/* VEIL — service worker. Owns the encrypted vault and assigns placeholders.
   No network access: the only fetch() reads VEIL's own packaged dictionary files
   (the extension CSP allows 'self' only). */
importScripts('lib/types.js', 'lib/names.js', 'lib/vendor/libphonenumber-max.js', 'lib/phone.js', 'lib/ids.js', 'lib/topics.js', 'lib/urdu.js', 'lib/hindi.js', 'lib/fakenames.js',
  'lib/dict.js', 'lib/detect.js', 'lib/tokens.js', 'lib/sites.js', 'lib/settings.js', 'lib/vault.js');

const T = VeilTypes;
const vault = new VeilVault();
// Uses a generic example so the note itself is never "restored" in the page.
const HINT = '\n\n(Bracketed placeholders like [TYPE_N] stand in for private details. Keep them exactly as written.)';

// ───────────────────────────── lifecycle ─────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // The toolbar icon opens the per-site popup; the side panel opens from there or via the shortcut.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'veil-protect', title: 'VEIL: Always protect “%s”', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'veil-allow', title: 'VEIL: Never protect “%s”', contexts: ['selection'] });
  });
});

// Name/place dictionaries (packaged files), plus the raw text for content scripts.
let dictRaw = null, dict = null;
const dictReady = VeilDict.fetchRaw().then((raw) => { dictRaw = raw; dict = VeilDict.build(raw); }).catch((e) => console.warn('VEIL: dictionaries unavailable', e));
const HOME = VeilPhone.homeRegions();

// Values protected before: detected wherever they appear again (learning).
function knownValues() {
  return vault.list().slice(0, 3000).map((e) => ({ type: e.type, value: e.value }));
}
function detectOptions(s) {
  return { types: s.types, terms: vault.data.terms, allow: vault.data.allow, known: knownValues(), aliases: vault.aliasTable().map((a) => a.text), dict, home: HOME };
}

const ready = (async () => {
  await vault.ready;
  await dictReady;
  const s = await VeilSettings.get();
  if (vault.prune(s.retentionDays)) await vault.save();
})();

// ───────────────────────────── helpers ─────────────────────────────

async function notify() {
  chrome.runtime.sendMessage({ type: 'veil:changed' }).catch(() => {});
  const tabs = await chrome.tabs.query({}).catch(() => []);
  for (const t of tabs) if (t.id >= 0 && /^https?:/.test(t.url || 'https:')) chrome.tabs.sendMessage(t.id, { type: 'veil:changed' }).catch(() => {});
}

function guessType(text) {
  const spans = VeilDetect.detect(text, { types: T.TYPE_KEYS, dict, home: HOME });
  const s = spans.find((x) => x.end - x.start >= text.trim().length * 0.8);
  if (s) return s.type;
  if (/^\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+){0,3}$/u.test(text.trim())) return 'PERSON';
  return 'TERM';
}

// Per-tab counters for the toolbar badge (session storage survives worker restarts).
async function bumpBadge(tabId, n) {
  if (!Number.isInteger(tabId) || !n) return;
  const key = `badge:${tabId}`;
  const cur = (await chrome.storage.session.get(key))[key] || 0;
  await chrome.storage.session.set({ [key]: cur + n });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#1f2937' }).catch(() => {});
  chrome.action.setBadgeTextColor?.({ tabId, color: '#ffffff' }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text: String(Math.min(cur + n, 999)) }).catch(() => {});
}
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`badge:${tabId}`));

// Add the "keep placeholders" note once per conversation. New chats change URL
// right after the first message, so the new URL inherits the flag briefly.
const hinted = new Map(); // tabId -> { urls:Set, at }
async function shouldHint(tabId) {
  if (!Number.isInteger(tabId)) return true;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const h = hinted.get(tabId);
  if (tab && h && h.urls.has(tab.url)) return false;
  if (tab) hinted.set(tabId, { urls: new Set([...(h ? h.urls : []), tab.url]), at: Date.now() });
  return true;
}
chrome.tabs.onUpdated.addListener((tabId, info) => {
  const h = hinted.get(tabId);
  if (info.url && h && Date.now() - h.at < 20000) h.urls.add(info.url);
});
chrome.tabs.onRemoved.addListener((tabId) => hinted.delete(tabId));

