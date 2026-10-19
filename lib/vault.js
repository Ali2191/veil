/* VEIL — encrypted local vault (service worker only).
   Holds placeholder mappings, "always protect" terms and the "never protect" list.
   Data is AES-GCM encrypted in chrome.storage.local with a non-extractable key kept
   in IndexedDB, so raw values never sit in plain-text extension storage. */
(function (root) {
  'use strict';
  const T = root.VeilTypes;

  const DB = 'veil', STORE = 'keys', KEY_ID = 'vault-key', STORAGE_KEY = 'vault.v1';

  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(k) {
    const db = await idb();
    return new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(k);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function idbPut(k, v) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(v, k);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  }

  async function getKey() {
    let key = await idbGet(KEY_ID);
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await idbPut(KEY_ID, key);
    }
    return key;
  }

  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function encrypt(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    // Chunked base64 to avoid call-stack limits on large vaults.
    const bytes = new Uint8Array(ct);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { iv: b64(iv), ct: btoa(bin) };
  }
  async function decrypt(key, blob) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  const empty = () => ({ entries: {}, counters: {}, terms: [], allow: [] });

  class Vault {
    constructor() { this.data = empty(); this.byKey = new Map(); this.key = null; this.ready = this.load(); this.saving = Promise.resolve(); }

    async load() {
      this.key = await getKey();
      const { [STORAGE_KEY]: blob } = await chrome.storage.local.get(STORAGE_KEY);
      if (blob) {
        try { this.data = { ...empty(), ...(await decrypt(this.key, blob)) }; }
        catch (e) { console.warn('VEIL: vault could not be decrypted; starting fresh.', e); this.data = empty(); }
      }
      this.reindex();
    }

    reindex() {
      this.byKey.clear();
      for (const e of Object.values(this.data.entries)) this.byKey.set(e.key, e);
    }

    save() {
      // Serialize writes so concurrent saves never interleave.
      this.saving = this.saving.then(async () => {
        const blob = await encrypt(this.key, this.data);
        await chrome.storage.local.set({ [STORAGE_KEY]: blob });
      });
      return this.saving;
    }

    prune(retentionDays) {
      if (!retentionDays) return false;
      const cutoff = Date.now() - retentionDays * 86400000;
      let changed = false;
      for (const [tok, e] of Object.entries(this.data.entries)) {
        if ((e.used || e.created) < cutoff) { delete this.data.entries[tok]; changed = true; }
      }
      if (changed) this.reindex();
      return changed;
    }

    // What to send in place of a detected span: a placeholder like [PERSON_1] or, in "natural names"
    // mode, a believable stand-in name for people. With commit=false, new values get provisional
    // numbers (stable within `pending`) and nothing is stored.
    // ctx (from aliasContext) = { natural, avoid:Set, used:Set }.
    tokenFor(span, commit, pending, ctx) {
      const natural = !!(ctx && ctx.natural && span.type === 'PERSON' && root.VeilFake);
      const hit = this.byKey.get(span.key);
      if (hit) {
        if (commit) hit.used = Date.now();
        if (!natural) return hit.token;
        if (hit.alias) return hit.alias;
        // An older entry without a stand-in: give it one now (deterministic, so previews agree).
        const a = root.VeilFake.pick(hit.value, ctx);
        if (!a) return hit.token;
        if (commit) { hit.alias = a.text; hit.aliasParts = a.parts; }
        return a.text;
      }
      if (pending.has(span.key)) return pending.get(span.key);
      const c = this.data.counters;
      const n = (c[span.type] || 0) + 1 + [...pending.values()].filter((t) => t.startsWith(`[${span.type}_`)).length;
      const token = T.token(span.type, n);
      const a = natural ? root.VeilFake.pick(span.value, ctx) : null;
      const out = a ? a.text : token;
      if (commit) {
        c[span.type] = n;
        const e = { token, type: span.type, value: span.value, key: span.key, created: Date.now(), used: Date.now() };
        if (a) { e.alias = a.text; e.aliasParts = a.parts; }
        this.data.entries[token] = e;
        this.byKey.set(span.key, e);
      } else pending.set(span.key, out);
      return out;
    }

    // Shared by all spans of one message in natural mode: words to steer clear of, names already used.
    aliasContext(text, natural) {
      if (!natural) return null;
      const avoid = new Set((text.toLowerCase().match(/[\p{L}\p{M}]+/gu)) || []);
      const used = new Set();
      for (const e of Object.values(this.data.entries)) if (e.alias) used.add(e.alias.split(/\s+/)[0].toLowerCase());
      return { natural: true, avoid, used };
    }

    // Stand-in names handed out so far, for restoring them in replies and protecting them from re-detection:
    // [{ text, value, key }], full names first, then single words.
    aliasTable() {
      const full = [], parts = [];
      for (const e of Object.values(this.data.entries)) {
        if (!e.alias) continue;
        const key = e.token.slice(1, -1);
        full.push({ text: e.alias, value: e.value, key });
        const pairs = e.aliasParts || [];
        if (pairs.length > 1) for (const [fake, real] of pairs) if (fake && real && fake.length >= 3) parts.push({ text: fake, value: real, key });
      }
      return [...full, ...parts];
    }

    // Map of canonical token ("PERSON_1") → original value.
    lookupTable() {
      const out = {};
      for (const e of Object.values(this.data.entries)) out[e.token.slice(1, -1)] = e.value;
      return out;
    }

    list() {
      return Object.values(this.data.entries)
        .sort((a, b) => (b.used || 0) - (a.used || 0))
        .map(({ token, type, value, created, used }) => ({ token, type, value, created, used }));
    }

    deleteToken(token) {
      const e = this.data.entries[token];
      if (!e) return false;
      delete this.data.entries[token];
      this.byKey.delete(e.key);
      return true;
    }

    clearMappings() { this.data.entries = {}; this.data.counters = {}; this.byKey.clear(); }

    addTerm(value, type) {
      value = String(value || '').trim();
      if (value.length < 2) return false;
      if (this.data.terms.some((t) => t.value.toLowerCase() === value.toLowerCase())) return false;
      this.data.terms.push({ value, type: T.TYPES[type] ? type : 'TERM' });
      this.data.allow = this.data.allow.filter((a) => T.allowKey(a) !== T.allowKey(value));
      return true;
    }
    removeTerm(value) { this.data.terms = this.data.terms.filter((t) => t.value !== value); }

    addAllow(value) {
      value = String(value || '').trim();
      if (!value || this.data.allow.some((a) => T.allowKey(a) === T.allowKey(value))) return false;
      this.data.allow.push(value);
      this.data.terms = this.data.terms.filter((t) => T.allowKey(t.value) !== T.allowKey(value));
      return true;
    }
    removeAllow(value) { this.data.allow = this.data.allow.filter((a) => a !== value); }
  }

  root.VeilVault = Vault;
})(globalThis);
