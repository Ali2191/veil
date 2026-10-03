/* VEIL — name and place dictionaries (built by tools/build-dictionaries.py from Wikidata and
   GeoNames). Loaded once per context; lookups are Set.has() on lowercase words. */
(function (root) {
  'use strict';
  const N = root.VeilNames || (typeof require === 'function' ? require('./names.js') : null);
  const FILES = ['given', 'family', 'places'];

  // raw: { given: "a\nb\n…", family: "…", places: "…" }
  function build(raw) {
    const d = {};
    for (const f of FILES) d[f] = new Set((raw[f] || '').split('\n').filter(Boolean));
    // The curated lists are always part of the dictionary.
    if (N) { for (const n of N.FIRST) d.given.add(n); for (const n of N.SURNAMES) d.family.add(n); }
    return d;
  }

  // Extension pages / service worker: read the packaged files.
  async function fetchRaw() {
    const raw = {};
    await Promise.all(FILES.map(async (f) => {
      const res = await fetch(chrome.runtime.getURL(`lib/data/${f}.txt`));
      raw[f] = await res.text();
    }));
    return raw;
  }

  // Node (tests).
  function readRaw() {
    const fs = require('fs'), path = require('path');
    const raw = {};
    for (const f of FILES) raw[f] = fs.readFileSync(path.join(__dirname, 'data', `${f}.txt`), 'utf8');
    return raw;
  }

  const api = { build, fetchRaw, readRaw };
  root.VeilDict = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
