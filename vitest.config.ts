import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Default `npm test` run: pure-function tests only, no DB required. The
// real-Postgres concurrency suite lives in tests/integration/ and needs a
// running local Supabase stack — it's excluded here and run separately via
// `npm run test:integration` (see vitest.integration.config.ts) so a plain
// `npm test` never silently hangs/fails for a contributor without Docker.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    exclude: ['**/node_modules/**', 'tests/integration/**', '.claude/**'],
  },
});
