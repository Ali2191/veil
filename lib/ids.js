/* VEIL — worldwide identity-document pack.
   Each entry: { name, type, re, check?, score, cue?, cueScore?, needCue? }
   - `check(match)` validates the official checksum / structure where one exists.
   - `cue` is a context regex tested against the ~40 chars before the match; `needCue`
     entries are only reported when that context is present (formats that are just digits).
   Scores: ≥ 0.7 is protected automatically, 0.4–0.7 is protected but marked "please check". */
(function (root) {
  'use strict';
  const D = (s) => s.replace(/\D/g, '');
  const digitsOf = (s) => D(s).split('').map(Number);

  // ── checksum helpers ──
  function luhn(num) {
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = num.charCodeAt(i) - 48;
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }
  const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
  const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
  function verhoeff(num) {
    let c = 0;
    const a = num.split('').reverse().map(Number);
    for (let i = 0; i < a.length; i++) c = VD[c][VP[i % 8][a[i]]];
    return c === 0;
  }
  const weighted = (ds, w) => w.reduce((s, x, i) => s + x * ds[i], 0);
  // ISO 7064 MOD 11,10 (German tax ID)
  function mod11_10(num) {
    let p = 10;
    for (let i = 0; i < num.length - 1; i++) {
      let s = (Number(num[i]) + p) % 10; if (s === 0) s = 10;
      p = (s * 2) % 11;
    }
    return (11 - p) % 10 === Number(num[num.length - 1]);
  }
  function validDate(yy, mm, dd) {
    mm = Number(mm); dd = Number(dd);
    return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
  }

  // ── validators ──
  const V = {
    aadhaar: (m) => { const d = D(m); return d.length === 12 && /^[2-9]/.test(d) && verhoeff(d); },
    pan: (m) => /^[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]$/.test(m),
    sin: (m) => { const d = D(m); return d.length === 9 && /^[1-79]/.test(d) && luhn(d); },
    tfn: (m) => { const d = digitsOf(m); return (d.length === 9 && weighted(d, [1,4,3,7,5,8,6,9,10]) % 11 === 0) || (d.length === 8 && weighted(d, [10,7,8,4,6,3,5,1]) % 11 === 0); },
    medicare: (m) => { const d = digitsOf(m); return d.length >= 10 && d[0] >= 2 && d[0] <= 6 && weighted(d, [1,3,7,9,1,3,7,9]) % 10 === d[8]; },
    steuerId: (m) => { const d = D(m); return d.length === 11 && d[0] !== '0' && mod11_10(d); },
    nir: (m) => {
      let s = m.replace(/\s/g, '').toUpperCase();
      if (s.length !== 15) return false;
      const key = Number(s.slice(13));
      s = s.slice(0, 13).replace('2A', '19').replace('2B', '18');
      if (!/^\d{13}$/.test(s)) return false;
      return 97 - Number(BigInt(s) % 97n) === key;
    },
    dni: (m) => { const s = m.replace(/-/g, '').toUpperCase(); return 'TRWAGMYFPDXBNJZSQVHLCKE'[Number(s.slice(0, 8)) % 23] === s[8]; },
    nie: (m) => { const s = m.replace(/-/g, '').toUpperCase(); const n = 'XYZ'.indexOf(s[0]) + s.slice(1, 8); return 'TRWAGMYFPDXBNJZSQVHLCKE'[Number(n) % 23] === s[8]; },
    codiceFiscale: (m) => {
      const s = m.toUpperCase();
      const odd = { 0:1,1:0,2:5,3:7,4:9,5:13,6:15,7:17,8:19,9:21,A:1,B:0,C:5,D:7,E:9,F:13,G:15,H:17,I:19,J:21,K:2,L:4,M:18,N:20,O:11,P:3,Q:6,R:8,S:12,T:14,U:16,V:10,W:22,X:25,Y:24,Z:23 };
      let sum = 0;
      for (let i = 0; i < 15; i++) {
        const c = s[i];
        sum += i % 2 === 0 ? odd[c] : (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65);
      }
      return String.fromCharCode(65 + (sum % 26)) === s[15];
    },
    bsn: (m) => { const d = digitsOf(m); return d.length === 9 && (weighted(d.slice(0, 8), [9,8,7,6,5,4,3,2]) - d[8]) % 11 === 0; },
    beNational: (m) => {
      const d = D(m); if (d.length !== 11) return false;
      const base = d.slice(0, 9), key = Number(d.slice(9));
      return 97 - (Number(base) % 97) === key || 97 - (Number('2' + base) % 97) === key;
    },
    sePnr: (m) => { const d = D(m).slice(-10); return d.length === 10 && validDate(0, d.slice(2, 4), d.slice(4, 6) % 60) && luhn(d); },
    noFnr: (m) => {
      const d = digitsOf(m); if (d.length !== 11) return false;
      let k1 = 11 - (weighted(d, [3,7,6,1,8,9,4,5,2]) % 11); if (k1 === 11) k1 = 0;
      let k2 = 11 - (weighted(d, [5,4,3,2,7,6,5,4,3,2]) % 11); if (k2 === 11) k2 = 0;
      return k1 === d[9] && k2 === d[10] && validDate(0, d[2] * 10 + d[3], (d[0] * 10 + d[1]) % 40);
    },
    dkCpr: (m) => { const d = D(m); return validDate(0, d.slice(2, 4), d.slice(0, 2)); },
    hetu: (m) => {
      const s = m.toUpperCase();
      const n = Number(s.slice(0, 6) + s.slice(7, 10));
      return '0123456789ABCDEFHJKLMNPRSTUVWXY'[n % 31] === s[10] && validDate(0, s.slice(2, 4), s.slice(0, 2));
    },
    pesel: (m) => {
      const d = digitsOf(m); if (d.length !== 11) return false;
      return (10 - (weighted(d, [1,3,7,9,1,3,7,9,1,3]) % 10)) % 10 === d[10] && validDate(0, (d[2] * 10 + d[3]) % 20, d[4] * 10 + d[5]);
    },
    cpf: (m) => {
      const d = digitsOf(m); if (d.length !== 11 || new Set(d).size === 1) return false;
      const c1 = (weighted(d, [10,9,8,7,6,5,4,3,2]) * 10) % 11 % 10;
      const c2 = (weighted(d, [11,10,9,8,7,6,5,4,3,2]) * 10) % 11 % 10;
      return c1 === d[9] && c2 === d[10];
    },
    cnpj: (m) => {
      const d = digitsOf(m); if (d.length !== 14 || new Set(d).size === 1) return false;
      const k = (n, w) => { const r = weighted(d, w) % 11; return r < 2 ? 0 : 11 - r; };
      return k(12, [5,4,3,2,9,8,7,6,5,4,3,2]) === d[12] && k(13, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === d[13];
    },
    rut: (m) => {
      const s = m.replace(/[.\-]/g, '').toUpperCase();
      const body = s.slice(0, -1), dv = s.slice(-1);
      let sum = 0, mul = 2;
      for (let i = body.length - 1; i >= 0; i--) { sum += Number(body[i]) * mul; mul = mul === 7 ? 2 : mul + 1; }
      const r = 11 - (sum % 11);
      return (r === 11 ? '0' : r === 10 ? 'K' : String(r)) === dv;
    },
    cnId: (m) => {
      const s = m.toUpperCase(); if (!/^\d{17}[\dX]$/.test(s)) return false;
      const w = [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
      const sum = w.reduce((a, x, i) => a + x * Number(s[i]), 0);
      return '10X98765432'[sum % 11] === s[17] && validDate(0, s.slice(10, 12), s.slice(12, 14));
    },
    hkid: (m) => {
      const s = m.replace(/[()]/g, '').toUpperCase();
      const letters = s.slice(0, s.length - 7), num = s.slice(-7, -1), chk = s.slice(-1);
      const val = (c) => c.charCodeAt(0) - 55;
      let sum = letters.length === 2 ? val(letters[0]) * 9 + val(letters[1]) * 8 : 36 * 9 + val(letters[0]) * 8;
      for (let i = 0; i < 6; i++) sum += Number(num[i]) * (7 - i);
      const r = (11 - (sum % 11)) % 11;
      return (r === 10 ? 'A' : String(r)) === chk;
    },
    nric: (m) => {
      const s = m.toUpperCase();
      const d = digitsOf(s.slice(1, 8));
      let sum = weighted(d, [2,7,6,5,4,3,2]);
      if ('TG'.includes(s[0])) sum += 4;
      if (s[0] === 'M') sum += 3;
      const i = sum % 11;
      const table = 'ST'.includes(s[0]) ? 'JZIHGFEDCBA' : 'FG'.includes(s[0]) ? 'XWUTRQPNMLK' : 'KLJNPQRTUWX';
      return table[s[0] === 'M' ? 10 - i : i] === s[8];
    },
    myNumber: (m) => {
      const d = digitsOf(m); if (d.length !== 12) return false;
      let sum = 0;
      for (let n = 1; n <= 11; n++) sum += d[11 - n] * (n <= 6 ? n + 1 : n - 5);
      const r = sum % 11;
      return (r <= 1 ? 0 : 11 - r) === d[11];
    },
    twId: (m) => {
      const s = m.toUpperCase();
      const map = 'ABCDEFGHJKLMNPQRSTUVXYWZIO';
      const code = map.indexOf(s[0]) + 10;
      const ds = [Math.floor(code / 10), code % 10, ...s.slice(1).split('').map(Number)];
      const sum = weighted(ds, [1,9,8,7,6,5,4,3,2,1,1]);
      return sum % 10 === 0;
    },
    zaId: (m) => { const d = D(m); return d.length === 13 && validDate(0, d.slice(2, 4), d.slice(4, 6)) && luhn(d); },
    tcKimlik: (m) => {
      const d = digitsOf(m); if (d.length !== 11 || d[0] === 0) return false;
      const d10 = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
      const d11 = d.slice(0, 10).reduce((a, x) => a + x, 0) % 10;
      return (d10 + 10) % 10 === d[9] && d11 === d[10];
    },
    ilId: (m) => { const d = D(m).padStart(9, '0'); let s = 0; for (let i = 0; i < 9; i++) { let x = Number(d[i]) * (i % 2 + 1); if (x > 9) x -= 9; s += x; } return s % 10 === 0; },
    egId: (m) => { const d = D(m); return d.length === 14 && /^[23]/.test(d) && validDate(0, d.slice(3, 5), d.slice(5, 7)) && (Number(d.slice(7, 9)) <= 35 || d.slice(7, 9) === '88'); },
    saId: (m) => { const d = D(m); return d.length === 10 && /^[12]/.test(d) && luhn(d); },
    ppsn: (m) => {
      const s = m.toUpperCase();
      const d = digitsOf(s.slice(0, 7));
      let sum = weighted(d, [8,7,6,5,4,3,2]);
      if (s.length === 9 && s[8] !== 'W') sum += (s.charCodeAt(8) - 64) * 9;
      return 'WABCDEFGHIJKLMNOPQRSTUV'[sum % 23] === s[7];
    },
    ptNif: (m) => { const d = digitsOf(m); if (d.length !== 9) return false; const r = weighted(d, [9,8,7,6,5,4,3,2]) % 11; return (r < 2 ? 0 : 11 - r) === d[8]; },
    nhs: (m) => { const d = digitsOf(m); if (d.length !== 10) return false; const r = 11 - (weighted(d, [10,9,8,7,6,5,4,3,2]) % 11); return (r === 11 ? 0 : r) === d[9] && r !== 10; },
    krRrn: (m) => { const d = D(m); return validDate(0, d.slice(2, 4), d.slice(4, 6)); },
    myKad: (m) => { const d = D(m); return validDate(0, d.slice(2, 4), d.slice(4, 6)); },
    curp: (m) => {
      const s = m.toUpperCase();
      const dict = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
      let sum = 0;
      for (let i = 0; i < 17; i++) sum += dict.indexOf(s[i]) * (18 - i);
      return String((10 - (sum % 10)) % 10) === s[17] && validDate(0, s.slice(6, 8), s.slice(8, 10));
    },
  };

  const NUM_CUE = (words) => new RegExp(`(?:${words})\\s*(?:no\\.?|number|num|#|id)?\\s*(?:is|:|-|=)?\\s*$`, 'i');

  // ── the pack ──
  const IDS = [
    // South Asia
    { name: 'CNIC (PK)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{5}-\d{7}-\d(?![\d-])/g, score: 0.95 },
    { name: 'CNIC (PK)', type: 'NATIONAL_ID', re: /(?<!\d)\d{13}(?!\d)/g, needCue: true, cue: NUM_CUE('cnic|nicop|nic|national\\s+id(?:entity)?(?:\\s+card)?|id\\s+card|b-?form'), score: 0.9 },
    { name: 'NTN (PK)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{7}-?\d(?![\d-])/g, needCue: true, cue: NUM_CUE('ntn|national\\s+tax(?:\\s+number)?'), score: 0.85 },
    { name: 'Aadhaar (IN)', type: 'NATIONAL_ID', re: /(?<![\d-])[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![\d-])/g, check: V.aadhaar, score: 0.6, cue: NUM_CUE('aadhaa?r|uidai|uid'), cueScore: 0.95 },
    { name: 'PAN (IN)', type: 'NATIONAL_ID', re: /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g, check: V.pan, score: 0.85 },
    { name: 'NID (BD)', type: 'NATIONAL_ID', re: /(?<!\d)(?:\d{17}|\d{13}|\d{10})(?!\d)/g, needCue: true, cue: NUM_CUE('nid|national\\s+id(?:entity)?(?:\\s+card)?|smart\\s+card'), score: 0.85 },
    // North America
    { name: 'SSN (US)', type: 'NATIONAL_ID', re: /(?<![\d-])(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?![\d-])/g, score: 0.9 },
    { name: 'SSN (US)', type: 'NATIONAL_ID', re: /(?<!\d)(?!000|666|9\d\d)\d{3} ?(?!00)\d{2} ?(?!0000)\d{4}(?!\d)/g, needCue: true, cue: NUM_CUE('ssn|social\\s+security'), score: 0.95 },
    { name: 'ITIN (US)', type: 'NATIONAL_ID', re: /(?<![\d-])9\d{2}-(?:5\d|6[0-5]|7\d|8[0-8]|9[0-24-9])-\d{4}(?![\d-])/g, score: 0.9 },
    { name: 'EIN (US)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{2}-\d{7}(?![\d-])/g, needCue: true, cue: NUM_CUE('ein|employer\\s+id(?:entification)?|fein|tax\\s+id'), score: 0.85 },
    { name: 'SIN (CA)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{3}[ -]?\d{3}[ -]?\d{3}(?![\d-])/g, check: V.sin, needCue: true, cue: NUM_CUE('sin|social\\s+insurance'), score: 0.9 },
    { name: 'CURP (MX)', type: 'NATIONAL_ID', re: /\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d\b/g, check: V.curp, score: 0.95 },
    { name: 'RFC (MX)', type: 'NATIONAL_ID', re: /\b[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}\b/g, needCue: true, cue: NUM_CUE('rfc'), score: 0.85 },
    // Europe
    { name: 'NINO (UK)', type: 'NATIONAL_ID', re: /\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z] ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b/g, score: 0.85 },
    { name: 'NHS number (UK)', type: 'HEALTH_ID', re: /(?<![\d-])\d{3}[ -]?\d{3}[ -]?\d{4}(?![\d-])/g, check: V.nhs, needCue: true, cue: NUM_CUE('nhs|chi|health\\s+(?:service|care)'), score: 0.95 },
    { name: 'PPSN (IE)', type: 'NATIONAL_ID', re: /\b\d{7}[A-W][A-IW]?\b/g, check: V.ppsn, score: 0.7, cue: NUM_CUE('pps|ppsn|personal\\s+public\\s+service'), cueScore: 0.95 },
    { name: 'Steuer-ID (DE)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{2} ?\d{3} ?\d{3} ?\d{3}(?![\d-])/g, check: V.steuerId, needCue: true, cue: NUM_CUE('steuer(?:-?id|identifikationsnummer|nummer)?|idnr|tax\\s+id|tin'), score: 0.9 },
    { name: 'NIR (FR)', type: 'NATIONAL_ID', re: /\b[12] ?\d{2} ?(?:0[1-9]|1[0-2]|[2-9]\d) ?(?:\d{2}|2[AB]) ?\d{3} ?\d{3} ?\d{2}\b/g, check: V.nir, score: 0.9 },
    { name: 'DNI (ES)', type: 'NATIONAL_ID', re: /\b\d{8}-?[A-Z]\b/g, check: V.dni, score: 0.9 },
    { name: 'NIE (ES)', type: 'NATIONAL_ID', re: /\b[XYZ]-?\d{7}-?[A-Z]\b/g, check: V.nie, score: 0.9 },
    { name: 'Codice fiscale (IT)', type: 'NATIONAL_ID', re: /\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/g, check: V.codiceFiscale, score: 0.95 },
    { name: 'BSN (NL)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{9}(?![\d-])/g, check: V.bsn, needCue: true, cue: NUM_CUE('bsn|burgerservicenummer|sofi'), score: 0.9 },
    { name: 'National number (BE)', type: 'NATIONAL_ID', re: /(?<![\d.-])\d{2}\.?\d{2}\.?\d{2}-?\d{3}\.?\d{2}(?![\d.-])/g, check: V.beNational, score: 0.6, cue: NUM_CUE('rijksregister|registre\\s+national|national\\s+number|nn'), cueScore: 0.95 },
    { name: 'Personnummer (SE)', type: 'NATIONAL_ID', re: /(?<![\d-])(?:19|20)?\d{6}[-+]\d{4}(?![\d-])/g, check: V.sePnr, score: 0.85 },
    { name: 'Fødselsnummer (NO)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{6} ?\d{5}(?![\d-])/g, check: V.noFnr, score: 0.7, cue: NUM_CUE('fødselsnummer|fodselsnummer|personnummer'), cueScore: 0.95 },
    { name: 'CPR (DK)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{6}-\d{4}(?![\d-])/g, check: V.dkCpr, score: 0.55, cue: NUM_CUE('cpr|personnummer'), cueScore: 0.95 },
    { name: 'HETU (FI)', type: 'NATIONAL_ID', re: /\b\d{6}[-+A-FU-Y]\d{3}[0-9A-Y]\b/g, check: V.hetu, score: 0.95 },
    { name: 'PESEL (PL)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{11}(?![\d-])/g, check: V.pesel, score: 0.55, cue: NUM_CUE('pesel'), cueScore: 0.95 },
    { name: 'NIF (PT)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{9}(?![\d-])/g, check: V.ptNif, needCue: true, cue: NUM_CUE('nif|contribuinte'), score: 0.9 },
    { name: 'TC Kimlik (TR)', type: 'NATIONAL_ID', re: /(?<![\d-])[1-9]\d{10}(?![\d-])/g, check: V.tcKimlik, score: 0.7, cue: NUM_CUE('tc|t\\.c\\.|kimlik|tckn'), cueScore: 0.95 },
    // Middle East & Africa
    { name: 'Emirates ID (AE)', type: 'NATIONAL_ID', re: /(?<!\d)784-?\d{4}-?\d{7}-?\d(?!\d)/g, score: 0.95 },
    { name: 'National ID / Iqama (SA)', type: 'NATIONAL_ID', re: /(?<![\d-])[12]\d{9}(?![\d-])/g, check: V.saId, score: 0.5, cue: NUM_CUE('iqama|national\\s+id|هوية|إقامة'), cueScore: 0.95 },
    { name: 'National ID (EG)', type: 'NATIONAL_ID', re: /(?<![\d-])[23]\d{13}(?![\d-])/g, check: V.egId, score: 0.75 },
    { name: 'Teudat Zehut (IL)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{9}(?![\d-])/g, check: V.ilId, needCue: true, cue: NUM_CUE('teudat\\s+zehut|israeli\\s+id|id\\s+number|ת\\.?ז'), score: 0.9 },
    { name: 'NIN / BVN (NG)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{11}(?![\d-])/g, needCue: true, cue: NUM_CUE('nin|bvn|national\\s+identification|bank\\s+verification'), score: 0.9 },
    { name: 'ID number (ZA)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{13}(?![\d-])/g, check: V.zaId, score: 0.7, cue: NUM_CUE('id\\s+number|identity\\s+number|sa\\s+id'), cueScore: 0.95 },
    // East & South-East Asia, Oceania
    { name: 'Resident ID (CN)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{17}[\dXx](?![\d-])/g, check: V.cnId, score: 0.95 },
    { name: 'HKID (HK)', type: 'NATIONAL_ID', re: /\b[A-Z]{1,2}\d{6}\(?[\dA]\)?/g, check: V.hkid, score: 0.9 },
    { name: 'NRIC / FIN (SG)', type: 'NATIONAL_ID', re: /\b[STFGM]\d{7}[A-Z]\b/g, check: V.nric, score: 0.95 },
    { name: 'MyKad (MY)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{6}-\d{2}-\d{4}(?![\d-])/g, check: V.myKad, score: 0.85 },
    { name: 'My Number (JP)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{4} ?\d{4} ?\d{4}(?![\d-])/g, check: V.myNumber, needCue: true, cue: NUM_CUE('my\\s*number|マイナンバー|個人番号'), score: 0.95 },
    { name: 'RRN (KR)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{6}-[1-8]\d{6}(?![\d-])/g, check: V.krRrn, score: 0.9 },
    { name: 'National ID (TW)', type: 'NATIONAL_ID', re: /\b[A-Z][12]\d{8}\b/g, check: V.twId, score: 0.95 },
    { name: 'NIK (ID)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{16}(?![\d-])/g, needCue: true, cue: NUM_CUE('nik|ktp'), score: 0.9 },
    { name: 'PhilSys / SSS / TIN (PH)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{2,4}-?\d{3,7}-?\d{1,7}(?:-?\d{3})?(?![\d-])/g, needCue: true, cue: NUM_CUE('philsys|psn|sss|umid|tin|gsis'), score: 0.85 },
    { name: 'TFN (AU)', type: 'NATIONAL_ID', re: /(?<![\d-])\d{3} ?\d{3} ?\d{2,3}(?![\d-])/g, check: V.tfn, needCue: true, cue: NUM_CUE('tfn|tax\\s+file'), score: 0.95 },
    { name: 'Medicare (AU)', type: 'HEALTH_ID', re: /(?<![\d-])[2-6]\d{3} ?\d{5} ?\d(?: ?\d)?(?![\d-])/g, check: V.medicare, needCue: true, cue: NUM_CUE('medicare'), score: 0.95 },
    // Latin America
    { name: 'CPF (BR)', type: 'NATIONAL_ID', re: /(?<![\d.-])\d{3}\.\d{3}\.\d{3}-\d{2}(?![\d.-])/g, check: V.cpf, score: 0.95 },
    { name: 'CPF (BR)', type: 'NATIONAL_ID', re: /(?<![\d.-])\d{11}(?![\d.-])/g, check: V.cpf, needCue: true, cue: NUM_CUE('cpf'), score: 0.95 },
    { name: 'CNPJ (BR)', type: 'NATIONAL_ID', re: /(?<![\d.\/-])\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?![\d.\/-])/g, check: V.cnpj, score: 0.9 },
    { name: 'RUT (CL)', type: 'NATIONAL_ID', re: /(?<![\d.-])\d{1,2}\.\d{3}\.\d{3}-[\dkK](?![\w.-])/g, check: V.rut, score: 0.9 },
    { name: 'DNI (AR/PE)', type: 'NATIONAL_ID', re: /(?<![\d.-])\d{2}\.?\d{3}\.?\d{3}(?![\d.\-A-Za-z])/g, needCue: true, cue: NUM_CUE('dni|documento'), score: 0.9 },
    // Travel documents, licences, health
    { name: 'Passport MRZ', type: 'PASSPORT', re: /P<[A-Z<]{3}[A-Z<]{30,39}/g, score: 0.95 },
    { name: 'Passport MRZ', type: 'PASSPORT', re: /\b[A-Z0-9<]{9}\d[A-Z<]{3}\d{6}\d[MF<]\d{6}\d[A-Z0-9<]{14}\d\d?\b/g, score: 0.95 },
    { name: "Driver's licence", type: 'LICENSE', re: /\b[A-Z0-9](?:[A-Z0-9 -]{3,18})[A-Z0-9]\b/g, needCue: true, cue: /(?:driver'?s?|driving)\s+licen[cs]e(?:\s+(?:no\.?|number|#))?\s*(?:is|:|-|=)?\s*$|\bdl\s*(?:no\.?|number|#)\s*[:-]?\s*$/i, digitsMin: 4, score: 0.9 },
    { name: 'Medical record / insurance', type: 'HEALTH_ID', re: /\b[A-Z0-9](?:[A-Z0-9-]{3,18})[A-Z0-9]\b/g, needCue: true, cue: /(?:mrn|medical\s+record(?:\s+number)?|patient\s+id|member\s+id|policy\s+(?:no\.?|number)|insurance\s+(?:id|no\.?|number)|health\s+(?:card|insurance)\s+(?:no\.?|number)|subscriber\s+id)\s*(?:is|:|#|-|=)?\s*$/i, digitsMin: 3, score: 0.9 },
  ];

  // Returns candidates for detect.js: [{ type, start, end, score }]
  function findIds(text) {
    const out = [];
    for (const id of IDS) {
      id.re.lastIndex = 0;
      let m;
      while ((m = id.re.exec(text))) {
        const v = m[0];
        if (id.digitsMin && D(v).length < id.digitsMin) continue;
        if (id.check) { let ok = false; try { ok = id.check(v); } catch {} if (!ok) continue; }
        const before = text.slice(Math.max(0, m.index - 40), m.index);
        const cued = !!(id.cue && id.cue.test(before));
        if (id.needCue && !cued) continue;
        out.push({ type: id.type, start: m.index, end: m.index + v.length, score: cued && id.cueScore ? id.cueScore : id.score, source: id.name });
      }
    }
    return out;
  }

  const api = { findIds, IDS, validators: V, luhn, verhoeff };
  root.VeilIds = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
