import { defineConfig } from 'vitest/config';

// `npm run test:integration` — real-Postgres tests against a local Supabase
// CLI stack (see tests/integration/booking-concurrency.test.ts's header
// comment for setup). Deliberately a separate config/script from the
// default `npm test`, not just a filtered path, so this suite's
// requirements (Docker, a running local stack, .env.test.local) never leak
// into the default test run.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 20000,
  },
});
