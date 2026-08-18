const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output: bundles just the files needed to run `node server.js` into
  // .next/standalone, so the Docker runner stage doesn't need node_modules copied in.
  output: 'standalone',
  // instrumentation.ts (L8 launch phase, Sentry) — stable by default on
  // Next 15+, still behind this flag on the 14.x line this app is pinned to.
  experimental: {
    instrumentationHook: true,
  },
};

// Wraps the build with Sentry's webpack plugin (source maps, release
// tagging) — a no-op at runtime when SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN are
// unset, same as the SDK's own Sentry.init calls. silent: true keeps a
// DSN-less local/CI build from printing "Sentry CLI not configured" noise.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  treeshake: { removeDebugLogging: true },
});
