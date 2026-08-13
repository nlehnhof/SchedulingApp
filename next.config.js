/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output: bundles just the files needed to run `node server.js` into
  // .next/standalone, so the Docker runner stage doesn't need node_modules copied in.
  output: 'standalone',
};

module.exports = nextConfig;
