'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Required by @sentry/nextjs for the App Router (L8 launch phase) — without
// this file, a React render error that reaches the root boundary never gets
// reported, since Next's own root-layout error handling short-circuits
// before the SDK's automatic instrumentation sees it. Replaces the entire
// document (its own <html>/<body>) only in the rare case this actually
// renders, so it doesn't need the real layout's fonts/design tokens.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: '#0D0F17', color: '#F5F5F5', fontFamily: 'sans-serif', padding: '2rem' }}>
        <h1>Something went wrong</h1>
        <p>Please refresh the page. If this keeps happening, email support@gathertime.com.</p>
      </body>
    </html>
  );
}
