# API Contract: OneSell Scout Client ↔ Backend

**Version**: 1.0.0  
**Status**: Accepted  
**Date**: 2026-03-15  
**Author**: Architect  
**Linked Issue**: #4  
**Depends on**: ADR-001 (Issue #3)

---

## Base URL

```
https://api.onesell.app/api/v1
```

Versioning is path-based. When breaking changes are introduced, a new prefix (`/api/v2`) is added while the old version is kept for one minor release.

---

## Authentication

All endpoints require a valid JWT in the `Authorization` header.

```
Authorization: Bearer <access_token>
```

### JWT Properties

| Property | Value |
|---|---|
| Algorithm | RS256 |
| Access token TTL | 15 minutes |
| Refresh token TTL | 7 days |
| Issuer | `auth.onesell.app` |
| Audience | `api.onesell.app` |

### Token Claims (Access Token)

```json
{
  "sub": "user_01HXXXXXXXXXXXXXXXX",
  "email": "user@example.com",
  "plan": "free" | "pro",
  "iss": "auth.onesell.app",
  "aud": "api.onesell.app",
  "iat": 1700000000,
  "exp": 1700000900
}
```

### Token Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Exchange email + password for token pair |
| `POST` | `/auth/refresh` | Exchange refresh token for new access token |
| `POST` | `/auth/logout` | Revoke refresh token |

---

## Endpoints

### 1. Submit Analysis

Accepts a structured market dataset and triggers an asynchronous agent analysis session.

```
POST /api/v1/analysis
Content-Type: application/json
Authorization: Bearer <access_token>
```

#### Request Body — `AnalysisPayload`

```json
{
  "schemaVersion": "string (semver, e.g. \"1.0.0\")",
  "context": {
    "market": "us | cn | sea | uk | de | jp | au",
    "platforms": ["amazon" | "shopee" | "lazada" | "tiktokshop" | "taobao" |
                  "tmall" | "jd" | "ebay" | "rakuten"],
    "keyword": "string (1–200 chars, the product keyword searched by user)",
    "budget": {
      "amount": "number (positive, user's sourcing budget)",
      "currency": "string (ISO 4217, e.g. 'USD', 'CNY', 'SGD')"
    },
    "sellerProfile": {
      "experience": "none | some | experienced",
      "riskTolerance": "low | medium | high",
      "fulfillmentPreference": "fba | fbm | dropship | any"
    }
  },
  "extractedData": [
    {
      "platform": "string (platform identifier, must match platforms[])",
      "extractedAt": "string (ISO 8601 timestamp)",
      "scriptVersion": "string (semver of the extraction script used)",
      "products": [
        {
          "id": "string (platform-native product/listing ID)",
          "title": "string",
          "price": "number (platform currency, positive)",
          "currency": "string (ISO 4217)",
          "sales30d": "number | null (units sold in last 30 days)",
          "reviewCount": "number | null",
          "reviewRating": "number | null (0.0–5.0)",
          "category": "string | null",
          "subcategory": "string | null",
          "sellerType": "brand | reseller | factory | unknown",
          "listingAge": "number | null (days since first listed)",
          "imageUrl": "string | null (HTTPS URL — used by renderer only, not sent to LLM)",
          "productUrl": "string | null (HTTPS URL — stored for reference, not sent to LLM)",
          "extraFields": "object (platform-specific additional metadata, schema open)"
        }
      ],
      "categoryStats": {
        "topKeywords": "string[] (up to 10)",
        "avgPrice": "number | null",
        "avgSales30d": "number | null",
        "totalListings": "number | null"
      },
      "extractionErrors": [
        {
          "page": "string (URL or logical page name)",
          "error": "string (error message)",
          "recoverable": "boolean"
        }
      ]
    }
  ]
}
```

#### JSON Schema (Zod-equivalent constraints)

| Field | Type | Required | Constraints |
|---|---|---|---|
| `schemaVersion` | string | ✅ | semver format |
| `context.market` | enum | ✅ | one of 7 market codes |
| `context.platforms` | string[] | ✅ | 1–10 items; each must be a known platform |
| `context.keyword` | string | ✅ | 1–200 chars; no HTML |
| `context.budget.amount` | number | ✅ | > 0 |
| `context.budget.currency` | string | ✅ | 3-char ISO 4217 |
| `context.sellerProfile.experience` | enum | ✅ | none/some/experienced |
| `context.sellerProfile.riskTolerance` | enum | ✅ | low/medium/high |
| `context.sellerProfile.fulfillmentPreference` | enum | ✅ | fba/fbm/dropship/any |
| `extractedData` | array | ✅ | 1–10 items |
| `extractedData[].platform` | string | ✅ | must match a value in `context.platforms` |
| `extractedData[].extractedAt` | string | ✅ | ISO 8601 |
| `extractedData[].scriptVersion` | string | ✅ | semver |
| `extractedData[].products` | array | ✅ | 0–500 items |
| `extractedData[].products[].id` | string | ✅ | 1–200 chars |
| `extractedData[].products[].price` | number | ✅ | > 0 |
| `extractedData[].products[].reviewRating` | number | no | 0.0–5.0 if present |

**Max payload size**: 5 MB. Requests exceeding this are rejected with `HTTP 413`.

---

### 2. Get Analysis Status

Poll for the status and intermediate steps of an asynchronous analysis session.

```
GET /api/v1/analysis/:sessionId/status
Authorization: Bearer <access_token>
```

#### Response — `AnalysisStatus`

```json
{
  "sessionId": "string (ULID)",
  "status": "queued | running | complete | failed",
  "currentStep": "planning | executing | synthesizing | null",
  "completedSteps": ["string"],
  "estimatedSecondsRemaining": "number | null",
  "updatedAt": "string (ISO 8601)"
}
```

---

### 3. Get Analysis Results

Retrieve the completed ranked product recommendation cards.

```
GET /api/v1/analysis/:sessionId/results
Authorization: Bearer <access_token>
```

#### Response — `AnalysisResults`

```json
{
  "sessionId": "string (ULID)",
  "completedAt": "string (ISO 8601)",
  "market": "string (market code)",
  "keyword": "string",
  "cards": [
    {
      "rank": "number (1-based)",
      "productId": "string (platform-native ID)",
      "platform": "string",
      "title": "string",
      "price": "number",
      "currency": "string (ISO 4217)",
      "imageUrl": "string | null",
      "productUrl": "string | null",
      "scores": {
        "overall": "number (0–100)",
        "competition": "number (0–100)",
        "trend": "number (0–100)",
        "margin": "number (0–100)",
        "beginnerFriendly": "number (0–100)"
      },
      "estimatedMargin": {
        "low": "number (fraction, e.g. 0.12 = 12%)",
        "mid": "number",
        "high": "number"
      },
      "competitionLevel": "low | medium | high | very_high",
      "trendDirection": "rising | stable | declining",
      "beginnerRisks": ["string"],
      "agentRationale": "string (1–3 sentences explaining why this product was recommended)"
    }
  ],
  "agentSummary": "string (2–4 sentence plain-language overview of findings)",
  "disclaimers": ["string"]
}
```

---

### 4. Save Products from a Session

Save one or more product cards from a completed analysis session to the user's saved list.

```
POST /api/v1/saved-products
Content-Type: application/json
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "sessionId": "string (ULID)",
  "productIds": ["string"]
}
```

#### Response — `201 Created`

```json
{
  "saved": "number (count of newly saved products)"
}
```

---

### 5. Get Saved Products

```
GET /api/v1/saved-products
Authorization: Bearer <access_token>
```

#### Query Parameters

| Param | Type | Description |
|---|---|---|
| `market` | string | Filter by market code |
| `platform` | string | Filter by platform |
| `limit` | number | Max items to return (default 20, max 100) |
| `offset` | number | Pagination offset (default 0) |

#### Response — `200 OK`

```json
{
  "total": "number",
  "items": ["ProductCard[]  (same shape as analysis results cards)"]
}
```

---

## Error Response Format

All error responses follow this shape regardless of HTTP status code:

```json
{
  "error": "string (human-readable message)",
  "code": "string (machine-readable code, SCREAMING_SNAKE_CASE)",
  "requestId": "string (correlation ID — always log this for support)"
}
```

### Standard Error Codes

| HTTP Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body fails Zod schema validation |
| 401 | `UNAUTHORIZED` | Missing or expired JWT |
| 401 | `TOKEN_EXPIRED` | Access token expired (client should refresh) |
| 403 | `FORBIDDEN` | Token valid but user lacks permission (e.g. free plan limit) |
| 404 | `NOT_FOUND` | sessionId does not exist or was purged |
| 408 | `ANALYSIS_TIMEOUT` | Agent exceeded 120s limit (retryable) |
| 409 | `SESSION_IN_PROGRESS` | User already has an active analysis session |
| 413 | `PAYLOAD_TOO_LARGE` | Request body exceeds 5 MB |
| 422 | `SCHEMA_VERSION_UNSUPPORTED` | `schemaVersion` not supported by current backend |
| 429 | `RATE_LIMITED` | Requests per minute exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `LLM_UNAVAILABLE` | Upstream LLM provider error (retryable) |

#### Validation Error Response (extended)

When `code` is `VALIDATION_ERROR`, the response includes an `issues` array:

```json
{
  "error": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "requestId": "01HXXXXXXXXXXXXXXXX",
  "issues": [
    {
      "field": "string (dot-path to failing field, e.g. 'context.budget.amount')",
      "message": "string (Zod message)"
    }
  ]
}
```

---

## Rate Limiting

| Plan | Analysis sessions / hour | Saved products | Requests / minute |
|---|---|---|---|
| Free | 3 | 20 | 30 |
| Pro | 20 | 500 | 120 |

Rate limit headers are included on every response:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1700000060
```

---

## Request / Response Headers

### Request headers (required on all authenticated requests)

| Header | Description |
|---|---|
| `Authorization` | `Bearer <access_token>` |
| `Content-Type` | `application/json` (for POST/PATCH) |
| `X-Client-Version` | Electron app version (e.g. `1.0.0`) — used for compatibility checks |

### Response headers (always present)

| Header | Description |
|---|---|
| `X-Request-Id` | Correlation ID for this request (same as `requestId` in error bodies) |
| `X-API-Version` | Backend API version in use (e.g. `1.0.0`) |

---

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-03-15 | Initial contract — POST /analysis, GET /status, GET /results, saved-products CRUD |
