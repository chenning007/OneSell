import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackendClient, BackendApiError } from '../../src/main/backend-client.js';
import type { AuthTokens } from '../../src/main/backend-client.js';

// ── Helpers ─────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeClient(fetchFn: typeof fetch): BackendClient {
  return new BackendClient({ baseUrl: 'https://api.test.com', fetchFn });
}

const validTokens: AuthTokens = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
};

// Disable real delays in retry logic
beforeEach(() => {
  vi.spyOn(BackendClient, 'sleep').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Auth tests ──────────────────────────────────────────────────────

describe('BackendClient — auth', () => {
  it('login sends POST to /auth/login and stores tokens', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(200, validTokens),
    );
    const client = makeClient(mockFetch);

    const result = await client.login('user@test.com', 'password123');

    expect(result).toEqual(validTokens);
    expect(client.hasTokens()).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.test.com/auth/login');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init!.body as string)).toEqual({
      email: 'user@test.com',
      password: 'password123',
    });
    // P1: no Authorization header on login
    expect((init?.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('register sends POST to /auth/register and stores tokens', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(201, validTokens),
    );
    const client = makeClient(mockFetch);

    const result = await client.register('new@test.com', 'securepass');

    expect(result).toEqual(validTokens);
    expect(client.hasTokens()).toBe(true);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.test.com/auth/register');
  });

  it('refreshToken sends POST to /auth/refresh with current refresh token', async () => {
    const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(200, newTokens),
    );
    const client = makeClient(mockFetch);
    client.setTokens(validTokens);

    await client.refreshToken();

    expect(client.hasTokens()).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.refreshToken).toBe('refresh-xyz');
  });

  it('refreshToken throws if no refresh token is stored', async () => {
    const mockFetch = vi.fn<typeof fetch>();
    const client = makeClient(mockFetch);

    await expect(client.refreshToken()).rejects.toThrow('No refresh token available');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('clearTokens removes stored tokens', () => {
    const client = makeClient(vi.fn());
    client.setTokens(validTokens);
    expect(client.hasTokens()).toBe(true);
    client.clearTokens();
    expect(client.hasTokens()).toBe(false);
  });
});

// ── Authorization header ────────────────────────────────────────────

describe('BackendClient — auth header', () => {
  it('attaches Bearer token to authenticated requests', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(200, { analysisId: 'abc', status: 'pending', message: undefined }),
    );
    const client = makeClient(mockFetch);
    client.setTokens(validTokens);

    await client.getAnalysisStatus('00000000-0000-0000-0000-000000000001');

    const headers = mockFetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer access-abc');
  });

  it('does NOT attach auth header on login/register', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(200, validTokens),
    );
    const client = makeClient(mockFetch);

    await client.login('a@b.com', 'pass');

    const headers = mockFetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

// ── Auto-refresh on 401 ─────────────────────────────────────────────

describe('BackendClient — token auto-refresh', () => {
  it('retries once on 401 after refreshing the token', async () => {
    const newTokens = { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' };
    const mockFetch = vi.fn<typeof fetch>()
      // First call: status request → 401
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Token expired' }))
      // Second call: refresh → 200
      .mockResolvedValueOnce(jsonResponse(200, newTokens))
      // Third call: retry status → 200
      .mockResolvedValueOnce(
        jsonResponse(200, { analysisId: 'abc', status: 'complete' }),
      );

    const client = makeClient(mockFetch);
    client.setTokens(validTokens);

    const result = await client.getAnalysisStatus('00000000-0000-0000-0000-000000000001');

    expect(result.status).toBe('complete');
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // The retry should use the fresh token
    const retryHeaders = mockFetch.mock.calls[2]![1]!.headers as Record<string, string>;
    expect(retryHeaders['Authorization']).toBe('Bearer fresh-access');
  });

  it('throws BackendApiError if retry after refresh also fails', async () => {
    const newTokens = { accessToken: 'fresh', refreshToken: 'fresh-r' };
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(200, newTokens))
      .mockResolvedValueOnce(jsonResponse(403, { error: 'forbidden' }));

    const client = makeClient(mockFetch);
    client.setTokens(validTokens);

    await expect(
      client.getAnalysisStatus('00000000-0000-0000-0000-000000000001'),
    ).rejects.toThrow(BackendApiError);
  });
});

