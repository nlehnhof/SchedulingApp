// Next.js's instrumentation hook (requires experimental.instrumentationHook
// in next.config.js on this Next 14.x — stable by default starting Next 15)
// — the standard @sentry/nextjs entry point for the server/edge configs,
// since Sentry's own webpack plugin only auto-injects the client config.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
