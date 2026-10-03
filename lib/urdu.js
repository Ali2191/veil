/* VEIL — Urdu / Arabic-script rules. Urdu has no capital letters, so the Latin name logic can't
   see names written in Urdu script. This module adds:
     - spelling normalization (Arabic ي/ك/ه and Urdu ی/ک/ہ match each other, diacritics ignored)
     - Eastern Arabic digits (۰۱۲… / ٠١٢…) → ASCII digits, same length, so number rules still work
     - person names from cues (نام، جناب، محترمہ، بھائی، صاحب…), curated names/surnames and the
       Arabic-script entries of the Wikidata dictionaries
     - addresses (مکان نمبر، گلی، محلہ، کالونی، سیکٹر…), Urdu form labels, and ID/DOB/account cues
   All functions are pure and synchronous. */
(function (root) {
  'use strict';

  // ───────────────────────────── normalization ─────────────────────────────

  const DIACRITICS = /[\u064B-\u065F\u0670\u0640\u06D6-\u06ED\u200c\u200d]/g;
  const MAP = {
    'ي': 'ی', 'ى': 'ی', 'ے': 'ی', 'ۓ': 'ی', 'ك': 'ک',
    'ه': 'ہ', 'ھ': 'ہ', 'ة': 'ہ', 'ۀ': 'ہ', 'ۂ': 'ہ', 'ۃ': 'ہ',
    'أ': 'ا', 'إ': 'ا', 'ٱ': 'ا', 'ؤ': 'و',
  };
  const MAP_RE = /[يىےۓكهھةۀۂۃأإٱؤ]/g;
  // Lower-cases nothing (no case in Urdu); collapses spelling variants and strips marks.
  const norm = (w) => w.replace(DIACRITICS, '').replace(MAP_RE, (c) => MAP[c]);

  // ۰-۹ (Persian/Urdu) and ٠-٩ (Arabic-Indic) → 0-9. Output has the same length as the input.
  const asciiDigits = (s) => s.replace(/[۰-۹٠-٩]/g, (c) => {
    const n = c.charCodeAt(0);
    return String(n >= 0x06F0 ? n - 0x06F0 : n - 0x0660);
  });

  const set = (s) => new Set(s.trim().split(/\s+/).map(norm));
  const has = (S, w) => S.has(w);
  const ARABIC = /\p{Script=Arabic}/u;

  // ───────────────────────────── lexicons ─────────────────────────────

  const GIVEN = set(`
    محمد احمد علی حسن حسین عمر عثمان بلال حمزہ طارق عمران کامران فیصل فہد فرحان فواد ارسلان اسد آصف عارف عدنان
    عامر انور ارشد اشرف عاطف اظہر بابر دانش احسان فراز حارث حیدر حامد ہارون افتخار عرفان جواد جنید کاشف خالد
    خرم منصور محسن معیز نبیل نعیم ناصر نوید ندیم نعمان عبید اویس قاسم راشد رضوان ثاقب سلمان ساجد شاہد شہزاد
    شعیب سہیل سفیان طاہر عمیر اسامہ اسامہ وقاص وسیم ولید یاسر یوسف زاہد ذیشان زبیر ابراہیم اسماعیل ادریس
    عبداللہ عبدالرحمن ابوبکر ایان ارحم احسن شایان مصطفی مرتضی مجتبی ریحان شیراز تیمور طہ عزیر وہاب زید ظہیر
    ظفر جہانگیر جاوید پرویز اسلم اکرم اکبر نواز حماد عمار انس عاقب عقیل فضل حبیب حفیظ حنیف اعجاز اقبال
    جمیل کلیم کریم لطیف محمود ماجد مقصود مسعود مبشر مدثر منیب موسی نذیر نثار قادر رفیق رحیم رؤف سعید
    سرفراز شفیق شکیل شمیم شریف شوکت سکندر سلطان تنویر توصیف واجد یعقوب یاسین ذوہیب عظیم عزیز عابد آفتاب
    اعظم باسط برہان زین طلحہ سعد ایمن شہریار شہروز فرقان فیضان فاروق فرید فخر ہاشم ہلال ہیثم جبران جعفر
    ریاض رمضان رحمان شبیر شعیب شاہزیب صغیر صفدر صہیب طلال عرفات علیم غفار غیاث قیصر کفایت ماہر مجید
    مزمل مظفر معظم ممتاز منان منور مہتاب میر نادر ناظم نجیب نصیر نعیم وجاہت وحید ہمایوں یحییٰ یونس
    فاطمہ عائشہ مریم زینب خدیجہ ثناء حنا آمنہ سارہ اقرا مہنور اریبہ حرا رابعہ صائمہ نادیہ فرح مہوش
    سعدیہ عظمی بشری اسماء ثمینہ شازیہ روبینہ نازیہ انعم علیزہ علیشبہ لائبہ زویا عائزہ عنایہ حفصہ حمیرا
    جویریہ کنزہ کومل ماہم مائرہ مہک مشال مومنہ نمرہ رمشہ سدرہ صدف سمرا سوبیہ طاہرہ عروج زارہ زہرہ
    زنیرہ شبنم پروین نسرین یاسمین سلمی رانیہ ملائکہ نایاب نائلہ نجمہ نرگس نصرت نغمہ لبنی لیلی ماریہ
    مریم مدیحہ منزہ منیبہ مہرین مہر ندا نبیلہ نوشین نمرہ ہما ہاجرہ ہانیہ ہبہ ایمن ایشال ایلیاہ
    بینش بسمہ بلقیس بتول بشرا تحریم تسنیم تبسم ثریا جنت جمیلہ حبیبہ حلیمہ حمنہ خولہ دعا رخشندہ رضیہ
    رقیہ ریحانہ زیبا زلیخا ساجدہ سائرہ سبیلہ ستارہ سلیمہ سمیرا سمیعہ شائستہ شگفتہ شمائلہ شہناز
    صالحہ صائمہ صبیحہ صفیہ عابدہ عالیہ عبیرہ عفیفہ عنبرین عذرا فائزہ فریحہ فوزیہ کلثوم
  `);

  // Names that are also everyday words: only trusted with a cue.
  const AMBIGUOUS = set(`عمر حسن نور سحر صبا ایمان آیت رضا امید کمال جمال انعام فضل غلام اقبال زین دعا ہما مہر ندا جنت ستارہ`);

  const SURNAMES = set(`
    خان علی احمد شاہ ملک بٹ قریشی چوہدری چودھری شیخ صدیقی حسین رضا اقبال اختر رانا مرزا بیگ اعوان عباسی جٹ بھٹی
    راجپوت جاوید ہاشمی گیلانی بخاری نقوی رضوی زیدی کاظمی جعفری فاروقی عثمانی انصاری خٹک آفریدی یوسفزئی درانی
    نیازی چیمہ وڑائچ گوندل سندھو رندھاوا ترین لودھی میمن بلوچ باجوہ غوری کیانی جنجوعہ خواجہ شریف نواز رحمان
    حسن حیدر اسلم انور ارشد سعید محمود لطیف اکرم ڈار بھٹو زرداری لغاری مزاری کھوسہ دولتانہ گجر ہراج سہگل پراچہ
    کھوکھر ٹوانہ تارڑ ورک سیال قاضی حق ارائیں کشمیری دہلوی لاہوری ملتانی پٹھان مغل صابر عالم آغا سومرو
    جمالی مگسی رئیسانی مینگل بگٹی اچکزئی کاکڑ ترکئی مہمند وزیر محسود بنگش اورکزئی شنواری مروت گنڈاپور
    رشید حمید ندیم نعیم خلیل سلیم شفیع یوسف ظفر وحید جمیل فاروق قدوس
  `);

  // Words that sit inside a name: "ضیاء الحق", "عبد الرحمن", "محمد بن قاسم".
  const PARTICLES = set(`بن بنت ابن ال الدین الحق الرحمن الرحمان الرحیم اللہ الاسلام الحسن الحسین الہی`);

  // Titles that come before a name (not part of the name).
  const TITLES = set(`
    جناب محترم محترمہ مسٹر مس مسز ڈاکٹر پروفیسر انجینئر حاجی حافظ قاری مولانا مولوی میاں علامہ کیپٹن
    کرنل جنرل میجر سردار مفتی بیگم صاحبزادہ صاحبزادی ماسٹر
  `);
  // Titles that are also part of names/surnames: kept in the span.
  const SOFT_TITLES = set(`سید سیدہ شیخ چوہدری چودھری ملک خواجہ رانا مرزا`);

  // Words after a name that show it is a person: "حمزہ بھائی", "ثمینہ باجی", "احمد صاحب".
  const AFTER = set(`صاحب صاحبہ بھائی بھیا باجی آپی آپا بھابھی بھابی انکل آنٹی سر میڈم جی بیٹا بیٹی`);

  // "نام" = name: میرا نام حمزہ ہے
  const NAME_CUE = set(`نام اسم گرامی ولدیت`);
  const GREET_CUE = set(`ہیلو ہائے ہائی سلام علیکم پیارے پیاری عزیزم ڈئیر`);

  // After a name these show it is a place, not a person: "علی پور", "اقبال ٹاؤن".
  const PLACE_SUFFIX = set(`پور آباد نگر گڑھ والا والی ٹاؤن کالونی روڈ چوک بازار اسٹریٹ سٹریٹ گلی محلہ سیکٹر بلاک فیز سوسائٹی`);

  const CITIES = set(`
    لاہور کراچی اسلام آباد ملتان پشاور کوئٹہ راولپنڈی فیصل آباد حیدر آباد حیدرآباد سیالکوٹ گوجرانوالہ گجرات بہاولپور
    سرگودھا سکھر لاڑکانہ ایبٹ آباد ایبٹآباد مردان مظفر آباد جہلم اوکاڑہ قصور شیخوپورہ ساہیوال ڈیرہ غازی خان رحیم یار خان
    ہنزہ سکردو مری سوات دبئی لندن ریاض جدہ مکہ مدینہ دہلی ممبئی ڈھاکہ نوشہرہ کوہاٹ بنوں چکوال جھنگ ٹوبہ ٹیک سنگھ
    وزیرآباد گجرانوالہ نارووال حافظ آباد منڈی بہاؤالدین بہاولنگر خانیوال وہاڑی لودھراں میانوالی
  `);
  const CITY_FIRST = new Set([...CITIES].filter((c) => !c.includes(' ')));
  const CITY_PHRASES = [...CITIES].filter((c) => c.includes(' '));

  // Not names: pronouns, particles, verbs, calendar words, everyday nouns, countries, cities.
  const STOP = set(`
    میں مجھے میرا میری میرے ہم ہمارا ہماری ہمارے ہمیں آپ آپکا آپکی آپکے آپ کا آپ کی تم تمہارا تمہارے تمہاری تو یہ وہ اس اسے
    ان انہیں انہوں اسکا اسکی اسکے ان کا ان کی جو کون کیا کیوں کب کہاں کیسے کس کتنا کتنی کتنے اور یا لیکن مگر کہ تاکہ اگر
    بھی ہی صرف نہیں نہ مت کو کا کی کے نے سے پر تک لئے لیے کیلئے کیلیے ساتھ بعد پہلے اندر باہر ہے ہیں تھا تھی تھے ہوں ہو
    ہوگا ہوگی ہوں گے گا گی گے کریں کرو کرنا کر کرے کرتا کرتی کرتے دیں دیجئے دیجیے دو دینا بھیجیں بھیجو بھیج بھیجنا لکھیں
    لکھو لکھ لکھنا بتائیں بتاؤ بتا بتانا بنائیں بنا بنانا چاہیے چاہئے چاہتا چاہتی سکتا سکتی سکتے رہا رہی رہے رہتا رہتی
    رہتے ہوا ہوئی ہوئے کل آج پرسوں ابھی پھر یہاں وہاں اب ای میل ایمیل فون نمبر موبائل پتہ پتا ایڈریس گھر شہر ملک علاقہ
    دفتر کمپنی بینک اسکول یونیورسٹی ہسپتال اسپتال دکان مکان کتاب کام دوست بہن والد والدہ امی ابو شوہر بیوی استاد خط
    درخواست مضمون کہانی جواب سوال اردو انگریزی عربی پاکستان بھارت ہندوستان چین امریکہ برطانیہ سعودی عرب
    اتوار پیر منگل بدھ جمعرات جمعہ ہفتہ جنوری فروری مارچ اپریل مئی جون جولائی اگست ستمبر اکتوبر نومبر دسمبر
    شکریہ مہربانی براہ کرم برائے کرم سلام اسلام السلام علیکم والسلام وعلیکم السلام انشاء اللہ ان شاء اللہ
    اللہ خدا رب نبی قرآن مسجد اسلام مسلمان عید رمضان محرم
    سال ماہ دن رات صبح شام دوپہر وقت گھنٹہ منٹ ہفتہ مہینہ تاریخ نام ولدیت
    ایک دو تین چار پانچ چھ سات آٹھ نو دس سو ہزار لاکھ روپے روپیہ پیسے رقم
    اچھا اچھی اچھے برا بری بڑا بڑی بڑے چھوٹا چھوٹی چھوٹے نیا نئی نئے پرانا پرانی پرانے
    پہلا دوسرا تیسرا آخری اگلا پچھلا کوئی سب کچھ ہر کئی بہت زیادہ کم تھوڑا
    ہاں جی نہیں ٹھیک اچھا ضرور شاید لازمی
    کہا کہتا کہتی کہتے بولا بولتا بولتی کہو بولو سنو دیکھو دیکھیں آؤ آئیں جاؤ جائیں جانا آنا
    ملاقات بات چیت پیغام میسج ٹیکسٹ کال رابطہ معلومات تفصیل تفصیلات
    ${[...CITIES].join(' ')}
    ${[...AFTER].join(' ')}
    ${[...PLACE_SUFFIX].join(' ')}
    ${[...NAME_CUE].join(' ')}
    ${[...GREET_CUE].join(' ')}
  `);
  // Words that look like stops but are names/titles in context and must not be stopped.
  for (const w of [...TITLES, ...SOFT_TITLES]) STOP.delete(w);

  // Postpositions that show the word before is a noun/name in a sentence.
  const POST = set(`کو نے سے کا کی کے پر کیلئے کیلیے لئے لیے کیساتھ اور`);

  // ───────────────────────────── dictionary (Wikidata, Arabic script) ─────────────────────────────

  const cache = new WeakMap();
  function dictSets(dict) {
    if (!dict) return null;
    let c = cache.get(dict);
    if (c) return c;
    const pick = (S) => { const out = new Set(); if (S) for (const w of S) if (ARABIC.test(w)) out.add(norm(w)); return out; };
    c = { given: pick(dict.given), family: pick(dict.family) };
    cache.set(dict, c);
    return c;
  }

  // ───────────────────────────── tokens ─────────────────────────────

  const WORD = /[\p{L}\p{M}\u200c\u200d\u0640]+/gu;
  function tokenize(text) {
    const out = [];
    WORD.lastIndex = 0;
    let m;
    while ((m = WORD.exec(text)) !== null) {
      if (!ARABIC.test(m[0])) continue;
      out.push({ w: m[0], n: norm(m[0]), s: m.index, e: m.index + m[0].length });
    }
    return out;
  }
  const singleSpace = (text, a, b) => /^[ \u00a0]$/.test(text.slice(a.e, b.s));

  // ───────────────────────────── persons ─────────────────────────────

  function nameScore(ws, cue, nextTok, dsets) {
    const n = ws.length;
    if (n === 0 || n > 4) return 0;
    const lw = ws.map((t) => t.n);
    const given = (x) => has(GIVEN, x) || (dsets && dsets.given.has(x));
    const sur = (x) => has(SURNAMES, x) || (dsets && dsets.family.has(x));
    const part = (x) => has(PARTICLES, x);
    const nextN = nextTok ? nextTok.n : '';
    // "علی پور", "اقبال ٹاؤن": a place, unless the writer said it is a name.
    if (has(PLACE_SUFFIX, nextN) && cue !== 'strong') return 0;
    if (CITY_PHRASES.includes(lw.join(' ')) || (n === 1 && CITY_FIRST.has(lw[0]))) return 0;

    if (n >= 2) {
      if (cue === 'strong') return n <= 3 ? 0.85 : 0.75;
      if (cue === 'mid' || cue === 'after') return n <= 3 ? 0.8 : 0.7;
      if (lw.every((x) => given(x) || sur(x) || part(x))) {
        if (has(GIVEN, lw[0]) && !has(AMBIGUOUS, lw[0])) return 0.85;
        if (lw.some((x) => has(GIVEN, x) || has(SURNAMES, x))) return 0.8;
        return 0.65;
      }
      if (cue === 'greet') return n <= 3 ? 0.75 : 0;
      if (given(lw[0]) && !has(AMBIGUOUS, lw[0]) && (sur(lw[n - 1]) || has(GIVEN, lw[0]))) return 0.75;
      return 0;
    }

    const x = lw[0];
    if (x.length < 2) return 0;
    if (cue === 'strong') return 0.85;
    if (cue === 'mid' || cue === 'after') return 0.8;
    if (cue === 'greet') return 0.75;
    if (has(GIVEN, x) && !has(AMBIGUOUS, x)) return has(POST, nextN) || !nextTok ? 0.75 : 0.7;
    return 0;
  }

  function detectPersons(text, add, dict) {
    if (!ARABIC.test(text)) return;
    const toks = tokenize(text);
    if (!toks.length) return;
    const dsets = dictSets(dict);
    let i = 0;
    while (i < toks.length) {
      const t = toks[i];
      if (has(STOP, t.n)) { i++; continue; }

      // Segment: consecutive non-stop words separated by single spaces.
      const seg = [t];
      let j = i + 1;
      while (j < toks.length && singleSpace(text, toks[j - 1], toks[j]) && !has(STOP, toks[j].n) && seg.length < 6) { seg.push(toks[j]); j++; }
      const prev = i > 0 ? toks[i - 1] : null;
      const next = j < toks.length ? toks[j] : null;
      const nextAdj = next && singleSpace(text, seg[seg.length - 1], next) ? next : null;

      // Cue before the name.
      let before = null;
      while (seg.length && has(TITLES, seg[0].n)) { before = 'strong'; seg.shift(); }
      if (!seg.length) { i = j; continue; }
      if (!before && has(SOFT_TITLES, seg[0].n) && seg.length >= 2) before = 'mid';
      if (!before && prev && /^[ \u00a0:：=\-–—]{1,3}$/.test(text.slice(prev.e, t.s))) {
        if (has(NAME_CUE, prev.n)) before = 'strong';
        else if (has(GREET_CUE, prev.n)) before = 'greet';
      }
      // Cue after the name: "حمزہ بھائی", "میں حمزہ ہوں".
      let after = null;
      if (nextAdj && has(AFTER, nextAdj.n)) after = 'after';
      else if (prev && nextAdj && prev.n === norm('میں') && nextAdj.n === norm('ہوں') && singleSpace(text, prev, t)) after = 'mid';

      while (seg.length && has(PARTICLES, seg[seg.length - 1].n)) seg.pop();
      let found = false;
      for (let d = 0; d < seg.length && !found; d++) {
        for (let e = seg.length; e > d && !found; e--) {
          const ws = seg.slice(d, e);
          const atEnd = e === seg.length;
          const cue = (d === 0 && before) || (atEnd && after) || null;
          const score = nameScore(ws, cue, atEnd ? next : seg[e], dsets);
          if (score) { add('PERSON', ws[0].s, ws[ws.length - 1].e, score); found = true; }
        }
      }
      i = j;
    }
  }

  // ───────────────────────────── addresses ─────────────────────────────

  const A = (s) => norm(s);
  const UNIT_WORDS = 'مکان|گھر|پلاٹ|فلیٹ|دکان|ہاؤس|کوٹھی|کمرہ|آفس|دفتر'.split('|').map(A).join('|');
  const AREA_WORDS = 'گلی|محلہ|کالونی|ٹاؤن|سیکٹر|بلاک|فیز|روڈ|سٹریٹ|اسٹریٹ|بازار|چوک|سوسائٹی|اسکیم|گارڈن|گارڈنز|ایونیو|ویلی|کینٹ|ہاؤسنگ|ایکسٹینشن|پارک|مارکیٹ'.split('|').map(A).join('|');
    function detectAddresses(text, add) {
    if (!ARABIC.test(text)) return;
    const toks = tokenize(text);
    if (!toks.length) return;
    const unitRe = new RegExp(`^(?:${UNIT_WORDS})$`);
    const areaRe = new RegExp(`^(?:${AREA_WORDS})$`);
    const isNum = (s) => /^[A-Za-z]?-?\d{1,5}[A-Za-z]?(?:[-/][A-Za-z0-9]{1,4})?$/.test(s);

    const anchors = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (unitRe.test(t.n)) {
        // "مکان نمبر 12", "گھر 5-B", "پلاٹ نمبر 45"
        let k = i, end = t.e;
        const rest = text.slice(t.e, t.e + 40);
        const m = /^[\s:#-]*(?:نمبر)?[\s:#-]*([A-Za-z]?-?\d{1,5}[A-Za-z]?(?:[-/][A-Za-z0-9]{1,4})?)/.exec(rest);
        if (m) { end = t.e + rest.indexOf(m[1]) + m[1].length; anchors.push({ s: t.s, e: end, strong: true }); }
        void k;
      } else if (areaRe.test(t.n)) {
        // area word with up to 2 words before ("گلشن اقبال بلاک") and a number or letter after
        let s = t.s, k = i - 1, back = 0;
        while (k >= 0 && back < 2 && singleSpace(text, toks[k], toks[k + 1]) && !has(STOP, toks[k].n) && !unitRe.test(toks[k].n)) { s = toks[k].s; k--; back++; }
        let e = t.e;
        const rest = text.slice(t.e, t.e + 20);
        const m = /^[\s:#-]*(?:نمبر)?[\s:#-]*([A-Za-z]-?\d{1,4}(?:\/\d{1,2})?|\d{1,4}[A-Za-z]?|[A-Za-z])(?![\p{L}\d])/u.exec(rest);
        let strong = false;
        if (m) { e = t.e + rest.indexOf(m[1]) + m[1].length; strong = true; }
        else if (back === 0) continue; // a bare area word alone ("روڈ") is not an address
        anchors.push({ s, e, strong });
      }
    }
    if (!anchors.length) return;

    // Merge neighbouring anchors ("مکان نمبر 12، گلی 5، سیکٹر F-8") and trailing cities.
    const groups = [];
    for (const a of anchors) {
      const g = groups[groups.length - 1];
      if (g && a.s - g.e <= 6 && /^[\s,،-]*$/.test(text.slice(g.e, a.s))) { g.e = Math.max(g.e, a.e); g.count++; g.strong += a.strong ? 1 : 0; }
      else groups.push({ s: a.s, e: a.e, count: 1, strong: a.strong ? 1 : 0 });
    }
    for (const g of groups) {
      let end = g.e, place = false;
      for (let r = 0; r < 3; r++) {
        const m = /^[\s]*[،,][\s]*([\p{L}\p{M}\u200c]+(?:[ \u00a0][\p{L}\p{M}\u200c]+)?)/u.exec(text.slice(end));
        if (!m) { // city without a comma: "... سیکٹر F-8 اسلام آباد"
          const m2 = /^[\s\u00a0]+([\p{L}\p{M}\u200c]+(?:[ \u00a0][\p{L}\p{M}\u200c]+)?)/u.exec(text.slice(end));
          if (!m2) break;
          const w2 = norm(m2[1].replace(/\u00a0/g, ' '));
          const one = w2.split(' ')[0];
          if (CITIES.has(w2)) { end += m2[0].length; place = true; }
          else if (CITY_FIRST.has(one)) { end += m2[0].indexOf(m2[1]) + m2[1].split(/[ \u00a0]/)[0].length; place = true; }
          break;
        }
        const cand = norm(m[1].replace(/\u00a0/g, ' '));
        const first = cand.split(' ')[0];
        if (CITIES.has(cand)) { end += m[0].length; place = true; }
        else if (CITY_FIRST.has(first)) { end += m[0].indexOf(m[1]) + m[1].split(/[ \u00a0]/)[0].length; place = true; }
        else if (areaRe.test(first) || /^[\p{L}\p{M}\u200c]+$/u.test(cand) && !has(STOP, cand) && r < 2) { end += m[0].length; }
        else break;
      }
      let score = g.count >= 2 ? 0.8 : g.strong ? 0.7 : place ? 0.6 : 0;
      if (place && score >= 0.7) score += 0.1;
      if (score) add('ADDRESS', g.s, end, Math.min(score, 0.9));
    }

    // "پتہ: …", "رہائشی پتہ …", "میں … میں رہتا ہوں"
    const cueRe = /(?:(?:رہائشی|موجودہ|مستقل|نیا|پرانا|میرا|میری|ہمارا|ہمارے|اس کا|گھر کا|دفتر کا|ڈاک کا)\s+(?:پتہ|پتا|ایڈریس)|ایڈریس|(?:پتہ|پتا)(?=\s*[:：=]))\s*(?:ہے)?\s*[:：=-]?\s*/gu;
    let m;
    while ((m = cueRe.exec(text)) !== null) {
      const from = m.index + m[0].length;
      const rest = text.slice(from, from + 140);
      if (!ARABIC.test(rest.slice(0, 20)) && !/^\d/.test(rest)) continue;
      const stop = rest.search(/[\n۔.؟?!]|\s(?:اور|فون|موبائل|ای میل|ایمیل|پر کال|پر رابطہ)(?=\s|$)/u);
      const chunk = stop === -1 ? rest : rest.slice(0, stop);
      const trimmed = chunk.replace(/[\s،,:;]+$/u, '');
      if (trimmed.length >= 4 && (/\d/.test(trimmed) || /[،,]/.test(trimmed))) add('ADDRESS', from, from + trimmed.length, 0.8);
    }
  }

  // ───────────────────────────── organizations ─────────────────────────────

  const ORG_SUFFIX = ['پرائیویٹ لمیٹڈ', 'لمیٹڈ', 'ٹیکنالوجیز', 'سولیوشنز', 'انڈسٹریز', 'انٹرپرائزز', 'ٹریڈرز'].map(A);
  function detectOrgs(text, add) {
    if (!ARABIC.test(text)) return;
    const toks = tokenize(text);
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      let endTok = null;
      if (ORG_SUFFIX.includes(t.n)) endTok = t;
      else if (i + 1 < toks.length && ORG_SUFFIX.includes(t.n + ' ' + toks[i + 1].n) && singleSpace(text, t, toks[i + 1])) endTok = toks[i + 1];
      if (!endTok) continue;
      let k = i - 1, start = t.s, n = 0;
      while (k >= 0 && n < 3 && singleSpace(text, toks[k], toks[k + 1]) && !has(STOP, toks[k].n)) { start = toks[k].s; k--; n++; }
      if (n === 0) continue;
      add('ORG', start, endTok.e, 0.7);
    }
  }

  // ───────────────────────────── form labels ─────────────────────────────

  const KEYS = [
    ['PERSON', 0.85, 'نام|پورا نام|مکمل نام|اسم|اسم گرامی|والد کا نام|والدہ کا نام|والد صاحب کا نام|شوہر کا نام|بیوی کا نام|ولدیت|نام والد|نام والدہ|نام شوہر|مریض کا نام|گاہک کا نام|درخواست گزار کا نام'],
    ['PHONE', 0.9, 'فون|فون نمبر|موبائل|موبائل نمبر|رابطہ نمبر|رابطہ|واٹس ایپ|واٹس ایپ نمبر|ٹیلیفون|سیل نمبر|کنٹیکٹ نمبر'],
    ['EMAIL', 0.9, 'ای میل|ایمیل|ای میل ایڈریس|ایمیل ایڈریس'],
    ['ADDRESS', 0.85, 'پتہ|پتا|ایڈریس|رہائشی پتہ|موجودہ پتہ|مستقل پتہ|گھر کا پتہ|دفتر کا پتہ|ڈاک کا پتہ|ترسیل کا پتہ'],
    ['NATIONAL_ID', 0.9, 'شناختی کارڈ|شناختی کارڈ نمبر|قومی شناختی کارڈ|قومی شناختی کارڈ نمبر|سی این آئی سی|شناختی نمبر|آئی ڈی کارڈ'],
    ['DOB', 0.9, 'تاریخ پیدائش|پیدائش|تاریخ پیدائش'],
    ['PASSPORT', 0.9, 'پاسپورٹ|پاسپورٹ نمبر'],
    ['ACCOUNT', 0.85, 'اکاؤنٹ|اکاؤنٹ نمبر|بینک اکاؤنٹ|کھاتہ نمبر|اکاونٹ نمبر|اکائونٹ نمبر|بینک اکاؤنٹ نمبر'],
  ].map(([type, score, list]) => [type, score, new Set(list.split('|').map(norm))]);

  function keyType(rawKey) {
    const k = norm(rawKey).replace(/\s+/g, ' ').trim();
    for (const [type, score, S] of KEYS) if (S.has(k)) return [type, score];
    return null;
  }

  // Lines like "نام: حمزہ طارق" → callback(type, score, valueStart, value)
  const KV = /^[ \t]*(?:[-*•>]\s*)?([\p{L}\p{M}\u200c][\p{L}\p{M}\u200c ]{0,40}?)[ \t]*[:：=][ \t]*(.*?)[ \t]*$/dgmu;
  function scanKeys(text, emit) {
    if (!ARABIC.test(text)) return;
    KV.lastIndex = 0;
    let m;
    while ((m = KV.exec(text)) !== null) {
      if (!ARABIC.test(m[1])) continue;
      const kt = keyType(m[1]);
      if (!kt || !m[2]) continue;
      emit(kt[0], kt[1], m.indices[2][0], m[2]);
    }
  }

  // ───────────────────────────── cue + number patterns ─────────────────────────────
  // Run on digit-normalized text. Numbers may use ASCII digits (after asciiDigits) and Urdu months.

  const MONTHS = 'جنوری|فروری|مارچ|اپریل|مئی|جون|جولائی|اگست|ستمبر|اکتوبر|نومبر|دسمبر';
  const CUES = [
    ['NATIONAL_ID', 0.85, /(?:قومی\s+)?شناختی\s+کارڈ(?:\s+نمبر)?\s*(?:ہے|:|-|=)?\s*(\d[\d -]{4,20}\d)/gu, (v) => v.replace(/\D/g, '').length >= 5],
    ['NATIONAL_ID', 0.85, /(?:سی\s*این\s*آئی\s*سی|شناختی\s+نمبر)\s*(?:نمبر)?\s*(?:ہے|:|-|=)?\s*(\d[\d -]{4,20}\d)/gu, (v) => v.replace(/\D/g, '').length >= 5],
    ['ACCOUNT', 0.85, /(?:(?:بینک\s+)?اکاؤنٹ|اکاونٹ|اکائونٹ|کھاتہ)(?:\s+نمبر)?\s*(?:ہے|:|-|=)?\s*(\d[\d -]{4,28}\d)/gu, (v) => v.replace(/\D/g, '').length >= 6],
    ['PASSPORT', 0.9, /پاسپورٹ(?:\s+نمبر)?\s*(?:ہے|:|-|=)?\s*([A-Za-z]{1,2}\d{6,9}|\d{8,9})/gu, () => true],
    ['PHONE', 0.85, /(?:فون|موبائل|سیل|ٹیلیفون|رابطہ|واٹس\s*ایپ)(?:\s+نمبر)?\s*(?:ہے|:|-|=)?\s*(\+?\d[\d ().-]{7,18}\d)/gu, (v) => { const n = v.replace(/\D/g, '').length; return n >= 9 && n <= 15; }],
    ['DOB', 0.9, new RegExp(`(?:تاریخ\\s+پیدائش|پیدائش|پیدا\\s+ہوا|پیدا\\s+ہوئی)(?:\\s+ہے|\\s+کی\\s+تاریخ)?\\s*(?::|-|=)?\\s*(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}|(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4})`, 'gu'), () => true],
  ];
  function detectCues(text, add) {
    if (!ARABIC.test(text)) return;
    for (const [type, score, re, ok] of CUES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (!m[1] || !ok(m[1])) continue;
        const start = m.index + m[0].length - m[1].length;
        add(type, start, start + m[1].length, score);
      }
    }
  }

  const api = { norm, asciiDigits, detectPersons, detectAddresses, detectOrgs, detectCues, scanKeys, keyType, tokenize };
  root.VeilUrdu = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
