/* VEIL — settings (non-sensitive, stored in plain chrome.storage.local). */
(function (root) {
  'use strict';
  const T = root.VeilTypes;

  const DEFAULTS = {
    enabled: true,
    types: T.TYPE_KEYS.filter((k) => T.TYPES[k].defaultOn),
    pasteGuard: true,       // sanitize pasted / dropped text before the page sees it
    sendGuard: true,        // sanitize text typed directly into the site before it is sent
    restoreInPage: true,    // show real values inside the site's reply text
    highlight: true,        // tint restored values in the page
    hint: true,             // tell the model to keep placeholders intact
    topics: true,           // flag sensitive topics (health, legal, money…) — never swapped
    strict: false,          // swap each detail as soon as it is finished, instead of on send
    retentionDays: 0,       // 0 = keep placeholders forever
    siteRules: {},          // { "chat.z.ai": "off" | "on" } — overrides automatic detection
  };

  // Detail types added in later versions start switched on for existing users too.
  function withNewTypes(saved) {
    if (!saved || !Array.isArray(saved.types)) return saved;
    const known = new Set(saved.knownTypes || saved.types);
    const added = T.TYPE_KEYS.filter((k) => T.TYPES[k].defaultOn && !known.has(k) && !saved.types.includes(k));
    return added.length ? { ...saved, types: [...saved.types, ...added] } : saved;
  }

  async function get() {
    const { settings } = await chrome.storage.local.get('settings');
    const s = withNewTypes(settings);
    return { ...DEFAULTS, ...(s || {}), siteRules: { ...((s && s.siteRules) || {}) } };
  }
  async function set(patch) {
    const next = { ...(await get()), ...patch, knownTypes: T.TYPE_KEYS };
    await chrome.storage.local.set({ settings: next });
    return next;
  }

  root.VeilSettings = { DEFAULTS, get, set, withNewTypes };
})(globalThis);
