import { describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

// Free-tier owner on every calendar; no DB is ever reached on the 403 path.
vi.mock('@/lib/require-client', () => ({
  requireClient: async () => ({ clientId: 'c1', collaboratorCalendars: [] }),
}));
vi.mock('@/lib/require-calendar', () => ({
  requireCalendarAccess: async (id: string) => ({ calendarId: id, role: 'owner' }),
  requireWriteRole: () => null,
  calendarOwnerTier: async () => 'free',
}));
vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => {
    throw new Error('DB must not be reached');
  },
}));
vi.mock('@/lib/google-calendar', () => ({ listGoogleCalendars: async () => [] }));

import { GET } from './route';
import { PATCH } from '../calendar/route';

describe('free-tier marketing opt-in gate', () => {
  it('export returns 403', async () => {
    const res = (await GET(new Request('http://x/api?calendarId=cal1'))) as NextResponse;
    expect(res.status).toBe(403);
  });

  it('PATCH enabling the opt-in returns 403', async () => {
    const res = await PATCH(
      new Request('http://x/api?calendarId=cal1', {
        method: 'PATCH',
        body: JSON.stringify({ collectMarketingOptin: true }),
      })
    );
    expect(res.status).toBe(403);
  });
});
