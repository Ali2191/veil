/* VEIL — side panel. */
(() => {
  'use strict';
  const T = VeilTypes;
  const $ = (s) => document.querySelector(s);
  const h = (tag, props = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.append(k);
    return el;
  };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ICON_X = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('width', '12'); s.setAttribute('height', '12'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'; return s; };
  const ICON_BAN = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('width', '13'); s.setAttribute('height', '13'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 17.5l11-11" stroke="currentColor" stroke-width="2"/>'; return s; };

  async function bg(msg) {
    const r = await chrome.runtime.sendMessage(msg);
    if (r && r.error) throw new Error(r.error);
    return r;
  }

  let settings = { ...VeilSettings.DEFAULTS };
  let state = { terms: [], allow: [] };
  let tab = null;               // { id, site, active, composer }
  let excluded = new Set();     // keys the user chose to send as-is for this prompt
  let tokenByKey = new Map();   // latest placeholder per key, from the vault
  let spans = [];
  let topicSpans = [];
  let dict = null;              // name/place dictionaries (packaged files)
  let known = [];               // values protected before (learning)
  const home = VeilPhone.homeRegions();
  VeilDict.fetchRaw().then((raw) => { dict = VeilDict.build(raw); refresh(true); }).catch(() => {});

  // ───────────────────────────── toast ─────────────────────────────

  let toastTimer = 0;
  function toast(text, err) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.toggle('err', !!err);
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), err ? 3500 : 1800);
  }

  // ───────────────────────────── tabs ─────────────────────────────

  function showTab(name) {
    for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
    for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== `view-${name}`;
    $('#actions').hidden = name !== 'compose';
    try { localStorage.setItem('veil.tab', name); } catch {}
    if (name === 'vault') renderVault();
    if (name === 'compose') $('#input').focus();
    if (name === 'restore') $('#r-input').focus();
  }
  for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => showTab(b.dataset.tab));

  // ───────────────────────────── active site ─────────────────────────────

  async function refreshSite() {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    tab = null;
    if (t && t.id !== undefined) {
      try {
        const r = await chrome.tabs.sendMessage(t.id, { type: 'veil:ping' });
        if (r) tab = { ...r, id: t.id, site: r.site || r.host };
      } catch { /* not a supported site, or page still loading */ }
    }
    const el = $('#site');
    el.classList.toggle('on', !!tab && tab.active);
    el.classList.toggle('paused', !!tab && !tab.active);
    el.querySelector('span').textContent = tab ? (tab.active ? `${tab.site} · protected` : `${tab.site} · off`) : 'No page to protect';
    el.title = tab ? '' : 'Open any AI chat. You can still copy protected text from here.';
    updateButtons();
  }
  chrome.tabs.onActivated.addListener(refreshSite);
  chrome.tabs.onUpdated.addListener((id, info) => { if (info.status === 'complete' || info.url) refreshSite(); });
  chrome.windows.onFocusChanged.addListener(refreshSite);

  // ───────────────────────────── compose ─────────────────────────────

  const input = $('#input');
  const hl = $('#hl');

  function detectOpts() { return { types: settings.types, terms: state.terms, allow: state.allow, known, dict, home }; }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight + 2, window.innerHeight * 0.5)}px`;
  }

  function paintHighlights(text) {
    let html = '', cur = 0;
    const marks = [...spans.map((s) => ({ ...s, cls: excluded.has(s.key) ? 'off' : s.tier === 'check' ? 'check' : '' })),
      ...topicSpans.map((t) => ({ ...t, cls: 'topic' }))].sort((a, b) => a.start - b.start);
    for (const s of marks) {
      if (s.start < cur) continue;
      html += esc(text.slice(cur, s.start));
      html += `<mark class="${s.cls}">${esc(text.slice(s.start, s.end))}</mark>`;
      cur = s.end;
    }
    // Trailing newline needs a character so the backdrop keeps the same height.
    html += esc(text.slice(cur)) + '​';
    hl.innerHTML = html;
    hl.parentElement.scrollTop = input.scrollTop;
  }

  function renderItems() {
    const list = $('#items');
    list.textContent = '';
    const groups = new Map();
    for (const s of spans) {
      const g = groups.get(s.key);
      if (g) g.n++; else groups.set(s.key, { ...s, n: 1 });
    }
    const protectedN = [...groups.keys()].filter((k) => !excluded.has(k)).length;
    $('#count').textContent = groups.size
      ? `${protectedN} of ${groups.size} ${groups.size === 1 ? 'item' : 'items'} protected`
      : (input.value.trim() ? 'No private details found' : 'Nothing to protect yet');

    const topicLabels = [...new Set(topicSpans.map((t) => t.label))];
    if (topicLabels.length) list.append(h('li', { class: 'topic-note' }, `Sensitive topic: ${topicLabels.join(', ')}. Not replaced, so consider rephrasing.`));
    for (const g of groups.values()) {
      const off = excluded.has(g.key);
      const cb = h('input', { type: 'checkbox', 'aria-label': `Protect ${g.value}` });
      cb.checked = !off;
      cb.addEventListener('change', () => {
        if (cb.checked) excluded.delete(g.key); else excluded.add(g.key);
        refresh(true);
      });
      list.append(h('li', { class: `item${off ? ' off' : ''}` },
        h('span', { class: 'type', title: g.tier === 'check' ? 'Less certain. Protected, but worth a look.' : T.TYPES[g.type].label }, T.TYPES[g.type].label, g.tier === 'check' ? h('em', { class: 'maybe' }, 'check') : null),
        h('span', { class: 'val' },
          h('span', { class: 'v', title: g.value }, g.value, g.n > 1 ? h('span', { class: 'times' }, `×${g.n}`) : null),
          h('span', { class: 'tok' }, off ? 'sent as is' : (tokenByKey.get(g.key) || '…'))),
        h('button', { class: 'icon', title: 'Never protect this', 'aria-label': `Never protect ${g.value}`, onclick: async (e) => {
          const b = e.currentTarget;
          // Permanent, so it takes a second click.
          if (!b.dataset.armed) {
            b.dataset.armed = '1'; b.classList.add('armed'); b.title = 'Click again to never protect this';
            setTimeout(() => { delete b.dataset.armed; b.classList.remove('armed'); b.title = 'Never protect this'; }, 2500);
            return;
          }
          await bg({ type: 'addAllow', value: g.value });
          toast(`“${g.value}” won’t be protected. Undo in Vault.`);
        } }, ICON_BAN()),
        h('label', { class: 'switch', title: off ? 'Protect' : 'Send as is' }, cb, h('span'))));
    }
  }

  // Local detection is instant; placeholder numbers come from the vault (debounced).
  let seq = 0, timer = 0;
  function refresh(immediate) {
    const text = input.value;
    spans = VeilDetect.detect(text, detectOpts());
    topicSpans = settings.topics ? VeilDetect.topics(text) : [];
    paintHighlights(text);
    renderItems();
    updateButtons();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const my = ++seq;
      if (!text.trim()) { $('#preview').textContent = ''; return; }
      try {
        const res = await bg({ type: 'sanitize', text, exclude: [...excluded] });
        if (my !== seq) return;
        tokenByKey = new Map(res.items.filter((i) => i.token).map((i) => [i.key, i.token]));
        $('#preview').textContent = res.text;
        renderItems();
      } catch {}
    }, immediate ? 0 : 90);
  }

  input.addEventListener('input', () => { autosize(); refresh(); });
  input.addEventListener('scroll', () => { hl.parentElement.scrollTop = input.scrollTop; });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (tab && tab.active) deliver(true); else copyProtected();
    }
  });

  function updateButtons() {
    const has = !!input.value.trim();
    $('#copy').disabled = !has;
    $('#insert').disabled = !has || !tab || !tab.active;
    $('#send').disabled = !has || !tab || !tab.active;
  }

  async function commit() {
    return bg({ type: 'sanitize', text: input.value, exclude: [...excluded], commit: true, hint: true, tabId: tab && tab.id });
  }

  function resetComposer() {
    input.value = '';
    excluded.clear();
    tokenByKey.clear();
    autosize();
    refresh(true);
  }

  async function deliver(send) {
    if (!input.value.trim() || !tab) return;
    try {
      const res = await commit();
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'veil:insert', text: res.text, send });
      if (!r || !r.ok) throw new Error((r && r.error) || 'Could not reach the page. Reload it and try again.');
      resetComposer();
      toast(send ? `Sent to ${tab.site}` : `Inserted into ${tab.site}`);
    } catch (e) {
      toast(e.message || String(e), true);
    }
  }

  async function copyProtected() {
    if (!input.value.trim()) return;
    try {
      const res = await commit();
      await navigator.clipboard.writeText(res.text);
      toast('Protected text copied');
    } catch (e) { toast(e.message || 'Copy failed', true); }
  }

  $('#send').addEventListener('click', () => deliver(true));
  $('#insert').addEventListener('click', () => deliver(false));
  $('#copy').addEventListener('click', copyProtected);

  // Protect a selection the detector missed.
  const selbar = $('#selbar');
  function typeOptions(select, preferred) {
    select.textContent = '';
    for (const k of ['PERSON', 'ADDRESS', 'PHONE', 'EMAIL', 'ORG', 'NATIONAL_ID', 'PASSPORT', 'LICENSE', 'HEALTH_ID', 'ACCOUNT', 'SECRET', 'TERM']) {
      select.append(h('option', { value: k }, T.TYPES[k].label));
    }
    select.value = preferred || 'TERM';
  }
  function onSelect() {
    const s = input.value.slice(input.selectionStart, input.selectionEnd).trim();
    if (s.length < 2 || s.length > 120 || s.includes('\n') || spans.some((sp) => sp.value === s)) { selbar.hidden = true; return; }
    $('#sel-text').textContent = s;
    typeOptions($('#sel-type'), /^\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+){0,3}$/u.test(s) ? 'PERSON' : /\d/.test(s) ? 'ACCOUNT' : 'TERM');
    selbar.hidden = false;
  }
  input.addEventListener('select', onSelect);
  input.addEventListener('mouseup', onSelect);
  input.addEventListener('keyup', (e) => { if (e.shiftKey || e.key.startsWith('Arrow')) onSelect(); });
  $('#sel-add').addEventListener('click', async () => {
    const value = $('#sel-text').textContent;
    await bg({ type: 'addTerm', value, type: $('#sel-type').value });
    selbar.hidden = true;
    toast(`“${value}” will always be protected`);
  });

  // ───────────────────────────── restore ─────────────────────────────

  let rTimer = 0;
  const rInput = $('#r-input');
  rInput.addEventListener('input', () => {
    clearTimeout(rTimer);
    rTimer = setTimeout(async () => {
      const text = rInput.value;
      const out = $('#r-output');
      if (!text.trim()) { out.textContent = ''; $('#r-count').textContent = ''; $('#r-copy').disabled = true; return; }
      const r = await bg({ type: 'restore', text });
      out.textContent = '';
      let cur = 0;
      for (const p of r.parts || []) {
        out.append(r.text.slice(cur, p.start), h('mark', { title: p.token }, r.text.slice(p.start, p.end)));
        cur = p.end;
      }
      out.append(r.text.slice(cur));
      out.dataset.text = r.text;
      $('#r-count').textContent = r.count ? `${r.count} ${r.count === 1 ? 'value' : 'values'} restored` : 'No known placeholders found';
      $('#r-copy').disabled = false;
    }, 60);
  });
  $('#r-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('#r-output').dataset.text || '');
    toast('Restored text copied');
  });

  // ───────────────────────────── vault ─────────────────────────────

  let vaultData = { entries: [], terms: [], allow: [] };
  let clearArmed = 0;

  async function renderVault() {
    try { vaultData = await bg({ type: 'vaultList' }); } catch { return; }

    const terms = $('#terms');
    terms.textContent = '';
    if (!vaultData.terms.length) terms.append(h('li', { class: 'empty' }, 'Add your name, phone or address so they are always caught.'));
    for (const t of vaultData.terms) {
      terms.append(h('li', {},
        h('span', { class: 'main', title: t.value }, h('span', { class: 'sub' }, T.TYPES[t.type]?.label || t.type), t.value),
        h('button', { class: 'icon', title: 'Remove', 'aria-label': `Remove ${t.value}`, onclick: () => bg({ type: 'removeTerm', value: t.value }) }, ICON_X())));
    }

    const allows = $('#allows');
    allows.textContent = '';
    if (!vaultData.allow.length) allows.append(h('li', { class: 'empty' }, 'Nothing here yet.'));
    for (const a of vaultData.allow) {
      allows.append(h('li', {},
        h('span', { class: 'main', title: a }, a),
        h('button', { class: 'icon', title: 'Remove', 'aria-label': `Remove ${a}`, onclick: () => bg({ type: 'removeAllow', value: a }) }, ICON_X())));
    }
    renderMaps();
  }

  function renderMaps() {
    const q = $('#map-search').value.trim().toLowerCase();
    const list = $('#maps');
    list.textContent = '';
    const rows = vaultData.entries.filter((e) => !q || e.value.toLowerCase().includes(q) || e.token.toLowerCase().includes(q));
    $('#map-count').textContent = vaultData.entries.length ? `· ${vaultData.entries.length}` : '';
    $('#clear-maps').disabled = !vaultData.entries.length;
    if (!rows.length) list.append(h('li', { class: 'empty' }, q ? 'No matches.' : 'Placeholders you create appear here.'));
    for (const e of rows.slice(0, 300)) {
      list.append(h('li', {},
        h('span', { class: 'main', title: `${e.token} → ${e.value}` }, h('span', { class: 'tok' }, e.token), e.value),
        h('button', { class: 'icon', title: 'Forget', 'aria-label': `Forget ${e.token}`, onclick: () => bg({ type: 'deleteToken', token: e.token }) }, ICON_X())));
    }
  }

  $('#map-search').addEventListener('input', renderMaps);
  $('#clear-maps').addEventListener('click', async () => {
    const b = $('#clear-maps');
    if (Date.now() - clearArmed > 3000) {
      clearArmed = Date.now();
      b.textContent = 'Click again to clear';
      setTimeout(() => { b.textContent = 'Clear all'; }, 3000);
      return;
    }
    clearArmed = 0;
    b.textContent = 'Clear all';
    await bg({ type: 'clearMappings' });
    toast('All placeholders cleared');
  });

  $('#term-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = $('#term-value').value.trim();
    if (!value) return;
    const r = await bg({ type: 'addTerm', value, type: $('#term-type').value });
    if (r.ok) $('#term-value').value = ''; else toast('Already in the list', true);
  });
  $('#allow-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = $('#allow-value').value.trim();
    if (!value) return;
    const r = await bg({ type: 'addAllow', value });
    if (r.ok) $('#allow-value').value = ''; else toast('Already in the list', true);
  });

  // ───────────────────────────── settings ─────────────────────────────

  function toggle(label, help, checked, onChange) {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = checked;
    cb.addEventListener('change', () => onChange(cb.checked));
    return h('label', { class: 'toggle' },
      h('span', { class: 't' }, label, help ? h('small', {}, help) : null),
      h('span', { class: 'switch' }, cb, h('span')));
  }

  const save = (patch) => VeilSettings.set(patch);

  function renderSettings() {
    const p = $('#set-protection');
    p.textContent = '';
    p.append(
      toggle('Enabled', 'Pause VEIL everywhere without uninstalling.', settings.enabled, (v) => save({ enabled: v })),
      toggle('Protect pasted text', 'Clean clipboard text before the site can read it.', settings.pasteGuard, (v) => save({ pasteGuard: v })),
      toggle('Check messages before sending', 'Swaps private details for placeholders when you press Send.', settings.sendGuard, (v) => save({ sendGuard: v })),
      toggle('Strict mode', 'Swap each detail the moment you finish typing it, so the site never holds it in the text box. Experimental.', settings.strict, (v) => save({ strict: v })),
      toggle('Show real values in replies', 'Off keeps placeholders on the page; read replies in Restore instead.', settings.restoreInPage, (v) => save({ restoreInPage: v })),
      toggle('Highlight restored values', null, settings.highlight, (v) => save({ highlight: v })),
      toggle('Ask the AI to keep placeholders', 'Adds one short note to the first protected message in a chat.', settings.hint, (v) => save({ hint: v })),
      toggle('Flag sensitive topics', 'Health, legal, money and similar details about you get a wavy amber underline. They’re never replaced.', settings.topics, (v) => save({ topics: v })),
    );

    const t = $('#set-types');
    t.textContent = '';
    for (const k of T.TYPE_KEYS) {
      if (k === 'TERM') continue;
      t.append(toggle(T.TYPES[k].label, null, settings.types.includes(k), (v) => {
        const set = new Set(settings.types);
        if (v) set.add(k); else set.delete(k);
        save({ types: T.TYPE_KEYS.filter((x) => set.has(x) || x === 'TERM') });
      }));
    }

    $('#set-retention').value = String(settings.retentionDays);

    const s = $('#set-sites');
    s.textContent = '';
    const rules = Object.entries(settings.siteRules).sort(([a], [b]) => a.localeCompare(b));
    if (!rules.length) s.append(h('li', { class: 'empty' }, 'No exceptions. Turn VEIL off on a site from the toolbar icon.'));
    for (const [hostName, state] of rules) {
      s.append(h('li', {},
        h('span', { class: 'main', title: hostName }, h('span', { class: 'sub' }, state === 'off' ? 'Off' : 'On'), hostName),
        h('button', { class: 'icon', title: 'Remove exception', 'aria-label': `Remove exception for ${hostName}`, onclick: () => {
          const next = { ...settings.siteRules };
          delete next[hostName];
          save({ siteRules: next });
        } }, ICON_X())));
    }
  }
  $('#set-retention').addEventListener('change', async (e) => {
    await save({ retentionDays: Number(e.target.value) });
    await bg({ type: 'prune' });
  });

  // ───────────────────────────── sync ─────────────────────────────

  async function loadState() {
    try { state = await bg({ type: 'state' }); } catch {}
    known = Object.entries(state.lookup || {}).map(([k, v]) => ({ type: k.slice(0, k.lastIndexOf('_')), value: v })).filter((x) => T.TYPES[x.type]);
    refresh(true);
    if (!$('#view-vault').hidden) renderVault();
  }

  chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === 'veil:changed') loadState(); });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.settings) return;
    settings = { ...VeilSettings.DEFAULTS, ...(VeilSettings.withNewTypes(ch.settings.newValue) || {}) };
    renderSettings();
    refresh(true);
    refreshSite();
  });

  (async () => {
    settings = await VeilSettings.get();
    typeOptions($('#term-type'), 'PERSON');
    renderSettings();
    let last = 'compose';
    try { last = localStorage.getItem('veil.tab') || 'compose'; } catch {}
    showTab(['compose', 'restore', 'vault', 'settings'].includes(last) ? last : 'compose');
    autosize();
    await Promise.all([loadState(), refreshSite()]);
  })();
})();
