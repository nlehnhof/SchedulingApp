import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.fn(async (_args: unknown) => {});
const exportedRows: { calendar_id: string; month: string }[] = [];

// Minimal in-memory supabase: calendars c1,c2; csv_exports is the idempotency record.
vi.mock('./email', () => ({ sendEmail: (a: unknown) => sendEmail(a) }));
vi.mock('./supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'booking_calendars') {
        return {
          select: (cols: string) => {
            if (cols.includes('display_name')) {
              return {
                eq: (_: string, id: string) => ({
                  single: async () => ({
                    data: { id, display_name: null, clients: { email: 'o@x.com' } },
                  }),
                }),
              };
            }
            return Promise.resolve({ data: [{ id: 'c1' }, { id: 'c2' }] });
          },
        };
      }
      if (table === 'appointments') {
        const q: any = { select: () => q, eq: () => q, gte: () => q, lt: async () => ({ data: [] }) };
        return q;
      }
      // csv_exports
      return {
        select: () => ({
          eq: (_: string, month: string) =>
            Promise.resolve({ data: exportedRows.filter((r) => r.month === month) }),
        }),
        upsert: async (row: any) => {
          exportedRows.push(row);
          return {};
        },
      };
    },
  }),
}));

import { exportMonthlyCSVForAllClients } from './csv-export';

beforeEach(() => {
  sendEmail.mockClear();
  exportedRows.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('exportMonthlyCSVForAllClients idempotency', () => {
  it('running the export window twice for the same month sends once per calendar', async () => {
    expect(await exportMonthlyCSVForAllClients('2026-02')).toEqual({ exported: 2, skipped: 0 });
    expect(await exportMonthlyCSVForAllClients('2026-02')).toEqual({ exported: 0, skipped: 2 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('one calendar failing does not stop the rest, and is retried next tick', async () => {
    sendEmail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(exportMonthlyCSVForAllClients('2026-02')).rejects.toThrow('smtp down');
    expect(exportedRows.map((r) => r.calendar_id)).toEqual(['c2']);
    expect(await exportMonthlyCSVForAllClients('2026-02')).toEqual({ exported: 1, skipped: 1 });
  });
});
