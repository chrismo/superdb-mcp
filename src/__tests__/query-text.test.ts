import { describe, it, expect } from 'vitest';
import { stripLiterals, hasTopLevelFrom } from '../lib/query-text.js';

describe('stripLiterals', () => {
  it('blanks string, backtick, and regex literals', () => {
    expect(stripLiterals('where s=="a|[b" and t==\'x\' and `f-g`==1')).toBe('where s=="    " and t==\' \' and `   `==1');
    expect(stripLiterals('where grep(/error|[Ww]arn/, s)')).toBe('where grep(/             /, s)');
  });

  it('honors escaped quotes', () => {
    expect(stripLiterals('values "a\\"|[b" , 1')).toBe('values "      " , 1');
  });

  it('leaves division alone', () => {
    expect(stripLiterals('values a / 2 / b')).toBe('values a / 2 / b');
  });
});

describe('hasTopLevelFrom', () => {
  it.each([
    'from events',
    '  FROM "my-table" | count()',
    'where x | from other',
    'select a from t',
    "SELECT a FROM t WHERE s = 'b'",
  ])('finds a FROM in %s', query => {
    expect(hasTopLevelFrom(query)).toBe(true);
  });

  it.each([
    'where msg=="hello from x"',
    'cut from:=msg',
    'values {from: 1}',
    'values {n:(from other | count())}',
    'where s matches /from/',
    '',
  ])('finds no FROM in %s', query => {
    expect(hasTopLevelFrom(query)).toBe(false);
  });
});
