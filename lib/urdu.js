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
  const N = root.VeilNames || (typeof require === 'function' ? (() => { try { return require('./names.js'); } catch { return null; } })() : null);

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

  // Eastern Arabic (٠-٩), Persian/Urdu (۰-۹), Devanagari (०-९), Bengali, Gurmukhi and Gujarati digits → 0-9.
  // Output has the same length as the input, so offsets stay valid.
  const DIGIT_RE = /[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF]/g;
  const DIGIT_BASES = [0x0660, 0x06F0, 0x0966, 0x09E6, 0x0A66, 0x0AE6];
  const asciiDigits = (s) => s.replace(DIGIT_RE, (c) => {
    const n = c.charCodeAt(0);
    for (const b of DIGIT_BASES) if (n >= b && n <= b + 9) return String(n - b);
    return c;
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
    السيد السيدة الدكتور الأستاذ الحاج الشيخ المهندس ښاغلی ډاکټر
  `);
  // Titles that are also part of names/surnames: kept in the span.
  const SOFT_TITLES = set(`سید سیدہ شیخ چوہدری چودھری ملک خواجہ رانا مرزا`);

  // Words after a name that show it is a person: "حمزہ بھائی", "ثمینہ باجی", "احمد صاحب".
  const AFTER = set(`صاحب صاحبہ بھائی بھیا باجی آپی آپا بھابھی بھابی انکل آنٹی سر میڈم جی بیٹا بیٹی سائیں صېب صیب پاء ویر بھرا`);

  // "نام" = name: میرا نام حمزہ ہے
  const NAME_CUE = set(`نام اسم گرامی ولدیت ناں نالو نوم اسمي اسمه اسمها`);
  const GREET_CUE = set(`ہیلو ہائے ہائی سلام علیکم پیارے پیاری عزیزم ڈئیر`);

  // After a name these show it is a place, not a person: "علی پور", "اقبال ٹاؤن".
  const PLACE_SUFFIX = set(`پور آباد نگر گڑھ والا والی ٹاؤن کالونی روڈ چوک بازار اسٹریٹ سٹریٹ گلی محلہ سیکٹر بلاک فیز سوسائٹی`);

  // One entry per city; multi-word cities are kept whole ("اسلام آباد").
  const CITY_LIST = [
    'لاہور', 'کراچی', 'اسلام آباد', 'ملتان', 'پشاور', 'کوئٹہ', 'راولپنڈی', 'فیصل آباد', 'حیدر آباد', 'حیدرآباد',
    'سیالکوٹ', 'گوجرانوالہ', 'گجرانوالہ', 'گجرات', 'بہاولپور', 'سرگودھا', 'سکھر', 'لاڑکانہ', 'ایبٹ آباد', 'ایبٹآباد',
    'مردان', 'مظفر آباد', 'مظفرآباد', 'جہلم', 'اوکاڑہ', 'قصور', 'شیخوپورہ', 'ساہیوال', 'ڈیرہ غازی خان', 'رحیم یار خان',
    'ہنزہ', 'سکردو', 'مری', 'سوات', 'دبئی', 'لندن', 'ریاض', 'جدہ', 'مکہ', 'مدینہ', 'دہلی', 'ممبئی', 'ڈھاکہ', 'نوشہرہ',
    'کوہاٹ', 'بنوں', 'چکوال', 'جھنگ', 'ٹوبہ ٹیک سنگھ', 'وزیرآباد', 'نارووال', 'حافظ آباد', 'منڈی بہاؤالدین',
    'بہاولنگر', 'خانیوال', 'وہاڑی', 'لودھراں', 'میانوالی',
  ].map(norm);
  const CITIES = new Set(CITY_LIST);
  const CITY_FIRST = new Set(CITY_LIST.filter((c) => !c.includes(' ')));
  const CITY_PHRASES = CITY_LIST.filter((c) => c.includes(' '));

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
    اے نیں سی وچ تے نوں توں دا دی دے ہیگا آں ایہہ ایہہ اوہ کیتا کردا ہندا رہندا رہندی
    زه ته د په کې دی ده او ورته هغه دا ما زما
    آهي آهن ۽ جو جي کي ڏانهن منهنجو تنهنجو هو هي ۾ مان سان
    في من إلى الى هو هي أنا هذا هذه لا نعم عن مع ما
    ${[...CITY_FIRST].join(' ')}
    ${[...AFTER].join(' ')}
    ${[...PLACE_SUFFIX].join(' ')}
    ${[...NAME_CUE].join(' ')}
    ${[...GREET_CUE].join(' ')}
  `);
  // Words that look like stops but are names/titles in context and must not be stopped.
  for (const w of [...TITLES, ...SOFT_TITLES]) STOP.delete(w);

  // Postpositions that show the word before is a noun/name in a sentence.
  const POST = set(`کو نے سے کا کی کے پر کیلئے کیلیے لئے لیے کیساتھ اور`);

  // ───────────────────────────── Roman Urdu (Urdu written in Latin letters) ─────────────────────────────
  // People type "hamza bhai ko bol dena" in lowercase, so the capital-letter rules never fire.
  // Names must be known (curated list, or the dictionary with a strong cue) and need a cue.

  const rset = (s) => new Set(s.trim().split(/\s+/));
  const R_AFTER = rset(`bhai bhaijan bhaiya bhayya bhaiyya sahab sahib saab sab baji bajji baaji aapi api apa bhabhi bhabi chacha chachu mamu mama khala khalu phuppo phupho dada nana ji jee`);
  const R_POST = rset(`ko ne se sy ka ki ke ky kay ny say nay kon`);
  const R_NAME_CUE = rset(`naam naaam janab janaab jnab mohtarma muhtarma mohtaram muhtaram`);
  const R_GREET = rset(`salam salaam hi hello hey dear oye oy`);
  const R_POSS = rset(`mera meri mere mery hamara hamari hamare uska uski uske iska iski iske tumhara tumhari tumhare apka apki apke`);
  const R_KIN = rset(`bhai behan behen bhen dost beta beti chacha chachu mama mamu khala bhabhi bhabi bacha beti ustaad ustad`);
  const R_BE = rset(`hun hoon hu hon hn`);
  // Names that are also common Roman Urdu words: never trusted on a weak cue.
  const R_AMBIG = rset(`sara kamal jamal noor nur sahar saba umeed aziz azam naseeb fazal ghulam inam iqbal aman sher taj raja rani mehr dua hira sitara bahar gul chand tara pari jaan dil rahat shan shabnam rida eman iman`);
  const R_STOP = rset(`
    ek aur ya ye yeh wo woh ko ne se sy ka ki ke ky kay ny mein main mai hai hain hun hoon ho tha thi the nahi nahin bhi bas kal aaj
    abhi phir kya kyun kyu kaise kab kahan kon kaun kitna kitni kitne mera meri mere tera teri tere uska uski uske iska iski iske
    hamara hamari hamare apna apni apne acha achha theek thik bohat bahut zyada kam sab sara saari sare koi kuch har kar karo karna
    karke kardo bol bolo bolna bata batao batana bhej bhejo de do dena dedo le lo lena aa aao aana ja jao jana chal chalo raha rahi
    rahe sakta sakti sakte chahiye wala wali wale jab tab agar lekin magar par pe tak liye lie saath sath baad pehle neeche upar
    ghar office class classes shifting final first time monday tuesday sunday orientation message call bhai baji apa
    bara bari chota choti bada badi chhota chhoti pyara pyari
  `);
  const LATIN_WORD = /\p{Script=Latin}[\p{L}'’-]*/gu;

  function detectRomanPersons(text, add, dict) {
    if (!N || !/[a-z]/.test(text)) return;
    const toks = [];
    LATIN_WORD.lastIndex = 0;
    let m;
    while ((m = LATIN_WORD.exec(text)) !== null) toks.push({ w: m[0], n: m[0].toLowerCase(), s: m.index, e: m.index + m[0].length, up: /^\p{Lu}/u.test(m[0]) });
    if (!toks.length) return;
    const sp1 = (a, b) => b && /^[  ]$/.test(text.slice(a.e, b.s));
    const curated = (x) => N.FIRST.has(x) || N.SURNAMES.has(x);
    const curatedGiven = (x) => N.FIRST.has(x) && !N.AMBIGUOUS.has(x) && !R_AMBIG.has(x);
    const dictGiven = (x) => !!dict && !cueWord(x) && x.length >= 4 && dict.given.has(x) && !dict.places.has(x) && !N.NOT_NAME.has(x) && !R_STOP.has(x) && !N.AMBIGUOUS.has(x) && !R_AMBIG.has(x);
    const cueWord = (x) => R_GREET.has(x) || R_NAME_CUE.has(x) || R_AFTER.has(x) || R_POSS.has(x) || R_KIN.has(x) || R_STOP.has(x) || R_POST.has(x);
    const nameLike = (x) => curated(x) && !N.AMBIGUOUS.has(x) && !cueWord(x);

    // R1: after "naam" / "janab": whatever follows is a name ("naam hamza tariq hai").
    for (let i = 0; i < toks.length - 1; i++) {
      if (!R_NAME_CUE.has(toks[i].n) || !sp1(toks[i], toks[i + 1])) continue;
      let j = i + 1;
      while (j < toks.length && j <= i + 3 && (j === i + 1 || sp1(toks[j - 1], toks[j])) && !N.NOT_NAME.has(toks[j].n) && !R_STOP.has(toks[j].n) && toks[j].w.length >= 2) j++;
      if (j > i + 1) add('PERSON', toks[i + 1].s, toks[j - 1].e, 0.85);
    }

    // R2: runs of known names with a cue before or after.
    let i = 0;
    while (i < toks.length) {
      const t = toks[i];
      if (!(nameLike(t.n) || dictGiven(t.n))) { i++; continue; }
      let j = i + 1;
      while (j < toks.length && j < i + 3 && sp1(toks[j - 1], toks[j]) && (nameLike(toks[j].n) || dictGiven(toks[j].n))) j++;
      const run = toks.slice(i, j);
      const prev = i > 0 && sp1(toks[i - 1], t) ? toks[i - 1] : null;
      const prev2 = prev && i > 1 && sp1(toks[i - 2], prev) ? toks[i - 2] : null;
      const next = j < toks.length && sp1(toks[j - 1], toks[j]) ? toks[j] : null;
      // Capitalized runs belong to the Latin name rules.
      if (run.every((x) => x.up)) { i = j; continue; }

      let cue = null;
      if (prev && R_NAME_CUE.has(prev.n)) cue = 'strong';
      else if (next && R_AFTER.has(next.n)) cue = 'after';
      else if (prev && prev.n === 'main' && next && R_BE.has(next.n)) cue = 'mid';
      else if (prev && prev2 && R_KIN.has(prev.n) && R_POSS.has(prev2.n)) cue = 'kin';
      else if (prev && R_GREET.has(prev.n)) cue = 'greet';
      else if (next && R_POST.has(next.n)) cue = 'post';

      let score = 0;
      const first = run[0].n;
      if (run.length >= 2) {
        if (cue === 'strong' || cue === 'after' || cue === 'mid' || cue === 'kin') score = 0.8;
        else if (cue === 'greet' || cue === 'post') score = curatedGiven(first) ? 0.75 : 0;
        else score = curatedGiven(first) && run.slice(1).every((x) => N.SURNAMES.has(x.n) || N.FIRST.has(x.n)) ? 0.7 : 0;
      } else if (cue === 'strong' || cue === 'after' || cue === 'mid' || cue === 'kin') score = 0.8;
      else if (cue === 'greet') score = curatedGiven(first) ? 0.7 : 0;
      else if (cue === 'post') score = curatedGiven(first) && first.length >= 3 ? 0.7 : 0;
      if (score) add('PERSON', run[0].s, run[run.length - 1].e, score);
      i = j;
    }
  }

  // ───────────────────────────── engine ─────────────────────────────
  // Everything below is script-independent logic. A profile P supplies the word lists and
  // patterns for one language (Urdu here, Hindi in hindi.js).
  function makeEngine(P) {
    const { norm, SCRIPT, GIVEN, AMBIGUOUS, SURNAMES, PARTICLES, TITLES, SOFT_TITLES, AFTER, NAME_CUE, GREET_CUE,
      PLACE_SUFFIX, CITIES, CITY_FIRST, CITY_PHRASES, STOP, POST, I_WORD, AM_WORD, UNIT_WORDS, AREA_WORDS, ADDR_KEEP } = P;
    const UNIT_NUM = new RegExp(`^[\\s:#-]*(?:${P.NUMWORD})?[\\s:#-]*([A-Za-z]?-?\\d{1,5}[A-Za-z]?(?:[-/][A-Za-z0-9]{1,4})?)`);
    const AREA_NUM = new RegExp(`^[\\s:#-]*(?:${P.NUMWORD})?[\\s:#-]*([A-Za-z]-?\\d{1,4}(?:\\/\\d{1,2})?|\\d{1,4}(?:-[A-Za-z0-9]{1,2}(?:\\/\\d{1,2})?)?[A-Za-z]?|[A-Za-z])(?![\\p{L}\\d])`, 'u');
    const has = (S, w) => S.has(w);
    // ───────────────────────────── dictionary (Wikidata, Arabic script) ─────────────────────────────

    const cache = new WeakMap();
    function dictSets(dict) {
      if (!dict) return null;
      let c = cache.get(dict);
      if (c) return c;
      const pick = (S) => { const out = new Set(); if (S) for (const w of S) if (SCRIPT.test(w)) out.add(norm(w)); return out; };
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
        if (!SCRIPT.test(m[0])) continue;
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
      if (!SCRIPT.test(text)) return;
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
        else if (prev && nextAdj && prev.n === I_WORD && nextAdj.n === AM_WORD && singleSpace(text, prev, t)) after = 'mid';

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

    function detectAddresses(text, add) {
      if (!SCRIPT.test(text)) return;
      const toks = tokenize(text);
      if (!toks.length) return;
      const unitRe = new RegExp(`^(?:${UNIT_WORDS})$`);
      const areaRe = new RegExp(`^(?:${AREA_WORDS})$`);
      const MOHALLA = P.MOHALLA; // "محلہ اسلام پورہ": the area name comes after the word
      // Inside an address only real function words end it; place words and "اسلام" are fine.
      const ADDR_STOP = (n) => has(STOP, n) && !has(PLACE_SUFFIX, n) && !areaRe.test(n) && !ADDR_KEEP.has(n);

      const anchors = [];
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (unitRe.test(t.n)) {
          // "مکان نمبر 12", "گھر 5-B", "پلاٹ نمبر 45"
          const rest = text.slice(t.e, t.e + 40);
          const m = UNIT_NUM.exec(rest);
          if (m) anchors.push({ s: t.s, e: t.e + rest.indexOf(m[1]) + m[1].length, strong: true });
        } else if (areaRe.test(t.n)) {
          // area word with up to 2 words before ("گلشن اقبال بلاک") and a number or letter after
          let s = t.s, k = i - 1, back = 0;
          while (k >= 0 && back < 2 && singleSpace(text, toks[k], toks[k + 1]) && !has(STOP, toks[k].n) && !unitRe.test(toks[k].n)) { s = toks[k].s; k--; back++; }
          let e = t.e, strong = false;
          const rest = text.slice(t.e, t.e + 20);
          const m = AREA_NUM.exec(rest);
          if (m) { e = t.e + rest.indexOf(m[1]) + m[1].length; strong = true; }
          else if (t.n === MOHALLA) {
            let j = i + 1;
            while (j < toks.length && j <= i + 2 && singleSpace(text, toks[j - 1], toks[j]) && !ADDR_STOP(toks[j].n) && !areaRe.test(toks[j].n)) { e = toks[j].e; j++; }
            if (e === t.e && back === 0) continue;
          } else if (back === 0) continue; // a bare area word alone ("روڈ") is not an address
          anchors.push({ s, e, strong });
        }
      }
      if (!anchors.length) return;

      // Merge neighbouring anchors ("مکان نمبر 12، گلی 5، سیکٹر F-8").
      const groups = [];
      for (const a of anchors) {
        const g = groups[groups.length - 1];
        if (g && a.s - g.e <= 6 && /^[\s,،-]*$/.test(text.slice(g.e, a.s))) { g.e = Math.max(g.e, a.e); g.count++; g.strong += a.strong ? 1 : 0; }
        else if (g && a.s < g.e) { g.e = Math.max(g.e, a.e); }
        else groups.push({ s: a.s, e: a.e, count: 1, strong: a.strong ? 1 : 0 });
      }

      // After the anchors come comma-separated parts (area name, town) and usually a city.
      const WORDS = /[\p{L}\p{M}\u200c]+/uy;
      const segmentWords = (from) => {
        const ws = [];
        let q = from;
        while (ws.length < 4) {
          WORDS.lastIndex = q;
          const m = WORDS.exec(text);
          if (!m) break;
          ws.push({ n: norm(m[0]), s: m.index, e: m.index + m[0].length });
          q = WORDS.lastIndex;
          if (!/^[ \u00a0]$/.test(text.slice(q, q + 1))) break;
          q++;
        }
        return ws;
      };
      const cityAt = (ws, k) => (k + 1 < ws.length && CITIES.has(ws[k].n + ' ' + ws[k + 1].n) ? k + 1 : CITY_FIRST.has(ws[k].n) ? k : -1);

      for (const g of groups) {
        let end = g.e, place = false;
        for (let r = 0; r < 4 && !place; r++) {
          const comma = /^[\s\u00a0]*[،,][\s\u00a0]*/u.exec(text.slice(end));
          const from = end + (comma ? comma[0].length : (/^[\s\u00a0]+/.exec(text.slice(end)) || [''])[0].length);
          const ws = segmentWords(from);
          if (!ws.length) break;
          let take = 0;
          for (let k = 0; k < ws.length; k++) {
            const c = cityAt(ws, k);
            if (c >= 0) { end = ws[c].e; place = true; break; }
            if (!comma || ADDR_STOP(ws[k].n)) break; // without a comma only a city may follow
            take++;
          }
          if (place) break;
          if (!take) break;
          end = ws[take - 1].e;
        }
        let score = g.count >= 2 ? 0.8 : g.strong ? 0.7 : place ? 0.6 : 0;
        if (place && score >= 0.7) score += 0.1;
        if (score) add('ADDRESS', g.s, end, Math.min(score, 0.9));
      }

      // "پتہ: …" — an address label, then the address up to the end of the sentence
      const cueRe = new RegExp(P.ADDRESS_CUE.source, 'gu');
      let m;
      while ((m = cueRe.exec(text)) !== null) {
        const from = m.index + m[0].length;
        const rest = text.slice(from, from + 140);
        if (!SCRIPT.test(rest.slice(0, 20)) && !/^\d/.test(rest)) continue;
        const stop = rest.search(P.ADDRESS_STOP);
        const chunk = stop === -1 ? rest : rest.slice(0, stop);
        const trimmed = chunk.replace(/[\s،,:;]+$/u, '');
        if (trimmed.length >= 4 && (/\d/.test(trimmed) || /[،,]/.test(trimmed))) add('ADDRESS', from, from + trimmed.length, 0.8);
      }
    }

    // ───────────────────────────── landmarks ─────────────────────────────
    // "ماڈل ٹاؤن پارک کے پیچھے رہتا ہوں" — a place word + "behind/near/opposite", in a sentence about living.
    const PLACE_UR = P.PLACE_WORDS;
    const NEAR_UR = P.NEAR;
    const LIVING_UR = P.LIVING;

    function detectLandmarks(text, add) {
      if (!SCRIPT.test(text)) return;
      const toks = tokenize(text);
      for (let i = 1; i + 1 < toks.length; i++) {
        if (toks[i].n !== P.OF || !NEAR_UR.includes(toks[i + 1].n)) continue;
        if (!singleSpace(text, toks[i - 1], toks[i]) || !singleSpace(text, toks[i], toks[i + 1])) continue;
        // phrase: up to 3 words before "کے", ending in a place word
        let k = i - 1, n = 0;
        const stopLM = (w) => has(STOP, w) && !has(PLACE_UR, w) && !has(PLACE_SUFFIX, w);
        while (k >= 0 && n < 3 && (n === 0 || singleSpace(text, toks[k], toks[k + 1])) && !stopLM(toks[k].n)) { k--; n++; }
        const phrase = toks.slice(k + 1, i);
        if (!phrase.length || !phrase.some((t) => has(PLACE_UR, t.n))) continue;
        const lo = Math.max(0, toks[i].s - 70), hi = Math.min(text.length, toks[i + 1].e + 70);
        if (!LIVING_UR.test(text.slice(lo, hi))) continue;
        let end = phrase[phrase.length - 1].e;
        // optional city: "… پارک کے پیچھے لاہور میں"
        const after = toks[i + 2];
        if (after && CITY_FIRST.has(after.n) && singleSpace(text, toks[i + 1], after)) end = Math.max(end, after.e);
        add('ADDRESS', phrase[0].s, end, 0.65);
      }
    }

    // ───────────────────────────── organizations ─────────────────────────────

    const ORG_SUFFIX = P.ORG_SUFFIX;
    function detectOrgs(text, add) {
      if (!SCRIPT.test(text)) return;
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

    const KEYS = P.KEYS;

    function keyType(rawKey) {
      const k = norm(rawKey).replace(/\s+/g, ' ').trim();
      for (const [type, score, S] of KEYS) if (S.has(k)) return [type, score];
      return null;
    }

    // Lines like "نام: حمزہ طارق" → callback(type, score, valueStart, value)
    const KV = /^[ \t]*(?:[-*•>]\s*)?([\p{L}\p{M}\u200c][\p{L}\p{M}\u200c ]{0,40}?)[ \t]*[:：=][ \t]*(.*?)[ \t]*$/dgmu;
    function scanKeys(text, emit) {
      if (!SCRIPT.test(text)) return;
      KV.lastIndex = 0;
      let m;
      while ((m = KV.exec(text)) !== null) {
        if (!SCRIPT.test(m[1])) continue;
        const kt = keyType(m[1]);
        if (!kt || !m[2]) continue;
        emit(kt[0], kt[1], m.indices[2][0], m[2]);
      }
    }

    // ───────────────────────────── cue + number patterns ─────────────────────────────
    // Run on digit-normalized text. Numbers may use ASCII digits (after asciiDigits) and Urdu months.

    const CUES = P.CUES;
    function detectCues(text, add) {
      if (!SCRIPT.test(text)) return;
      for (const [type, score, src, ok] of CUES) {
        const re = new RegExp(src.source, src.flags);
        let m;
        while ((m = re.exec(text)) !== null) {
          if (!m[1] || !ok(m[1])) continue;
          const start = m.index + m[0].length - m[1].length;
          add(type, start, start + m[1].length, score);
        }
      }
    }


    return { detectPersons, detectAddresses, detectLandmarks, detectOrgs, detectCues, scanKeys, keyType, tokenize };
  }

  // ───────────────────────────── Urdu profile ─────────────────────────────
  const A = (s) => norm(s);
  const UNIT_WORDS = 'مکان|گھر|پلاٹ|فلیٹ|دکان|ہاؤس|کوٹھی|کمرہ|آفس|دفتر'.split('|').map(A).join('|');
  const AREA_WORDS = 'گلی|محلہ|کالونی|ٹاؤن|سیکٹر|بلاک|فیز|روڈ|سٹریٹ|اسٹریٹ|بازار|چوک|سوسائٹی|اسکیم|گارڈن|گارڈنز|ایونیو|ویلی|کینٹ|ہاؤسنگ|ایکسٹینشن|پارک|مارکیٹ'.split('|').map(A).join('|');
  const PLACE_UR = set(`پارک مارکیٹ ہسپتال اسپتال اسکول مسجد چوک اسٹیشن ہوٹل مال پلازہ مدرسہ کالج یونیورسٹی بازار ٹاؤن کالونی ٹاور سینٹر پل چوراہا موڑ`);
  const NEAR_UR = ['قریب', 'پیچھے', 'سامنے', 'نزدیک', 'پاس', 'بالمقابل', 'ساتھ', 'برابر'].map(norm);
  const LIVING_UR = /(?<![\p{L}\p{M}])(?:رہتا|رہتی|رہتے|رہتا ہوں|رہائش|رہائشی|گھر|مکان|دفتر|دکان|آفس|پتہ|پتا|منتقل|شفٹ)(?![\p{L}\p{M}])/u;
  const ORG_SUFFIX = ['پرائیویٹ لمیٹڈ', 'لمیٹڈ', 'ٹیکنالوجیز', 'سولیوشنز', 'انڈسٹریز', 'انٹرپرائزز', 'ٹریڈرز'].map(A);
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

  const MONTHS = 'جنوری|فروری|مارچ|اپریل|مئی|جون|جولائی|اگست|ستمبر|اکتوبر|نومبر|دسمبر';
  const CUES = [
    ['NATIONAL_ID', 0.85, /(?:قومی\s+)?شناختی\s+کارڈ(?:\s+نمبر)?\s*(?:ہے|:|-|=)?\s*(\d[\d -]{4,20}\d)/gu, (v) => v.replace(/\D/g, '').length >= 5],
    ['NATIONAL_ID', 0.85, /(?:سی\s*این\s*آئی\s*سی|شناختی\s+نمبر)\s*(?:نمبر)?\s*(?:ہے|:|-|=)?\s*(\d[\d -]{4,20}\d)/gu, (v) => v.replace(/\D/g, '').length >= 5],
    ['ACCOUNT', 0.85, /(?:(?:بینک\s+)?اکاؤنٹ|اکاونٹ|اکائونٹ|کھاتہ)(?:\s+نمبر)?\s*(?:ہے|:|-|=)?\s*(\d[\d -]{4,28}\d)/gu, (v) => v.replace(/\D/g, '').length >= 6],
    ['PASSPORT', 0.9, /پاسپورٹ(?:\s+نمبر)?\s*(?:ہے|:|-|=)?\s*([A-Za-z]{1,2}\d{6,9}|\d{8,9})/gu, () => true],
    ['PHONE', 0.85, /(?:فون|موبائل|سیل|ٹیلیفون|رابطہ|واٹس\s*ایپ)(?:\s+نمبر)?\s*(?:ہے|:|-|=)?\s*(\+?\d[\d ().-]{7,18}\d)/gu, (v) => { const n = v.replace(/\D/g, '').length; return n >= 9 && n <= 15; }],
    ['DOB', 0.9, new RegExp(`(?:تاریخ\\s+پیدائش|پیدائش|پیدا\\s+ہوا|پیدا\\s+ہوئی)(?:\\s+ہے|\\s+کی\\s+تاریخ)?\\s*(?::|-|=)?\\s*(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}|(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4})`, 'gu'), () => true],
  ];

  const URDU = {
    norm, SCRIPT: ARABIC, GIVEN, AMBIGUOUS, SURNAMES, PARTICLES, TITLES, SOFT_TITLES, AFTER, NAME_CUE, GREET_CUE,
    PLACE_SUFFIX, CITIES, CITY_FIRST, CITY_PHRASES, STOP, POST,
    I_WORD: norm('میں'), AM_WORD: norm('ہوں'),
    UNIT_WORDS, AREA_WORDS, NUMWORD: 'نمبر', MOHALLA: A('محلہ'), ADDR_KEEP: new Set([A('اسلام')]),
    ADDRESS_CUE: /(?:(?:رہائشی|موجودہ|مستقل|نیا|پرانا|میرا|میری|ہمارا|ہمارے|اس کا|گھر کا|دفتر کا|ڈاک کا)\s+(?:پتہ|پتا|ایڈریس)|ایڈریس|(?:پتہ|پتا)(?=\s*[:：=]))\s*(?:ہے)?\s*[:：=-]?\s*/gu,
    ADDRESS_STOP: /[\n۔.؟?!]|\s(?:اور|فون|موبائل|ای میل|ایمیل|پر کال|پر رابطہ)(?=\s|$)/u,
    PLACE_WORDS: PLACE_UR, NEAR: NEAR_UR, LIVING: LIVING_UR, OF: norm('کے'),
    ORG_SUFFIX, KEYS, CUES,
  };
  const urdu = makeEngine(URDU);

  const api = {
    norm, asciiDigits, makeEngine, set,
    detectPersons: urdu.detectPersons, detectRomanPersons, detectLandmarks: urdu.detectLandmarks,
    detectAddresses: urdu.detectAddresses, detectOrgs: urdu.detectOrgs, detectCues: urdu.detectCues,
    scanKeys: urdu.scanKeys, keyType: urdu.keyType, tokenize: urdu.tokenize,
  };
  root.VeilUrdu = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
