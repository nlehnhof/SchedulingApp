import * as Sentry from '@sentry/nextjs';

// L8 launch phase. This app has no edge-runtime routes today (every API
// route that needs it sets `runtime = 'nodejs'` explicitly, e.g.
// app/api/health/route.ts and app/api/stripe/webhook/route.ts) — this file
// exists so the SDK's instrumentation hook has something to import if that
// ever changes, per the standard @sentry/nextjs project layout.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
