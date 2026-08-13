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
