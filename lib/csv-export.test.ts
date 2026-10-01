import { describe, expect, it } from 'vitest';
import { csvEscape } from './csv-export';

describe('csvEscape', () => {
  it('leaves ordinary text untouched', () => {
    expect(csvEscape('Jane Doe')).toBe('Jane Doe');
  });

  it('quotes values containing commas, quotes, or newlines', () => {
    expect(csvEscape('Doe, Jane')).toBe('"Doe, Jane"');
    expect(csvEscape('5\'9" tall')).toBe('"5\'9"" tall"');
  });

  it('neutralizes formula-injection prefixes (=, +, -, @)', () => {
    // Contains quotes too, so it's also outer-quoted (with internal quotes doubled).
    expect(csvEscape('=HYPERLINK("http://evil.com","click")')).toBe(
      '"\'=HYPERLINK(""http://evil.com"",""click"")"'
    );
    expect(csvEscape('+1 555 123 4567')).toBe("'+1 555 123 4567");
    expect(csvEscape('-cmd|/c calc')).toBe("'-cmd|/c calc");
    expect(csvEscape('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
  });

  it('still quotes a formula-prefixed value that also has a comma', () => {
    expect(csvEscape('=1+1, oops')).toBe('"\'=1+1, oops"');
  });
});

import { buildContactsCsv } from './csv-export';

describe('buildContactsCsv', () => {
  it('dedupes by lowercased email keeping the earliest opt-in', () => {
    const csv = buildContactsCsv([
      { visitor_name: 'Jane', visitor_email: 'Jane@x.com', email_marketing_optin_at: '2026-02-01T00:00:00Z' },
      { visitor_name: 'Jane D', visitor_email: 'jane@x.com', email_marketing_optin_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(csv).toBe('name,email,opted_in_at\nJane D,jane@x.com,2026-01-01T00:00:00Z');
  });

  it('escapes names and skips rows with no email or opt-in date', () => {
    const csv = buildContactsCsv([
      { visitor_name: '=BAD, "x"', visitor_email: 'a@x.com', email_marketing_optin_at: '2026-01-01T00:00:00Z' },
      { visitor_name: 'No email', visitor_email: null, email_marketing_optin_at: '2026-01-01T00:00:00Z' },
      { visitor_name: 'Never', visitor_email: 'n@x.com', email_marketing_optin_at: null },
    ]);
    expect(csv).toBe('name,email,opted_in_at\n"\'=BAD, ""x""",a@x.com,2026-01-01T00:00:00Z');
  });
});
