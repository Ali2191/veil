// Urdu / Arabic-script rules. Run: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
require('../lib/types.js'); require('../lib/names.js'); require('../lib/ids.js'); require('../lib/phone.js'); require('../lib/topics.js');
require('../lib/urdu.js');
const D = require('../lib/dict.js');
const { detect } = require('../lib/detect.js');
const T = require('../lib/types.js');
const { substitute } = require('../lib/tokens.js');

const dict = D.build(D.readRaw());
const opts = { dict, home: ['PK'] };
const found = (text) => detect(text, opts).map((s) => [s.type, s.value]);
const has = (text, type, value) =>
  assert.ok(found(text).some(([t, v]) => t === type && v === value), `expected ${type} "${value}" in ${JSON.stringify(text)}: ${JSON.stringify(found(text))}`);

test('Urdu names: cue words', () => {
  has('میرا نام حمزہ طارق ہے اور میں لاہور میں رہتا ہوں', 'PERSON', 'حمزہ طارق');
  has('اس کا نام رباب ہے', 'PERSON', 'رباب');
  has('نام: زورب لیکس مینڈل', 'PERSON', 'زورب لیکس مینڈل');
  has('جناب عمران قریشی نے قرض کے لیے درخواست دی ہے', 'PERSON', 'عمران قریشی');
  has('محترمہ سائرہ بانو کا فون', 'PERSON', 'سائرہ بانو');
  has('ڈاکٹر سعد احمد سے ملاقات', 'PERSON', 'سعد احمد');
  has('میں ارسلان ہوں', 'PERSON', 'ارسلان');
  has('سلام حمزہ، کیسے ہو؟', 'PERSON', 'حمزہ');
});

test('Urdu names: honorific after the name', () => {
  has('کامران بھائی کو فائلیں بھیج دیں', 'PERSON', 'کامران');
  has('ثمینہ باجی کل آئیں گی', 'PERSON', 'ثمینہ');
  has('زورب لیکس صاحب سے بات کریں', 'PERSON', 'زورب لیکس');
});

test('Urdu names: dictionary and spelling variants', () => {
  has('براہ کرم عائشہ صدیقی کو ای میل کریں', 'PERSON', 'عائشہ صدیقی');
  has('محمد عثمان غنی شیخ نے دستخط کیے', 'PERSON', 'محمد عثمان غنی شیخ');
  // Arabic ي/ك/ة spellings match the Urdu ی/ک/ہ forms
  has('براہ کرم عائشة صديقي کو لکھیں', 'PERSON', 'عائشة صديقي');
});

test('Urdu names: Roman Urdu cues', () => {
  has('mera naam Hamza hai aur main Lahore mein rehta hun', 'PERSON', 'Hamza');
  has('Zorblax bhai ko message karo', 'PERSON', 'Zorblax');
  has('janab Imran sahab ka number', 'PERSON', 'Imran');
});

test('Urdu digits work in phone, CNIC, DOB, account', () => {
  has('محترمہ سائرہ بانو کا فون نمبر ۰۳۰۰-۱۲۳۴۵۶۷ ہے', 'PHONE', '۰۳۰۰-۱۲۳۴۵۶۷');
  has('واٹس ایپ نمبر ٠٣٢١٧٦٥٤٣٢١', 'PHONE', '٠٣٢١٧٦٥٤٣٢١');
  has('شناختی کارڈ نمبر ۳۵۲۰۲-۱۲۳۴۵۶۷-۱ ہے', 'NATIONAL_ID', '۳۵۲۰۲-۱۲۳۴۵۶۷-۱');
  has('تاریخ پیدائش: ۱۴ اگست ۱۹۹۸', 'DOB', '۱۴ اگست ۱۹۹۸');
  has('اکاؤنٹ نمبر 0123456789012 میں رقم بھیجیں', 'ACCOUNT', '0123456789012');
});

test('Urdu and ASCII digits share one placeholder', () => {
  const a = detect('فون ۰۳۰۰-۱۲۳۴۵۶۷', opts).find((s) => s.type === 'PHONE');
  const b = detect('call 0300-1234567', opts).find((s) => s.type === 'PHONE');
  assert.equal(a.key, b.key);
  // the original text (not the ASCII copy) is what gets replaced
  const text = 'فون ۰۳۰۰-۱۲۳۴۵۶۷ پر کال کریں';
  const spans = detect(text, opts);
  const out = substitute(text, spans, (sp) => T.token(sp.type, 1)).text;
  assert.equal(out, 'فون [PHONE_1] پر کال کریں');
});

