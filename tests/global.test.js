// Worldwide coverage: phones, identity documents, structure, dictionaries, learning, topics.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../lib/types.js'); require('../lib/names.js'); require('../lib/ids.js'); require('../lib/phone.js'); require('../lib/topics.js');
const { detect, topics } = require('../lib/detect.js');
const Dict = require('../lib/dict.js');

const dict = Dict.build(Dict.readRaw());
const opts = (extra = {}) => ({ dict, home: ['PK'], ...extra });
const found = (text, o) => detect(text, opts(o)).map((s) => [s.type, s.value]);
function has(text, type, value, o) {
  const f = found(text, o);
  assert.ok(f.some(([t, v]) => t === type && v === value), `${text}\n  expected ${type} "${value}"\n  got ${JSON.stringify(f)}`);
}

test('phones from many countries', () => {
  for (const [text, value] of [
    ['UK office +44 20 7946 0958 please', '+44 20 7946 0958'],
    ['US cell (415) 555-0132 anytime', '(415) 555-0132'],
    ['India: +91 98765 43210', '+91 98765 43210'],
    ['Saudi mobile +966 50 123 4567', '+966 50 123 4567'],
    ['UAE 00971 50 123 4567', '00971 50 123 4567'],
    ['Karachi landline 021-35871234', '021-35871234'],
    ['Nigeria: call 0803 123 4567', '0803 123 4567'],
    ['Germany +49 30 12345678', '+49 30 12345678'],
    ['Brazil +55 11 91234-5678', '+55 11 91234-5678'],
    ['Japan 090-1234-5678 is my number', '090-1234-5678'],
  ]) has(text, 'PHONE', value);
});

test('number-like things that are not phones', () => {
  for (const t of ['Order 12345678901 shipped', 'Invoice #20240115 attached', 'ISBN 978-3-16-148410-0', 'Version 10.2.3.4 is out', 'Total 1,234,567.89']) {
    assert.ok(!found(t).some(([ty]) => ty === 'PHONE'), `${t} → ${JSON.stringify(found(t))}`);
  }
});

test('identity documents worldwide', () => {
  for (const [text, type, value] of [
    ['CNIC 35202-1234567-1', 'NATIONAL_ID', '35202-1234567-1'],
    ['Aadhaar: 2345 6789 0124', 'NATIONAL_ID', '2345 6789 0124'],
    ['PAN ABCPE1234F', 'NATIONAL_ID', 'ABCPE1234F'],
    ['SSN 123-45-6789', 'NATIONAL_ID', '123-45-6789'],
    ['My SIN is 130 692 544', 'NATIONAL_ID', '130 692 544'],
    ['DNI 12345678Z', 'NATIONAL_ID', '12345678Z'],
    ['codice fiscale RSSMRA85T10A562S', 'NATIONAL_ID', 'RSSMRA85T10A562S'],
    ['NIR 2 55 08 14 168 025 38', 'NATIONAL_ID', '2 55 08 14 168 025 38'],
    ['CPF 529.982.247-25', 'NATIONAL_ID', '529.982.247-25'],
    ['RUT 12.345.678-5', 'NATIONAL_ID', '12.345.678-5'],
    ['身份证 11010519491231002X', 'NATIONAL_ID', '11010519491231002X'],
    ['NRIC S1234567D', 'NATIONAL_ID', 'S1234567D'],
    ['HKID A123456(3)', 'NATIONAL_ID', 'A123456(3)'],
    ['ID A123456789', 'NATIONAL_ID', 'A123456789'],
    ['Emirates ID 784-1990-1234567-1', 'NATIONAL_ID', '784-1990-1234567-1'],
    ['TC kimlik 10000000146', 'NATIONAL_ID', '10000000146'],
    ['CURP HEGG560427MVZRRL04', 'NATIONAL_ID', 'HEGG560427MVZRRL04'],
    ['NHS number 943 476 5919', 'HEALTH_ID', '943 476 5919'],
    ['MRN: 00458123', 'HEALTH_ID', '00458123'],
    ["Driver's license no. D1234-5678-9012", 'LICENSE', 'D1234-5678-9012'],
    ['P<PAKALI<<TAYYAB<<<<<<<<<<<<<<<<<<<<<<<<<<<', 'PASSPORT', 'P<PAKALI<<TAYYAB<<<<<<<<<<<<<<<<<<<<<<<<<<<'],
  ]) has(text, type, value);
});

test('checksums reject look-alikes', () => {
  for (const t of ['DNI 12345678A', 'CPF 529.982.247-26', 'NRIC S1234567A', 'code RSSMRA85T10A562X']) {
    assert.ok(!found(t).some(([ty]) => ty === 'NATIONAL_ID'), `${t} → ${JSON.stringify(found(t))}`);
  }
});

