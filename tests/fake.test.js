// "Natural names" mode: stand-in names, restoring them, protecting them, and the vault glue.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../lib/types.js'); require('../lib/names.js'); require('../lib/ids.js'); require('../lib/phone.js'); require('../lib/topics.js');
require('../lib/urdu.js'); require('../lib/hindi.js'); require('../lib/fakenames.js');
const D = require('../lib/dict.js');
const { detect } = require('../lib/detect.js');
const Tokens = require('../lib/tokens.js');
const Fake = require('../lib/fakenames.js');
const T = require('../lib/types.js');

const dict = D.build(D.readRaw());

test('stand-ins are deterministic and keep word count', () => {
  const a = Fake.pick('Hamza Tariq'), b = Fake.pick('Hamza Tariq');
  assert.deepEqual(a, b);
  assert.equal(a.text.split(' ').length, 2);
  assert.equal(Fake.pick('Hamza').text.split(' ').length, 1);
  assert.notEqual(Fake.pick('Hamza Tariq').text, Fake.pick('Bilal Ahmed').text);
});

test('stand-ins never reuse the real name or a word in the message', () => {
  const real = 'Hamza Tariq';
  const a = Fake.pick(real);
  assert.ok(!a.text.toLowerCase().split(' ').some((w) => ['hamza', 'tariq'].includes(w)));
  // steer clear of words already in the text
  const avoid = new Set(a.text.toLowerCase().split(' '));
  const b = Fake.pick(real, { avoid });
  assert.notEqual(b.text.split(' ')[0].toLowerCase(), a.text.split(' ')[0].toLowerCase());
  assert.notEqual(b.text.split(' ')[1].toLowerCase(), a.text.split(' ')[1].toLowerCase());
});

test('stand-ins are unique per person', () => {
  const used = new Set();
  const names = ['Hamza Tariq', 'Bilal Ahmed', 'Usman Ghani', 'Imran Aslam', 'Kamran Yousuf', 'Saad Ahmed', 'Fahad Ali', 'Junaid Khan'];
  const firsts = names.map((n) => Fake.pick(n, { used }).text.split(' ')[0]);
  assert.equal(new Set(firsts).size, names.length);
});

test('stand-ins match script, gender and culture', () => {
  const female = new Set(['Alina', 'Bushra', 'Dua', 'Eman', 'Farwa', 'Hania', 'Inaya', 'Javeria', 'Kinza', 'Laiba', 'Mahira', 'Nimra', 'Omaima', 'Rida', 'Sehar', 'Tooba', 'Warda', 'Yumna', 'Zara', 'Aleena', 'Hoorain', 'Mehak', 'Aiza', 'Anum', 'Bisma', 'Dania', 'Fizza', 'Gulnaz', 'Humna', 'Iman', 'Komal', 'Lubna', 'Maham', 'Nashwa', 'Pareesa', 'Rameen', 'Sahar', 'Tuba', 'Zoha']);
  assert.ok(female.has(Fake.pick('Ayesha Khan').text.split(' ')[0]), 'female name → female stand-in');
  assert.ok(!female.has(Fake.pick('Hamza Tariq').text.split(' ')[0]), 'male name → male stand-in');
  const west = Fake.pick('Sarah Johnson').text;
  assert.ok(/^[A-Za-z]+ [A-Za-z]+$/.test(west) && ['Emma', 'Olivia', 'Chloe', 'Grace', 'Hannah', 'Isla', 'Lily', 'Maya', 'Nora', 'Ruby', 'Ella', 'Freya', 'Poppy', 'Evie', 'Alice', 'Clara', 'Iris', 'Julia', 'Leah', 'Nina'].includes(west.split(' ')[0]), west);
  assert.ok(/^\p{Script=Arabic}+( \p{Script=Arabic}+)?$/u.test(Fake.pick('حمزہ طارق').text), 'Urdu in → Urdu out');
  assert.ok(/^\p{Script=Devanagari}[\p{L}\p{M}]*( [\p{L}\p{M}]+)?$/u.test(Fake.pick('राहुल शर्मा').text), 'Hindi in → Hindi out');
});

