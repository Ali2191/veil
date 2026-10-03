// End-to-end: real Chromium, VEIL loaded as an extension, a fake AI site.
// Run: npm run e2e
const test = require('node:test');
const assert = require('node:assert/strict');
const { startSite } = require('./mock-site.js');
const { launch, until } = require('./harness.js');

async function withBrowser(settings, fn) {
  const site = await startSite();
  const b = await launch(settings);
  try { await fn({ site, b }); } finally { await b.close(); await site.close(); }
}
const logText = (page) => page.locator('#log').innerText();
const sendClick = (page) => page.click('button[aria-label="Send message"]');

test('placeholders: the AI never sees real values, and replies show them again', { timeout: 60000 }, () => withBrowser({}, async ({ site, b }) => {
  site.reply = () => 'Hi [PERSON_1], I will write to [EMAIL_1] about [ADDRESS_1].';
  const page = await b.open(`${site.url}/chat.html`);
  await page.fill('textarea', 'Email Sarah Khan at sarah@example.com about 27-B Gulgasht Colony, Multan');
  await sendClick(page);
  await until(() => site.received.length === 1, 'the message to reach the AI');
  const got = site.received[0];
  for (const secret of ['Sarah', 'Khan', 'sarah@example.com', 'Gulgasht']) assert.ok(!got.includes(secret), `the AI received "${secret}": ${got}`);
  assert.match(got, /\[PERSON_1\].*\[EMAIL_1\].*\[ADDRESS_1\]/);
  await until(async () => (await logText(page)).includes('Hi Sarah Khan'), 'the reply to be restored');
  const shown = await logText(page);
  assert.match(shown, /sarah@example\.com/);
  assert.match(shown, /Gulgasht Colony, Multan/);
  assert.ok(!/\[PERSON_1\]/.test(shown), 'no placeholder left on the page');
  // the user's own bubble shows the real text too
  assert.match(shown, /Email Sarah Khan at sarah@example\.com/);
}));

test('the same person keeps the same placeholder; a new person gets the next one', { timeout: 60000 }, () => withBrowser({}, async ({ site, b }) => {
  const page = await b.open(`${site.url}/chat.html`);
  await page.fill('textarea', 'Tell Sarah Khan the meeting moved.');
  await sendClick(page);
  await until(() => site.received.length === 1, 'first message');
  await page.fill('textarea', 'Also tell Sarah Khan and Bilal Ahmed to bring the report.');
  await sendClick(page);
  await until(() => site.received.length === 2, 'second message');
  assert.match(site.received[0], /\[PERSON_1\]/);
  assert.match(site.received[1], /\[PERSON_1\].*\[PERSON_2\]/);
  assert.ok(!/Sarah|Bilal/.test(site.received.join(' ')));
}));

test('rich-text box that sends on Enter', { timeout: 60000 }, () => withBrowser({}, async ({ site, b }) => {
  site.reply = () => 'Noted, [PERSON_1].';
  const page = await b.open(`${site.url}/editor.html`);
  await page.click('#box');
  await page.keyboard.type('My name is Hamza Tariq and my number is 0300-1234567');
  await page.keyboard.press('Enter');
  await until(() => site.received.length === 1, 'the message to reach the AI');
  assert.ok(!/Hamza|Tariq|0300-1234567/.test(site.received[0]), site.received[0]);
  assert.match(site.received[0], /\[PERSON_1\].*\[PHONE_1\]/);
  await until(async () => (await logText(page)).includes('Noted, Hamza Tariq.'), 'the reply to be restored');
}));

