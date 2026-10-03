# VEIL — Private AI

A Chrome extension that replaces private details with placeholders before they reach an AI chat, then restores the real values locally in the reply.

```
You type     "Email Sarah Khan at sarah@example.com about 27-B Gulgasht Colony, Multan"
AI receives  "Email [PERSON_1] at [EMAIL_1] about [ADDRESS_1]"
AI replies   "Hi [PERSON_1], …"
You see      "Hi Sarah Khan, …"
```

Works on **any AI chat website**. ChatGPT, Claude, Gemini, Perplexity, Copilot, DeepSeek, Grok and Le Chat have tuned support. Everywhere else (Z.ai, Qwen, Kimi, Poe, HuggingChat, internal company tools…), VEIL finds the chat box by itself.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin VEIL to the toolbar.

## How it works

- **As you type:** private details in the site's own text box get a soft green highlight, and a small 🛡 badge on the box shows how many are protected. Click the badge to switch any item off for this message.
- **On Send:** VEIL swaps the details for placeholders in the box, then lets the message go. There's no pop-up.
- **Replies:** placeholders are replaced with your real values, in the same soft green.
- **Copying:** selecting text, or using the site's own copy button, gives the real values.
- **Paste:** pasted text is cleaned before the site's scripts can read it.
- **Strict mode** (Settings → Strict mode, experimental): each detail is swapped the moment you finish typing it, instead of on Send.
- **Natural names** (Settings → *Natural names*, experimental): people are swapped for believable stand-in names instead of `[PERSON_1]`. The stand-in matches the script (Latin, Urdu, Devanagari), likely gender and culture, is always the same for the same person, and is restored to the real name in replies. Other details keep placeholders.
- **Toolbar icon:** turns VEIL on or off for the current site, and remembers it. Messaging and email sites (WhatsApp, Gmail, Slack…) stay off by default, so messages to people are never altered.
- **Side panel** (**Alt+Shift+V**, or *Open VEIL panel* in the popup): compose privately, restore any pasted reply, manage your vault and settings.

If VEIL missed something, right-click the selected text and choose **VEIL: Always protect**, or add it under **Vault → Always protect**. Use **Never protect** for public names the AI should see.

### When VEIL turns on

| Site | Default |
|---|---|
| Known AI apps | On |
| Other sites with AI signals (domain, page title) and a chat-style box | On |
| Messaging/email/social sites | Off |
| Anything you switched with the toolbar icon | Your choice, remembered per site |

## What it detects

Everything runs on the user's device: rules, checksums and dictionaries, with no AI model and no network. Each match gets a **confidence score**:
- **Confident** (≥ 0.7): soft green.
- **Less certain** (0.4–0.7): lighter green with a dotted underline, labeled *check* in the list. Still protected.

| Type | How it's detected |
|---|---|
| **Phones, every country** | Google's libphonenumber rules for ~240 countries. Numbers with a country code are validated anywhere. Local numbers are checked against your home country (from browser language and time zone) and ~35 common ones. Order numbers, dates and ISBNs are rejected. |
| **National IDs, 40+ countries** | Official formats and checksums: CNIC, NTN, Aadhaar, PAN, SSN, ITIN, SIN, NINO, NHS, DNI/NIE, NIR, codice fiscale, Steuer-ID, BSN, PESEL, personnummer, HETU, CPF/CNPJ, CURP, RUT, Chinese resident ID, HKID, NRIC, MyKad, RRN, Taiwan ID, NIK, Emirates ID, Iqama, Egyptian ID, TC Kimlik, SA ID and more. Digits-only formats require a context word ("Aadhaar", "SIN"…). |
| **Passports, licences, health IDs** | Passport MRZ lines and numbers; driver's licences; NHS/Medicare/MRN/insurance numbers (with context) |
| **Money** | Cards (Luhn + issuer), IBAN (mod-97), account numbers, SWIFT/IFSC/sort code/BSB; amounts optional |
| **Email, IP, date of birth, secrets** | Patterns and context; 20+ API-key formats, passwords in code, URL credentials, high-randomness strings |
| **Names** | 54,000 given names and 22,000 family names from Wikidata (Latin and Urdu/Arabic scripts), plus clues ("my name is", "Dear", titles, sign-offs). Common English words and city names are excluded. |
| **Addresses** | South Asian, US/UK and continental formats (Hauptstraße 12, Rue de Rivoli 10) with 38,000 GeoNames cities. Also lowercase chat style (*house no 5 street 3 sector G-11/2 islamabad*) and free text: landmarks when someone says where they live (*behind Model Town Park*) and area names (*Bahria Town Phase 2*, *Model Town, Lahore*) |
| **Urdu and Arabic script** | Names from cues (نام، جناب، محترمہ، بھائی، صاحب، میں … ہوں), about 300 Urdu given names and 100 surnames, and the Arabic-script names in the dictionaries. Spelling variants match (ي/ی, ك/ک, ه/ہ). Punjabi (ناں), Sindhi (نالو), Pashto (نوم) and Arabic (اسمي، السيد) name cues too. Addresses (مکان نمبر، گلی، محلہ، کالونی، سیکٹر), landmarks (… پارک کے پیچھے رہتا ہوں), form labels (نام:، فون:، پتہ:), organizations (…پرائیویٹ لمیٹڈ), ID, date-of-birth and account cues. |
| **Hindi (Devanagari)** | Names from cues (नाम، श्री، श्रीमती، भैया، जी، मैं … हूँ) and a list of Hindi given names and surnames (nukta and chandrabindu spellings match). Aadhaar, PAN, account, passport, phone and date-of-birth cues, addresses (मकान नंबर, गली, मोहल्ला, सेक्टर), landmarks and form labels. There are no Devanagari names in the dictionaries, so uncommon Hindi names need a cue. |
| **Roman Urdu / Hinglish** | Lowercase names with a cue: *hamza bhai ko…*, *ayesha ne kaha*, *main bilal hun*, *naam hamza tariq hai*, *salam hamza*, *mera dost imran*. Names that are also everyday words (*sara*, *kamal*, *noor*) need a stronger cue. |
| **Usernames** | `@handles`, and *instagram …*, *telegram username …*, *github: …*. Code decorators and package names (`@Override`, `@types/node`) are left alone. |
| **Structure** | `Name: …` forms, JSON/YAML keys, `.env` files, CSV/TSV/Markdown tables with name/email/phone columns |
| **Learning** | Anything protected once is recognised everywhere afterwards, including a known first name on its own and one-letter typos ("Tayab"). VEIL never asks for your details. |
| **Sensitive topics** | Health, mental health, sexuality, belief, legal, financial and immigration topics *about a person* get a wavy amber underline. They are flagged, never replaced. |

