/* VEIL — shared type definitions, placeholder format and value normalization.
   Loaded as a classic script in the service worker, content scripts and side panel,
   and as a CommonJS module in tests. */
(function (root) {
  'use strict';

  // Order matters only for display. `priority` resolves overlapping detections.
  const TYPES = {
    SECRET:      { label: 'Secret',       priority: 95, defaultOn: true },
    EMAIL:       { label: 'Email',        priority: 85, defaultOn: true },
    NATIONAL_ID: { label: 'National ID',  priority: 82, defaultOn: true },
    CARD:        { label: 'Card number',  priority: 80, defaultOn: true },
    IBAN:        { label: 'IBAN',         priority: 80, defaultOn: true },
    PASSPORT:    { label: 'Passport',     priority: 78, defaultOn: true },
    LICENSE:     { label: 'Driver’s licence', priority: 76, defaultOn: true },
    HEALTH_ID:   { label: 'Health ID',    priority: 76, defaultOn: true },
    ACCOUNT:     { label: 'Account',      priority: 72, defaultOn: true },
    PHONE:       { label: 'Phone',        priority: 70, defaultOn: true },
    DOB:         { label: 'Date of birth', priority: 65, defaultOn: true },
    IP:          { label: 'IP address',   priority: 60, defaultOn: true },
    HANDLE:      { label: 'Username',     priority: 55, defaultOn: true },
    ADDRESS:     { label: 'Address',      priority: 50, defaultOn: true },
    AMOUNT:      { label: 'Amount',       priority: 45, defaultOn: false },
    ORG:         { label: 'Organization', priority: 42, defaultOn: true },
    PERSON:      { label: 'Name',         priority: 40, defaultOn: true },
    TERM:        { label: 'Private term', priority: 40, defaultOn: true },
  };
  const TYPE_KEYS = Object.keys(TYPES);

  // Placeholders look like [PERSON_1]. Brackets + upper snake case survive
  // markdown rendering and are reproduced verbatim by current models.
  const token = (type, n) => `[${type}_${n}]`;

  // Matches placeholders already present in text (never re-detect these).
  const TOKEN_EXACT = new RegExp(`\\[(?:${TYPE_KEYS.join('|')})_\\d{1,5}\\]`, 'g');

  const alnum = (s) => s.replace(/[^\p{L}\p{N}]+/gu, '');
  const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  function normPhone(v) {
    let d = v.replace(/\D/g, '');
    if (d.startsWith('0092')) d = '0' + d.slice(4);
    else if (d.startsWith('92') && d.length === 12) d = '0' + d.slice(2);
    return d;
  }

  // Canonical form so that "0300-1234567" and "+92 300 1234567" share one placeholder.
  const asciiDigits = (v) => v.replace(/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF]/g, (c) => { const n = c.charCodeAt(0); for (const b of [0x0660, 0x06F0, 0x0966, 0x09E6, 0x0A66, 0x0AE6]) if (n >= b && n <= b + 9) return String(n - b); return c; });

  function normalize(type, value) {
    value = asciiDigits(value);
    switch (type) {
      case 'EMAIL': return value.trim().toLowerCase();
      case 'PHONE': return normPhone(value);
      case 'CARD': case 'IBAN': case 'NATIONAL_ID': case 'ACCOUNT': case 'PASSPORT': case 'LICENSE': case 'HEALTH_ID':
        return alnum(value).toUpperCase();
      case 'IP': return value.trim().toLowerCase();
      case 'HANDLE': return value.trim().replace(/^@/, '').toLowerCase();
      case 'SECRET': return value.trim();
      case 'AMOUNT': return value.toLowerCase().replace(/\s+/g, '');
      case 'DOB': return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-');
      default: return words(value);
    }
  }

  const keyOf = (type, value) => `${type}:${normalize(type, value)}`;
  // Type-independent key for the "never protect" list.
  const allowKey = (value) => words(value);

  const api = { TYPES, TYPE_KEYS, token, TOKEN_EXACT, normalize, keyOf, allowKey };
  root.VeilTypes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