test('forms, JSON, YAML, env and tables', () => {
  has('Name: Zorblax Quinn\nPhone: 0300 7654321', 'PERSON', 'Zorblax Quinn');
  has('Home address: Plot 9, Street 4, F-7/2, Islamabad', 'ADDRESS', 'Plot 9, Street 4, F-7/2, Islamabad');
  has('{"customer_name": "Aiko Tanaka", "email": "aiko@example.jp"}', 'PERSON', 'Aiko Tanaka');
  has('firstName: Olumide\nlastName: Adeyemi', 'PERSON', 'Olumide');
  has('name,email,city\nPriya Raman,priya@example.in,Chennai', 'PERSON', 'Priya Raman');
  has('| Name | Phone |\n|---|---|\n| Karim Benali | 0612345678 |', 'PERSON', 'Karim Benali');
  has('PATIENT_NAME=Maria Gonzalez', 'PERSON', 'Maria Gonzalez');
});

test('names from the global dictionary', () => {
  has('Please forward this to Olumide Adeyemi today.', 'PERSON', 'Olumide Adeyemi');
  has('Meeting with Aiko Tanaka in Osaka.', 'PERSON', 'Aiko Tanaka');
  has('Send the file to Siobhan Murphy.', 'PERSON', 'Siobhan Murphy');
  // Cities are not people.
  assert.ok(!found('We flew from New York to San Francisco.').some(([t]) => t === 'PERSON'));
});

test('learning from values protected before', () => {
  const known = [{ type: 'PERSON', value: 'Tayyab Ali' }, { type: 'PHONE', value: '0300-1234567' }, { type: 'TERM', value: 'Project Falcon' }];
  has('tayyab ali called about project falcon', 'PERSON', 'tayyab ali', { known });
  has('Tayyab said hi', 'PERSON', 'Tayyab', { known });
  has('Tayab said hi', 'PERSON', 'Tayab', { known }); // one typo away
  has('number 0300 123 4567', 'PHONE', '0300 123 4567', { known });
});

test('confidence tiers', () => {
  const [a] = detect('Email me at aiko@example.jp', opts());
  assert.equal(a.tier, 'high');
  const weak = detect('Olumide agreed.', opts()).find((s) => s.type === 'PERSON');
  assert.ok(weak && weak.tier === 'check', JSON.stringify(weak));
});

test('sensitive topics are flagged only when personal', () => {
  assert.deepEqual(topics('I was diagnosed with diabetes.').map((t) => t.topic), ['health', 'health']);
  assert.deepEqual(topics('What causes diabetes?'), []);
  assert.deepEqual(topics('My brother was arrested.').map((t) => t.topic), ['legal']);
});

const CLEAN = [
  'Explain the difference between TCP and UDP in simple terms.',
  'Write a Python function that returns the nth Fibonacci number using memoization.',
  'Summarize the key ideas of The Lean Startup.',
  'What are the main causes of the French Revolution?',
  'Give me a recipe for chicken biryani for 4 people, 500g chicken, 2 cups rice.',
  'Our Q3 revenue grew 12% while churn dropped to 3.4%. Draft a board update.',
  'Plan a 5 day trip to Northern Pakistan covering Hunza and Skardu in June.',
  'Compare Next.js App Router with the Pages Router for a SaaS dashboard.',
  'Docker build fails with error code 137 on step 5/12. What does it mean?',
  'Version 2.14.1 fixed the memory leak reported in issue #4821.',
  'Our meeting is on Monday at 10:30 in Room B. Please prepare slides.',
  'Apple, Google and Microsoft reported earnings this week.',
  'Use UTF-8 encoding and ISO 8601 dates like 2025-03-14T10:00:00Z.',
  'The train from Paris to Berlin takes about eight hours.',
  'Translate this paragraph into Spanish and keep the tone formal.',
  'Order 1029384756 was delayed; the tracking page shows 3 attempts.',
  'git checkout -b feature/login && npm run build',
  'const user = await db.users.findOne({ where: { id } });',
  'Write a cover letter for a marketing role at a startup.',
  'How do I calculate compound interest over 10 years at 7%?',
];

test('ordinary prompts stay clean with full dictionaries', () => {
  for (const t of CLEAN) assert.deepEqual(found(t), [], t);
});

test('performance with dictionaries and phone library', () => {
  const chunk = 'My name is Tayyab Ali, email tayyab@example.com, phone 0300-1234567, address 27-B Gulgasht Colony, Multan. The weather was fine and the meeting went well. ';
  const text = chunk.repeat(Math.ceil(20000 / chunk.length));
  detect(text, opts()); // warm up
  let ms = Infinity;
  for (let i = 0; i < 7; i++) { const t0 = performance.now(); detect(text, opts()); ms = Math.min(ms, performance.now() - t0); }
  assert.ok(ms < 80, `20KB took ${ms.toFixed(1)}ms`);
  let short = Infinity;
  for (let i = 0; i < 7; i++) { const t1 = performance.now(); detect('Write an email to Sarah Khan at sarah@example.com about the 27-B Gulgasht Colony flat.', opts()); short = Math.min(short, performance.now() - t1); }
  assert.ok(short < 5, `short prompt took ${short.toFixed(1)}ms`);
});
