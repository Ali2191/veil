// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
require('../lib/types.js');
require('../lib/names.js'); require('../lib/ids.js'); require('../lib/phone.js'); require('../lib/topics.js');
const { detect, luhn, ibanValid } = require('../lib/detect.js');
const { substitute, restore } = require('../lib/tokens.js');
const T = require('../lib/types.js');

const found = (text, opts) => detect(text, opts).map((s) => [s.type, s.value]);
const has = (text, type, value, opts) =>
  assert.ok(found(text, opts).some(([t, v]) => t === type && v === value), `expected ${type} "${value}" in: ${JSON.stringify(found(text, opts))}`);
const none = (text, opts) => assert.deepEqual(found(text, opts), []);

// Minimal in-memory vault used for round-trip tests.
function vault() {
  const byKey = new Map(), byTok = new Map(), counters = {};
  return {
    tokenFor: (sp) => {
      if (!byKey.has(sp.key)) {
        const n = (counters[sp.type] = (counters[sp.type] || 0) + 1);
        const t = T.token(sp.type, n);
        byKey.set(sp.key, t); byTok.set(`${sp.type}_${n}`, sp.value);
      }
      return byKey.get(sp.key);
    },
    lookup: (k) => byTok.get(k),
  };
}

test('plan example: landlord email', () => {
  const text = 'Write an email to my landlord saying that I moved from 134 Street, Multan to 27-B Gulgasht Colony, Multan. My phone number is 0300-1234567.';
  assert.deepEqual(found(text), [
    ['ADDRESS', '134 Street, Multan'],
    ['ADDRESS', '27-B Gulgasht Colony, Multan'],
    ['PHONE', '0300-1234567'],
  ]);
});

test('plan example: personal info', () => {
  const text = 'My name is Tayyab Ali. My email is tayyab@example.com and my phone is 0300-1234567.';
  assert.deepEqual(found(text), [
    ['PERSON', 'Tayyab Ali'], ['EMAIL', 'tayyab@example.com'], ['PHONE', '0300-1234567'],
  ]);
});

test('plan example: customer support', () => {
  const text = 'Customer Tayyab Ali lives at 134 Street, Multan. His phone number is 0300-1234567. He says his package never arrived.';
  assert.deepEqual(found(text), [
    ['PERSON', 'Tayyab Ali'], ['ADDRESS', '134 Street, Multan'], ['PHONE', '0300-1234567'],
  ]);
});

test('plan example: email to Sarah', () => {
  const text = 'Write an email to Sarah Khan at sarah@example.com telling her that my new address is 27-B Gulgasht Colony, Multan and she can call me at 0300-1234567.';
  assert.deepEqual(found(text), [
    ['PERSON', 'Sarah Khan'], ['EMAIL', 'sarah@example.com'], ['ADDRESS', '27-B Gulgasht Colony, Multan'], ['PHONE', '0300-1234567'],
  ]);
});

test('code with PII and secrets', () => {
  const text = 'CUSTOMER_EMAIL="tayyab@example.com"\nCUSTOMER_PHONE="0300-1234567"\nDB_PASSWORD="hunter2!x"\nOPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456\nAPI_KEY=process.env.KEY';
  const f = found(text);
  assert.deepEqual(f, [
    ['EMAIL', 'tayyab@example.com'], ['PHONE', '0300-1234567'], ['SECRET', 'hunter2!x'], ['SECRET', 'sk-proj-abcdefghijklmnopqrstuvwxyz123456'],
  ]);
});

test('structured identifiers', () => {
  has('CNIC 35202-1234567-1 please', 'NATIONAL_ID', '35202-1234567-1');
  has('SSN is 123-45-6789', 'NATIONAL_ID', '123-45-6789');
  has('card 4111 1111 1111 1111 exp 12/27', 'CARD', '4111 1111 1111 1111');
  has('pay to PK36SCBL0000001123456702', 'IBAN', 'PK36SCBL0000001123456702');
  has('IBAN GB82 WEST 1234 5698 7654 32', 'IBAN', 'GB82 WEST 1234 5698 7654 32');
  has('Account 123456789 at the branch', 'ACCOUNT', '123456789');
  has('my passport number is AB1234567.', 'PASSPORT', 'AB1234567');
  has('I was born on 12/03/1995 in Multan', 'DOB', '12/03/1995');
  has('server at 10.24.1.7 is down', 'IP', '10.24.1.7');
  has('call +1 (415) 555-0132 now', 'PHONE', '+1 (415) 555-0132');
  has('call +92 300 1234567', 'PHONE', '+92 300 1234567');
  has('postgres://admin:s3cr3tpass@db.internal:5432/app', 'SECRET', 's3cr3tpass');
  has('Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789', 'SECRET', 'abcdefghijklmnopqrstuvwxyz0123456789');
});

