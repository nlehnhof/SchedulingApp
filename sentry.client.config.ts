import * as Sentry from '@sentry/nextjs';

// L8 launch phase. Free tier — low trace sample rate, no session replay (a
// privacy surface this app would have to disclose for no real benefit at
// this scale). Empty dsn (Sentry not configured yet) makes every call in
// this SDK a documented no-op, not a crash — see .env.example.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