test('natural names: the AI sees a stand-in name, the page shows the real one', { timeout: 60000 }, () => withBrowser({ naturalNames: true }, async ({ site, b }) => {
  site.reply = (text) => { const m = /write to (.+?) \(/.exec(text); return `Dear ${m ? m[1] : '?'}, I have drafted it for [EMAIL_1].`; };
  const page = await b.open(`${site.url}/chat.html`);
  await page.fill('textarea', 'Please write to Hamza Tariq (hamza@example.com) about the invoice.');
  await sendClick(page);
  await until(() => site.received.length === 1, 'the message to reach the AI');
  const got = site.received[0];
  assert.ok(!/Hamza|Tariq|hamza@example/.test(got), `the AI received a real value: ${got}`);
  assert.ok(!/\[PERSON_/.test(got), 'people get a stand-in name, not a placeholder');
  assert.match(got, /\[EMAIL_1\]/, 'other details still use placeholders');
  const stand = /write to (.+?) \(/.exec(got)[1];
  assert.match(stand, /^\S+ \S+$/, `a two-word stand-in name, got "${stand}"`);
  await until(async () => (await logText(page)).includes('Dear Hamza Tariq,'), 'the stand-in to be restored to the real name');
  // the same person gets the same stand-in next time
  await page.fill('textarea', 'Please write to Hamza Tariq (hamza@example.com) again.');
  await sendClick(page);
  await until(() => site.received.length === 2, 'second message');
  assert.equal(/write to (.+?) \(/.exec(site.received[1])[1], stand, 'same person, same stand-in');
}));

test('Urdu and Hindi names are protected and restored', { timeout: 60000 }, () => withBrowser({}, async ({ site, b }) => {
  site.reply = () => '[PERSON_1] صاحب، خوش آمدید';
  const page = await b.open(`${site.url}/chat.html`);
  await page.fill('textarea', 'میرا نام حمزہ طارق ہے');
  await sendClick(page);
  await until(() => site.received.length === 1, 'Urdu message');
  assert.ok(!/حمزہ|طارق/.test(site.received[0]), site.received[0]);
  assert.match(site.received[0], /\[PERSON_1\]/);
  await until(async () => (await logText(page)).includes('حمزہ طارق صاحب'), 'Urdu reply restored');

  site.reply = () => 'नमस्ते [PERSON_2]';
  await page.fill('textarea', 'मेरा नाम राहुल शर्मा है');
  await sendClick(page);
  await until(() => site.received.length === 2, 'Hindi message');
  assert.ok(!/राहुल|शर्मा/.test(site.received[1]), site.received[1]);
  await until(async () => (await logText(page)).includes('नमस्ते राहुल शर्मा'), 'Hindi reply restored');
}));

test('pasted text is cleaned before the page can read it', { timeout: 60000 }, () => withBrowser({}, async ({ site, b }) => {
  const page = await b.open(`${site.url}/chat.html`);
  await page.focus('textarea');
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'Call Sarah Khan on 0300-1234567 about the invoice');
    document.querySelector('textarea').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await until(async () => /\[PERSON_1\]/.test(await page.inputValue('textarea')), 'the paste to be swapped');
  const value = await page.inputValue('textarea');
  assert.ok(!/Sarah|0300-1234567/.test(value), value);
  assert.match(value, /\[PERSON_1\].*\[PHONE_1\]/);
}));

test('VEIL stays out of the way on a page that is not an AI chat', { timeout: 60000 }, () => withBrowser({}, async ({ site, b }) => {
  const page = await b.open(`${site.url}/notes.html`);
  await page.fill('textarea', 'Remember to call Sarah Khan on 0300-1234567');
  await page.click('#send');
  await until(() => site.received.length === 1, 'the note to be saved');
  assert.equal(site.received[0], 'Remember to call Sarah Khan on 0300-1234567', 'a normal page gets the text unchanged');
}));

test('turning VEIL off for a site is respected', { timeout: 60000 }, () => withBrowser({ siteRules: {} }, async ({ site, b }) => {
  const host = new URL(site.url).hostname;
  await b.setSettings({ siteRules: { [host]: 'off' } });
  const page = await b.open(`${site.url}/chat.html`);
  await page.fill('textarea', 'Email Sarah Khan at sarah@example.com');
  await sendClick(page);
  await until(() => site.received.length === 1, 'the message to reach the AI');
  assert.equal(site.received[0], 'Email Sarah Khan at sarah@example.com');
}));
