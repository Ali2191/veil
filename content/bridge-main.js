/* VEIL — page-world clipboard bridge (runs in the page's JS world at document_start).
   When the site's own "Copy" button writes text that contains placeholders, the text is handed
   to VEIL's isolated content script, which restores it and writes the clipboard itself.
   Only placeholder text travels out of the page; real values never enter the page's JS world. */
(() => {
  'use strict';
  if (window.__veilBridge || typeof Clipboard === 'undefined') return;
  Object.defineProperty(window, '__veilBridge', { value: true });

  // Keep in sync with VeilTypes.TYPE_KEYS.
  const HAS_TOKEN = /(?:SECRET|EMAIL|NATIONAL(?:\\?_|[ -])ID|HEALTH(?:\\?_|[ -])ID|LICENSE|CARD|IBAN|PASSPORT|ACCOUNT|PHONE|DOB|IP|ADDRESS|AMOUNT|ORG|PERSON|TERM)(?:\\?_|[ -])?\d/i;
  const proto = Clipboard.prototype;
  const origWriteText = proto.writeText;
  const origWrite = proto.write;
  const pending = new Map();
  let seq = 0;

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.__veil !== 'copied' || !pending.has(d.id)) return;
    pending.get(d.id)(d.ok === true);
    pending.delete(d.id);
  });

  function handOff(text, html) {
    return new Promise((resolve) => {
      const id = `${Date.now()}-${++seq}`;
      pending.set(id, resolve);
      window.postMessage({ __veil: 'copy', id, text, html }, location.origin === 'null' ? '*' : location.origin);
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(false); } }, 500);
    });
  }

  proto.writeText = async function (text) {
    if (typeof text === 'string' && HAS_TOKEN.test(text) && (await handOff(text, null))) return;
    return origWriteText.call(this, text);
  };

  if (origWrite) {
    proto.write = async function (items) {
      try {
        const item = items && items[0];
        if (item && item.types.includes('text/plain')) {
          const text = await (await item.getType('text/plain')).text();
          if (HAS_TOKEN.test(text)) {
            const html = item.types.includes('text/html') ? await (await item.getType('text/html')).text() : null;
            if (await handOff(text, html)) return;
          }
        }
      } catch { /* fall through to the site's original write */ }
      return origWrite.call(this, items);
    };
  }
})();
