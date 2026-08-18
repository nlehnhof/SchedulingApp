import { describe, expect, it } from 'vitest';
import { meetsMinNotice } from './min-notice';
import type { Rule } from './types';

const NOW = new Date('2026-08-17T12:00:00');

function noticeRule(hours: number): Rule {
  return {
    id: 'r1',
    calendar_id: 'c1',
    rule_type: 'min_notice',
    day_of_week: null,
    start_time: null,
    end_time: null,
    max_concurrent: null,
    config: { notice_hours: hours },
  };
}

describe('meetsMinNotice', () => {
  it('is always true with no min_notice rule', () => {
    expect(meetsMinNotice([], new Date('2026-08-17T12:30:00'), NOW)).toBe(true);
  });

  it('rejects a start time inside the notice window', () => {
    expect(meetsMinNotice([noticeRule(24)], new Date('2026-08-17T18:00:00'), NOW)).toBe(false);
  });

  it('accepts a start time outside the notice window', () => {
    expect(meetsMinNotice([noticeRule(24)], new Date('2026-08-19T12:00:00'), NOW)).toBe(true);
  });

  it('treats the exact cutoff as satisfying notice', () => {
    expect(meetsMinNotice([noticeRule(24)], new Date('2026-08-18T12:00:00'), NOW)).toBe(true);
  });
});
