// Punjabi (Shahmukhi), Pashto, Sindhi, Arabic cues and Hindi (Devanagari). Run: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
require('../lib/types.js'); require('../lib/names.js'); require('../lib/ids.js'); require('../lib/phone.js'); require('../lib/topics.js');
require('../lib/urdu.js'); require('../lib/hindi.js');
const D = require('../lib/dict.js');
const { detect } = require('../lib/detect.js');

const dict = D.build(D.readRaw());
const opts = { dict, home: ['IN', 'PK'] };
const found = (text) => detect(text, opts).map((s) => [s.type, s.value]);
const has = (text, type, value) =>
  assert.ok(found(text).some(([t, v]) => t === type && v === value), `expected ${type} "${value}" in ${JSON.stringify(text)}: ${JSON.stringify(found(text))}`);

test('Punjabi, Sindhi, Pashto and Arabic name cues', () => {
  has('میرا ناں علی رضا اے', 'PERSON', 'علی رضا');
  has('منهنجو نالو عمران آهي', 'PERSON', 'عمران');
  has('زما نوم احمد دی', 'PERSON', 'احمد');
  has('اسمي محمد علي', 'PERSON', 'محمد علي');
  has('السيد أحمد حسن', 'PERSON', 'أحمد حسن');
  has('ہم نے سائیں عمران کو بلایا', 'PERSON', 'عمران');
});

test('Hindi names', () => {
  has('मेरा नाम राहुल शर्मा है और मैं दिल्ली में रहता हूँ', 'PERSON', 'राहुल शर्मा');
  has('कृपया प्रिया वर्मा को ईमेल भेजें', 'PERSON', 'प्रिया वर्मा');
  has('श्रीमती सुनीता देवी का फोन नंबर', 'PERSON', 'सुनीता देवी');
  has('अमित भैया को फाइलें भेज दीजिए', 'PERSON', 'अमित');
  has('मैं रोहित हूँ', 'PERSON', 'रोहित');
  has('नाम: ज़ोरब लेक्स मेंडल', 'PERSON', 'ज़ोरब लेक्स मेंडल');
  has('डॉक्टर संदीप गुप्ता से मिलना है', 'PERSON', 'संदीप गुप्ता');
  // nukta spelling variants match
  has('कृपया जैद खान को लिखें', 'PERSON', 'जैद खान');
});

test('Hindi numbers, addresses and form labels', () => {
  has('श्रीमती सुनीता देवी का फोन नंबर ९८१०१२३४५६७ है', 'PHONE', '९८१०१२३४५६७');
  has('मेरा आधार नंबर १२३४ ५६७८ ९०१२ है', 'NATIONAL_ID', '१२३४ ५६७८ ९०१२');
  has('पैन कार्ड ABCDE1234F है', 'NATIONAL_ID', 'ABCDE1234F');
  has('जन्म तिथि: १४ अगस्त १९९८', 'DOB', '१४ अगस्त १९९८');
  has('खाता नंबर 0123456789012 में पैसे भेजें', 'ACCOUNT', '0123456789012');
  has('मकान नंबर १२, गली नंबर ५, सेक्टर ४, नोएडा', 'ADDRESS', 'मकान नंबर १२, गली नंबर ५, सेक्टर ४, नोएडा');
  has('मेरा पता: मकान नंबर २७, राजीव नगर, जयपुर', 'ADDRESS', 'मकान नंबर २७, राजीव नगर, जयपुर');
  has('मॉडल टाउन पार्क के पीछे रहता हूँ', 'ADDRESS', 'मॉडल टाउन पार्क');
});

test('ordinary Hindi text produces no detections', () => {
  for (const t of [
    'मुझे पता है कि आज मौसम अच्छा है', 'भारत की अर्थव्यवस्था के बारे में लेख लिखें', 'एक अच्छी कहानी लिखिए जिसमें राजा और रानी हों',
    'कल मीटिंग सुबह दस बजे है कृपया तैयार रहें', 'दिल्ली और मुंबई के मौसम की तुलना करें', 'पार्क के पीछे बच्चे खेल रहे हैं',
    'अस्पताल के सामने सड़क बंद है', 'आकाश में बादल हैं', 'प्रकाश की गति कितनी होती है', 'चाय बनाने की विधि बताइए',
  ]) assert.deepEqual(found(t), [], t);
});

test('digits of every supported script become ASCII', () => {
  const { asciiDigits } = require('../lib/urdu.js');
  assert.equal(asciiDigits('۰۳۰۰ ٠١٢ ०९८ ১২৩ ੧੨ ૪૫'), '0300 012 098 123 12 45');
});
