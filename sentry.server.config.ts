import * as Sentry from '@sentry/nextjs';

// L8 launch phase. `beforeSend` scrubs visitor PII before anything leaves
// the process — the app's own privacy policy (app/privacy/page.tsx) commits
// to Sentry never seeing a visitor's name, phone, or email, since the
// anonymous booking flow (app/api/visitor/*) is the one place this app
// collects that data from someone who never agreed to *this* app's own
// terms, only whatever the client told them. Request bodies are dropped
// outright for that whole route tree rather than field-by-field redacted,
// since new fields can be added there later without anyone remembering to
// update a scrub list.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    const url = event.request?.url ?? '';
    if (url.includes('/api/visitor/')) {
      delete event.request?.data;
    }
    for (const field of ['visitor_name', 'visitorName', 'visitor_phone', 'visitorPhone', 'visitor_email', 'visitorEmail', 'phone']) {
      if (event.extra && field in event.extra) delete event.extra[field];
      if (event.contexts) {
        for (const ctx of Object.values(event.contexts)) {
          if (ctx && typeof ctx === 'object' && field in ctx) delete (ctx as Record<string, unknown>)[field];
        }
      }
    }
    return event;
  },
});
