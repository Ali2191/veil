/* VEIL — editor-agnostic text model and editing helpers for content scripts.
   A "model" is the editor's text plus a map from text offsets to DOM positions, so
   detections can be highlighted (CSS Highlight API) and replaced in place. */
(function (root) {
  'use strict';

  const BLOCK = /^(P|DIV|LI|UL|OL|H[1-6]|PRE|BLOCKQUOTE|TR|TABLE|SECTION|ARTICLE|HEADER|FOOTER|FIGURE)$/;
  const isField = (el) => !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');

  // Topmost editable element that contains `node` (the editor root), or null.
  function editableRoot(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || el.closest('[data-veil]')) return null;
    const t = el.closest('textarea, input:not([type]), input[type="text"], input[type="search"], [contenteditable]:not([contenteditable="false"])');
    if (!t) return null;
    if (isField(t)) return t.disabled || t.readOnly ? null : t;
    if (!t.isContentEditable) return null;
    let top = t;
    while (top.parentElement && top.parentElement.isContentEditable) top = top.parentElement;
    return top;
  }

  // Text + offset map. Blocks and <br> become "\n" the same way innerText does, closely enough
  // for detection; offsets are exact because we build the string and the map together.
  function model(el) {
    if (isField(el)) return { el, field: true, text: el.value.replace(/ /g, ' '), segs: null };
    let text = '';
    const segs = []; // { node, start, end } for text nodes
    const walk = (node) => {
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          const v = c.nodeValue;
          if (!v) continue;
          segs.push({ node: c, start: text.length, end: text.length + v.length });
          text += v.replace(/ /g, ' ');
        } else if (c.nodeType === 1) {
          if (c.tagName === 'BR') {
            // ProseMirror's trailing <br> in an empty/ending paragraph isn't a real line.
            if (!c.classList.contains('ProseMirror-trailingBreak')) text += '\n';
            continue;
          }
          if (c.hidden || c.getAttribute('aria-hidden') === 'true' && !c.textContent.trim()) continue;
          const block = BLOCK.test(c.tagName);
          if (block && text && !text.endsWith('\n')) text += '\n';
          walk(c);
          if (block && text && !text.endsWith('\n')) text += '\n';
        }
      }
    };
    walk(el);
    return { el, field: false, text: text.replace(/\n+$/, ''), segs };
  }

  // DOM point for a text offset (rich editors only).
  function point(m, off, preferEnd) {
    const segs = m.segs;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (off < s.start) return { node: s.node, offset: 0 };
      if (off < s.end || (off === s.end && (preferEnd || i === segs.length - 1 || segs[i + 1].start > off))) {
        return { node: s.node, offset: off - s.start };
      }
    }
    const last = segs[segs.length - 1];
    return last ? { node: last.node, offset: last.node.length } : { node: m.el, offset: m.el.childNodes.length };
  }

  function range(m, start, end) {
    const r = document.createRange();
    const a = point(m, start, false), b = point(m, end, true);
    r.setStart(a.node, Math.min(a.offset, a.node.nodeType === 3 ? a.node.length : a.offset));
    r.setEnd(b.node, Math.min(b.offset, b.node.nodeType === 3 ? b.node.length : b.offset));
    return r;
  }

  // Caret offset in model coordinates, or -1 when the selection isn't inside the editor.
  function caret(m) {
    if (m.field) return document.activeElement === m.el ? m.el.selectionEnd : -1;
    const sel = getSelection();
    if (!sel.rangeCount || !m.el.contains(sel.focusNode)) return -1;
    const n = sel.focusNode, o = sel.focusOffset;
    if (n.nodeType === 3) {
      const s = m.segs.find((x) => x.node === n);
      return s ? s.start + o : -1;
    }
    // Element position: offset of the first text node at/after that child.
    const child = n.childNodes[o];
    if (!child) {
      const before = m.segs.filter((x) => n.contains(x.node));
      return before.length ? before[before.length - 1].end : m.text.length;
    }
    const s = m.segs.find((x) => child === x.node || child.contains(x.node) || (child.compareDocumentPosition(x.node) & Node.DOCUMENT_POSITION_FOLLOWING));
    return s ? s.start : m.text.length;
  }

  function setCaret(el, off) {
    const m = model(el);
    off = Math.max(0, Math.min(off, m.text.length));
    if (m.field) { el.setSelectionRange(off, off); return; }
    const p = point(m, off, true);
    const sel = getSelection();
    const r = document.createRange();
    r.setStart(p.node, Math.min(p.offset, p.node.nodeType === 3 ? p.node.length : p.offset));
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function select(el, start, end) {
    el.focus();
    const m = model(el);
    if (m.field) { el.setSelectionRange(start, end); return; }
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range(m, start, end));
  }

  function selectAll(el) {
    el.focus();
    if (isField(el)) { el.select(); return; }
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  // Insert text over the current selection exactly once.
  // execCommand('insertText') goes through the editor's normal typing path (beforeinput/input),
  // which ProseMirror, Quill, Lexical, Slate and React textareas all handle synchronously.
  // A synthetic paste is used only if that changed nothing — some editors handle paste
  // asynchronously, so doing both would insert the text twice.
  function insert(el, text) {
    if (isField(el)) {
      if (!document.execCommand('insertText', false, text)) {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? el.value.length;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, el.value.slice(0, s) + text + el.value.slice(e));
        el.setSelectionRange(s + text.length, s + text.length);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    const before = el.innerText;
    if (document.execCommand('insertText', false, text) && el.innerText !== before) return;
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }

  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

  root.VeilDom = { isField, editableRoot, model, range, caret, setCaret, select, selectAll, insert, visible };
})(globalThis);
