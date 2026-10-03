/* VEIL — local, deterministic sensitive-data detector with confidence scores.
   detect(text, options) -> [{ start, end, type, value, key, score, tier, source }]
     sorted by start, non-overlapping. tier: 'high' (score ≥ 0.7) or 'check' (0.4–0.7).
   options: { types, terms, allow, known, dict, home, minScore }
     terms  – user's "always protect" list [{ value, type }]
     allow  – user's "never protect" list [string]
     known  – values already protected before (learned from the vault) [{ type, value }]
     dict   – VeilDict.build(...) sets { given, family, places } (optional)
     home   – the user's likely home countries for phone numbers, e.g. ['PK']
   Synchronous and fast enough to run on every keystroke. No network, no models. */
(function (root) {
  'use strict';
  const T = root.VeilTypes || require('./types.js');
  const N = root.VeilNames || require('./names.js');
  const Ids = root.VeilIds || (typeof require === 'function' ? require('./ids.js') : null);
  const Urdu = root.VeilUrdu || (typeof require === 'function' ? (() => { try { return require('./urdu.js'); } catch { return null; } })() : null);
  const Phone = root.VeilPhone || (typeof require === 'function' ? (() => { try { return require('./phone.js'); } catch { return null; } })() : null);

  const HIGH = 0.7;
  const digits = (s) => s.replace(/\D/g, '');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function luhn(num) {
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = num.charCodeAt(i) - 48;
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }

  function ibanValid(raw) {
    const s = raw.replace(/\s/g, '').toUpperCase();
    if (s.length < 15 || s.length > 34) return false;
    const r = s.slice(4) + s.slice(0, 4);
    let rem = 0;
    for (const ch of r) {
      const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
      for (const d of v) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97;
    }
    return rem === 1;
  }

  const DATE_LIKE = /^(?:\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}|\d{4}-\d{2}-\d{2})$/;

  function scan(re, text, fn) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue; }
      fn(m);
    }
  }
  function groupSpan(m, g) {
    const idx = m.indices && m.indices[g];
    return idx ? { start: idx[0], end: idx[1] } : null;
  }
  function trimSpan(text, start, end) {
    while (end > start && /[\s.,;:!?)"'’\]]/.test(text[end - 1])) end--;
    while (start < end && /[\s("'‘\[]/.test(text[start])) start++;
    return [start, end];
  }

  // ─────────────────────────── structured data ───────────────────────────

  const RE = {
    email: /(?<![\w.+%-])[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,24}(?![\w-])/g,
    // Fallback phone patterns (used only if the phone library is unavailable).
    phonePK: /(?<![\w+])(?:(?:\+|00)92[\s.-]?|92[\s.-]?|0)3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?![\d])/g,
    phoneIntl: /(?<![\w+])\+\d(?:[\s.()-]{0,2}\d){7,14}(?![\d])/g,
    phoneNANP: /(?<![\w+])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?![\d])/g,
    idCue: /\b(?:national\s+id(?:entity)?(?:\s+(?:card|number))?|id\s+card(?:\s+number)?|identity\s+(?:card|number)|citizen(?:ship)?\s+(?:id|number)|tax\s+id|taxpayer\s+id|social\s+(?:security|insurance)\s+(?:no|number))\.?\s*(?:no\.?|number|#)?\s*(?:is|:|-|=)?\s*([A-Z0-9](?:[A-Z0-9-]| (?=\d)){5,20}[A-Z0-9])/dgi,
    card: /(?<![\d-])(?:\d{4}([ -])\d{4}\1\d{4}\1\d{1,7}|\d{4}[ -]\d{6}[ -]\d{5}|\d{13,19})(?![\d-])/g,
    iban: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g,
    passportCue: /\bpassport(?:\s*(?:number|no\.?|#))?\s*(?:is|:|-|=)?\s*([A-Z]{1,2}\d{6,9}|\d{8,9}|[A-Z0-9]{6,9})\b/dgi,
    accountCue: /\b(?:(?:bank\s+)?account|acct|a\/c|acc)\.?(?:\s*(?:number|num|no\.?|#))?\s*(?:is|:|-|=)?\s*(\d[\d -]{4,28}\d)/dgi,
    bankCodeCue: /\b(?:routing|aba|sort\s+code|swift|bic|ifsc|bsb)(?:\s*(?:code|number|no\.?|#))?\s*(?:is|:|-|=)?\s*([A-Z0-9](?:[A-Z0-9-]| (?=\d)){4,14}[A-Z0-9])\b/dgi,
    dobCue: /\b(?:born(?:\s+on)?|date\s+of\s+birth|d\.?o\.?b\.?|birth\s*day(?:\s+is)?|birth\s+date)\s*(?:is|:|-|=)?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/dgi,
    ipv4: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\d]|\.\d)/g,
    ipv6: /(?<![\w:])(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}(?![\w:])|(?<![\w:])(?:[0-9a-fA-F]{1,4}:){1,6}:(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}(?![\w:])/g,
    amount: /(?:(?:[$€£¥₹₨]|\b(?:Rs|PKR|USD|EUR|GBP|INR|AED|SAR|CAD|AUD)\.?)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|bn|million|billion|thousand|lakh|lac|crore)\b)?|\b\d[\d,]*(?:\.\d+)?\s?(?:k\s)?(?:PKR|USD|EUR|GBP|INR|AED|rupees|dollars|euros|pounds)\b)/gi,
  };

  // Secrets: [regex, capture group (0 = whole match), score]
  const SECRETS = [
    [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, 0, 0.99],
    [/\b(?:AKIA|ASIA|AGPA|AIDA|AROA)[0-9A-Z]{16}\b/g, 0, 0.97],
    [/\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g, 0, 0.97],
    [/\bgithub_pat_[A-Za-z0-9_]{50,255}\b/g, 0, 0.97],
    [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, 0, 0.97],
    [/\bsk-ant-[A-Za-z0-9_-]{20,}/g, 0, 0.97],
    [/\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g, 0, 0.95],
    [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, 0, 0.97],
    [/\bAIza[0-9A-Za-z_-]{35}\b/g, 0, 0.97],
    [/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, 0, 0.97],
    [/\bwhsec_[A-Za-z0-9+/=]{20,}/g, 0, 0.95],
    [/\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, 0, 0.97],
    [/\bhf_[A-Za-z0-9]{30,}\b/g, 0, 0.95],
    [/\bnpm_[A-Za-z0-9]{36}\b/g, 0, 0.95],
    [/\b(?:AC|SK)[0-9a-f]{32}\b/g, 0, 0.85],
    [/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, 0, 0.95],
    [/\bBearer\s+([A-Za-z0-9._~+\/-]{20,}=*)/dg, 1, 0.9],
    [/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:([^\s@\/]{3,})@/dgi, 1, 0.95],
    [/[?&](?:token|key|api_?key|access_token|auth|sig|signature|password|secret|X-Amz-Signature|X-Amz-Credential)=([^&\s#"']{8,})/dgi, 1, 0.8],
    [/(?<![A-Za-z0-9])["']?[A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth[_-]?token|credentials?)["']?\s*[:=]\s*["']?([^\s"',;`]{4,})/dgi, 1, 0.85],
    [/\b(?:password|passcode|passphrase|pin|otp)\s+(?:is|:)\s*["']?([^\s"',;]{4,})/dgi, 1, 0.85],
  ];
  const IS_TOKEN = new RegExp(`^${T.TOKEN_EXACT.source}$`);
  const SECRET_PLACEHOLDER = /^(?:\*+|x+|\.+|null|none|true|false|undefined|changeme|password|secret|token|example|redacted|your[_-].*|<.*>|\$\{.*\}|\{\{.*\}\}|process\.env.*|os\.environ.*|env\(.*|getenv.*|\[.*\])$/i;

  // Random-looking strings in code (unknown key formats). Pure hex hashes and UUIDs are skipped.
  const ENTROPY_CAND = /(?<=[=:"'`\s(])[A-Za-z0-9+\/_-]{24,}={0,2}(?=["'`\s,;)]|$)/g;
  function entropy(s) {
    const f = {};
    for (const c of s) f[c] = (f[c] || 0) + 1;
    let h = 0;
    for (const k in f) { const p = f[k] / s.length; h -= p * Math.log2(p); }
    return h;
  }

  // ─────────────────────────── addresses ───────────────────────────

  const STREET_WORDS = 'Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Boulevard|Blvd|Drive|Dr|Court|Ct|Place|Pl|Way|Terrace|Close|Crescent|Highway|Hwy|Parkway|Pkwy|Square|Sq|Colony|Town|Block|Sector|Phase|Bazaar|Bazar|Chowk|Mohalla|Society|Scheme|Gali|Enclave|Heights|Gardens?|Villas?|Residency|Apartments?|Plaza|Nagar|Abad|Marg|Housing|Estate|Row|Walk|Mews|Circle|Cir|Trail|Park|Straße|Strasse|Str|Weg|Allee|Platz|Rue|Avenida|Calle|Via|Viale|Rua|Jalan|Jl|Soi|Thanon|Cadde|Sokak';
  const ADDR = {
    house: /\b(?:House|HOUSE|H\.? ?No|H\.? ?#|Plot|PLOT|Flat|FLAT|Apt|Apartment|Villa)\.?\s*(?:No\.?|#)?\s*[A-Z]?-?\d{1,5}[A-Z]?(?:[-\/][A-Z0-9]{1,4})?\b/g,
    unitWeak: /\b(?:Suite|Ste|Unit|Room|Shop|Office|Bldg|Building|Floor)\.?\s*(?:No\.?|#)?\s*[A-Z]?-?\d{1,5}[A-Z]?\b/g,
    numStreet: new RegExp(`\\b\\d{1,5}(?:[-\\/][A-Za-z0-9]{1,4}|[A-Za-z])?,?\\s+(?:\\p{Lu}[\\p{L}'’.-]*\\s+){0,4}(?:${STREET_WORDS})\\b\\.?(?:\\s+(?:NW|NE|SW|SE|N|S|E|W)\\b)?`, 'gu'),
    // Continental style: "Hauptstraße 12", "Calle Mayor 5", "Rue de Rivoli 10"
    streetNumEU: new RegExp(`(?:\\b(?:Rue|Avenida|Avenue|Calle|Carrer|Via|Viale|Rua|Jalan|Jl|Soi|Thanon|Cadde|Sokak|Allee|Platz|Ulica|ul)\\.?\\s+(?:\\p{Lu}[\\p{L}'’.-]*\\s+|de\\s+|del\\s+|la\\s+|du\\s+|des\\s+){1,4}|\\b\\p{Lu}[\\p{L}]*(?:straße|strasse|str\\.|weg|gasse|laan|straat|gracht|gatan|vägen|vej|allee|platz|ring|damm|ufer)\\s+)\\d{1,4}[a-zA-Z]?\\b`, 'gu'),
    streetNum: /\b(?:Street|St|Block|Sector|Phase|Gali|Lane|Road|Rd)\.?\s*(?:No\.?|#)?\s*(?:[A-Z]-?\d{1,4}(?:\/\d{1,2})?|\d{1,4}[A-Z]?|[A-Z])\b/g,
    seg: /,\s*(?:[A-Z]-?\d{1,3}(?:\/\d{1,2})?|\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,2})(?=[\s,.;:!?)]|$)/uy,
    post: /[\s,]+(?:\d{5}(?:-\d{4})?|\d{4,6}|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|[A-Z]\d[A-Z] ?\d[A-Z]\d)\b/y,
    cue: /\b(?:(?:home|office|work|mailing|postal|billing|shipping|delivery|current|new|old|permanent|residential|my|our|his|her|their)\s+)?address(?:\s+is)?\s*[:=-]?\s*|\b(?:i\s+live|lives|living|residing|reside|located|moved|move|moving|relocated|relocating)\s+(?:at|to|from)\s+|\b(?:ship|deliver|send\s+it|mail\s+it|post\s+it)\s+to\s+/gi,
    stop: /[\n;]|\.(?=\s+\p{Lu}|\s*$)|\s+(?:and|but|so|or|my|his|her|their|phone|mobile|email|call|please|which|where|who|if|because|since|from|to|with|for|on|by)\b/iu,
  };
  const SEG_STOP = new Set('i the my your our his her their and but or so please thanks then he she we they it this that also call email phone'.split(' '));

  function detectAddresses(text, add, dict) {
    const units = [];
    const unit = (re, strong) => scan(re, text, (m) => units.push({ s: m.index, e: m.index + m[0].length, strong }));
    unit(ADDR.house, true);
    unit(ADDR.numStreet, true);
    unit(ADDR.streetNumEU, true);
    unit(ADDR.streetNum, false);
    unit(ADDR.unitWeak, false);
    units.sort((a, b) => a.s - b.s || b.e - a.e);

    const groups = [];
    for (const u of units) {
      const g = groups[groups.length - 1];
      if (g && u.s <= g.e + 3 && /^[\s,]*$/.test(text.slice(g.e, Math.max(g.e, u.s)))) {
        g.e = Math.max(g.e, u.e); g.strong += u.strong ? 1 : 0; g.weak += u.strong ? 0 : 1;
      } else groups.push({ s: u.s, e: u.e, strong: u.strong ? 1 : 0, weak: u.strong ? 0 : 1 });
    }

    for (const g of groups) {
      let end = g.e, segs = 0, place = false;
      for (let i = 0; i < 4; i++) {
        ADDR.seg.lastIndex = end;
        const m = ADDR.seg.exec(text);
        if (!m) break;
        const segText = m[0].replace(/^,\s*/, '');
        if (SEG_STOP.has(segText.split(/\s+/)[0].toLowerCase())) break;
        if (dict && dict.places.has(segText.toLowerCase())) place = true;
        end += m[0].length; segs++;
      }
      ADDR.post.lastIndex = end;
      const pm = ADDR.post.exec(text);
      if (pm) end += pm[0].length;
      let score = g.strong ? 0.8 : g.weak >= 2 ? 0.65 : segs ? 0.55 : 0;
      if (score && place) score += 0.1;
      if (score) add('ADDRESS', g.s, end, score);
    }

    scan(ADDR.cue, text, (m) => {
      const from = m.index + m[0].length;
      const rest = text.slice(from, from + 140);
      if (!/^[\p{Lu}\d]/u.test(rest)) return;
      const stop = rest.search(ADDR.stop);
      let chunk = stop === -1 ? rest : rest.slice(0, stop);
      const [s, e] = trimSpan(text, from, from + chunk.length);
      chunk = text.slice(s, e);
      if (chunk.length < 4) return;
      const explicit = /address/i.test(m[0]);
      const structured = /\d/.test(chunk) || /,/.test(chunk) || new RegExp(`\\b(?:${STREET_WORDS})\\b`).test(chunk);
      if (explicit) add('ADDRESS', s, e, 0.85);
      else if (structured) add('ADDRESS', s, e, 0.75);
    });
  }

  // ─────────────────────────── organizations ───────────────────────────

  const ORG_RE = /(?<![\p{L}\p{N}])(?:\p{Lu}[\p{L}\p{N}&'’.-]*\s+){1,4}(?:\(?(?:Pvt|Private)\.?\)?\s*)?(?:Inc|LLC|L\.L\.C|Ltd|Limited|Corp|Corporation|Company|Co|GmbH|AG|SA|SAS|SARL|BV|NV|PLC|LLP|Pty|Bank|Technologies|Solutions|Systems|Group|Holdings|Industries|Enterprises|Associates|Partners|Labs|Ventures|Capital|Consulting|Traders|Foundation)\b\.?/gu;

  function detectOrgs(text, add) {
    scan(ORG_RE, text, (m) => {
      let s = m.index;
      const parts = m[0].split(/\s+/);
      let i = 0;
      while (i < parts.length - 1 && N.NOT_NAME.has(parts[i].toLowerCase())) { s += parts[i].length; i++; while (/\s/.test(text[s])) s++; }
      if (i >= parts.length - 1) return;
      const [a, b] = trimSpan(text, s, m.index + m[0].length);
      add('ORG', a, b + (text[b] === '.' && /^(?:Inc|Ltd|Co|Corp)$/.test(parts[parts.length - 1].replace('.', '')) ? 1 : 0), 0.7);
    });
  }

  // ─────────────────────────── person names ───────────────────────────

  const WORD_RE = /\p{L}[\p{L}\p{M}'’-]*/gu;
  const WORDY_SURNAMES = new Set('king long young white green bell wood price hill brown gray grey cook reed ward cox hunter mason carter baker turner walker parker bennett brooks rogers morgan cooper foster powell perry fisher graham wallace james thomas martin lee jordan scott allen wright adams long ross hamilton'.split(' '));
  const STRONG_CUE = /(?:\bmy\s+name\s+is|\bmy\s+name's|\bmer[aei]\s+(?:naa?m|name)(?:\s+hai)?|\bnaa?m\s*[:=-]|\b(?:janab|janaab|mohtarma|muhtarma|mohtaram|muhtaram)|\bname\s*[:=-]|\bfull\s+name\s*[:=-]?|\bnamed|\bcalled|\bsigned,?|\bregards,?\s*\n|\bsincerely,?\s*\n|\bthanks,?\s*\n|\bcheers,?\s*\n|\byours,?\s*\n|\bfrom:|\bto:)\s*$/i;
  const MID_CUE = /(?:\bi\s+am|\bi'm|\bi’m|\bthis\s+is|\bit's|\bit’s)\s*$/i;
  const GREET_CUE = /(?:^|[\n.!?]\s*|,\s*)(?:dear|hi|hello|hey|salam|assalam[-\s]?o[-\s]?alaikum|good\s+(?:morning|afternoon|evening))\s*,?\s*$/i;
  const LOWER_CUE = /\b(?:my\s+name\s+is|my\s+name's|mer[aei]\s+(?:naa?m|name)(?:\s+hai)?|janab|name\s*[:=])\s+([\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,2})/giu;

  const AFTER_CUE = /^\s+(?:bhai(?:jan)?|bhaiya|bhayya|sahab|sahib|saab|baji|bajji|apa|aapi|api|bhabhi|bhabi|uncle|aunty|auntie|sir|madam|ji)\b/i;

  const bare = (w) => w.toLowerCase().replace(/['’]s$/, '');

  function nameScore(ws, cue, endsRun, nextChar, dict) {
    const n = ws.length;
    if (n === 0 || n > 4) return 0;
    const lw = ws.map((w) => bare(w.w));
    const firstC = (x) => N.FIRST.has(x);
    const firstD = (x) => firstC(x) || (dict && dict.given.has(x));
    const surC = (x) => N.SURNAMES.has(x);
    const surD = (x) => surC(x) || (dict && dict.family.has(x));
    const acronym = (w) => w.length > 1 && w === w.toUpperCase() && !firstD(w.toLowerCase()) && !surD(w.toLowerCase());
    if (ws.some((w) => acronym(w.w))) return 0;
    if (dict && dict.places.has(lw.join(' '))) return 0; // "New York", "San Jose"
    if (n >= 2) {
      if (firstC(lw[0])) return 0.9;
      if (lw.every((x) => firstD(x) || surD(x) || N.PARTICLES.has(x))) return lw.some((x) => firstC(x) || surC(x)) ? 0.85 : 0.75;
      const last = lw[n - 1];
      if (surC(last) && !WORDY_SURNAMES.has(last)) return 0.8;
      if (firstD(lw[0]) && surD(last)) return 0.8;
      if (cue === 'strong') return n <= 3 ? 0.85 : 0;
      if (cue === 'mid') return n <= 3 ? 0.75 : 0;
      if (cue === 'after') return n <= 3 ? 0.8 : 0;
      if (cue === 'greet') return n <= 3 && endsRun && /^[,!\n:]?$/.test(nextChar || '') ? 0.75 : 0;
      if (surD(last) && !WORDY_SURNAMES.has(last)) return 0.6;
      if (firstD(lw[0])) return 0.55;
      return 0;
    }
    const x = lw[0];
    if (cue === 'strong') return 0.85;
    if (cue === 'after') return 0.8; // "Zorblax bhai", "Sidra baji"
    if (firstC(x) && !N.AMBIGUOUS.has(x)) return 0.75;
    if (cue === 'greet' && endsRun && /^[,!\n:—-]?$/.test(nextChar || '')) return 0.75;
    if (dict && dict.given.has(x) && !N.AMBIGUOUS.has(x) && !dict.places.has(x) && x.length >= 3) return 0.45;
    return 0;
  }

  function detectPersons(text, add, dict) {
    const words = [];
    scan(WORD_RE, text, (m) => words.push({ w: m[0], s: m.index, e: m.index + m[0].length }));
    let i = 0;
    while (i < words.length) {
      if (!/^\p{Lu}/u.test(words[i].w)) { i++; continue; }
      const run = [words[i]];
      let j = i + 1;
      while (j < words.length) {
        const prev = run[run.length - 1];
        const gap = text.slice(prev.e, words[j].s);
        const titleDot = gap === '. ' && N.TITLES.has(prev.w.toLowerCase());
        if (gap !== ' ' && !titleDot) break;
        const w = words[j].w;
        if (/^\p{Lu}/u.test(w)) { run.push(words[j]); j++; continue; }
        if (N.PARTICLES.has(w) && j + 1 < words.length && /^\p{Lu}/u.test(words[j + 1].w) && text.slice(words[j].e, words[j + 1].s) === ' ') {
          run.push(words[j]); j++; continue;
        }
        break;
      }
      evaluateRun(text, run, add, dict);
      i = j;
    }

    scan(LOWER_CUE, text, (m) => {
      const start = m.index + m[0].length - m[1].length;
      const parts = [];
      let off = start;
      for (const p of m[1].split(/\s+/)) {
        const s = text.indexOf(p, off);
        if (N.NOT_NAME.has(p.toLowerCase()) || p.length < 2) break;
        parts.push({ s, e: s + p.length }); off = s + p.length;
      }
      if (parts.length) add('PERSON', parts[0].s, parts[parts.length - 1].e, 0.85);
    });
  }

  function evaluateRun(text, run, add, dict) {
    let cue = null;
    const segs = [];
    let cur = [];
    for (const w of run) {
      const lw = w.w.toLowerCase().replace(/\.$/, '');
      if (N.TITLES.has(lw) && cur.length === 0) { cue = 'strong'; continue; }
      if (N.NOT_NAME.has(lw) || N.NOT_NAME.has(bare(w.w))) {
        if (/^(?:dear|hi|hello|hey)$/.test(lw)) cue = 'greet';
        if (cur.length) { segs.push({ ws: cur, cue }); cue = null; }
        cur = [];
        continue;
      }
      cur.push(w);
    }
    if (cur.length) segs.push({ ws: cur, cue });

    for (const seg of segs) {
      while (seg.ws.length && N.PARTICLES.has(seg.ws[seg.ws.length - 1].w)) seg.ws.pop();
      if (!seg.ws.length) continue;
      // Multi-word place names ("San Francisco", "Rio de Janeiro") are never people.
      if (dict && seg.ws.length > 1 && dict.places.has(seg.ws.map((w) => bare(w.w)).join(' '))) continue;
      let c = seg.cue;
      if (!c) {
        const before = text.slice(Math.max(0, seg.ws[0].s - 40), seg.ws[0].s);
        if (STRONG_CUE.test(before)) c = 'strong';
        else if (MID_CUE.test(before)) c = 'mid';
        else if (GREET_CUE.test(before)) c = 'greet';
        else if (AFTER_CUE.test(text.slice(seg.ws[seg.ws.length - 1].e, seg.ws[seg.ws.length - 1].e + 14))) c = 'after';
      }
      const lastWord = seg.ws[seg.ws.length - 1];
      const endsRun = lastWord === run[run.length - 1];
      const nextChar = text.slice(lastWord.e).match(/^\s*(\S?)/)[1];
      for (let d = 0; d < seg.ws.length; d++) {
        const ws = seg.ws.slice(d);
        const score = nameScore(ws, d === 0 ? c : null, endsRun, nextChar, dict);
        if (score) {
          let e = ws[ws.length - 1].e;
          if (/['’]s$/.test(ws[ws.length - 1].w)) e -= 2;
          add('PERSON', ws[0].s, e, score);
          break;
        }
      }
    }
  }

  // ─────────────────────── structure: forms, JSON, YAML, env, tables ───────────────────────

  const KEY_TYPES = [
    [/^(?:full ?name|name|first ?name|given ?name|last ?name|surname|family ?name|middle ?name|father'?s? ?name|mother'?s? ?name|husband'?s? ?name|spouse(?:'?s)? ?name|guardian(?: ?name)?|next ?of ?kin|patient(?: ?name)?|customer(?: ?name)?|client(?: ?name)?|employee(?: ?name)?|applicant(?: ?name)?|contact(?: ?person| ?name)?|recipient(?: ?name)?|sender(?: ?name)?|beneficiary(?: ?name)?|account ?(?:holder|title)|card ?holder(?: ?name)?|emergency ?contact|user ?name|display ?name)$/, 'PERSON', 0.85],
    [/^(?:address|home ?address|residential ?address|permanent ?address|current ?address|mailing ?address|postal ?address|street(?: ?address)?|address ?line ?\d?|shipping ?address|billing ?address|delivery ?address)$/, 'ADDRESS', 0.85],
    [/^(?:city|town|zip|zip ?code|post ?code|postal ?code)$/, 'ADDRESS', 0.5],
    [/^(?:e-?mail|email ?address|mail)$/, 'EMAIL', 0.9],
    [/^(?:phone|phone ?(?:no|number)|mobile|mobile ?(?:no|number)|cell|tel|telephone|contact ?(?:no|number)|whats ?app|fax)$/, 'PHONE', 0.9],
    [/^(?:dob|date ?of ?birth|birth ?date|birthday)$/, 'DOB', 0.9],
    [/^(?:cnic|nic|ssn|sin|nin|national ?id|national ?id ?(?:no|number)|id ?card|id ?number|tax ?id|tin|ntn|aadhaa?r|pan|nric|emirates ?id|iqama|cpf|curp)$/, 'NATIONAL_ID', 0.9],
    [/^(?:passport|passport ?(?:no|number))$/, 'PASSPORT', 0.9],
    [/^(?:driver'?s? ?licen[cs]e|driving ?licen[cs]e|licen[cs]e ?(?:no|number)|dl)$/, 'LICENSE', 0.85],
    [/^(?:iban|account|account ?(?:no|number)|bank ?account|acct)$/, 'ACCOUNT', 0.85],
    [/^(?:card|card ?(?:no|number)|credit ?card|debit ?card)$/, 'CARD', 0.85],
    [/^(?:mrn|medical ?record(?: ?number)?|patient ?id|member ?id|policy ?(?:no|number)|insurance ?(?:id|no|number))$/, 'HEALTH_ID', 0.85],
    [/^(?:ip|ip ?address|client ?ip)$/, 'IP', 0.8],
  ];
  const normKey = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/ (?:no|num|nr)$/, ' no');
  function keyType(k) {
    const n = normKey(k);
    for (const [re, type, score] of KEY_TYPES) if (re.test(n)) return [type, score];
    return null;
  }
  // "Name: …", "name: …", "NAME=…", "\"name\": \"…\"", "- email: …"
  const KV = /^[ \t]*(?:[-*•>]\s*)?(?:export\s+)?["']?([A-Za-z][A-Za-z0-9 _'.-]{0,40}?)["']?[ \t]*[:=][ \t]*["']?([^"'\n]*?)["']?[ \t]*,?[ \t]*$/dgm;
  // Inline JSON pairs anywhere: "email": "x@y.z"
  const JSON_PAIR = /"([A-Za-z][A-Za-z0-9_ -]{0,40})"\s*:\s*"([^"\\\n]{1,200})"/dg;

  function valueOk(type, v) {
    if (!v || v.length > 160 || IS_TOKEN.test(v) || SECRET_PLACEHOLDER.test(v)) return false;
    if (/^(?:n\/?a|none|null|-+|tbd|unknown|yes|no|true|false)$/i.test(v)) return false;
    if (type === 'PERSON') return /\p{L}/u.test(v) && !/\d/.test(v) && v.split(/\s+/).length <= 5;
    if (['PHONE', 'NATIONAL_ID', 'PASSPORT', 'ACCOUNT', 'CARD', 'LICENSE', 'HEALTH_ID', 'DOB'].includes(type)) return /\d/.test(v);
    if (type === 'EMAIL') return v.includes('@');
    return true;
  }

  function detectStructure(text, add) {
    const emit = (type, score, vStart, v) => {
      if (!valueOk(type, v)) return;
      const [s, e] = trimSpan(text, vStart, vStart + v.length);
      if (e > s) add(type, s, e, score);
    };
    scan(KV, text, (m) => {
      const kt = keyType(m[1]);
      if (!kt) return;
      emit(kt[0], kt[1], m.indices[2][0], m[2]);
    });
    scan(JSON_PAIR, text, (m) => {
      const kt = keyType(m[1]);
      if (kt) emit(kt[0], kt[1], m.indices[2][0], m[2]);
    });
    if (Urdu) Urdu.scanKeys(text, emit);
    detectTables(text, add);
  }

  // CSV / TSV / Markdown tables: a header row names the columns.
  function detectTables(text, add) {
    const lines = [];
    let off = 0;
    for (const l of text.split('\n')) { lines.push({ l, off }); off += l.length + 1; }
    for (let i = 0; i < lines.length - 1; i++) {
      const head = lines[i].l;
      const sep = head.includes('\t') ? '\t' : head.includes('|') ? '|' : head.includes(',') ? ',' : null;
      if (!sep) continue;
      const cols = head.split(sep).map((c) => c.trim());
      if (cols.length < 2) continue;
      const types = cols.map((c) => (c && c.length < 40 ? keyType(c.replace(/^["']|["']$/g, '')) : null));
      if (!types.some(Boolean)) continue;
      for (let j = i + 1; j < lines.length; j++) {
        const row = lines[j].l;
        if (sep === '|' && /^\s*\|?\s*:?-{2,}/.test(row)) continue; // markdown divider
        const cells = row.split(sep);
        if (cells.length !== cols.length) break;
        let pos = lines[j].off;
        cells.forEach((cell, k) => {
          const kt = types[k];
          if (kt) {
            const v = cell.trim().replace(/^["']|["']$/g, '');
            const at = pos + cell.indexOf(v);
            if (valueOk(kt[0], v)) add(kt[0], at, at + v.length, Math.max(kt[1], 0.75));
          }
          pos += cell.length + sep.length;
        });
      }
    }
  }

  // ─────────────────────────── user terms & learned values ───────────────────────────

  function termPattern(value) {
    const v = value.trim();
    const ds = digits(v);
    if (ds.length >= 6 && ds.length / v.replace(/\s/g, '').length > 0.6) return ds.split('').join('[\\s().+-]*');
    return esc(v).replace(/\s+/g, '\\s+');
  }

  function distinctiveParts(value) {
    const out = [];
    const parts = value.trim().split(/\s+/);
    if (parts.length < 2) return out;
    for (const p of parts) {
      const lp = p.toLowerCase();
      if (p.length >= 3 && !N.SURNAMES.has(lp) && !N.PARTICLES.has(lp) && !N.TITLES.has(lp) && !N.AMBIGUOUS.has(lp) && !N.NOT_NAME.has(lp)) out.push(p);
    }
    return out;
  }

  const caches = new Map();
  function matcher(name, list, expand) {
    const entries = [];
    for (const t of list) {
      if (!t || !t.value || t.value.trim().length < 2) continue;
      entries.push({ value: t.value.trim(), type: t.type || 'TERM', score: t.score });
      if (expand && (t.type || 'TERM') === 'PERSON') for (const p of distinctiveParts(t.value)) entries.push({ value: p, type: 'PERSON', score: t.partScore });
    }
    const sig = entries.length + ':' + entries.map((e) => e.value).join('\u0001');
    const c = caches.get(name);
    if (c && c.sig === sig) return c;
    entries.sort((a, b) => b.value.length - a.value.length);
    const next = {
      sig, entries,
      re: entries.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${entries.map((e) => `(${termPattern(e.value)})`).join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null,
      parts: [...new Set(entries.filter((e) => e.type === 'PERSON').flatMap((e) => e.value.split(/\s+/)).filter((p) => p.length >= 5).map((p) => p.toLowerCase()))],
    };
    caches.set(name, next);
    return next;
  }

  function runMatcher(text, mt, add, defaultScore) {
    if (!mt.re) return;
    scan(mt.re, text, (m) => {
      let gi = 1;
      while (gi < m.length && m[gi] === undefined) gi++;
      const e = mt.entries[gi - 1];
      if (e) add(e.type, m.index, m.index + m[0].length, e.score ?? defaultScore, true);
    });
  }

  // One typo away from a known name ("Tayab" for "Tayyab").
  function nearOne(a, b) {
    if (Math.abs(a.length - b.length) > 1 || a === b) return a === b;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; continue; } // transposition
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  // ─────────────────────────── main ───────────────────────────

  function detect(text, opts = {}) {
    if (!text) return [];
    const orig = text;
    if (Urdu) text = Urdu.asciiDigits(text); // ۰۱۲… → 012…, same length, so offsets stay valid
    const enabled = opts.types ? new Set(opts.types) : new Set(T.TYPE_KEYS.filter((k) => T.TYPES[k].defaultOn));
    const allow = new Set((opts.allow || []).map(T.allowKey));
    const dict = opts.dict || null;
    const minScore = opts.minScore ?? 0.4;
    const cands = [];

    const add = (type, start, end, score, forced) => {
      if (end <= start || score < minScore) return;
      if (!forced && !enabled.has(type)) return;
      cands.push({ type, start, end, score: Math.min(score, 1), prio: T.TYPES[type] ? T.TYPES[type].priority : 40 });
    };
    const addWhole = (type, score, check) => (m) => { if (!check || check(m[0], m)) add(type, m.index, m.index + m[0].length, score); };
    const addGroup = (type, g, score, check) => (m) => {
      const sp = groupSpan(m, g);
      if (!sp) return;
      const [s, e] = trimSpan(text, sp.start, sp.end);
      if (!check || check(text.slice(s, e))) add(type, s, e, score);
    };

    // 1. The user's own lists and everything protected before (learning).
    if (opts.terms && opts.terms.length) runMatcher(text, matcher('terms', opts.terms.map((t) => ({ ...t, score: 1, partScore: 0.9 })), true), add, 1);
    let known = null;
    if (opts.known && opts.known.length) {
      known = matcher('known', opts.known.map((k) => ({ ...k, score: 0.97, partScore: 0.8 })), true);
      runMatcher(text, known, add, 0.97);
    }

    // 2. Secrets
    if (enabled.has('SECRET')) {
      for (const [re, g, score] of SECRETS) {
        scan(re, text, g === 0 ? addWhole('SECRET', score) : addGroup('SECRET', g, score, (v) => !SECRET_PLACEHOLDER.test(v) && !IS_TOKEN.test(v)));
      }
      scan(ENTROPY_CAND, text, (m) => {
        const v = m[0];
        if (/^[0-9a-f]+$/i.test(v) || /^[0-9a-f-]{36}$/i.test(v) || !/\d/.test(v) || !/[a-z]/.test(v) || !/[A-Z]/.test(v)) return;
        if (entropy(v) >= 4.2) add('SECRET', m.index, m.index + v.length, 0.6);
      });
    }

    // 3. Contact details
    if (enabled.has('EMAIL')) scan(RE.email, text, addWhole('EMAIL', 0.95));
    if (enabled.has('PHONE')) {
      if (Phone && Phone.available()) {
        for (const p of Phone.findPhones(text, opts.home || [])) add('PHONE', p.start, p.end, p.score);
      } else {
        scan(RE.phonePK, text, addWhole('PHONE', 0.9));
        scan(RE.phoneIntl, text, addWhole('PHONE', 0.8, (v) => { const n = digits(v).length; return n >= 8 && n <= 15; }));
        scan(RE.phoneNANP, text, addWhole('PHONE', 0.8, (v) => /^[2-9]/.test(digits(v).replace(/^1(?=\d{10}$)/, ''))));
      }
    }

    // 4. Identity documents worldwide
    if (Ids) for (const c of Ids.findIds(text)) add(c.type, c.start, c.end, c.score);
    if (enabled.has('NATIONAL_ID')) scan(RE.idCue, text, addGroup('NATIONAL_ID', 1, 0.8, (v) => digits(v).length >= 5));
    if (enabled.has('PASSPORT')) scan(RE.passportCue, text, addGroup('PASSPORT', 1, 0.9, (v) => /\d/.test(v)));

    // 5. Money
    if (enabled.has('CARD')) scan(RE.card, text, (m) => {
      const d = digits(m[0]);
      if (d.length < 13 || d.length > 19 || !/^[2-6]/.test(d) || !luhn(d)) return;
      add('CARD', m.index, m.index + m[0].length, /[ -]/.test(m[0]) ? 0.95 : 0.75);
    });
    if (enabled.has('IBAN')) scan(RE.iban, text, addWhole('IBAN', 0.95, ibanValid));
    if (enabled.has('ACCOUNT')) {
      scan(RE.accountCue, text, addGroup('ACCOUNT', 1, 0.85, (v) => digits(v).length >= 6));
      scan(RE.bankCodeCue, text, addGroup('ACCOUNT', 1, 0.85, (v) => /\d/.test(v)));
    }
    if (enabled.has('AMOUNT')) scan(RE.amount, text, addWhole('AMOUNT', 0.8, (v) => /\d/.test(v)));

    // 6. Dates, network
    if (enabled.has('DOB')) scan(RE.dobCue, text, addGroup('DOB', 1, 0.9));
    if (enabled.has('IP')) {
      scan(RE.ipv4, text, addWhole('IP', 0.8, (v, m) => !/^(?:0\.0\.0\.0|127\.|255\.255\.|1\.0\.0\.0$)/.test(v) && !/\bv(?:ersion)?\s*$/i.test(text.slice(Math.max(0, m.index - 10), m.index))));
      scan(RE.ipv6, text, addWhole('IP', 0.75, (v) => (v.match(/:/g) || []).length >= 3 && /[0-9a-f]{3,}/i.test(v)));
    }

    // Urdu / Arabic script: ID, DOB, account and phone cues
    if (Urdu) Urdu.detectCues(text, add);

    // 7. Places, organizations, people
    if (enabled.has('ADDRESS')) { detectAddresses(text, add, dict); if (Urdu) Urdu.detectAddresses(text, add); }
    if (enabled.has('ORG')) { detectOrgs(text, add); if (Urdu) Urdu.detectOrgs(text, add); }
    if (enabled.has('PERSON')) {
      detectPersons(text, add, dict);
      if (Urdu) Urdu.detectPersons(text, add, dict);
      if (known && known.parts.length) {
        scan(WORD_RE, text, (m) => {
          const w = m[0].toLowerCase();
          if (w.length < 5 || !/^\p{Lu}/u.test(m[0])) return;
          if (known.parts.some((p) => p !== w && nearOne(w, p))) add('PERSON', m.index, m.index + m[0].length, 0.6);
        });
      }
    }

    // 8. Forms, JSON, YAML, env files, tables
    detectStructure(text, add);

    // Never re-detect placeholders.
    const blocked = [];
    scan(new RegExp(T.TOKEN_EXACT.source, 'g'), text, (m) => blocked.push([m.index, m.index + m[0].length]));

    // Resolve overlaps: most confident first, then type priority, then longer span.
    cands.sort((a, b) => b.score - a.score || b.prio - a.prio || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const taken = [];
    const overlaps = (s, e) => taken.some((t) => s < t.end && e > t.start) || blocked.some(([bs, be]) => s < be && e > bs);
    for (const c of cands) {
      if (overlaps(c.start, c.end)) continue;
      const value = orig.slice(c.start, c.end);
      if (allow.has(T.allowKey(value))) continue;
      taken.push({ start: c.start, end: c.end, type: c.type, value, key: T.keyOf(c.type, value), score: Math.round(c.score * 100) / 100, tier: c.score >= HIGH ? 'high' : 'check' });
    }
    return taken.sort((a, b) => a.start - b.start);
  }

  const topics = (text) => (root.VeilTopics ? root.VeilTopics.topics(text) : []);

  const api = { detect, topics, luhn, ibanValid, HIGH };
  root.VeilDetect = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
