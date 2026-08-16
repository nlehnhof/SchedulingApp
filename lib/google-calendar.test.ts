import { describe, expect, it } from 'vitest';
import { stripTimeZoneOffset } from './google-calendar';

describe('stripTimeZoneOffset', () => {
  it('strips a negative UTC offset', () => {
    expect(stripTimeZoneOffset('2026-08-17T12:00:00-06:00')).toBe('2026-08-17T12:00:00');
  });

  it('strips a positive UTC offset', () => {
    expect(stripTimeZoneOffset('2026-08-17T12:00:00+05:30')).toBe('2026-08-17T12:00:00');
  });

  it('strips a trailing Z (UTC)', () => {
    expect(stripTimeZoneOffset('2026-08-17T12:00:00Z')).toBe('2026-08-17T12:00:00');
  });

  it('leaves an already-naive datetime untouched', () => {
    expect(stripTimeZoneOffset('2026-08-17T12:00:00')).toBe('2026-08-17T12:00:00');
  });
});