Rebuild the dictionaries with `python3 tools/build-dictionaries.py <raw-data-dir>` (sources are listed in the script).

## Privacy and security

- **Everything is local.** The extension's CSP is `connect-src 'self'`: VEIL can only read its own packaged files (the dictionaries) and cannot contact any server.
- **Encrypted vault.** Mappings and your "always protect" list are AES-GCM encrypted in `chrome.storage.local`. The key is a non-extractable WebCrypto key held in IndexedDB.
- **Permissions:** `storage`, `sidePanel` and `contextMenus`, plus content scripts on all sites so VEIL can protect any AI chat. On pages without an AI chat box, VEIL stays inactive: it doesn't watch the page and doesn't load your vault into it.
- **The site's copy buttons:** a tiny page-level hook passes *placeholder* text out to VEIL, which writes the restored text to the clipboard itself. Real values are never handed to the page's scripts.
- **Retention.** Placeholders can expire after 1–90 days. You can delete them one by one or clear them all.
- **Never written into editors.** Real values are never restored into a text box, so they can't be re-sent by accident.

### Limits

- **Natural names** replace words the page may also use elsewhere: if a stand-in first name appears in the site's own text (a sidebar title, say), VEIL shows the real name there too while that mapping exists. Placeholders never have this problem, so they stay the default.
- Uncommon names with no cue and not in any list (*Zorblax went home*) can still be missed; add them under **Vault → Always protect**.
- Famous people are treated as names. Add them to **Never protect** if the AI needs them.

- Restoring real values in the page means the site's scripts *could* read them from the page. For the strictest setup, turn off **Show real values in replies** in Settings and read replies in the Restore tab.
- In the default mode, the site can see keystrokes before you press Send. Strict mode shortens that window to the moment you finish each detail.
- Replies shown inside editable blocks (e.g. ChatGPT's email cards) keep their placeholders, because the site saves edits made there. Use the **Copy with real values** button shown on the block.
- Detection is rule-based: fast, predictable and offline, but not perfect. Uncommon names without a cue ("Zorblax went home") can be missed. Add your own details under **Vault → Always protect** so they are always caught.
- Public figures' names are also treated as names. Add them to **Never protect** if the AI needs them.
- Surrounding context (job title, employer, city) can still identify someone. VEIL pseudonymizes; it does not make text anonymous.
- Site markup changes over time. Each site has layered selectors plus generic fallbacks (`lib/sites.js`).

## Project layout

```
manifest.json
background.js        service worker: vault owner, placeholder assignment, context menu, badge
lib/types.js         types, placeholder format, normalization
lib/names.js         name lexicons
lib/detect.js        detector with confidence scores (sync; <5 ms per prompt)
lib/phone.js         worldwide phone numbers (libphonenumber metadata, lib/vendor)
lib/ids.js           40+ national ID formats with checksums
lib/topics.js        sensitive-topic flags
lib/urdu.js          Urdu / Arabic-script rules, Roman Urdu names, digits, and the language engine shared with Hindi
lib/hindi.js         Hindi (Devanagari) names, addresses, IDs and form labels
lib/fakenames.js     stand-in names for natural-names mode
lib/dict.js          name/place dictionaries (lib/data, built by tools/)
lib/tokens.js        substitution + tolerant restoration
lib/vault.js         encrypted storage
lib/sites.js         tuned selectors for known apps + AI-site heuristics
lib/settings.js      settings defaults
content/content.js   activation, live highlighting, strict mode, guards, restoration, copying
content/dom.js       editor-agnostic text model (textarea, ProseMirror, Quill, Lexical…)
content/ui.js        badge, review list, highlight overlay, chips (closed shadow DOM)
content/bridge-main.js  page-world hook for the site's copy buttons
popup/               toolbar popup: per-site on/off
panel/               side panel UI
tests/               node --test tests/*.test.js
```

## Tests

```
node --test tests/*.test.js
```

## Tests

```
npm test
```

The suite runs on Node 20+ with no dependencies (`tests/`). It covers each detector, Urdu/Hindi/Roman Urdu rules, a corpus of realistic prompts and clean prompts, natural names, that the extension's script lists agree, and that the libraries load as classic browser scripts. GitHub Actions runs it on every pull request.

```
npm install
npm run e2e
```

The end-to-end tests (`tests/e2e/`) start a real Chromium with VEIL loaded as an unpacked extension and a fake AI chat site. They check that the "AI" never receives a real value, that replies show the real values again, and that paste, rich-text boxes, Urdu/Hindi names, natural names and per-site switches work. They need Chromium: set `CHROMIUM_PATH`, or run `npx playwright-core install chromium` first.