// ── 5xx retry with backoff ──────────────────────────────────────────

describe('BackendClient — 5xx retry', () => {
  it('retries up to 3 times on 5xx then returns success', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(503, { error: 'unavailable' }))
      .mockResolvedValueOnce(jsonResponse(500, { error: 'internal' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { analysisId: 'x', status: 'pending' }),
      );

    const client = makeClient(mockFetch);
    client.setTokens(validTokens);

    const result = await client.submitAnalysis({
      extractionData: [{ platformId: 'amazon-us', available: true }],
      preferences: {},
      marketId: 'us',
    });

    expect(result.analysisId).toBe('x');
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(BackendClient.sleep).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries exhausted on 5xx', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(500, { error: 'down' }));

    const client = makeClient(mockFetch);
    client.setTokens(validTokens);

    await expect(
      client.submitAnalysis({
        extractionData: [{ platformId: 'test', available: true }],
        preferences: {},
        marketId: 'us',
      }),
    ).rejects.toThrow(BackendApiError);

    // 1 initial + 3 retries = 4
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

// ── Analysis endpoints ──────────────────────────────────────────────

describe('BackendClient — analysis', () => {
  it('submitAnalysis sends POST to /analysis', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(202, { analysisId: 'new-id', status: 'pending' }),
    );
    const client = makeClient(mockFetch);
    client.setTokens(validTokens);

    const payload = {
      extractionData: [{ platformId: 'amazon-us', available: true }],
      preferences: { budget: 500 },
      marketId: 'us',
    };
    const result = await client.submitAnalysis(payload);

    expect(result).toEqual({ analysisId: 'new-id', status: 'pending' });
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.test.com/analysis');
    expect(init?.method).toBe('POST');
  });

  it('getAnalysisStatus calls GET /analysis/:id/status', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(200, { analysisId: 'abc', status: 'complete' }),
    );
    const client = makeClient(mockFetch);
    client.setTokens(validTokens);

    const result = await client.getAnalysisStatus('00000000-0000-0000-0000-000000000001');

    expect(result.status).toBe('complete');
    expect(mockFetch.mock.calls[0]![0]).toBe(
      'https://api.test.com/analysis/00000000-0000-0000-0000-000000000001/status',
    );
  });

  it('getAnalysisResults calls GET /analysis/:id/results', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(200, { analysisId: 'abc', results: [{ product: 'Widget' }] }),
    );
    const client = makeClient(mockFetch);
    client.setTokens(validTokens);

    const result = await client.getAnalysisResults('00000000-0000-0000-0000-000000000001');

    expect(result.results).toEqual([{ product: 'Widget' }]);
  });

  it('throws BackendApiError on 4xx', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(400, { error: 'Validation failed' }),
    );
    const client = makeClient(mockFetch);

    await expect(
      client.login('bad', 'bad'),
    ).rejects.toThrow(BackendApiError);
  });
});

// ── P1: credential safety ───────────────────────────────────────────

describe('BackendClient — P1 security', () => {
  it('does not expose tokens via any public getter', () => {
    const client = makeClient(vi.fn());
    client.setTokens(validTokens);

    // The class should not have token getters
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(client));
    const publicMethods = proto.filter(
      (n) => !n.startsWith('_') && n !== 'constructor',
    );

    // Verify no method names suggesting token leakage
    expect(publicMethods).not.toContain('getAccessToken');
    expect(publicMethods).not.toContain('getRefreshToken');
    expect(publicMethods).not.toContain('getTokens');
  });

  it('strips trailing slashes from baseUrl', () => {
    const client = new BackendClient({
      baseUrl: 'https://api.test.com///',
      fetchFn: vi.fn(),
    });
    // Verify via a login call
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(200, validTokens),
    );
    // Re-create with the mock
    const c2 = new BackendClient({ baseUrl: 'https://api.test.com///', fetchFn: mockFetch });
    void c2.login('a@b.com', 'p');
    // URL should not have trailing slashes doubled
    expect(mockFetch.mock.calls[0]![0]).toBe('https://api.test.com/auth/login');
  });
});
