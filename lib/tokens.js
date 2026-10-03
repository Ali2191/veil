/* VEIL — placeholder substitution and restoration. Pure functions, no storage. */
(function (root) {
  'use strict';
  const T = root.VeilTypes || require('./types.js');

  // Replace detected spans with placeholders.
  // `tokenFor(span)` returns a placeholder string, or null to leave the span as is.
  function substitute(text, spans, tokenFor) {
    let out = '', cursor = 0;
    const items = [];
    for (const sp of spans) {
      const tok = tokenFor(sp);
      if (!tok) continue;
      out += text.slice(cursor, sp.start);
      items.push({ ...sp, token: tok, outStart: out.length, outEnd: out.length + tok.length });
      out += tok;
      cursor = sp.end;
    }
    out += text.slice(cursor);
    return { text: out, items };
  }

  // Models occasionally reformat placeholders. Accept:
  //   [PERSON_1]  [ person-1 ]  PERSON_1  Person-1  PERSON\_1   and, uppercase only, PERSON 1
  const typeAlt = T.TYPE_KEYS.map((k) => k.replace(/_/g, '(?:\\\\?_|[ -])')).join('|');
  const SEP = '(?:\\\\?_|[ -])';
  const RESTORE_RE = new RegExp(
    `\\\\?\\[\\s*(${typeAlt})${SEP}?(\\d{1,5})\\s*\\\\?\\]` +      // bracketed
    `|(?<![\\p{L}\\p{N}_])(${typeAlt})(\\\\?_|-)(\\d{1,5})(?![\\p{L}\\p{N}_])` + // PERSON_1 / Person-1
    `|(?<![\\p{L}\\p{N}_])(${typeAlt}) (\\d{1,5})(?![\\p{L}\\p{N}_])`,  // PERSON 1 (uppercase only)
    'giu'
  );
  // Cheap pre-check before running the full pattern.
  const QUICK = new RegExp(`(?:${typeAlt})${SEP}?\\d`, 'i');

  const canon = (t) => t.toUpperCase().replace(/\\?_|[ -]/g, '_');

  // `lookup(canonicalToken)` → original value or undefined, e.g. lookup('PERSON_1').
  function restore(text, lookup) {
    if (!text || !QUICK.test(text)) return { text, parts: null, count: 0 };
    const parts = [];
    let out = '', cursor = 0, count = 0;
    RESTORE_RE.lastIndex = 0;
    let m;
    while ((m = RESTORE_RE.exec(text)) !== null) {
      let type, n;
      if (m[1] !== undefined) { type = m[1]; n = m[2]; }
      else if (m[3] !== undefined) { type = m[3]; n = m[5]; }
      else {
        if (m[6] !== m[6].toUpperCase()) continue;
        type = m[6]; n = m[7];
      }
      const key = `${canon(type)}_${Number(n)}`;
      const value = lookup(key);
      if (value === undefined) continue;
      out += text.slice(cursor, m.index);
      // start/end: position in the restored text; from/to: position of the placeholder in the input.
      parts.push({ start: out.length, end: out.length + value.length, from: m.index, to: m.index + m[0].length, token: `[${key}]`, key });
      out += value;
      cursor = m.index + m[0].length;
      count++;
    }
    if (!count) return { text, parts: null, count: 0 };
    out += text.slice(cursor);
    return { text: out, parts, count };
  }

  const mightContainToken = (text) => !!text && QUICK.test(text);

  const api = { substitute, restore, mightContainToken };
  root.VeilTokens = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
