/* VEIL — content script (isolated world, every site, document_start).
   Activates only where there is an AI chat box, then:
   • highlights private details in the site's text box as you type (badge + review list)
   • swaps them for placeholders on send — or, in strict mode, as soon as each one is finished
   • sanitizes pasted/dropped text before the page can read it
   • restores placeholders to real values in replies, and in anything the user copies */
(() => {
  'use strict';
  if (window.__veilLoaded) return;
  window.__veilLoaded = true;

  const D = VeilDom, S = VeilSites, T = VeilTypes;
  const HOST = location.hostname;
  const TOP = window === window.top;
  const cls = S.classify(HOST);
  const site = cls.site;

  let settings = { ...VeilSettings.DEFAULTS };
  let lookup = {};              // "PERSON_1" → value
  let aliasTexts = [];          // stand-in names given out in natural-names mode (protected, restored in replies)
  let tokenByKey = new Map();   // normalized key → "[PERSON_1]"
  let terms = [], allow = [];
  let known = [];               // values protected before, detected wherever they reappear
  let dict = null, home = [];   // name/place dictionaries and home countries (from the service worker)
  let stateReady = false;
  let alive = true;             // false once the extension is reloaded or removed
  let bypass = 0;               // > 0 while VEIL dispatches its own events
  const excludedBy = new WeakMap(); // editor → Set of keys the user chose to send as is

  const ui = VeilUI.create({ onToggle, onNever, onUnallow });

  async function call(msg) {
    try {
      const res = await chrome.runtime.sendMessage(msg);
      if (res && res.error) throw new Error(res.error);
      return res;
    } catch (e) {
      if (/context invalidated|Receiving end/i.test(String(e))) { alive = false; shutdown(); }
      throw e;
    }
  }

  // ───────────────────────────── activation ─────────────────────────────

  let aiPageAt = 0, aiPageVal = false;
  function aiPage() {
    if (Date.now() - aiPageAt < 3000) return aiPageVal;
    aiPageAt = Date.now();
    const meta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.content || '';
    const text = `${document.title} ${meta('description')} ${meta('og:site_name')} ${meta('og:title')} ${meta('application-name')}`;
    aiPageVal = S.AI_HOST.test(HOST) || S.AI_TEXT.test(text);
    return aiPageVal;
  }

  const rule = () => settings.siteRules[HOST];

  // Is VEIL switched on for this page?
  function siteOn() {
    if (!alive || !settings.enabled) return false;
    const r = rule();
    if (r === 'off') return false;
    if (r === 'on' || cls.kind === 'known') return true;
    if (cls.kind === 'people') return false;
    return aiPage();
  }

  const chatBoxes = new WeakSet();
  const labelOf = (el) => [el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('data-placeholder'),
    el.querySelector && el.querySelector('[data-placeholder]')?.getAttribute('data-placeholder'),
    el.querySelector && el.querySelector('.placeholder, [class*="placeholder"]')?.textContent].filter(Boolean).join(' ');

  // Does this editor behave like an AI prompt box?
  function isChatBox(el) {
    if (!el || !siteOn()) return false;
    if (chatBoxes.has(el)) return true;
    let ok = false;
    if (site) {
      ok = site.composer.some((sel) => el.matches(sel) || !!el.querySelector(sel) || !!el.closest(sel));
    } else if (!(D.isField(el) && el.tagName === 'INPUT') && D.visible(el) && el.getBoundingClientRect().width >= 180
      && !el.closest('form')?.querySelector('input[type="password"]')) {
      ok = rule() === 'on' || !!findSendButton(el) || S.AI_BOX.test(labelOf(el));
    }
    if (ok) chatBoxes.add(el);
    return ok;
  }

  // ───────────────────────────── state ─────────────────────────────

  async function loadState() {
    if (!siteOn()) return;
    try {
      const [st, d] = await Promise.all([call({ type: 'state' }), dict ? null : call({ type: 'dict' })]);
      if (d && d.raw) { dict = VeilDict.build(d.raw); home = d.home || []; }
      lookup = st.lookup; terms = st.terms; allow = st.allow;
      aliasTexts = (st.aliases || []).map((a) => a.text);
      VeilTokens.setAliases(st.aliases || []);
      tokenByKey = new Map();
      known = [];
      for (const [k, v] of Object.entries(lookup)) {
        const type = k.slice(0, k.lastIndexOf('_'));
        if (!T.TYPES[type]) continue;
        tokenByKey.set(T.keyOf(type, v), `[${k}]`);
        known.push({ type, value: v });
      }
      stateReady = true;
      startRestore();
      if (activeEditor) scan(activeEditor);
    } catch { /* worker waking up; the next change event retries */ }
  }

  const detectOpts = () => ({ types: settings.types, terms, allow, known, aliases: aliasTexts, dict, home });
  const look = (k) => lookup[k];

  chrome.storage.local.get('settings').then(({ settings: s }) => {
    settings = { ...VeilSettings.DEFAULTS, ...(VeilSettings.withNewTypes(s) || {}) };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadState, { once: true });
    else loadState();
  });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.settings) return;
    const wasOn = siteOn() && settings.restoreInPage;
    settings = { ...VeilSettings.DEFAULTS, ...(VeilSettings.withNewTypes(ch.settings.newValue) || {}) };
    if (!siteOn()) { shutdown(); return; }
    if (wasOn && !settings.restoreInPage) revertAll();
    if (!stateReady) loadState(); else { startRestore(); if (activeEditor) scan(activeEditor); }
  });

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (msg.type === 'veil:changed') { if (stateReady || siteOn()) loadState(); return false; }
    if (msg.type === 'veil:ping') {
      if (!TOP) return false;
      reply({ host: HOST, site: site ? site.name : HOST, kind: cls.kind, rule: rule() || null, active: siteOn(), aiPage: aiPage(), composer: !!findComposer() });
      return false;
    }
    if (msg.type === 'veil:insert') {
      const el = findComposer();
      if (!el) return false; // another frame may hold the chat box; the panel reports if none does
      insertFromPanel(el, msg.text, msg.send).then(reply, (e) => reply({ ok: false, error: String(e.message || e) }));
      return true;
    }
    return false;
  });

  function shutdown() {
    ui.hideAll();
    typing.clear();
    revertAll();
    stopRestore();
  }

  // ───────────────────────────── composer & send button ─────────────────────────────

  const SEND_HINT = /\b(send|submit)\b/i;
  function isSendButton(btn) {
    if (!btn || btn.closest('[data-veil]')) return false;
    if (site && site.send.some((sel) => btn.matches(sel))) return true;
    const label = `${btn.getAttribute('aria-label') || ''} ${btn.getAttribute('data-testid') || ''} ${btn.title || ''} ${btn.id || ''}`;
    return SEND_HINT.test(label) || /send|submit/i.test(btn.getAttribute('data-testid') || '') || (btn.type === 'submit' && !!btn.form);
  }

  // Nearest visible send-like button within a few ancestors of the editor.
  function findSendButton(el) {
    if (site) {
      for (const sel of site.send) {
        const b = [...document.querySelectorAll(sel)].filter(D.visible).pop();
        if (b) return b;
      }
    }
    let scope = el;
    for (let i = 0; i < 6 && scope; i++, scope = scope.parentElement) {
      const b = [...scope.querySelectorAll('button, [role="button"], input[type="submit"]')].filter((x) => D.visible(x) && isSendButton(x)).pop();
      if (b) return b;
    }
    return null;
  }

  let activeEditor = null;
  function findComposer() {
    if (site) {
      for (const sel of site.composer) {
        const els = [...document.querySelectorAll(sel)].filter(D.visible);
        if (els.length) return D.editableRoot(els[els.length - 1]) || els[els.length - 1];
      }
    }
    if (activeEditor && activeEditor.isConnected && D.visible(activeEditor)) return activeEditor;
    const all = [...document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')]
      .map((x) => D.editableRoot(x)).filter((x) => x && D.visible(x) && isChatBox(x));
    return all.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0] || null;
  }

  // The visual box around the editor (for placing the badge): the nearest ancestor that
  // also holds the send button, if it isn't much larger than the editor itself.
  function anchorFor(el) {
    const btn = findSendButton(el);
    if (!btn) return el;
    const er = el.getBoundingClientRect();
    let a = el;
    for (let i = 0; i < 6 && a.parentElement; i++) {
      a = a.parentElement;
      if (a.contains(btn)) {
        const r = a.getBoundingClientRect();
        return r.height - er.height < 220 && r.width - er.width < 240 ? a : el;
      }
    }
    return el;
  }

  // ───────────────────────────── live highlighting ─────────────────────────────

  const hasHL = typeof Highlight === 'function' && !!CSS.highlights;
  const hlTyping = hasHL ? new Highlight() : null;   // confident detections
  const hlCheck = hasHL ? new Highlight() : null;    // "please check" tier
  const hlTopic = hasHL ? new Highlight() : null;    // sensitive topics (flagged, not swapped)
  const hlRestored = hasHL ? new Highlight() : null;
  if (hasHL) {
    CSS.highlights.set('veil-typing', hlTyping);
    CSS.highlights.set('veil-check', hlCheck);
    CSS.highlights.set('veil-topic', hlTopic);
    CSS.highlights.set('veil-restored', hlRestored);
  }

  const typing = {
    clear() { if (hasHL) { hlTyping.clear(); hlCheck.clear(); hlTopic.clear(); } ui.clearMirrors(); ui.hideBadge(); lastScan = null; stopWatch(); },
  };

  const TOKEN_IN_TEXT = new RegExp(T.TOKEN_EXACT.source, 'g');
  let scanQueued = null;

  function scheduleScan(el) {
    if (scanQueued === el) return;
    scanQueued = el;
    const run = () => { scanQueued = null; scan(el); };
    // Long prompts: debounce a little; short ones: next frame.
    if ((el.value || el.textContent || '').length > 20000) setTimeout(run, 150); else requestAnimationFrame(run);
  }

  function itemsFor(el, m, spans) {
    const excluded = excludedBy.get(el) || new Set();
    const items = new Map();
    for (const s of spans) {
      if (!items.has(s.key)) items.set(s.key, { key: s.key, type: s.type, value: s.value, tier: s.tier, token: tokenByKey.get(s.key) || null, on: !excluded.has(s.key) });
    }
    // Placeholders already in the box (strict mode, or pasted) count as protected.
    TOKEN_IN_TEXT.lastIndex = 0;
    let t;
    while ((t = TOKEN_IN_TEXT.exec(m.text))) {
      const k = t[0].slice(1, -1), v = lookup[k];
      if (v === undefined) continue;
      const type = k.slice(0, k.lastIndexOf('_'));
      const key = T.keyOf(type, v);
      if (!items.has(key)) items.set(key, { key, type, value: v, token: t[0], on: true, placed: true });
    }
    return [...items.values()];
  }

  function scan(el) {
    if (!el.isConnected || !isChatBox(el)) { if (el === activeEditor) typing.clear(); return; }
    const m = D.model(el);
    const spans = VeilDetect.detect(m.text, detectOpts());
    const excluded = excludedBy.get(el) || new Set();
    const shown = spans.filter((s) => !excluded.has(s.key));
    // Also mark placeholders that are already in the box.
    const tokenSpans = [];
    TOKEN_IN_TEXT.lastIndex = 0;
    let t;
    while ((t = TOKEN_IN_TEXT.exec(m.text))) if (lookup[t[0].slice(1, -1)] !== undefined) tokenSpans.push({ start: t.index, end: t.index + t[0].length });
    const topicSpans = settings.topics ? VeilDetect.topics(m.text) : [];
    const marks = [
      ...shown.map((s) => ({ start: s.start, end: s.end, kind: s.tier === 'check' ? 'check' : 'on' })),
      ...tokenSpans.map((s) => ({ ...s, kind: 'on' })),
      ...topicSpans.map((s) => ({ start: s.start, end: s.end, kind: 'topic' })),
    ].sort((a, b) => a.start - b.start);

    if (m.field) {
      ui.paintMirror(el, m.text, marks);
    } else if (hasHL) {
      hlTyping.clear(); hlCheck.clear(); hlTopic.clear();
      for (const s of marks) {
        try { (s.kind === 'topic' ? hlTopic : s.kind === 'check' ? hlCheck : hlTyping).add(D.range(m, s.start, s.end)); } catch {}
      }
    }

    const items = itemsFor(el, m, spans);
    // Details skipped only because they're on the "Never protect" list: listed (greyed) so
    // the user can see why and undo it.
    if (allow.length) {
      const allowSet = new Set(allow.map(T.allowKey));
      const seen = new Set(items.map((i) => i.key));
      for (const s of VeilDetect.detect(m.text, { ...detectOpts(), allow: [] })) {
        if (seen.has(s.key) || !allowSet.has(T.allowKey(s.value))) continue;
        seen.add(s.key);
        items.push({ key: s.key, type: s.type, value: s.value, token: null, on: false, allowed: true });
      }
    }
    // One row per sensitive topic (flagged, never swapped).
    const seenTopics = new Set();
    for (const tp of topicSpans) {
      if (seenTopics.has(tp.topic)) continue;
      seenTopics.add(tp.topic);
      items.push({ key: `topic:${tp.topic}`, type: 'TOPIC', label: tp.label, value: m.text.slice(tp.start, tp.end), topic: true, on: false });
    }
    lastScan = { el, text: m.text, marks, items, field: m.field };
    placeBadge();
  }

  // Scrolling/resizing only repositions; it never re-runs detection.
  let lastScan = null, watchTimer = 0;
  function placeBadge() {
    const l = lastScan;
    if (!l || !l.el.isConnected || !l.items.length) { ui.hideBadge(); stopWatch(); return; }
    startWatch();
    if (l.field) ui.paintMirror(l.el, l.text, l.marks);
    ui.showBadge(l.el, anchorFor(l.el), l.items, settings.strict);
  }

  // Sites often change the box without an input event (clearing it after send, swapping in a
  // new editor on "New chat"). While the badge is up, re-check the box a few times a second.
  function startWatch() {
    if (watchTimer) return;
    watchTimer = setInterval(() => {
      const l = lastScan;
      if (!l) { stopWatch(); return; }
      if (!l.el.isConnected) { typing.clear(); stopWatch(); return; }
      if (D.model(l.el).text !== l.text) scan(l.el);
    }, 400);
  }
  function stopWatch() { clearInterval(watchTimer); watchTimer = 0; }

  function onToggle(el, key, on) {
    if (!el) return;
    let set = excludedBy.get(el);
    if (!set) excludedBy.set(el, (set = new Set()));
    if (on) set.delete(key); else set.add(key);
    scan(el);
  }

  async function onNever(value) {
    try { await call({ type: 'addAllow', value }); } catch {}
  }

  async function onUnallow(value) {
    const k = T.allowKey(value);
    const entry = allow.find((a) => T.allowKey(a) === k);
    if (!entry) return;
    try { await call({ type: 'removeAllow', value: entry }); } catch {}
  }

  function onInput(e) {
    if (!alive) return;
    const el = D.editableRoot(e.target);
    if (!el || !isChatBox(el)) return;
    if (!stateReady) loadState();
    if (activeEditor && activeEditor !== el) typing.clear();
    activeEditor = el;
    scheduleScan(el);
    if (settings.strict && !bypass) scheduleStrict(el);
  }

  function onFocus(e) {
    const el = D.editableRoot(e.target);
    if (!el || !isChatBox(el)) return;
    if (!stateReady) loadState();
    if (activeEditor !== el) { typing.clear(); activeEditor = el; }
    scheduleScan(el);
  }

  let layoutQueued = false;
  function relayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      if (lastScan && lastScan.el === activeEditor) placeBadge();
      layoutChips();
    });
  }

  // ───────────────────────────── strict mode ─────────────────────────────
  // Swap each detail for its placeholder once it's finished (the caret has moved past it and
  // typing paused). Detection runs on the text with placeholders restored, so a name typed in
  // two steps ("Tayyab" … "Ali") is re-evaluated as one and gets one placeholder.

  let strictTimer = 0, composing = false;
  function scheduleStrict(el) {
    clearTimeout(strictTimer);
    strictTimer = setTimeout(() => strictPass(el).catch(() => {}), 450);
  }

  // Map an offset in restored text back to the editor text.
  function toSource(parts, off, edge) {
    let delta = 0;
    for (const p of parts || []) {
      if (off >= p.end) { delta += (p.to - p.from) - (p.end - p.start); continue; }
      if (off > p.start) return edge === 'start' ? p.from : p.to; // inside a restored value
      break;
    }
    return off + delta;
  }

  async function strictPass(el) {
    if (composing || !el.isConnected || !isChatBox(el) || !settings.strict) return;
    const m = D.model(el);
    const car = D.caret(m);
    const r = VeilTokens.restore(m.text, look);
    const view = r.text, parts = r.parts || [];
    const excluded = excludedBy.get(el) || new Set();
    const todo = [];
    for (const s of VeilDetect.detect(view, detectOpts())) {
      if (excluded.has(s.key)) continue;
      if (parts.some((p) => p.start === s.start && p.end === s.end)) continue; // already a placeholder
      const from = toSource(parts, s.start, 'start'), to = toSource(parts, s.end, 'end');
      const finished = car < 0 || car < from || car > to;
      if (finished) todo.push({ ...s, from, to });
    }
    if (!todo.length) return;
    const res = await call({ type: 'tokenize', items: todo.map((s) => ({ type: s.type, value: s.value })) });
    if (D.model(el).text !== m.text) { scheduleStrict(el); return; } // user kept typing; retry
    let caretPos = car;
    for (let i = todo.length - 1; i >= 0; i--) {
      const s = todo[i], tok = res.tokens[i];
      if (!tok) continue;
      bypass++;
      try { D.select(el, s.from, s.to); D.insert(el, tok); } finally { bypass--; }
      if (caretPos > s.to) caretPos += tok.length - (s.to - s.from);
    }
    if (caretPos >= 0) D.setCaret(el, caretPos);
    await loadState();
  }

  // ───────────────────────────── guards ─────────────────────────────

  let busy = false;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function unprotected(el) {
    const excluded = excludedBy.get(el) || new Set();
    return VeilDetect.detect(D.model(el).text, detectOpts()).filter((s) => !excluded.has(s.key));
  }
  const needsGuard = (el) => !!el && settings.sendGuard && isChatBox(el) && unprotected(el).length > 0;

  async function clickSend(el) {
    await frame();
    for (let i = 0; i < 10; i++) {
      const btn = findSendButton(el);
      if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
        bypass++;
        try { btn.click(); } finally { bypass--; }
        return;
      }
      await wait(40);
    }
    bypass++;
    try {
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    } finally { bypass--; }
  }

  async function guardSend(el) {
    if (busy) return;
    busy = true;
    try {
      const text = D.model(el).text;
      const excluded = [...(excludedBy.get(el) || [])];
      const res = await call({ type: 'sanitize', text, exclude: excluded, commit: true, hint: true });
      bypass++;
      try { D.selectAll(el); D.insert(el, res.text); } finally { bypass--; }
      await wait(30);
      await clickSend(el);
      excludedBy.delete(el);
      typing.clear();
    } catch {
      ui.toast('VEIL couldn’t protect this message, so it wasn’t sent. Reload the page and try again.', true);
    } finally {
      busy = false;
    }
  }

  function onKeyDown(e) {
    if (bypass || e.key !== 'Enter' || e.shiftKey || e.altKey || e.isComposing || e.keyCode === 229) return;
    const el = D.editableRoot(e.target);
    if (!el || (D.isField(el) && el.tagName === 'INPUT') || !needsGuard(el)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    guardSend(el);
  }

  function onClick(e) {
    if (bypass || !alive) return;
    const btn = e.target.closest && e.target.closest('button, [role="button"], input[type="submit"]');
    if (!btn || !isSendButton(btn)) return;
    const el = findComposer();
    if (!needsGuard(el)) return;
    // Heuristic matches must sit next to the composer ("Submit feedback" elsewhere is not a send).
    if (!(site && site.send.some((sel) => btn.matches(sel)))) {
      let scope = el, near = false;
      for (let i = 0; i < 6 && scope && !near; i++, scope = scope.parentElement) near = scope.contains(btn);
      if (!near) return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    guardSend(el);
  }

  function onSubmit(e) {
    if (bypass || !alive) return;
    const inner = e.target.querySelector && e.target.querySelector('textarea, [contenteditable="true"], [contenteditable=""]');
    const el = inner && D.editableRoot(inner);
    if (!needsGuard(el)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    guardSend(el);
  }

  async function onPaste(e) {
    if (bypass || !alive || !settings.pasteGuard) return;
    const el = D.editableRoot(e.target);
    const dt = e.clipboardData || e.dataTransfer;
    if (!el || !dt || !isChatBox(el)) return;
    const text = dt.getData('text/plain');
    if (!text || !VeilDetect.detect(text, detectOpts()).length) return;
    // Stop the page from ever seeing the raw clipboard text.
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      const res = await call({ type: 'sanitize', text, commit: true });
      el.focus();
      bypass++;
      try { D.insert(el, res.text); } finally { bypass--; }
      activeEditor = el;
      await loadState();
    } catch {
      ui.toast('VEIL couldn’t protect this paste. Reload the page and try again.', true);
    }
  }

  // Capture phase on window runs before any listener the page can register.
  window.addEventListener('paste', onPaste, true);
  window.addEventListener('drop', onPaste, true);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('submit', onSubmit, true);
  window.addEventListener('input', onInput, true);
  window.addEventListener('focusin', onFocus, true);
  window.addEventListener('compositionstart', () => { composing = true; }, true);
  window.addEventListener('compositionend', (e) => { composing = false; onInput(e); }, true);
  window.addEventListener('scroll', relayout, { capture: true, passive: true });
  window.addEventListener('resize', relayout, { passive: true });

  async function insertFromPanel(el, text, send) {
    if (!siteOn()) return { ok: false, error: 'VEIL is off on this site.' };
    bypass++;
    try { D.selectAll(el); D.insert(el, text); } finally { bypass--; }
    if (send) { await wait(30); await clickSend(el); }
    return { ok: true };
  }

  // ───────────────────────────── restore replies ─────────────────────────────

  const tracked = new Map(); // text node → { orig, shown, parts }
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'TEMPLATE']);
  const restoreOn = () => siteOn() && stateReady && settings.restoreInPage;
  let observing = false;

  function skipText(node) {
    const p = node.parentElement;
    if (!p || SKIP_TAGS.has(p.tagName)) return true;
    if (p.isContentEditable) return true; // never write real values into an editor
    return !!p.closest('[data-veil]');
  }

  function processText(node) {
    const v = node.nodeValue;
    const t = tracked.get(node);
    if (t && v === t.shown) return;
    if (!VeilTokens.mightContainToken(v)) { if (t) tracked.delete(node); return; }
    if (skipText(node)) { if (t) tracked.delete(node); noteEditable(node); return; }
    const r = VeilTokens.restore(v, look);
    if (!r.count) { tracked.delete(node); return; }
    tracked.set(node, { orig: v, shown: r.text, parts: r.parts });
    node.nodeValue = r.text;
  }

  // Placeholders split across adjacent text nodes (e.g. while streaming).
  function processSiblings(parent) {
    if (!parent || parent.nodeType !== 1 || SKIP_TAGS.has(parent.tagName) || parent.isContentEditable) return;
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        const joined = run.map((n) => n.nodeValue).join('');
        if (VeilTokens.mightContainToken(joined)) {
          const r = VeilTokens.restore(joined, look);
          if (r.count) {
            run.forEach((n, i) => {
              const shown = i === 0 ? r.text : '';
              tracked.set(n, { orig: n.nodeValue, shown, parts: i === 0 ? r.parts : [] });
              n.nodeValue = shown;
            });
          }
        }
      }
      run = [];
    };
    for (const c of parent.childNodes) { if (c.nodeType === 3) run.push(c); else flush(); }
    flush();
  }

  function walk(root) {
    if (!root || (root.nodeType === 1 && (root.hasAttribute('data-veil') || SKIP_TAGS.has(root.tagName)))) return;
    if (!VeilTokens.mightContainToken(root.textContent)) return;
    const parents = new Set();
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (VeilTokens.mightContainToken(n.nodeValue)) processText(n);
      if (n.parentNode) parents.add(n.parentNode);
    }
    for (const p of parents) if (VeilTokens.mightContainToken(p.textContent)) processSiblings(p);
  }

  // MutationObserver callbacks run before paint, so placeholders never flash on screen.
  const observer = new MutationObserver((muts) => {
    if (!restoreOn()) return;
    const parents = new Set();
    for (const m of muts) {
      if (m.type === 'attributes') { unrestoreEditable(m.target); continue; }
      if (m.type === 'characterData') {
        processText(m.target);
        if (m.target.parentNode) parents.add(m.target.parentNode);
      } else {
        for (const n of m.addedNodes) {
          if (n.nodeType === 3) { processText(n); if (n.parentNode) parents.add(n.parentNode); }
          else if (n.nodeType === 1) walk(n);
        }
      }
    }
    for (const p of parents) if (VeilTokens.mightContainToken(p.textContent)) processSiblings(p);
    unrestoreEditable(null);
    paintRestored();
    scheduleChips(true);
  });

  function startRestore() {
    if (!restoreOn()) return;
    if (!observing) {
      observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['contenteditable'] });
      observing = true;
    }
    walk(document.documentElement);
    paintRestored();
    scheduleChips(true);
  }
  function stopRestore() { if (observing) { observer.disconnect(); observing = false; } }

  function revertAll() {
    for (const [n, t] of tracked) if (n.isConnected && n.nodeValue === t.shown) n.nodeValue = t.orig;
    tracked.clear();
    paintRestored();
    scheduleChips(true);
  }

  // A reply can turn into an editor after it has streamed (e.g. ChatGPT's email blocks). Editors
  // read their DOM into the document the site saves, so any value restored there is put back to
  // its placeholder at once, and the block gets a "Copy with real values" button instead.
  function unrestoreEditable(scope) {
    for (const [n, t] of tracked) {
      const p = n.parentElement;
      if (!p || !p.isContentEditable || (scope && !scope.contains(n))) continue;
      if (n.nodeValue === t.shown) n.nodeValue = t.orig;
      tracked.delete(n);
      if (t.orig) noteEditable(n);
    }
  }

  // Same soft green as while typing, drawn by the CSS Highlight API (no DOM changes).
  let paintQueued = false;
  function paintRestored() {
    if (!hlRestored || paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(() => {
      paintQueued = false;
      unrestoreEditable(null);
      hlRestored.clear();
      for (const [n, t] of tracked) {
        if (!n.isConnected) { tracked.delete(n); continue; }
        if (!settings.highlight || !restoreOn() || n.nodeValue !== t.shown) continue;
        for (const p of t.parts) {
          if (p.end > n.length) continue;
          const r = new Range();
          r.setStart(n, p.start); r.setEnd(n, p.end);
          hlRestored.add(r);
        }
      }
    });
  }

  // ─────────────── editable reply blocks → "Copy with real values" ───────────────
  // Some replies render inside editors (e.g. ChatGPT's email blocks). Editors read DOM edits back
  // into their document and the site may save them, so real values are never written there.

  const blocks = new Set();
  let chipsQueued = false, chipsRecheck = false;

  function noteEditable(node) {
    const p = node.parentElement;
    if (!p || !p.isContentEditable) return;
    const root = D.editableRoot(p);
    if (!root || root === activeEditor || isChatBox(root) || blocks.has(root)) return;
    blocks.add(root);
    scheduleChips(true);
  }

  function scheduleChips(recheck) {
    if (recheck) chipsRecheck = true;
    if (chipsQueued || !blocks.size) return;
    chipsQueued = true;
    requestAnimationFrame(layoutChips);
  }

  function layoutChips() {
    chipsQueued = false;
    const recheck = chipsRecheck;
    chipsRecheck = false;
    for (const b of [...blocks]) {
      if (!b.isConnected || !restoreOn() || (recheck && !VeilTokens.restore(b.innerText, look).count)) {
        blocks.delete(b); ui.dropChip(b); continue;
      }
      ui.chip(b, async (block) => {
        const text = VeilTokens.restore(block.innerText, look).text;
        ui.toast((await writeClipboard(text, null)) ? 'Copied with real values' : 'Copy failed', false);
      });
    }
  }

  // ───────────────────────────── copying ─────────────────────────────

  const escHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function restoreHtml(html) {
    return html.replace(/>([^<]*)</g, (all, txt) => {
      if (!VeilTokens.mightContainToken(txt)) return all;
      const r = VeilTokens.restore(txt, (k) => (lookup[k] === undefined ? undefined : escHtml(lookup[k])), undefined, escHtml);
      return `>${r.text}<`;
    });
  }

  async function writeClipboard(text, html) {
    try {
      if (html && typeof ClipboardItem === 'function') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      return true;
    } catch {
      return false;
    }
  }

  // The site's own "Copy" buttons (via the page-world bridge).
  window.addEventListener('message', async (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.__veil !== 'copy' || typeof d.text !== 'string') return;
    let ok = false;
    if (restoreOn()) {
      const r = VeilTokens.restore(d.text, look);
      if (r.count) ok = await writeClipboard(r.text, typeof d.html === 'string' ? restoreHtml(d.html) : null);
    }
    window.postMessage({ __veil: 'copied', id: d.id, ok }, location.origin === 'null' ? '*' : location.origin);
  });

  // Copy events where the site fills the clipboard itself (e.g. copying markdown source).
  window.addEventListener('copy', (e) => {
    if (!restoreOn() || !e.clipboardData) return;
    const t = e.clipboardData.getData('text/plain');
    if (!t || !VeilTokens.mightContainToken(t)) return;
    const r = VeilTokens.restore(t, look);
    if (!r.count) return;
    const h = e.clipboardData.getData('text/html');
    e.clipboardData.setData('text/plain', r.text);
    if (h) e.clipboardData.setData('text/html', restoreHtml(h));
    e.preventDefault();
  });
})();
