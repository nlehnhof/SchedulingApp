import { describe, expect, it } from 'vitest';
import { dueJobs } from './cron-schedule';

const at = (iso: string) => dueJobs(new Date(iso));

describe('dueJobs', () => {
  it('normal tick runs only google-sync', () => {
    expect(at('2026-03-14T10:00:00Z')).toEqual(['google-sync']);
    expect(at('2026-03-14T10:30:00Z')).toEqual(['google-sync']);
  });

  it('cleanup runs in the 03:00-03:29 UTC window only', () => {
    expect(at('2026-03-14T02:59:59Z')).toEqual(['google-sync']);
    expect(at('2026-03-14T03:00:00Z')).toEqual(['google-sync', 'cleanup']);
    expect(at('2026-03-14T03:29:59Z')).toEqual(['google-sync', 'cleanup']);
    expect(at('2026-03-14T03:30:00Z')).toEqual(['google-sync']);
  });

  it('export-monthly runs on the 1st from the window onward, including catch-up ticks', () => {
    expect(at('2026-03-01T02:30:00Z')).toEqual(['google-sync']);
    expect(at('2026-03-01T03:00:00Z')).toEqual(['google-sync', 'cleanup', 'export-monthly']);
    expect(at('2026-03-01T03:30:00Z')).toEqual(['google-sync', 'export-monthly']);
    expect(at('2026-03-01T23:30:00Z')).toEqual(['google-sync', 'export-monthly']);
    expect(at('2026-03-02T03:00:00Z')).toEqual(['google-sync', 'cleanup']);
  });

  it('handles month rollover and leap day in UTC', () => {
    expect(at('2026-01-31T23:30:00Z')).toEqual(['google-sync']);
    expect(at('2026-02-01T03:00:00Z')).toContain('export-monthly');
    expect(at('2028-02-29T03:00:00Z')).toEqual(['google-sync', 'cleanup']);
    expect(at('2028-03-01T03:00:00Z')).toContain('export-monthly');
    expect(at('2027-02-28T03:00:00Z')).not.toContain('export-monthly');
  });
});
