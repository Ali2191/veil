// The extension loads the same library files in three places (page scripts, service worker, side panel).
// A file missing from one of them breaks the extension only at runtime, so check them here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const manifest = JSON.parse(read('manifest.json'));

const contentLibs = manifest.content_scripts.find((c) => (c.js || []).includes('lib/detect.js')).js.filter((f) => f.startsWith('lib/'));
const workerLibs = [...read('background.js').match(/importScripts\(([\s\S]*?)\);/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const panelLibs = [...read('panel/panel.html').matchAll(/<script src="\.\.\/(lib\/[^"]+)"/g)].map((m) => m[1]);

// Everything the detector and the placeholder logic need.
const SHARED = ['types', 'names', 'phone', 'ids', 'topics', 'urdu', 'hindi', 'fakenames', 'dict', 'detect', 'tokens', 'sites', 'settings'].map((n) => `lib/${n}.js`);

test('every script the manifest, worker and panel load exists', () => {
  for (const f of [...contentLibs, ...workerLibs, ...panelLibs, ...manifest.content_scripts.flatMap((c) => c.js || [])]) {
    assert.ok(fs.existsSync(path.join(root, f)), `missing file: ${f}`);
  }
});

test('page scripts, service worker and side panel load the shared libraries', () => {
  for (const f of SHARED) {
    assert.ok(contentLibs.includes(f), `${f} missing from manifest content_scripts`);
    assert.ok(workerLibs.includes(f), `${f} missing from background.js importScripts`);
    assert.ok(panelLibs.includes(f), `${f} missing from panel/panel.html`);
  }
});

test('libraries load in dependency order', () => {
  for (const [name, list] of [['content', contentLibs], ['worker', workerLibs], ['panel', panelLibs]]) {
    const at = (f) => list.indexOf(f);
    assert.ok(at('lib/types.js') < at('lib/names.js'), `${name}: types before names`);
    assert.ok(at('lib/names.js') < at('lib/urdu.js'), `${name}: names before urdu`);
    assert.ok(at('lib/urdu.js') < at('lib/hindi.js'), `${name}: urdu before hindi`);
    assert.ok(at('lib/urdu.js') < at('lib/detect.js') && at('lib/hindi.js') < at('lib/detect.js'), `${name}: language modules before detect`);
    assert.ok(at('lib/detect.js') < at('lib/tokens.js') || name === 'x', `${name}: detect before tokens`);
  }
  assert.ok(workerLibs.indexOf('lib/fakenames.js') < workerLibs.indexOf('lib/vault.js'), 'worker: fakenames before vault');
});

test('manifest basics', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(read('package.json')).version, manifest.version, 'package.json and manifest.json versions agree');
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'self'/, 'the extension must stay offline');
  for (const f of ['given', 'family', 'places']) assert.ok(fs.existsSync(path.join(root, `lib/data/${f}.txt`)), `dictionary ${f}.txt`);
});
