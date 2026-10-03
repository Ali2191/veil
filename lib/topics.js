/* VEIL — sensitive topics. These are flagged for the user, never swapped: "I have diabetes"
   can't become a placeholder without losing its meaning. A topic is flagged only when the
   sentence is about a specific person ("I", "my", "his", "the patient"…), so general
   questions like "what causes diabetes?" are left alone.
   topics(text) -> [{ start, end, topic, label }] */
(function (root) {
  'use strict';

  // Comma-separated entries; each may be a phrase or a small regex.
  const TOPICS = {
    health: { label: 'Health', words: `diabetes, diabetic, cancer, tumou?r, leukemia, lymphoma, hiv, aids, hepatitis, tuberculosis,
      asthma, epilepsy, seizures?, stroke, heart attack, heart disease, hypertension, high blood pressure, kidney disease, dialysis,
      liver disease, cirrhosis, thyroid, arthritis, lupus, multiple sclerosis, parkinson'?s, alzheimer'?s, dementia, covid, pcos,
      endometriosis, infertility, ivf, pregnan(?:t|cy), miscarriage, abortion, stds?, sti, herpes, chlamydia, gonorrh?oea,
      syphilis, chemotherapy, chemo, radiotherapy, biopsy, diagnosed with, prescription, insulin, disability, disabled,
      wheelchair, on medication` },
    mental: { label: 'Mental health', words: `depression, depressed, anxiety, panic attacks?, bipolar, schizophreni[ac], ptsd,
      ocd, adhd, autism, autistic, eating disorder, anorexia, bulimia, self-?harm, suicid(?:e|al), therapist, psychiatrist,
      antidepressants?, rehab, addiction, addicted, alcoholi(?:c|sm), overdose` },
    sexuality: { label: 'Sexuality & gender', words: `gay, lesbian, bisexual, transgender, queer, lgbtq?, coming out,
      sexual orientation, gender identity` },
    belief: { label: 'Religion & belief', words: `converted to islam, converted to christianity, converted to hinduism, apostate,
      apostasy, atheist, ahmadi, ahmadiyya, blasphemy, religious conversion` },
    legal: { label: 'Legal trouble', words: `arrested, arrest warrant, criminal record, convicted, conviction, in jail, in prison,
      probation, parole, lawsuit, sued, police case, court case, charged with, on bail, dui, dwi` },
    money: { label: 'Financial trouble', words: `in debt, debts, bankrupt, bankruptcy, loan default, defaulted, foreclosure,
      eviction, evicted, overdraft, collections agency, can'?t pay (?:my )?rent, unpaid bills, laid off, fired from my job,
      unemployed` },
    immigration: { label: 'Immigration status', words: `undocumented, illegal immigrant, overstayed, visa overstay, asylum,
      refugee status, deportation, deported, work permit expired` },
  };

  // A sentence is "about someone" when it contains one of these.
  const PERSONAL = /\b(?:i|i'm|i’m|i've|i’ve|me|my|mine|myself|we|our|he|she|his|her|him|they|their|them|patient|client|employee|son|daughter|wife|husband|mother|father|mom|mum|dad|brother|sister|friend|colleague|boss|child|kid)\b|\[(?:PERSON|TERM)_\d+\]/i;

  const compiled = Object.entries(TOPICS).map(([topic, t]) => {
    const phrases = t.words.split(',').map((w) => w.trim().replace(/\s+/g, '\\s+')).filter(Boolean);
    return { topic, label: t.label, re: new RegExp(`\\b(?:${phrases.join('|')})\\b`, 'gi') };
  });

  function topics(text) {
    if (!text) return [];
    const out = [];
    // Sentence boundaries for the "about someone" check.
    const sentences = [];
    const SENT = /[^.!?\n]+[.!?\n]*/g;
    let s;
    while ((s = SENT.exec(text))) sentences.push([s.index, s.index + s[0].length, PERSONAL.test(s[0])]);
    const personalAt = (i) => { for (const [a, b, p] of sentences) if (i >= a && i < b) return p; return false; };
    for (const c of compiled) {
      c.re.lastIndex = 0;
      let m;
      while ((m = c.re.exec(text))) {
        if (personalAt(m.index)) out.push({ start: m.index, end: m.index + m[0].length, topic: c.topic, label: c.label });
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  const api = { topics, TOPICS };
  root.VeilTopics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
