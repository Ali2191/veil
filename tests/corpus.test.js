// Ordinary prompts that must come through untouched, and realistic ones that must be caught.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../lib/types.js'); require('../lib/names.js'); require('../lib/ids.js'); require('../lib/phone.js'); require('../lib/topics.js');
const { detect } = require('../lib/detect.js');

const CLEAN = [
  'Explain the difference between TCP and UDP in simple terms.',
  'Write a Python function that returns the nth Fibonacci number using memoization.',
  'Summarize the key ideas of The Lean Startup.',
  'What are the main causes of the French Revolution?',
  'Give me a recipe for chicken biryani for 4 people, 500g chicken, 2 cups rice.',
  'Solve 3x + 7 = 22 and show the steps.',
  'Our Q3 revenue grew 12% while churn dropped to 3.4%. Draft a board update.',
  'Translate "Good morning, how are you?" into Urdu and Arabic.',
  'const port = process.env.PORT || 3000; app.listen(port);',
  'SELECT id, name FROM users WHERE created_at > NOW() - INTERVAL 7 DAY;',
  'In React, when should I use useMemo versus useCallback?',
  'Plan a 5 day trip to Northern Pakistan covering Hunza and Skardu in June.',
  'Compare Next.js App Router with the Pages Router for a SaaS dashboard.',
  'The API returns 429 Too Many Requests after 100 calls per minute. How do I add retries?',
  'Write a LinkedIn post about lessons learned from launching our first product.',
  'Docker build fails with error code 137 on step 5/12. What does it mean?',
  'Version 2.14.1 fixed the memory leak reported in issue #4821.',
  'Our meeting is on Monday at 10:30 in Room B. Please prepare slides.',
  'Rewrite this paragraph to be more concise and professional.',
  'git rebase -i HEAD~3 then force push to origin main',
  'What does Section 230 of the Communications Decency Act say?',
  'Build a budget: 40% needs, 30% wants, 20% savings, 10% giving.',
  'Hello Team, the deployment is scheduled for Friday.',
  'Chapter 5 covers linear regression and gradient descent.',
  'Apple, Google and Microsoft reported earnings this week.',
  'Set the timeout to 30000 ms and the retry count to 5.',
  'Use UTF-8 encoding and ISO 8601 dates like 2025-03-14T10:00:00Z.',
];

test('ordinary prompts produce no detections', () => {
  for (const t of CLEAN) assert.deepEqual(detect(t).map((s) => [s.type, s.value]), [], t);
});

const DIRTY = [
  ['Please update the shipping address for order 5512 to Flat 4, Block C, Gulberg III, Lahore.', 'ADDRESS', 'Flat 4, Block C, Gulberg III, Lahore'],
  ['Our new office: 1600 Amphitheatre Parkway, Mountain View, CA 94043', 'ADDRESS', '1600 Amphitheatre Parkway, Mountain View, CA 94043'],
  ['Mr. Imran Qureshi called about his loan.', 'PERSON', 'Imran Qureshi'],
  ['Forward this to Ayesha Siddiqui and Bilal.', 'PERSON', 'Ayesha Siddiqui'],
  ['Forward this to Ayesha Siddiqui and Bilal.', 'PERSON', 'Bilal'],
  ['whatsapp me on 0321 7654321 after 5', 'PHONE', '0321 7654321'],
  ['UK mobile 07911 123456', 'PHONE', '07911 123456'],
  ['ssh deploy@10.0.3.17 -i key.pem', 'IP', '10.0.3.17'],
  ['export GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789AB', 'SECRET', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789AB'],
  ['aws key AKIAIOSFODNN7EXAMPLE leaked', 'SECRET', 'AKIAIOSFODNN7EXAMPLE'],
  ['Invoice from Nexora Technologies Pvt Ltd is overdue', 'ORG', 'Nexora Technologies Pvt Ltd'],
  ['DOB: 14 August 1998', 'DOB', '14 August 1998'],
  ['NI number JG 10 37 52 A', 'NATIONAL_ID', 'JG 10 37 52 A'],
  ['my password is Tr0ub4dor&3', 'SECRET', 'Tr0ub4dor&3'],
  ['swift code MEZNPKKA0001', 'ACCOUNT', 'MEZNPKKA0001'],
];

test('realistic sensitive prompts are caught', () => {
  for (const [text, type, value] of DIRTY) {
    const f = detect(text).map((s) => [s.type, s.value]);
    assert.ok(f.some(([t, v]) => t === type && v === value), `${text}\n  expected ${type} "${value}"\n  got ${JSON.stringify(f)}`);
  }
});