test('Urdu addresses', () => {
  has('مکان نمبر 12، گلی 5، سیکٹر F-8/3، اسلام آباد', 'ADDRESS', 'مکان نمبر 12، گلی 5، سیکٹر F-8/3، اسلام آباد');
  has('میرا پتہ: مکان نمبر ۲۷ بی، گلگشت کالونی، ملتان', 'ADDRESS', 'مکان نمبر ۲۷ بی، گلگشت کالونی، ملتان');
  has('میں ماڈل ٹاؤن لاہور میں رہتا ہوں', 'ADDRESS', 'ماڈل ٹاؤن لاہور');
});

test('Urdu addresses: area name and town after the numbers', () => {
  has('مکان نمبر 45، گلی نمبر 7، محلہ اسلام پورہ، گوجرانوالہ', 'ADDRESS', 'مکان نمبر 45، گلی نمبر 7، محلہ اسلام پورہ، گوجرانوالہ');
  has('محلہ اسلام پورہ، گوجرانوالہ', 'ADDRESS', 'محلہ اسلام پورہ، گوجرانوالہ');
  has('گھر نمبر 7 محلہ غوثیہ سیالکوٹ میں رہتا ہوں', 'ADDRESS', 'گھر نمبر 7 محلہ غوثیہ سیالکوٹ');
  has('پلاٹ نمبر 45، سیکٹر 11-A، نارتھ کراچی', 'ADDRESS', 'پلاٹ نمبر 45، سیکٹر 11-A، نارتھ کراچی');
  has('مکان نمبر 12، گلی نمبر 3، محلہ باغبانپورہ، لاہور سے رابطہ کریں', 'ADDRESS', 'مکان نمبر 12، گلی نمبر 3، محلہ باغبانپورہ، لاہور');
  for (const t of ['محلہ کے لوگ بہت اچھے ہیں', 'گلی میں بچے کھیل رہے ہیں', 'میں لاہور میں رہتا ہوں', 'مکان کا کرایہ بہت زیادہ ہے']) assert.deepEqual(found(t), [], t);
});

test('Urdu form labels and organizations', () => {
  const t = 'نام: حمزہ طارق\nفون: 03001234567\nپتہ: مکان نمبر 5، گلی 3، ملتان';
  has(t, 'PERSON', 'حمزہ طارق');
  has(t, 'PHONE', '03001234567');
  has(t, 'ADDRESS', 'مکان نمبر 5، گلی 3، ملتان');
  has('نیکسورا ٹیکنالوجیز پرائیویٹ لمیٹڈ کا انوائس', 'ORG', 'نیکسورا ٹیکنالوجیز پرائیویٹ لمیٹڈ');
});

test('ordinary Urdu text produces no detections', () => {
  const CLEAN = [
    'مجھے پتہ ہے کہ آج موسم اچھا ہے',
    'پاکستان کی معیشت کے بارے میں مضمون لکھیں',
    'ٹی سی پی اور یو ڈی پی میں فرق بتائیں',
    'عمر بھر کی کمائی بچانے کا طریقہ بتائیں',
    'ایک اچھی کہانی لکھیں جس میں شیر اور چوہا ہو',
    'لاہور اور کراچی کے موسم کا موازنہ کریں',
    'پانی کا چکر سمجھائیں',
    'پائتھن میں فنکشن کیسے بناتے ہیں؟',
    'اس جملے کا انگریزی میں ترجمہ کریں',
    'فیصل آباد میں کپڑے کی صنعت پر نوٹ لکھیں',
    'کل میٹنگ صبح دس بجے ہے براہ کرم تیار رہیں',
    'نور کی رفتار کتنی ہوتی ہے',
    'حسن کی تعریف میں ایک شعر لکھیں',
    'ہماری کمپنی کی آمدنی تین فیصد بڑھی ہے',
    'چائے بنانے کی ترکیب بتائیں',
    'اسلام آباد کے بارے میں معلومات دیں',
    'کتاب کا خلاصہ لکھیں',
    'اس سڑک پر ٹریفک بہت زیادہ ہے',
    'علی پور اور اقبال ٹاؤن کے درمیان فاصلہ کتنا ہے',
  ];
  for (const t of CLEAN) assert.deepEqual(found(t), [], t);
});
