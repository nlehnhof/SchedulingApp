import type { Rule } from './types';

/**
 * True when `start` is far enough in the future to satisfy a calendar's
 * `min_notice` rule (no such rule = always true). Shared by the
 * visitor-facing manage routes' cancel/reschedule gate (L7 launch phase,
 * app/api/manage/[token]/*) — reuses the exact rule lib/availability.ts
 * already reads for slot generation rather than inventing a second notion
 * of "too last-minute."
 */
export function meetsMinNotice(rules: Rule[], start: Date, now: Date = new Date()): boolean {
  const rule = rules.find((r) => r.rule_type === 'min_notice');
  const hours =
    rule?.config && typeof rule.config.notice_hours === 'number' ? (rule.config.notice_hours as number) : null;
  if (hours === null) return true;
  const cutoff = new Date(now.getTime() + hours * 3600 * 1000);
  return start >= cutoff;
}