test('stand-in names are restored in replies, full name and single words', () => {
  const aliases = [
    { text: 'Junaid Mirza', value: 'Hamza Tariq', key: 'PERSON_1' },
    { text: 'Junaid', value: 'Hamza', key: 'PERSON_1' },
    { text: 'Mirza', value: 'Tariq', key: 'PERSON_1' },
  ];
  const r = Tokens.restore("Hi Junaid Mirza, thanks. junaid's plan: ask Mirza.", () => undefined, aliases);
  assert.equal(r.text, "Hi Hamza Tariq, thanks. Hamza's plan: ask Tariq.");
  assert.equal(r.count, 3);
  // not inside other words
  assert.equal(Tokens.restore('Junaidi and Mirzapur', () => undefined, aliases).count, 0);
  // placeholders and stand-ins in one text
  const both = Tokens.restore('[ACCOUNT_1] for Junaid Mirza', (k) => (k === 'ACCOUNT_1' ? '12345678' : undefined), aliases);
  assert.equal(both.text, '12345678 for Hamza Tariq');
  // module-level list used by the page script
  Tokens.setAliases(aliases);
  assert.ok(Tokens.mightContainToken('Hello Junaid'));
  assert.equal(Tokens.restore('Hello Junaid', () => undefined).text, 'Hello Hamza');
  // markup-safe restoring
  assert.equal(Tokens.restore('Hello Junaid', () => undefined, [{ text: 'Junaid', value: 'A<b>', key: 'PERSON_1' }], (v) => v.replace(/</g, '&lt;')).text, 'Hello A&lt;b>');
  Tokens.setAliases([]);
  assert.ok(!Tokens.mightContainToken('Hello Junaid'));
});

test('stand-in names are never detected as new people', () => {
  assert.deepEqual(detect('Please write to Junaid Mirza today.', { dict, aliases: [] }).map((s) => s.value), ['Junaid Mirza']);
  assert.deepEqual(detect('Please write to Junaid Mirza today.', { dict, aliases: ['Junaid Mirza', 'Junaid', 'Mirza'] }).map((s) => s.value), []);
});

test('vault hands out stand-ins and remembers them', () => {
  globalThis.VeilFake = Fake;
  const Vault = (() => { globalThis.VeilTypes = T; globalThis.chrome = {}; require('../lib/vault.js'); return globalThis.VeilVault; })();
  const v = Object.create(Vault.prototype);
  v.data = { entries: {}, counters: {}, terms: [], allow: [] };
  v.byKey = new Map();
  const spans = detect('Email Hamza Tariq at hamza@example.com', { dict });
  const person = spans.find((s) => s.type === 'PERSON'), email = spans.find((s) => s.type === 'EMAIL');
  const ctx = v.aliasContext('Email Hamza Tariq at hamza@example.com', true);
  const a = v.tokenFor(person, true, new Map(), ctx);
  assert.ok(!a.startsWith('['), 'people get a stand-in name');
  assert.equal(v.tokenFor(email, true, new Map(), ctx), '[EMAIL_1]', 'other details keep placeholders');
  assert.equal(v.tokenFor(person, true, new Map(), v.aliasContext('again Hamza Tariq', true)), a, 'same person, same stand-in');
  // placeholder mode is unchanged
  const w = Object.create(Vault.prototype);
  w.data = { entries: {}, counters: {}, terms: [], allow: [] }; w.byKey = new Map();
  assert.equal(w.tokenFor(person, true, new Map(), null), '[PERSON_1]');
  // table for the page script
  const table = v.aliasTable();
  assert.equal(table[0].text, a);
  assert.equal(table[0].value, 'Hamza Tariq');
  assert.ok(table.some((t) => t.value === 'Hamza') && table.some((t) => t.value === 'Tariq'));
  // the stand-in survives a full round trip: sanitize → AI reply → restore
  const sub = Tokens.substitute('Email Hamza Tariq at hamza@example.com', spans, (sp) => v.tokenFor(sp, true, new Map(), ctx));
  assert.ok(!/Hamza|Tariq|hamza@/.test(sub.text), sub.text);
  const reply = `Sure! Dear ${a}, here is the email for [EMAIL_1].`;
  const back = Tokens.restore(reply, (k) => v.lookupTable()[k], v.aliasTable());
  assert.equal(back.text, 'Sure! Dear Hamza Tariq, here is the email for hamza@example.com.');
});
