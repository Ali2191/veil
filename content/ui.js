/* VEIL — in-page UI. Everything lives in one closed shadow root on a fixed, click-through
   layer, so page scripts can neither read it nor restyle it, and the page's own DOM is untouched. */
(function (root) {
  'use strict';
  const T = root.VeilTypes;

  const SHIELD = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6l7-3z"/></svg>';
  const BAN = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 17.5l11-11" stroke="currentColor" stroke-width="2"/></svg>';

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .layer { position: fixed; inset: 0; pointer-events: none; font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      --bg:#ffffff; --fg:#111113; --muted:#6b6b76; --faint:#9a9aa3; --line:#e6e6ea; --surface:#f5f5f7; --accent:#0f9d74; --mark:rgba(16,185,129,.22); --shadow:0 8px 28px rgba(0,0,0,.14); }
    @media (prefers-color-scheme: dark) { .layer { --bg:#1b1b1f; --fg:#ececef; --muted:#a0a0aa; --faint:#72727c; --line:#2c2c32; --surface:#232329; --accent:#34d399; --mark:rgba(52,211,153,.24); --shadow:0 8px 28px rgba(0,0,0,.5); } }
    button { font: inherit; color: inherit; cursor: pointer; }

    .badge { position: fixed; pointer-events: auto; display: none; align-items: center; gap: 5px; height: 24px; padding: 0 9px 0 7px;
      background: var(--bg); color: var(--accent); border: 1px solid var(--line); border-radius: 999px; box-shadow: 0 2px 8px rgba(0,0,0,.08);
      font-weight: 600; font-size: 12px; font-variant-numeric: tabular-nums; transition: transform .12s ease; }
    .badge.on { display: inline-flex; }
    .badge:hover { transform: translateY(-1px); }
    .badge span { color: var(--fg); }
    .badge .dot { width: 6px; height: 6px; border-radius: 50%; background: #d97706; margin-left: 1px; }
    .maybe { font-style: normal; font-weight: 600; margin-left: 6px; padding: 0 5px; border-radius: 4px; background: rgba(16,185,129,.14); color: var(--accent); text-transform: none; letter-spacing: 0; }
    .row.topic { grid-template-columns: minmax(0,1fr); }
    .row.topic .val { color: #b45309; font-weight: 550; }
    @media (prefers-color-scheme: dark) { .row.topic .val { color: #f59e0b; } }

    .pop { position: fixed; pointer-events: auto; display: none; width: 320px; max-height: 360px; overflow: auto;
      background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 6px; }
    .pop.on { display: block; }
    .head { display: flex; align-items: center; gap: 6px; padding: 7px 8px 8px; font-weight: 600; font-size: 12px; color: var(--muted); }
    .head svg { color: var(--accent); }
    .row { display: grid; grid-template-columns: minmax(0,1fr) auto auto; align-items: center; gap: 6px; padding: 7px 8px; border-radius: 8px; }
    .row:hover { background: var(--surface); }
    .meta { min-width: 0; }
    .val { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub { display: block; font-size: 11px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub b { font-weight: 600; letter-spacing: .04em; text-transform: uppercase; font-size: 10px; margin-right: 6px; color: var(--muted); }
    .row.off .val { color: var(--muted); }
    .row.off .tok { text-decoration: line-through; }
    .tok { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
    .icon { width: 24px; height: 24px; display: inline-grid; place-items: center; border: 0; background: none; color: var(--faint); border-radius: 6px; padding: 0; }
    .icon:hover { color: var(--fg); background: var(--line); }
    .icon.armed { color: #fff; background: #c2372b; }
    .undo { grid-column: 2 / 4; border: 1px solid var(--line); background: var(--bg); border-radius: 7px; padding: 3px 10px; font-size: 12px; font-weight: 550; color: var(--accent); }
    .undo:hover { background: var(--surface); }
    .sw { position: relative; width: 30px; height: 18px; border: 0; padding: 0; border-radius: 999px; background: var(--line); transition: background .15s; }
    .sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .15s; }
    .sw[aria-checked="true"] { background: var(--accent); }
    .sw[aria-checked="true"]::after { transform: translateX(12px); }
    .foot { padding: 6px 8px 4px; font-size: 11px; color: var(--faint); }

    .mirror { position: fixed; overflow: hidden; color: transparent; pointer-events: none; white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; border-color: transparent !important; background: transparent !important; }
    .mirror mark { color: transparent; background: var(--mark); border-radius: 3px; }
    .mirror mark.check { background: rgba(16,185,129,.1); text-decoration: underline dotted rgba(16,185,129,.9); text-underline-offset: 3px; }
    .mirror mark.topic { background: none; text-decoration: underline wavy rgba(217,119,6,.85); text-underline-offset: 3px; }

    .chip { position: fixed; pointer-events: auto; display: none; align-items: center; gap: 6px; height: 28px; padding: 0 11px 0 9px;
      background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 999px; box-shadow: 0 3px 12px rgba(0,0,0,.1); font-weight: 500; font-size: 12px; white-space: nowrap; }
    .chip.on { display: inline-flex; }
    .chip svg { color: var(--accent); }
    .chip:hover { background: var(--surface); }

    .toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 6px); opacity: 0; transition: opacity .16s, transform .16s;
      display: flex; align-items: center; gap: 8px; padding: 9px 14px 9px 11px; border-radius: 999px; white-space: nowrap;
      background: #111827; color: #f9fafb; font-weight: 500; box-shadow: var(--shadow); }
    .toast.on { opacity: 1; transform: translate(-50%, 0); }
    .toast.err { background: #8f1d15; }
  `;

  function create(handlers) {
    let host, shadow, layer, badge, pop, toastEl, toastTimer = 0;
    const mirrors = new Map(); // textarea → mirror div
    const chips = new Map();   // block → chip button
    let popFor = null;         // editor the popover belongs to
    let lastItems = [];

    function ensure() {
      if (host && host.isConnected) return;
      if (!host) {
        host = document.createElement('veil-layer');
        host.setAttribute('data-veil', '');
        host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
        shadow = host.attachShadow({ mode: 'closed' });
        shadow.innerHTML = `<style>${CSS}</style><div class="layer"></div>`;
        layer = shadow.querySelector('.layer');
        badge = el('button', 'badge');
        badge.type = 'button';
        badge.addEventListener('mousedown', (e) => e.preventDefault()); // keep the editor's focus
        badge.addEventListener('click', (e) => { e.stopPropagation(); pop.classList.contains('on') ? closePop() : openPop(); });
        pop = el('div', 'pop');
        pop.addEventListener('mousedown', (e) => e.preventDefault());
        toastEl = el('div', 'toast');
        toastEl.setAttribute('role', 'status');
        layer.append(badge, pop, toastEl);
        document.addEventListener('mousedown', (e) => { if (!e.composedPath().includes(host)) closePop(); }, true);
      }
      (document.body || document.documentElement).appendChild(host);
    }
    const el = (tag, cls) => { const x = document.createElement(tag); if (cls) x.className = cls; return x; };

    // ─────────────── badge + popover ───────────────

    function showBadge(editor, anchor, items, strict) {
      ensure();
      lastItems = items;
      popFor = editor;
      const n = items.filter((i) => i.on && !i.allowed && !i.topic).length;
      if (!items.length) { hideBadge(); return; }
      const topicsN = items.filter((i) => i.topic).length;
      badge.innerHTML = `${SHIELD}<span>${n}</span>${topicsN ? '<i class="dot" aria-hidden="true"></i>' : ''}`;
      badge.title = `VEIL: ${n} private ${n === 1 ? 'detail' : 'details'} protected${items.some((i) => (!i.on || i.allowed) && !i.topic) ? ' (some skipped)' : ''}${topicsN ? ' · sensitive topic flagged' : ''}. Click to review.`;
      badge.classList.add('on');
      const r = anchor.getBoundingClientRect();
      const w = badge.offsetWidth || 44, h = badge.offsetHeight || 24;
      badge.style.left = `${Math.max(6, Math.min(r.right - w - 14, innerWidth - w - 6))}px`;
      badge.style.top = `${Math.max(6, r.top - h / 2)}px`;
      badge.dataset.strict = strict ? '1' : '';
      if (pop.classList.contains('on')) renderPop();
    }

    function hideBadge() {
      if (!badge) return;
      badge.classList.remove('on');
      closePop();
    }

    function openPop() { renderPop(); pop.classList.add('on'); placePop(); }
    function closePop() { if (pop) pop.classList.remove('on'); }

    function placePop() {
      const b = badge.getBoundingClientRect();
      const ph = pop.offsetHeight, pw = pop.offsetWidth;
      const left = Math.max(8, Math.min(b.right - pw, innerWidth - pw - 8));
      const above = b.top - ph - 8;
      pop.style.left = `${left}px`;
      pop.style.top = `${above > 8 ? above : Math.min(b.bottom + 8, innerHeight - ph - 8)}px`;
    }

    function renderPop() {
      pop.textContent = '';
      const head = el('div', 'head');
      head.innerHTML = `${SHIELD}<span>VEIL · private details in this message</span>`;
      pop.append(head);
      for (const it of lastItems) {
        if (it.topic) {
          const row = el('div', 'row topic');
          const meta = el('div', 'meta');
          const val = el('span', 'val'); val.textContent = it.label; val.title = it.value;
          const sub = el('span', 'sub'); sub.textContent = `Sensitive topic · not replaced (“${it.value}”)`;
          meta.append(val, sub);
          row.append(meta);
          pop.append(row);
          continue;
        }
        const row = el('div', `row${it.on ? '' : ' off'}`);
        const meta = el('div', 'meta');
        const val = el('span', 'val'); val.textContent = it.value; val.title = it.value;
        const sub = el('span', 'sub');
        const b = el('b'); b.textContent = T.TYPES[it.type].label;
        if (it.tier === 'check' && !it.allowed) { const c = el('em', 'maybe'); c.textContent = 'check'; c.title = 'Less certain. Protected, but worth a look.'; b.append(c); }
        const tok = el('span', 'tok'); tok.textContent = it.allowed ? 'never protected' : it.on ? (it.token || 'placeholder') : 'sent as is';
        sub.append(b, tok);
        meta.append(val, sub);
        if (it.allowed) {
          row.classList.add('off');
          const undo = el('button', 'undo');
          undo.type = 'button'; undo.textContent = 'Undo'; undo.title = 'Remove from “Never protect” and protect it again';
          undo.addEventListener('click', () => handlers.onUnallow(it.value));
          row.append(meta, undo);
          pop.append(row);
          continue;
        }
        const never = el('button', 'icon');
        never.type = 'button'; never.title = 'Never protect this'; never.innerHTML = BAN;
        never.addEventListener('click', () => {
          // Permanent, so it takes a second click.
          if (never.dataset.armed) { handlers.onNever(it.value); return; }
          never.dataset.armed = '1';
          never.classList.add('armed');
          never.title = 'Click again to never protect this';
          setTimeout(() => { delete never.dataset.armed; never.classList.remove('armed'); never.title = 'Never protect this'; }, 2500);
        });
        const sw = el('button', 'sw');
        sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(it.on));
        sw.title = it.on ? 'Send this one as is' : 'Protect';
        sw.addEventListener('click', () => handlers.onToggle(popFor, it.key, !it.on));
        row.append(meta, never, sw);
        pop.append(row);
      }
      const foot = el('div', 'foot');
      foot.textContent = badge.dataset.strict ? 'Swapped for placeholders as you type.' : 'Swapped for placeholders when you send.';
      pop.append(foot);
      if (pop.classList.contains('on')) placePop();
    }

    // ─────────────── textarea highlight mirror ───────────────

    const COPY = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch', 'lineHeight', 'letterSpacing', 'wordSpacing',
      'textTransform', 'textIndent', 'textAlign', 'direction', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'boxSizing'];

    function paintMirror(ta, text, spans) {
      ensure();
      let m = mirrors.get(ta);
      if (!spans.length) { if (m) { m.remove(); mirrors.delete(ta); } return; }
      if (!m) { m = el('div', 'mirror'); layer.prepend(m); mirrors.set(ta, m); }
      const cs = getComputedStyle(ta);
      for (const k of COPY) m.style[k] = cs[k];
      const r = ta.getBoundingClientRect();
      Object.assign(m.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      // Account for the textarea's vertical scrollbar so line wrapping matches.
      m.style.paddingRight = `${parseFloat(cs.paddingRight) + (ta.offsetWidth - ta.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth))}px`;
      m.textContent = '';
      let cur = 0;
      for (const s of spans) {
        m.append(text.slice(cur, s.start));
        if (s.start < cur) continue; // overlapping topic/detail: keep the first
        const mk = el('mark', s.kind && s.kind !== 'on' ? s.kind : ''); mk.textContent = text.slice(s.start, s.end);
        m.append(mk);
        cur = s.end;
      }
      m.append(text.slice(cur) + '​');
      m.scrollTop = ta.scrollTop;
      m.scrollLeft = ta.scrollLeft;
    }

    function clearMirrors(except) {
      for (const [ta, m] of mirrors) if (ta !== except) { m.remove(); mirrors.delete(ta); }
    }

    // ─────────────── "copy with real values" chips ───────────────

    function chip(block, onClick) {
      ensure();
      let c = chips.get(block);
      if (!c) {
        c = el('button', 'chip');
        c.type = 'button';
        c.innerHTML = `${SHIELD}<span>Copy with real values</span>`;
        c.title = 'VEIL: copy this block with your real details filled in';
        c.addEventListener('click', (e) => { e.stopPropagation(); onClick(block); });
        layer.append(c);
        chips.set(block, c);
      }
      const r = block.getBoundingClientRect();
      const h = c.offsetHeight || 28, w = c.offsetWidth || 170;
      const show = r.width > 0 && r.bottom > h + 16 && r.top < innerHeight - h - 8;
      c.classList.toggle('on', show);
      if (show) {
        c.style.top = `${Math.max(r.top + 8, Math.min(r.bottom - h - 10, innerHeight - h - 16))}px`;
        c.style.left = `${Math.max(8, r.right - w - 10)}px`;
      }
    }
    function dropChip(block) { const c = chips.get(block); if (c) { c.remove(); chips.delete(block); } }
    const chipBlocks = () => [...chips.keys()];

    // ─────────────── toast (errors and explicit actions only) ───────────────

    function toast(text, err) {
      ensure();
      toastEl.innerHTML = SHIELD;
      const s = el('span'); s.textContent = text; toastEl.append(s);
      toastEl.classList.toggle('err', !!err);
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('on'), err ? 4000 : 1800);
    }

    function hideAll() { hideBadge(); clearMirrors(); for (const b of chipBlocks()) dropChip(b); }

    return { showBadge, hideBadge, closePop, paintMirror, clearMirrors, chip, dropChip, chipBlocks, toast, hideAll,
      popOpen: () => !!pop && pop.classList.contains('on'), badgeFor: () => popFor };
  }

  root.VeilUI = { create };
})(globalThis);
