/* VEIL — worldwide phone numbers, validated with Google's libphonenumber metadata
   (libphonenumber-js "max" build, MIT; see lib/vendor). No network access.
   findPhones(text, homeRegions) -> [{ start, end, score, country }] */
(function (root) {
  'use strict';
  let L = root.libphonenumber;
  if (!L && typeof require === 'function') {
    try { L = require('./vendor/libphonenumber-max.js'); } catch {}
  }

  // Countries tried for numbers written without a country code, after the user's home regions.
  const COMMON = ['US', 'GB', 'IN', 'PK', 'CA', 'AU', 'AE', 'SA', 'DE', 'FR', 'ES', 'IT', 'NL', 'NG', 'BD', 'EG', 'TR', 'BR', 'MX',
    'ID', 'PH', 'ZA', 'CN', 'JP', 'KR', 'MY', 'SG', 'IE', 'NZ', 'QA', 'KW', 'OM', 'BH', 'KE', 'LK', 'NP'];

  // Time zone → country, for the user's likely home country (major zones only).
  const TZ = {
    'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dhaka': 'BD', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA',
    'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Muscat': 'OM', 'Asia/Bahrain': 'BH', 'Asia/Tehran': 'IR', 'Asia/Baghdad': 'IQ',
    'Asia/Kabul': 'AF', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW',
    'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH',
    'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Jerusalem': 'IL', 'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Europe/Istanbul': 'TR',
    'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT',
    'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
    'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR', 'Europe/Moscow': 'RU',
    'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA', 'Europe/Bucharest': 'RO', 'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU',
    'Africa/Lagos': 'NG', 'Africa/Cairo': 'EG', 'Africa/Nairobi': 'KE', 'Africa/Johannesburg': 'ZA', 'Africa/Casablanca': 'MA', 'Africa/Accra': 'GH',
    'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US',
    'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX',
    'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR', 'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Santiago': 'CL',
    'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Pacific/Auckland': 'NZ',
  };

  // The user's likely home countries: browser languages ("en-PK") and time zone.
  function homeRegions() {
    const out = [];
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (TZ[tz]) out.push(TZ[tz]);
    } catch {}
    const langs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    for (const l of langs) { const m = /[-_]([A-Z]{2})$/i.exec(l || ''); if (m) out.push(m[1].toUpperCase()); }
    return [...new Set(out)];
  }

  const CAND = /(?<![\w+@.\/-])(?:\+|00)?\(?\d[\d\s().\-‑]{5,22}\d(?![\w@]|\.\d|-\d)/g;
  const DATE_LIKE = /^(?:\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}|\d{4}-\d{2}-\d{2})$/;
  const CUE = /(?:phone|ph|mob(?:ile)?|cell(?:phone)?|tel(?:ephone)?|whats\s?app|viber|signal|telegram|contact|call(?:\s+me)?(?:\s+(?:at|on))?|text(?:\s+me)?|sms|fax|landline|reach\s+me|(?:phone|mobile|cell|contact|whatsapp)\s+(?:number|no\.?|#))\s*(?:is|:|-|=|at|on)?\s*$/i;
  const ANTI = /(?:order|invoice|inv|ref(?:erence)?|ticket|tracking|awb|shipment|version|ver|v|build|isbn|sku|item|model|part|serial|page|chapter|step|room|flight|pnr|booking|receipt|transaction|txn|amount|total|price|qty|quantity|id)\s*(?:no\.?|number|#)?\s*[:#-]?\s*$/i;

  function findPhones(text, home = []) {
    if (!L || !text) return [];
    const regions = [...new Set([...home, ...COMMON])];
    const homeSet = new Set(home);
    const out = [];
    CAND.lastIndex = 0;
    let m;
    while ((m = CAND.exec(text))) {
      let raw = m[0];
      // Trim unbalanced trailing ')' or separators.
      raw = raw.replace(/[\s.\-(]+$/, '');
      const start = m.index, end = start + raw.length;
      const digits = raw.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15 || DATE_LIKE.test(raw.trim())) continue;
      const before = text.slice(Math.max(0, start - 32), start);
      const cue = CUE.test(before), anti = ANTI.test(before);
      const sep = /[\s().\-]/.test(raw.replace(/^\+/, ''));
      let score = 0, country = null;
      const intl = raw.startsWith('+') || raw.startsWith('00');
      if (intl) {
        const p = L.parsePhoneNumberFromString(raw.startsWith('00') ? '+' + raw.slice(2) : raw);
        if (p && p.isValid()) { score = 0.95; country = p.country; }
        else if (cue && digits.length >= 8) score = 0.6;
      } else {
        for (const r of regions) {
          let ok = false;
          try { ok = L.isValidPhoneNumber(raw, r); } catch {}
          if (!ok) continue;
          country = r;
          score = homeSet.has(r) ? (sep ? 0.85 : 0.6) : (sep ? 0.6 : 0.3);
          break;
        }
        if (!score && cue && digits.length >= 7) score = 0.55;
      }
      if (!score) continue;
      if (cue) score = Math.min(0.99, score + 0.3);
      if (anti && !cue) score -= 0.5;
      if (score >= 0.4) out.push({ start, end, score, country });
    }
    return out;
  }

  const api = { findPhones, homeRegions, available: () => !!L };
  root.VeilPhone = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
