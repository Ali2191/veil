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

  // "Natural names" mode: stand-in names ("Junaid Mirza") are restored like placeholders.
  // list: [{ text, value, key }] — full names first, then single parts ("Junaid" → "Hamza").
  let ALIASES = [], aliasRe = null, aliasTest = null, aliasMap = new Map();
  const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function buildAliases(list) {
    const items = (list || []).filter((a) => a && a.text && a.value);
    const map = new Map();
    for (const a of items) if (!map.has(a.text.toLowerCase())) map.set(a.text.toLowerCase(), a);
    const texts = [...map.keys()].sort((x, y) => y.length - x.length);
    const body = texts.map(escRe).join('|');
    return {
      list: items, map,
      re: texts.length ? new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(?:${body})(?![\\p{L}\\p{M}\\p{N}_])`, 'giu') : null,
      test: texts.length ? new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(?:${body})(?![\\p{L}\\p{M}\\p{N}_])`, 'iu') : null,
    };
  }
  function setAliases(list) { const b = buildAliases(list); ALIASES = b.list; aliasRe = b.re; aliasTest = b.test; aliasMap = b.map; }

  // `lookup(canonicalToken)` → original value or undefined, e.g. lookup('PERSON_1').
  // `aliases` (optional) overrides the list set with setAliases().
  // `mapValue` (optional) is applied to stand-in-name values, e.g. HTML-escaping when restoring markup.
  function restore(text, lookup, aliases, mapValue) {
    const AL = aliases ? buildAliases(aliases) : { re: aliasRe, test: aliasTest, map: aliasMap };
    if (!text || (!QUICK.test(text) && !(AL.test && AL.test.test(text)))) return { text, parts: null, count: 0 };
    // 1. collect placeholder matches and stand-in-name matches, 2. drop overlaps, 3. build the output
    const hits = [];
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
      hits.push({ from: m.index, to: m.index + m[0].length, key, value });
    }
    if (AL.re) {
      AL.re.lastIndex = 0;
      while ((m = AL.re.exec(text)) !== null) {
        const a = AL.map.get(m[0].toLowerCase());
        if (!a) continue;
        if (hits.some((h) => m.index < h.to && m.index + m[0].length > h.from)) continue;
        hits.push({ from: m.index, to: m.index + m[0].length, key: a.key || 'PERSON_0', value: mapValue ? mapValue(a.value) : a.value });
      }
    }
    hits.sort((x, y) => x.from - y.from);
    const parts = [];
    let out = '', cursor = 0, count = 0;
    for (const h of hits) {
      out += text.slice(cursor, h.from);
      // start/end: position in the restored text; from/to: position of the placeholder in the input.
      parts.push({ start: out.length, end: out.length + h.value.length, from: h.from, to: h.to, token: `[${h.key}]`, key: h.key });
      out += h.value;
      cursor = h.to;
      count++;
    }
    if (!count) return { text, parts: null, count: 0 };
    out += text.slice(cursor);
    return { text: out, parts, count };
  }

  const mightContainToken = (text) => !!text && (QUICK.test(text) || !!(aliasTest && aliasTest.test(text)));

  const api = { substitute, restore, mightContainToken, setAliases };
  root.VeilTokens = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
