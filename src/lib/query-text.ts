/**
 * Helpers for reasoning about query text without a parser. Hints and the
 * FROM-prepend check look for keywords and old syntax in the query; matching
 * inside string, backtick, or regex literals gives false positives.
 */

/**
 * Blank out string ("..." '...'), backtick-quoted, and /regex/ literals,
 * keeping their delimiters so positions and surrounding syntax survive.
 *
 * A `/` opens a regex only where an operand is expected (at the start, or
 * after an operator, comma, or opening bracket), so division is left alone.
 */
export function stripLiterals(query: string): string {
  let out = '';
  let i = 0;
  while (i < query.length) {
    const c = query[i];
    const prev = out.replace(/\s+$/, '').slice(-1);
    const isRegex = c === '/' && (prev === '' || /[(,=~!|&:[{]/.test(prev));
    if (c === '"' || c === "'" || c === '`' || isRegex) {
      let j = i + 1;
      while (j < query.length && query[j] !== c) {
        if (query[j] === '\\') j++;
        j++;
      }
      out += c + ' '.repeat(Math.max(0, Math.min(j, query.length) - i - 1)) + (j < query.length ? c : '');
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Remove parenthesized groups (subqueries, call arguments), innermost first. */
export function stripParens(text: string): string {
  let prev: string;
  do {
    prev = text;
    text = text.replace(/\([^()]*\)/g, '()');
  } while (text !== prev);
  return text;
}

/**
 * True if the query reads its own input with a top-level FROM: a pipeline
 * that starts with (or pipes into) `from`, or a SQL SELECT ... FROM. A `from`
 * inside a string, a subquery, or used as a field name does not count.
 */
export function hasTopLevelFrom(query: string): boolean {
  const text = stripParens(stripLiterals(query));
  return /(^|\|>?|;)\s*from\b(?!\s*:)/i.test(text) || /\bselect\b[\s\S]*\bfrom\b(?!\s*:)/i.test(text);
}
