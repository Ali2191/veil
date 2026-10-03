// A tiny fake AI chat site for end-to-end tests. It records exactly what the "AI" receives, so a test
// can prove that real values never leave the browser, and answers with whatever the test asks for.
const http = require('node:http');

const page = (title, body, script) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:16px sans-serif;margin:24px;max-width:720px}#log div{margin:8px 0;padding:8px;border:1px solid #ddd;border-radius:6px}
textarea,.ProseMirror{width:100%;min-height:80px;border:1px solid #888;padding:8px;box-sizing:border-box}</style></head>
<body><h1>${title}</h1><div id="log"></div>${body}<script>${script}</script></body></html>`;

// Shared page logic: take the text from the box, show it, post it, show the reply.
const logic = (getText, clear) => `
const log = document.getElementById('log');
const add = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; log.appendChild(d); };
async function send() {
  const text = ${getText};
  if (!text.trim()) return;
  ${clear};
  add('user', text);
  const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
  add('assistant', (await r.json()).reply);
}`;

const PAGES = {
  // A textarea with a send button, labelled like an AI assistant.
  '/chat.html': page('AI Assistant', `<textarea id="box" aria-label="Ask anything" placeholder="Ask anything"></textarea>
    <button id="send" aria-label="Send message">Send</button>`,
    `${logic('document.getElementById("box").value', 'document.getElementById("box").value = ""')}
     document.getElementById('send').addEventListener('click', send);`),
  // A rich-text box (ProseMirror style) that sends on Enter.
  '/editor.html': page('AI Chat', `<div class="ProseMirror" id="box" contenteditable="true" role="textbox" aria-label="Message the assistant"></div>`,
    `${logic('document.getElementById("box").innerText', 'document.getElementById("box").textContent = ""')}
     document.getElementById('box').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });`),
  // Not an AI site: an ordinary notes page. VEIL must stay out of the way.
  '/notes.html': page('My Notes', `<textarea id="box" aria-label="Note"></textarea><button id="send">Save</button>`,
    `${logic('document.getElementById("box").value', 'document.getElementById("box").value = ""')}
     document.getElementById('send').addEventListener('click', send);`),
};

async function startSite() {
  const site = { received: [], reply: (text) => `You said: ${text}` };
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const { text } = JSON.parse(body);
        site.received.push(text);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ reply: site.reply(text) }));
      });
      return;
    }
    const html = PAGES[req.url.split('?')[0]];
    if (!html) { res.statusCode = 404; res.end('not found'); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  site.url = `http://127.0.0.1:${server.address().port}`;
  site.close = () => new Promise((r) => server.close(r));
  return site;
}

module.exports = { startSite };
