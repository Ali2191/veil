/* VEIL — believable stand-in names for "natural names" mode.
   pick("Hamza Tariq") → { text: "Junaid Mirza", parts: [["Junaid","Hamza"],["Mirza","Tariq"]] }
   The stand-in matches the real name's script (Latin, Urdu, Devanagari), likely gender and culture,
   is the same every time for the same name, and never equals a word already in the message or a
   stand-in already given to someone else. Pure functions, no storage. */
(function (root) {
  'use strict';
  const N = root.VeilNames || (typeof require === 'function' ? (() => { try { return require('./names.js'); } catch { return null; } })() : null);
  const list = (s) => s.trim().split(/\s+/);

  // ── Latin script ──
  const SA_MALE = list(`
    Adeel Arman Basit Danish Ehsan Faraz Fawad Hashir Irfan Jawad Junaid Kashif Khalid Luqman Mubeen Moiz Nabeel Naveed Obaid
    Osama Qasim Rayyan Sufyan Talha Uzair Wajid Yasir Zubair Haider Arsal Daud Feroz Gulzar Hammad Ismail Kamil Mahir Nadir Rehan Saim
  `);
  const SA_FEMALE = list(`
    Alina Bushra Dua Eman Farwa Hania Inaya Javeria Kinza Laiba Mahira Nimra Omaima Rida Sehar Tooba Warda Yumna Zara Aleena
    Hoorain Mehak Aiza Anum Bisma Dania Fizza Gulnaz Humna Iman Komal Lubna Maham Nashwa Pareesa Rameen Sahar Tuba Zoha
  `);
  const SA_SURNAMES = list(`
    Malik Siddiqui Chaudhry Qureshi Mirza Baig Hashmi Javed Farooqi Abbasi Rizvi Naqvi Bukhari Ansari Khawaja Niazi Cheema Bajwa
    Gondal Lodhi Memon Awan Butt Rana Sheikh Kayani Janjua Ghauri Zaidi Kazmi Jafri Usmani Durrani Afridi Tareen Warraich Sandhu
  `);
  const W_MALE = list(`Daniel Ethan Lucas Owen Noah Liam Henry Jack Ryan Adam Oliver Mason Caleb Nathan Isaac Dylan Aaron Connor Felix Hugo`);
  const W_FEMALE = list(`Emma Olivia Chloe Grace Hannah Isla Lily Maya Nora Ruby Ella Freya Poppy Evie Alice Clara Iris Julia Leah Nina`);
  const W_SURNAMES = list(`Turner Bennett Hughes Foster Reed Brooks Coleman Harper Ellis Gibson Hayes Porter Spencer Warren Fletcher Marsh Dixon Lawson Nash Peters`);
  const UNISEX = list(`Noor Rayan Sami Aman Shan Jaan Rohan Kiran Arya Ali Zain Saif Reem Sana Ayan`);

  // ── Urdu / Arabic script ──
  const UR_MALE = list(`عدیل ارمان باسط دانش احسان فراز فواد حاشر عرفان جواد جنید کاشف لقمان معیز نبیل اسامہ قاسم سفیان طلحہ عزیر وجاہت یاسر زبیر`);
  const UR_FEMALE = list(`عالیہ بشری دعا ایمان فروہ ہانیہ عنایہ جویریہ کنزہ لائبہ ماہرہ نمرہ عمیمہ ردا سحر طوبی وردہ زارا عالیزہ مہک`);
  const UR_SURNAMES = list(`ملک صدیقی چوہدری قریشی مرزا بیگ ہاشمی جاوید فاروقی عباسی رضوی نقوی بخاری انصاری خواجہ نیازی چیمہ باجوہ گوندل لودھی`);
  const UR_FEMALE_HINT = new Set(list(`
    فاطمہ عائشہ مریم زینب خدیجہ ثناء ثنا حنا آمنہ سارہ اقرا مہنور اریبہ حرا رابعہ صائمہ نادیہ فرح مہوش سعدیہ عظمی بشری اسماء ثمینہ شازیہ
    روبینہ نازیہ انعم علیزہ علیشبہ لائبہ زویا عائزہ عنایہ حفصہ حمیرا جویریہ کنزہ کومل ماہم مائرہ مہک مشال مومنہ نمرہ رمشہ سدرہ صدف سمرا
    سوبیہ طاہرہ عروج زارہ زہرہ زنیرہ شبنم پروین نسرین یاسمین سلمی رانیہ ملائکہ نایاب نائلہ نجمہ نرگس نصرت نغمہ لبنی لیلی ماریہ مدیحہ منزہ
    مہرین ندا نبیلہ نوشین ہما ہاجرہ ہانیہ ہبہ بینش بسمہ بلقیس بتول تحریم تسنیم تبسم ثریا جنت جمیلہ حبیبہ حلیمہ حمنہ خولہ دعا رضیہ رقیہ ریحانہ
    زیبا زلیخا ساجدہ سائرہ سبیلہ ستارہ سلیمہ سمیرا سمیعہ شائستہ شگفتہ شمائلہ شہناز صالحہ صبیحہ صفیہ عابدہ عالیہ عنبرین عذرا فائزہ فریحہ فوزیہ کلثوم
  `).map((w) => w.replace(/[يى]/g, 'ی').replace(/[كک]/g, 'ک')));

  // ── Devanagari ──
  const HI_MALE = list(`अनुज कपिल कुणाल मयंक मोहित नितिन पवन रितेश तुषार हर्ष जतिन आशुतोष राघव सिद्धांत दिवाकर गिरीश हेमंत जयेश`);
  const HI_FEMALE = list(`आरती अर्चना दीपिका गरिमा ईशा जूही काजल कीर्ति मानसी मेघा नंदिनी रितिका शिखा सोनिया तनीषा वैशाली`);
  const HI_SURNAMES = list(`मेहरा सक्सेना त्रिपाठी दुबे शुक्ला चौहान राठौर कपूर भाटिया अरोड़ा सहगल मल्होत्रा खन्ना बजाज`);
  const HI_FEMALE_HINT = new Set(list(`
    प्रिया पूजा नेहा अंजलि दिव्या काव्या स्नेहा अदिति अनन्या श्रेया रिया निशा लक्ष्मी मीरा सुनीता अनीता अंकिता स्वाति श्वेता प्रीति ऐश्वर्या फातिमा
    आयशा ज़ैनब मरियम सना हिना सलमा रुखसाना शबनम नसरीन यास्मीन सीमा रीना रेखा ममता मंजू कविता सरिता सविता गीता सीता राधा रुचि ऋचा शिवानी भावना
    कोमल कंचन खुशबू मधु माधुरी मोनिका नम्रता निधि पल्लवी पायल पूनम प्रतिभा रश्मि रूपा संगीता संध्या सपना शालिनी शीला सुषमा सोनम वर्षा विद्या वंदना
    आरती अर्चना दीपिका दीपा गरिमा ईशा जूही काजल कीर्ति मानसी मेघा नंदिनी रितिका शिखा सोनिया तनीषा
  `));

  // Latin female names (South Asian, Arab and Western) used to guess gender. Everything else known is treated as male.
  const FEM_LATIN = new Set(list(`
    fatima fatimah ayesha aisha aysha maryam mariam zainab khadija khadijah sana hina amna sara sarah iqra mahnoor areeba hira rabia saima
    nadia farah mehwish sadia uzma bushra asma samina shazia rubina nazia anam aliza alishba eman laiba zoya aiza anaya ayat hafsa humaira
    javeria kinza komal maham maira mehak mishal momina nimra rida rimsha sabahat sadaf saba samra sehar sidra sobia tahira urooj zara zahra
    zunaira shabnam parveen nasreen yasmin yasmeen yasmine salma mona huda rania dina reem noura layla leila lina amira samira jana dana
    rubab hoorain sumaira shumaila tehreem farwa ifrah ruqaiya kainat minahil pakeeza shagufta zubaida alina dua hania inaya mahira omaima
    warda yumna aleena bisma dania fizza gulnaz humna iman lubna nashwa pareesa rameen sahar tuba zoha
    priya pooja neha anjali divya kavya sneha aditi ananya shreya riya nisha lakshmi meera sunita anita ankita swati shweta preeti aishwarya
    ritu kavita rekha seema geeta suman sunita
    mary patricia jennifer linda elizabeth barbara susan jessica karen lisa nancy betty margaret sandra ashley kimberly emily donna michelle
    carol amanda dorothy melissa deborah stephanie rebecca sharon laura cynthia kathleen amy angela shirley anna brenda pamela emma nicole helen
    samantha katherine christine debra rachel carolyn janet catherine maria heather diane ruth julie olivia joyce virginia victoria kelly
    lauren christina joan evelyn judith megan andrea cheryl hannah jacqueline martha gloria teresa ann anne frances kathryn janice jean
    abigail alice judy sophia julia isabella charlotte amelia mia harper ella chloe zoe lily natalie jane kate lucy sophie jenny claire fiona
    emilia ava isla freya poppy evie ruby daisy holly nora iris leah nina clara
  `));
  const W_HINT = new Set([...W_MALE, ...W_FEMALE, ...W_SURNAMES].map((w) => w.toLowerCase()).concat(list(`
    james john robert michael william david richard joseph thomas charles christopher matthew anthony donald steven stephen paul andrew joshua
    kenneth kevin brian george edward ronald timothy jason jeffrey jacob gary nicholas eric jonathan larry justin scott brandon benjamin samuel
    gregory alexander raymond patrick dennis jerry tyler johnson smith williams brown jones miller davis wilson anderson taylor moore jackson
    martin lee thompson white harris clark lewis robinson walker young allen king wright hill green adams baker nelson carter mitchell roberts
  `)));

  // Same input → same output.
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }

  function scriptOf(s) {
    if (/\p{Script=Arabic}/u.test(s)) return 'ur';
    if (/\p{Script=Devanagari}/u.test(s)) return 'hi';
    return 'la';
  }

  const normUr = (w) => w.replace(/[ً-ٰٟـ‌‍]/g, '').replace(/[يى]/g, 'ی').replace(/[كک]/g, 'ک').replace(/[هھةۃ]/g, 'ہ');
  const normHi = (w) => w.normalize('NFD').replace(/[़‌‍]/g, '');

  // Gender and culture of a real name → which pools to draw from.
  function profile(words, script) {
    const first = words[0];
    if (script === 'ur') return { given: UR_FEMALE_HINT.has(normUr(first)) ? UR_FEMALE : UR_MALE, sur: UR_SURNAMES, key: (w) => w };
    if (script === 'hi') return { given: [...HI_FEMALE_HINT].some((f) => normHi(f) === normHi(first)) ? HI_FEMALE : HI_MALE, sur: HI_SURNAMES, key: (w) => w };
    const f = first.toLowerCase(), l = words[words.length - 1].toLowerCase();
    // A Western first name or surname decides ("Sarah Johnson" is Western even though Sarah is also a South Asian name).
    const western = W_HINT.has(f) || (words.length > 1 && W_HINT.has(l));
    const female = FEM_LATIN.has(f);
    const known = female || (N && N.FIRST.has(f)) || W_HINT.has(f);
    let given;
    if (!known) given = UNISEX;
    else if (western) given = female ? W_FEMALE : W_MALE;
    else given = female ? SA_FEMALE : SA_MALE;
    return { given, sur: western ? W_SURNAMES : SA_SURNAMES, key: (w) => w.toLowerCase() };
  }

  // opts.avoid: lowercase words already in the message; opts.used: lowercase first names already handed out.
  function pick(real, opts = {}) {
    const avoid = opts.avoid || new Set(), used = opts.used || new Set();
    const words = real.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    const script = scriptOf(real);
    const P = profile(words, script);
    const seed = hash(real.trim().toLowerCase());
    const taken = (w) => avoid.has(w.toLowerCase()) || used.has(w.toLowerCase());
    const choose = (pool, salt, extra) => {
      for (let i = 0; i < pool.length; i++) {
        const w = pool[(seed + salt + i * 7) % pool.length];
        if (!taken(w) && !(extra && extra.has(w.toLowerCase()))) return w;
      }
      return pool[(seed + salt) % pool.length];
    };
    const given = choose(P.given, 0);
    if (words.length === 1) {
      used.add(given.toLowerCase());
      return { text: given, parts: [[given, words[0]]] };
    }
    const sur = choose(P.sur, 3, new Set([given.toLowerCase()]));
    used.add(given.toLowerCase());
    const parts = [[given, words[0]], [sur, words[words.length - 1]]];
    return { text: `${given} ${sur}`, parts };
  }

  const api = { pick };
  root.VeilFake = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
