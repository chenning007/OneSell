# OneSell Scout — Test Suite

This directory contains all test plans, test execution records, and test fixtures for OneSell Scout.

## Structure

```
tests/
├── fixtures/
│   └── extraction/          # DOM fixture snapshots per platform (created by Tester)
├── unit/                    # Unit tests — tool functions, extraction scripts, utilities
├── integration/             # Integration tests — API endpoints, agent pipeline, IPC
├── security/                # Security tests — credential handling, auth, injection
├── e2e/                     # End-to-end Playwright tests — full user flows
└── TEST-STRATEGY.md         # Master test strategy (created in issue #8)
```

## Conventions

- Every test file mirrors the source file it tests: `src/services/agent/tools/calc-margin.ts` → `tests/unit/tools/calc-margin.test.ts`
- Fixture snapshots live under `tests/fixtures/extraction/[platform-id]/[page-type]-v[version].html`
- Market-specific fixtures are namespaced: `tests/fixtures/markets/[market-id]/`
- Security tests in `tests/security/` must all pass with zero tolerance — any failure is a P0 blocker

## Running Tests

```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# Security tests
pnpm test:security

# All tests
pnpm test
```

> Test commands will be available once the client and backend packages are bootstrapped in M1.
