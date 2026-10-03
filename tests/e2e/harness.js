// Launches Chromium with VEIL loaded as a real unpacked extension.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');

const EXT = path.join(__dirname, '..', '..');
const CANDIDATES = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);

async function launch(settings = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veil-e2e-'));
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  const context = await chromium.launchPersistentContext(dir, {
    ...(executablePath ? { executablePath } : {}),
    headless: false, // real headless can't load extensions; --headless=new below can
    args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    viewport: { width: 1000, height: 800 },
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
  const setSettings = (patch) => worker.evaluate(async (p) => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...(settings || {}), ...p } });
  }, patch);
  await setSettings(settings);
  return {
    context, worker, setSettings,
    async open(url) { const page = await context.newPage(); await page.goto(url); await page.waitForTimeout(400); return page; },
    async close() { await context.close(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

// Poll until fn() is truthy (the extension does its work asynchronously).
async function until(fn, what, ms = 8000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error(`timed out waiting for ${what}${last instanceof Error ? `: ${last.message}` : ''}`);
}

module.exports = { launch, until };
