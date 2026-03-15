// Global test setup — runs before every test file
// Set test environment vars so env.ts validation passes
process.env.DATABASE_URL = 'postgresql://onesell:onesell_test_pw@localhost:5432/onesell_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_PRIVATE_KEY = 'test-private-key-placeholder';
process.env.JWT_PUBLIC_KEY = 'test-public-key-placeholder';
process.env.OPENAI_API_KEY = 'sk-test-placeholder';
process.env.NODE_ENV = 'test';
