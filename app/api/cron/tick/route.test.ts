import { beforeEach, describe, expect, it, vi } from 'vitest';

const due = vi.fn();
const sync = vi.fn();
const cleanup = vi.fn();
const exp = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/cron-schedule', () => ({ dueJobs: (d: Date) => due(d) }));
vi.mock('@/lib/cron-jobs', () => ({
  runGoogleSync: () => sync(),
  runCleanup: () => cleanup(),
  runExportMonthly: (d: Date) => exp(d),
}));

import { POST } from './route';

const req = (secret?: string) =>
  new Request('http://x/api/cron/tick', {
    method: 'POST',
    headers: secret ? { 'x-cron-secret': secret } : {},
  });

beforeEach(() => {
  process.env.CRON_SECRET = 's3cret';
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/cron/tick', () => {
  it('rejects missing and wrong secrets without running anything', async () => {
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req('nope'))).status).toBe(401);
    expect(sync).not.toHaveBeenCalled();
  });

  it('runs only due jobs', async () => {
    due.mockReturnValue(['google-sync']);
    sync.mockResolvedValue({ ok: 1 });
    const body = await (await POST(req('s3cret'))).json();
    expect(body.results).toMatchObject([{ job: 'google-sync', ok: true }]);
    expect(cleanup).not.toHaveBeenCalled();
    expect(exp).not.toHaveBeenCalled();
  });

  it('one failing job does not stop the others', async () => {
    due.mockReturnValue(['google-sync', 'cleanup', 'export-monthly']);
    sync.mockRejectedValue(new Error('boom'));
    cleanup.mockResolvedValue({});
    exp.mockResolvedValue({});
    const res = await POST(req('s3cret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: any) => [r.job, r.ok])).toEqual([
      ['google-sync', false],
      ['cleanup', true],
      ['export-monthly', true],
    ]);
  });
});
