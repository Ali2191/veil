// Chrome loads the libraries as classic scripts (no require, no module). Load them that way, in the
// manifest's order, and make sure detection, placeholders and natural names work end to end.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const files = manifest.content_scripts.find((c) => (c.js || []).includes('lib/detect.js')).js.filter((f) => f.startsWith('lib/'));

function load(extra = []) {
  const sandbox = {
    console, TextEncoder, TextDecoder, Intl, URL,
    navigator: { language: 'en-PK', languages: ['en-PK', 'en'] },
    chrome: { runtime: { getURL: (p) => p }, storage: { local: { get: async () => ({}), set: async () => {} } } },
  };
  vm.createContext(sandbox);
  for (const f of [...files, ...extra]) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
  return sandbox;
}

test('classic-script load order works and exposes every module', () => {
  const g = load();
  for (const name of ['VeilTypes', 'VeilNames', 'VeilPhone', 'VeilIds', 'VeilTopics', 'VeilUrdu', 'VeilHindi', 'VeilFake', 'VeilDict', 'VeilDetect', 'VeilTokens', 'VeilSettings']) {
    assert.ok(g[name], `${name} is not defined after loading the page scripts`);
  }
});

test('detection works with scripts loaded the browser way', () => {
  const g = load();
  const dict = g.VeilDict.build({}); // the curated lists only; the packaged dictionaries are fetched in the real extension
  const run = (text) => [...g.VeilDetect.detect(text, { dict, home: ['PK'] }).map((s) => `${s.type}:${s.value}`)];
  assert.equal(JSON.stringify(run('Email Sarah Khan at sarah@example.com')), JSON.stringify(['PERSON:Sarah Khan', 'EMAIL:sarah@example.com']));
  assert.ok(run('میرا نام حمزہ طارق ہے').includes('PERSON:حمزہ طارق'));
  assert.ok(run('मेरा नाम राहुल शर्मा है').includes('PERSON:राहुल शर्मा'));
  assert.ok(run('hamza bhai ko bol dena').includes('PERSON:hamza'));
  assert.ok(run('call ۰۳۰۰-۱۲۳۴۵۶۷').some((x) => x.startsWith('PHONE:')));
});

test('placeholders round trip with scripts loaded the browser way', () => {
  const g = load();
  const text = 'Email Sarah Khan at sarah@example.com';
  const spans = g.VeilDetect.detect(text, { home: ['PK'] });
  const map = {};
  const sub = g.VeilTokens.substitute(text, spans, (s, i) => { const t = `[${s.type}_1]`; map[`${s.type}_1`] = s.value; return t; });
  assert.equal(sub.text, 'Email [PERSON_1] at [EMAIL_1]');
  assert.equal(g.VeilTokens.restore(sub.text, (k) => map[k]).text, text);
});

test('the service-worker order also loads (vault needs fakenames first)', () => {
  const g = load(['lib/vault.js']);
  assert.equal(typeof g.VeilVault, 'function');
});