test('invalid numbers are not flagged', () => {
  assert.ok(!luhn('4111111111111112'));
  assert.ok(ibanValid('PK36SCBL0000001123456702'));
  assert.ok(!ibanValid('PK37SCBL0000001123456702'));
  none('Order 4111 1111 1111 1112 shipped');
  none('Version 1.2.3.4 released on 2024-01-15');
  none('The meeting is at 10:30 on 2024-05-01, room 42.');
});

test('no false positives on ordinary prose', () => {
  none('Dear Landlord, I wanted to let you know about the move.');
  none('Hello World! Machine Learning is fun. New York is big.');
  none('Please write a professional message asking my bank about my account.');
  none('Will you mark the June report? May I ask a question?');
  none('Phase 2 of the project starts on Monday with Customer Support.');
  none('Dear Hiring Manager, I am applying for the role.');
  none('I earn 2800 per month and rent is 900.');
});

test('names: cues and lexicon', () => {
  has('Ask Sarah about it', 'PERSON', 'Sarah');
  has('my name is tayyab ali and I need help', 'PERSON', 'tayyab ali');
  has('Hi Zorblax,\nthanks for the update', 'PERSON', 'Zorblax');
  has('Meeting with Dr. Zorblax Quinn tomorrow', 'PERSON', 'Zorblax Quinn');
  has("Send it to Sarah's office", 'PERSON', 'Sarah');
  has('Contact Zia ul Haq tomorrow', 'PERSON', 'Zia ul Haq');
  has('Regards,\nZorblax Quinn', 'PERSON', 'Zorblax Quinn');
});

test('amounts only when enabled', () => {
  none('I earn $2,800 per month');
  const types = [...T.TYPE_KEYS];
  has('I earn $2,800 per month and rent is Rs 45,000', 'AMOUNT', '$2,800', { types });
  has('I earn $2,800 per month and rent is Rs 45,000', 'AMOUNT', 'Rs 45,000', { types });
});

test('user terms and allowlist', () => {
  const terms = [{ value: 'Tayyab Ali', type: 'PERSON' }, { value: 'Project Falcon', type: 'TERM' }, { value: '0300 1234567', type: 'PHONE' }];
  has('Tayyab here, working on project falcon', 'PERSON', 'Tayyab', { terms });
  has('Tayyab here, working on project falcon', 'TERM', 'project falcon', { terms });
  has('ring 0300-123-4567', 'PHONE', '0300-123-4567', { terms });
  none('Sarah Khan joined', { allow: ['sarah khan'] });
});

test('placeholders are never re-detected', () => {
  none('Hi [PERSON_1], call [PHONE_2] at [ADDRESS_1].');
});

test('round trip: sanitize then restore', () => {
  const v = vault();
  const text = 'Tayyab Ali (tayyab@example.com, 0300-1234567) moved to 27-B Gulgasht Colony, Multan. Tayyab Ali confirmed.';
  const spans = detect(text);
  const { text: clean } = substitute(text, spans, v.tokenFor);
  assert.equal(clean, '[PERSON_1] ([EMAIL_1], [PHONE_1]) moved to [ADDRESS_1]. [PERSON_1] confirmed.');
  assert.equal(restore(clean, v.lookup).text, text);
});

test('normalized values share one placeholder', () => {
  const v = vault();
  const a = substitute('0300-1234567', detect('0300-1234567'), v.tokenFor).text;
  const b = substitute('+92 300 1234567', detect('+92 300 1234567'), v.tokenFor).text;
  assert.equal(a, b);
});

test('restore tolerates model reformatting', () => {
  const lookup = (k) => ({ PERSON_1: 'Tayyab Ali', PHONE_1: '0300-1234567', NATIONAL_ID_1: '35202-1234567-1' })[k];
  assert.equal(restore('Hi Person-1, call PHONE_1.', lookup).text, 'Hi Tayyab Ali, call 0300-1234567.');
  assert.equal(restore('Dear [ person_1 ], id NATIONAL-ID-1', lookup).text, 'Dear Tayyab Ali, id 35202-1234567-1');
  assert.equal(restore('Hi PERSON 1 and person 1', lookup).text, 'Hi Tayyab Ali and person 1');
  assert.equal(restore('Escaped \\[PERSON\\_1\\]', lookup).text, 'Escaped Tayyab Ali');
  assert.equal(restore('Unknown [PERSON_9] stays', lookup).text, 'Unknown [PERSON_9] stays');
});

test('performance: 50KB in under 60ms', () => {
  const chunk = 'My name is Tayyab Ali, email tayyab@example.com, phone 0300-1234567, address 27-B Gulgasht Colony, Multan. The weather was fine and the meeting went well. ';
  const text = chunk.repeat(Math.ceil(50000 / chunk.length));
  detect(text); // warm up
  // Best of several runs: measures the code, not a busy machine.
  let ms = Infinity;
  for (let i = 0; i < 7; i++) { const t0 = performance.now(); detect(text); ms = Math.min(ms, performance.now() - t0); }
  assert.ok(ms < 60, `took ${ms.toFixed(1)}ms`);
});
