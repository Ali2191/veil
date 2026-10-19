// Realistic prompts (all invented): how people actually write to an AI chat, in English, Roman Urdu,
// Urdu and Hindi. Every sensitive item must be found; every clean prompt must stay untouched.
// Run: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
require('../lib/types.js'); require('../lib/names.js'); require('../lib/ids.js'); require('../lib/phone.js'); require('../lib/topics.js');
require('../lib/urdu.js'); require('../lib/hindi.js');
const D = require('../lib/dict.js');
const { detect } = require('../lib/detect.js');

const dict = D.build(D.readRaw());
const opts = { dict, home: ['PK', 'IN'] };

// A made-up payment-provider key, assembled at run time so the repository holds no secret-shaped text.
const STRIPE_KEY = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_');

// [prompt, [[type, exact text that must be covered], ...]]
const DIRTY = [
  // ── email and letters ──
  ['Write a polite email to Sarah Khan (sarah.khan@example.com) asking her to reschedule our Thursday call. My number is 0301-5551234.',
    [['PERSON', 'Sarah Khan'], ['EMAIL', 'sarah.khan@example.com'], ['PHONE', '0301-5551234']]],
  ['Draft a leave application. Employee: Muhammad Bilal Qureshi, employee ID 4471, department Finance, manager Ms. Hina Farooq.',
    [['PERSON', 'Muhammad Bilal Qureshi'], ['PERSON', 'Hina Farooq']]],
  ['Please rewrite this: "Dear Mr. Tariq Mehmood, your loan application for Rs. 450,000 has been approved. Contact us at 042-35761234."',
    [['PERSON', 'Tariq Mehmood'], ['PHONE', '042-35761234']]],
  ['Write a thank-you note to Dr. Saima Noreen for treating my father at Shifa International Hospital, Islamabad.',
    [['PERSON', 'Saima Noreen']]],
  // ── CV and forms ──
  ['Improve my CV summary.\nName: Ayesha Siddiqui\nEmail: ayesha.siddiqui@gmail.com\nPhone: +92 333 4567891\nAddress: House 14, Street 7, F-10/2, Islamabad\nDOB: 12/03/1996',
    [['PERSON', 'Ayesha Siddiqui'], ['EMAIL', 'ayesha.siddiqui@gmail.com'], ['PHONE', '+92 333 4567891'], ['ADDRESS', 'House 14, Street 7, F-10/2, Islamabad'], ['DOB', '12/03/1996']]],
  ['Fill this form for me: Full name: Usman Ghani, Father name: Abdul Ghani, CNIC: 35202-1234567-9, Mobile: 0300 1234567',
    [['PERSON', 'Usman Ghani'], ['PERSON', 'Abdul Ghani'], ['NATIONAL_ID', '35202-1234567-9'], ['PHONE', '0300 1234567']]],
  ['Make my cover letter shorter. I am Rabia Anwar, I live in Gulberg III, Lahore and my number is 0321-6543210.',
    [['PERSON', 'Rabia Anwar'], ['PHONE', '0321-6543210']]],
  // ── support and business ──
  ['Customer Imran Aslam called about order #55123. He lives at 27-B Gulgasht Colony, Multan. Phone 0345-8765432. Summarize the complaint.',
    [['PERSON', 'Imran Aslam'], ['ADDRESS', '27-B Gulgasht Colony, Multan'], ['PHONE', '0345-8765432']]],
  ['Reply to this ticket from john.carter@acme-corp.com: "Hi, I am John Carter. My card 4111 1111 1111 1111 was charged twice."',
    [['EMAIL', 'john.carter@acme-corp.com'], ['PERSON', 'John Carter'], ['CARD', '4111 1111 1111 1111']]],
  ['Invoice from Nexora Technologies Pvt Ltd is overdue by 30 days. Write a reminder to their accounts team.',
    [['ORG', 'Nexora Technologies Pvt Ltd']]],
  ['Our supplier Hassan Raza, bank account PK36SCBL0000001123456702 at Standard Chartered, needs a payment confirmation letter.',
    [['PERSON', 'Hassan Raza'], ['IBAN', 'PK36SCBL0000001123456702']]],
  // ── code and secrets ──
  [`Why does this fail?\nconst client = new Stripe("${STRIPE_KEY}");`,
    [['SECRET', STRIPE_KEY]]],
  ['My .env:\nDATABASE_URL=postgres://admin:S3cretPass99@10.0.4.12:5432/prod\nAWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
    [['SECRET', 'AKIAIOSFODNN7EXAMPLE'], ['IP', '10.0.4.12']]],
  ['ssh ubuntu@203.0.113.45 -i ~/.ssh/prod.pem keeps timing out, what should I check?',
    [['IP', '203.0.113.45']]],
  ['export GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789AB then run the deploy script',
    [['SECRET', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789AB']]],
  // ── medical, legal, finance ──
  ['Explain these lab results for my mother Nasreen Akhtar, age 58, patient ID MRN-77412, born 03/05/1967. HbA1c 8.2.',
    [['PERSON', 'Nasreen Akhtar'], ['DOB', '03/05/1967']]],
  ['My passport number is AB1234567, expiry 2029. Help me fill the visa form for Kamran Yousuf.',
    [['PASSPORT', 'AB1234567'], ['PERSON', 'Kamran Yousuf']]],
  ['Summarize this contract between Farhan Ahmed (CNIC 61101-7654321-5) and Bright Future Builders Pvt Ltd.',
    [['PERSON', 'Farhan Ahmed'], ['NATIONAL_ID', '61101-7654321-5'], ['ORG', 'Bright Future Builders Pvt Ltd']]],
  ['Calculate zakat. My account number is 0123456789012 at HBL Gulberg branch and balance is 2.4 million.',
    [['ACCOUNT', '0123456789012']]],
  // ── Roman Urdu chat ──
  ['hamza bhai ko bol dena ke kal 5 baje 0312-3456789 pe call kare',
    [['PERSON', 'hamza'], ['PHONE', '0312-3456789']]],
  ['mera naam ayesha hai aur main model town lahore mein rehti hun, email ayesha99@gmail.com',
    [['PERSON', 'ayesha'], ['EMAIL', 'ayesha99@gmail.com']]],
  ['usman ko batao ke meeting Johar Town ke office mein hai, address House 55, Block C, Johar Town, Lahore',
    [['PERSON', 'usman'], ['ADDRESS', 'House 55, Block C, Johar Town, Lahore']]],
  ['Ye email Kamran sahab ko bhejni hai: kamran.sahab@company.pk, unka number 0333-1112223 hai',
    [['PERSON', 'Kamran'], ['EMAIL', 'kamran.sahab@company.pk'], ['PHONE', '0333-1112223']]],
  ['meri behan sana ki shadi hai 14 december ko, card pe likhna hai "Sana weds Faisal"',
    [['PERSON', 'sana'], ['PERSON', 'Faisal']]],
  ['shifting kab kar sakty hain, mera address hai 12-A, Street 4, Satellite Town, Rawalpindi',
    [['ADDRESS', '12-A, Street 4, Satellite Town, Rawalpindi']]],
  // ── Urdu ──
  ['براہ کرم عائشہ صدیقی کو یہ خط بھیج دیں، ان کا فون نمبر ۰۳۰۰-۱۲۳۴۵۶۷ ہے',
    [['PERSON', 'عائشہ صدیقی'], ['PHONE', '۰۳۰۰-۱۲۳۴۵۶۷']]],
  ['میرا نام بلال احمد ہے، میں گلشن اقبال بلاک 5 کراچی میں رہتا ہوں، شناختی کارڈ نمبر 42201-1234567-1',
    [['PERSON', 'بلال احمد'], ['ADDRESS', 'گلشن اقبال بلاک 5 کراچی'], ['NATIONAL_ID', '42201-1234567-1']]],
  ['اس درخواست کو بہتر بنائیں: نام: حمزہ طارق، پتہ: مکان نمبر 12، گلی 3، محلہ باغبانپورہ، لاہور، فون: 03001234567',
    [['PERSON', 'حمزہ طارق'], ['ADDRESS', 'مکان نمبر 12، گلی 3، محلہ باغبانپورہ، لاہور'], ['PHONE', '03001234567']]],
  ['میری بیٹی سدرہ وقار کی تاریخ پیدائش 3/7/2015 ہے، اسکول کا فارم بھرنا ہے',
    [['PERSON', 'سدرہ وقار'], ['DOB', '3/7/2015']]],
  // ── Hindi ──
  ['मेरा नाम राहुल शर्मा है, मेरा आधार नंबर १२३४ ५६७८ ९०१२ है और फोन ९८१०१२३४५६७',
    [['PERSON', 'राहुल शर्मा'], ['NATIONAL_ID', '१२३४ ५६७८ ९०१२'], ['PHONE', '९८१०१२३४५६७']]],
  ['कृपया प्रिया वर्मा को ईमेल भेजें, पता: मकान नंबर २७, राजीव नगर, जयपुर',
    [['PERSON', 'प्रिया वर्मा'], ['ADDRESS', 'मकान नंबर २७, राजीव नगर, जयपुर']]],
  // ── tables and structured data ──
  ['name,email,phone\nAli Raza,ali.raza@example.com,0300-1111111\nSana Malik,sana.malik@example.com,0301-2222222\nWrite a summary of this list.',
    [['PERSON', 'Ali Raza'], ['EMAIL', 'ali.raza@example.com'], ['PHONE', '0300-1111111'], ['PERSON', 'Sana Malik'], ['PHONE', '0301-2222222']]],
  ['{"customer": "Zainab Hussain", "email": "zainab.h@example.org", "address": "Plot 45, Sector 11-A, North Karachi"}',
    [['PERSON', 'Zainab Hussain'], ['EMAIL', 'zainab.h@example.org'], ['ADDRESS', 'Plot 45, Sector 11-A, North Karachi']]],
  // ── free-text locations ──
  ['I stay near Dolmen Mall Clifton, can you suggest a gym nearby?',
    [['ADDRESS', 'Dolmen Mall']]],
  ['My shop is behind Liberty Market in Gulberg, how do I get more customers?',
    [['ADDRESS', 'Liberty Market']]],
  // ── names without a cue ──
  ['Rubab and Fahad are joining the call at 4, can you make the agenda?',
    [['PERSON', 'Rubab'], ['PERSON', 'Fahad']]],
  // ── chat transcripts, signatures, headers ──
  ['Hamza: kal aa jao\nAyesha: theek hai, kitne baje?\nHamza: 5 baje\nSummarize this chat.', [['PERSON', 'Hamza'], ['PERSON', 'Ayesha']]],
  ['Fayyaz Ahmed: please send the file\nSana Malik: ok sending now', [['PERSON', 'Fayyaz Ahmed'], ['PERSON', 'Sana Malik']]],
  ['Make this email shorter.\n\nRegards,\nHamza Tariq\nSenior Engineer, Nexora Technologies', [['PERSON', 'Hamza Tariq']]],
  ['Thanks,\nSana', [['PERSON', 'Sana']]],
  ['From: Ali Raza <ali.raza@example.com>\nTo: Sana Malik <sana@example.com>\nSubject: Q3 plan', [['PERSON', 'Ali Raza'], ['EMAIL', 'ali.raza@example.com'], ['PERSON', 'Sana Malik'], ['EMAIL', 'sana@example.com']]],
  ['Student: Bilal Ahmed, Roll No: 21F-3456, Section B. Write a recommendation letter.', [['PERSON', 'Bilal Ahmed']]],
  // ── number and address formats ──
  ['call me on +92-300-1234567 or 0092 321 7654321', [['PHONE', '+92-300-1234567'], ['PHONE', '0092 321 7654321']]],
  ['office (042) 111-222-333 and mobile 03451234567', [['PHONE', '(042) 111-222-333'], ['PHONE', '03451234567']]],
  ['my cnic is 3520212345679 please save it', [['NATIONAL_ID', '3520212345679']]],
  ['H# 12, St# 5, G-9/3, Islamabad', [['ADDRESS', 'H# 12, St# 5, G-9/3, Islamabad']]],
  ['house no 5 street 3 sector G-11/2 islamabad', [['ADDRESS', 'house no 5 street 3 sector G-11/2 islamabad']]],
  ['card 5500 0000 0000 0004 cvv 123 exp 12/27', [['CARD', '5500 0000 0000 0004']]],
  ['iban pk36scbl0000001123456702', [['IBAN', 'pk36scbl0000001123456702']]],
  ['mera account number 12345678901234 hai bank alfalah mein', [['ACCOUNT', '12345678901234']]],
  ['https://example.com/reset?token=9f8b7c6d5e4a3b2c1d0e9f8a7b6c5d4e&email=hamza@example.com', [['EMAIL', 'hamza@example.com']]],
  ['Password: Hunter2!Summer  username: hamza.tariq', [['SECRET', 'Hunter2!Summer']]],
  // ── usernames ──
  ['twitter handle @hamza_tariq and instagram hamza.tariq92', [['HANDLE', '@hamza_tariq'], ['HANDLE', 'hamza.tariq92']]],
  ['My telegram username is ali_raza_99, add me', [['HANDLE', 'ali_raza_99']]],
  // ── mixed language ──
  ['Aoa, mera naam Saad Ahmed hai, Lahore se hun, number 0300-9998887', [['PERSON', 'Saad Ahmed'], ['PHONE', '0300-9998887']]],
  ['Pls tell Mr Khan that his appointment with Dr Saad is at 5pm', [['PERSON', 'Khan'], ['PERSON', 'Saad']]],
  ['میں نے احمد کو فون کیا تھا 03001234567 پر', [['PERSON', 'احمد'], ['PHONE', '03001234567']]],
  ['ڈاکٹر صاحبہ کا نام نادیہ خان ہے اور ان کا کلینک ماڈل ٹاؤن لاہور میں ہے', [['PERSON', 'نادیہ خان']]],
];

const CLEAN = [
  'Explain the difference between TCP and UDP in simple terms.',
  'Write a Python function that returns the nth Fibonacci number using memoization.',
  'Give me a recipe for chicken biryani for 4 people, 500g chicken, 2 cups rice.',
  'Plan a 5 day trip to Northern Pakistan covering Hunza and Skardu in June.',
  'What are the main causes of the French Revolution?',
  'Translate "Good morning, how are you?" into Urdu and Arabic.',
  'Compare Next.js App Router with the Pages Router for a SaaS dashboard.',
  'Our Q3 revenue grew 12% while churn dropped to 3.4%. Draft a board update.',
  'The API returns 429 Too Many Requests after 100 calls per minute. How do I add retries?',
  'Docker build fails with error code 137 on step 5/12. What does it mean?',
  'git rebase -i HEAD~3 then force push to origin main',
  'SELECT id, name FROM users WHERE created_at > NOW() - INTERVAL 7 DAY;',
  'Summarize the key ideas of The Lean Startup in five bullets.',
  'Who discovered penicillin and in which year?',
  'Write a LinkedIn post about lessons learned from launching our first product.',
  'Explain how Lahore and Karachi differ in climate.',
  'Write a cover letter template for a software engineer role. Use [Your Name] and [Company] placeholders.',
  'Fix the grammar: "He go to the market yesterday and buy two kilo apple."',
  'kal ka weather kaisa rahega aur mujhe kya pehen kar jana chahiye?',
  'mujhe ek acha sa resume template chahiye jisme skills aur projects hon',
  'chai banane ki recipe bata do step by step',
  'مجھے پاکستان کی معیشت کے بارے میں ایک مضمون لکھ کر دیں',
  'ایک اچھی کہانی لکھیں جس میں شیر اور چوہا ہو',
  'پانی کا چکر سمجھائیں',
  'भारत की अर्थव्यवस्था के बारे में एक लेख लिखिए',
  'चाय बनाने की विधि बताइए',
  'Block 5 of the dataset is corrupted, how do I recover it?',
  'We visited Central Park last summer and loved Cape Town.',
  'The Town Hall meeting is on Friday at 10:30 in Room B.',
  'In Java, add @Override above the method and @Test for unit tests.',
  'npm install @types/node @angular/core --save-dev',
  '@media (max-width: 600px) { .card { padding: 8px } }',
  'Use @pytest.fixture for setup and @dataclass for the models.',
  'Muhammad Ali Jinnah Road, near Tower, Karachi is a busy street, what is the best time to drive there?',
];

test('realistic prompts: every sensitive item is found', () => {
  const misses = [];
  let total = 0;
  for (const [text, gold] of DIRTY) {
    const spans = detect(text, opts);
    for (const [type, sub] of gold) {
      total++;
      const at = text.indexOf(sub);
      assert.ok(at >= 0, `bad test data: "${sub}" is not in its prompt`);
      const hit = spans.some((s) => s.start < at + sub.length && s.end > at);
      if (!hit) misses.push(`${type} "${sub}"  in  ${JSON.stringify(text.slice(0, 70))}`);
    }
  }
  assert.deepEqual(misses, [], `${misses.length}/${total} items missed:\n  ${misses.join('\n  ')}`);
});

test('realistic prompts: nothing sensitive is cut in half', () => {
  const bad = [];
  for (const [text, gold] of DIRTY) {
    const spans = detect(text, opts);
    for (const [, sub] of gold) {
      const at = text.indexOf(sub);
      const cover = spans.filter((s) => s.start < at + sub.length && s.end > at);
      const covered = cover.length && Math.min(...cover.map((s) => s.start)) <= at && Math.max(...cover.map((s) => s.end)) >= at + sub.length;
      if (cover.length && !covered) bad.push(`"${sub}" only partly covered: ${cover.map((s) => JSON.stringify(s.value)).join(', ')}`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('realistic prompts: clean prompts stay untouched', () => {
  const fp = [];
  for (const t of CLEAN) {
    const spans = detect(t, opts);
    if (spans.length) fp.push(`${JSON.stringify(t.slice(0, 60))} → ${spans.map((s) => `${s.type}:${s.value}`).join(' | ')}`);
  }
  assert.deepEqual(fp, [], fp.join('\n'));
});