// ───────────────────────────── core ─────────────────────────────

async function sanitize({ text, exclude = [], commit = false, hint = false, tabId }) {
  const s = await VeilSettings.get();
  const spans = VeilDetect.detect(text, detectOptions(s));
  const skip = new Set(exclude);
  const pending = new Map();
  const tokens = new Map();
  const ctx = vault.aliasContext(text, s.naturalNames);
  let usedPlaceholder = false;
  const res = VeilTokens.substitute(text, spans, (sp) => {
    if (skip.has(sp.key)) return null;
    const tok = vault.tokenFor(sp, commit, pending, ctx);
    if (tok.startsWith('[')) usedPlaceholder = true;
    tokens.set(sp.key, tok);
    return tok;
  });
  let out = res.text;
  if (commit && res.items.length) {
    await vault.save();
    bumpBadge(tabId, res.items.length);
    notify();
    if (hint && s.hint && usedPlaceholder && (await shouldHint(tabId))) out += HINT;
  }
  // Report every detection (including excluded ones) so the UI can toggle them.
  const items = spans.map((sp) => ({ start: sp.start, end: sp.end, type: sp.type, value: sp.value, key: sp.key, tier: sp.tier, score: sp.score, token: tokens.get(sp.key) || null }));
  return { text: out, items };
}

const handlers = {
  async dict() { return { raw: dictRaw, home: HOME }; },
  async state() {
    return { lookup: vault.lookupTable(), aliases: vault.aliasTable(), terms: vault.data.terms, allow: vault.data.allow };
  },
  async sanitize(msg, sender) {
    const tabId = Number.isInteger(msg.tabId) ? msg.tabId : sender.tab?.id;
    return sanitize({ ...msg, tabId });
  },
  // Strict mode: placeholders for individual values as they are typed.
  async tokenize({ items }, sender) {
    const pending = new Map();
    const s = await VeilSettings.get();
    const ctx = vault.aliasContext((items || []).map((it) => (it && it.value) || '').join(' '), s.naturalNames);
    const tokens = (items || []).map((it) => {
      if (!it || !T.TYPES[it.type] || typeof it.value !== 'string' || !it.value.trim()) return null;
      return vault.tokenFor({ type: it.type, value: it.value, key: T.keyOf(it.type, it.value) }, true, pending, ctx);
    });
    if (tokens.some(Boolean)) {
      await vault.save();
      bumpBadge(sender.tab?.id, tokens.filter(Boolean).length);
      notify();
    }
    return { tokens };
  },
  async restore({ text }) {
    const table = vault.lookupTable();
    return VeilTokens.restore(text, (k) => table[k], vault.aliasTable());
  },
  async vaultList() {
    return { entries: vault.list(), terms: vault.data.terms, allow: vault.data.allow };
  },
  async deleteToken({ token }) { vault.deleteToken(token); await vault.save(); notify(); return {}; },
  async clearMappings() { vault.clearMappings(); await vault.save(); notify(); return {}; },
  async addTerm({ value, type }) {
    const ok = vault.addTerm(value, type || guessType(value));
    if (ok) { await vault.save(); notify(); }
    return { ok };
  },
  async removeTerm({ value }) { vault.removeTerm(value); await vault.save(); notify(); return {}; },
  async addAllow({ value }) {
    const ok = vault.addAllow(value);
    if (ok) { await vault.save(); notify(); }
    return { ok };
  },
  async removeAllow({ value }) { vault.removeAllow(value); await vault.save(); notify(); return {}; },
  async prune() {
    const s = await VeilSettings.get();
    if (vault.prune(s.retentionDays)) { await vault.save(); notify(); }
    return {};
  },
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // Only accept messages from this extension's own pages and content scripts.
  if (sender.id !== chrome.runtime.id || !msg || !handlers[msg.type]) return false;
  ready
    .then(() => handlers[msg.type](msg, sender))
    .then(reply, (e) => reply({ error: String(e && e.message || e) }));
  return true;
});

// Keyboard shortcut → side panel (must run synchronously inside the user gesture).
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-panel' && tab) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  await ready;
  const value = (info.selectionText || '').trim();
  if (!value) return;
  if (info.menuItemId === 'veil-protect') await handlers.addTerm({ value });
  if (info.menuItemId === 'veil-allow') await handlers.addAllow({ value });
});
