/**
 * BackendClient — HTTP client for the main Electron process.
 *
 * Communicates with the OneSell backend API for auth and analysis.
 * P1: Never logs tokens, credentials, or Authorization headers.
 *
 * Closes #138
 */

import { z } from 'zod';

// ── Response schemas (P9: validate at the boundary) ─────────────────

const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

const submitResponseSchema = z.object({
  analysisId: z.string().min(1),
  status: z.string(),
});

const statusResponseSchema = z.object({
  analysisId: z.string(),
  status: z.string(),
  message: z.string().optional(),
});

// Results can be complex — validate top-level shape only
const resultsResponseSchema = z.object({
  analysisId: z.string(),
  results: z.unknown(),
});

// ── Types ───────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SubmitAnalysisResponse {
  analysisId: string;
  status: string;
}

export interface AnalysisStatusResponse {
  analysisId: string;
  status: string;
  message?: string;
}

export interface AnalysisResultsResponse {
  analysisId: string;
  results: unknown;
}

export interface BackendClientOptions {
  baseUrl: string;
  /** Injected fetch function — defaults to global fetch. */
  fetchFn?: typeof fetch;
}

// ── Error class ─────────────────────────────────────────────────────

export class BackendApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: unknown,
  ) {
    super(`Backend API error: ${statusCode}`);
    this.name = 'BackendApiError';
  }
}

// ── Retry config ────────────────────────────────────────────────────

const MAX_5XX_RETRIES = 3;
const BACKOFF_BASE_MS = 300;

// ── Client ──────────────────────────────────────────────────────────

export class BackendClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(opts: BackendClientOptions) {
    // Strip trailing slash
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchFn = opts.fetchFn ?? globalThis.fetch;
  }

  // ── Token management ────────────────────────────────────────────

  setTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshTokenValue = tokens.refreshToken;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshTokenValue = null;
  }

  hasTokens(): boolean {
    return this.accessToken !== null && this.refreshTokenValue !== null;
  }

  // ── Auth endpoints ──────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthTokens> {
    const res = await this.post('/auth/login', { email, password }, false);
    const tokens = authResponseSchema.parse(res);
    this.setTokens(tokens);
    return tokens;
  }

  async register(email: string, password: string): Promise<AuthTokens> {
    const res = await this.post('/auth/register', { email, password }, false);
    const tokens = authResponseSchema.parse(res);
    this.setTokens(tokens);
    return tokens;
  }

  async refreshToken(): Promise<void> {
    if (!this.refreshTokenValue) {
      throw new Error('No refresh token available');
    }

    const res = await this.post(
      '/auth/refresh',
      { refreshToken: this.refreshTokenValue },
      false,
    );
    const tokens = authResponseSchema.parse(res);
    this.setTokens(tokens);
  }

  // ── Analysis endpoints ──────────────────────────────────────────

  async submitAnalysis(data: {
    extractionData: unknown[];
    preferences: unknown;
    marketId: string;
  }): Promise<SubmitAnalysisResponse> {
    const res = await this.post('/analysis', data, true);
    return submitResponseSchema.parse(res);
  }

  async getAnalysisStatus(analysisId: string): Promise<AnalysisStatusResponse> {
    const res = await this.get(`/analysis/${encodeURIComponent(analysisId)}/status`);
    return statusResponseSchema.parse(res);
  }

  async getAnalysisResults(analysisId: string): Promise<AnalysisResultsResponse> {
    const res = await this.get(`/analysis/${encodeURIComponent(analysisId)}/results`);
    return resultsResponseSchema.parse(res);
  }

  // ── Internal HTTP helpers ───────────────────────────────────────

  private async get(path: string): Promise<unknown> {
    return this.request('GET', path, undefined, true);
  }

  private async post(path: string, body: unknown, auth: boolean): Promise<unknown> {
    return this.request('POST', path, body, auth);
  }

  private async request(
    method: string,
    path: string,
    body: unknown | undefined,
    auth: boolean,
  ): Promise<unknown> {
    const doRequest = async (): Promise<Response> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (auth && this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      return this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    };

    let response = await this.executeWithRetry(doRequest);

    // Auto-refresh on 401 (one attempt)
    if (response.status === 401 && auth && this.refreshTokenValue) {
      await this.ensureTokenRefreshed();
      response = await doRequest();
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let parsed: unknown;
      try {
        parsed = JSON.parse(errorBody);
      } catch {
        parsed = errorBody;
      }
      throw new BackendApiError(response.status, parsed);
    }

    return response.json();
  }

  /**
   * Execute a request with retry logic for 5xx errors.
   * Retries up to MAX_5XX_RETRIES times with exponential backoff.
   */
  private async executeWithRetry(
    doRequest: () => Promise<Response>,
  ): Promise<Response> {
    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt <= MAX_5XX_RETRIES; attempt++) {
      lastResponse = await doRequest();

      if (lastResponse.status < 500 || attempt === MAX_5XX_RETRIES) {
        return lastResponse;
      }

      // Exponential backoff before retry
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
      await BackendClient.sleep(delay);
    }

    // Unreachable, but TypeScript needs it
    return lastResponse!;
  }

  /**
   * Ensures only one token refresh happens at a time (dedup concurrent 401s).
   */
  private async ensureTokenRefreshed(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshToken().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  /** Exposed as static for test mocking. */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
