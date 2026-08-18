import { describe, expect, it, beforeEach } from 'vitest';
import { createAppointmentToken, verifyAppointmentToken } from './appointment-token';

describe('appointment-token', () => {
  beforeEach(() => {
    process.env.APPOINTMENT_TOKEN_SECRET = 'test-secret-value';
  });

  it('round-trips a genuine token back to its appointment id', () => {
    const token = createAppointmentToken('11111111-1111-1111-1111-111111111111');
    expect(verifyAppointmentToken(token)).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('rejects a tampered signature', () => {
    const token = createAppointmentToken('11111111-1111-1111-1111-111111111111');
    const [id] = token.split('.');
    expect(verifyAppointmentToken(`${id}.deadbeef`)).toBeNull();
  });

  it('rejects a token for a different appointment id than it was signed for', () => {
    const token = createAppointmentToken('11111111-1111-1111-1111-111111111111');
    const [, signature] = token.split('.');
    expect(verifyAppointmentToken(`22222222-2222-2222-2222-222222222222.${signature}`)).toBeNull();
  });

  it('rejects a malformed token', () => {
    expect(verifyAppointmentToken('not-a-token')).toBeNull();
    expect(verifyAppointmentToken('')).toBeNull();
  });
});
