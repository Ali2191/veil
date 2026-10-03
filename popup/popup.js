/* VEIL — toolbar popup: turn VEIL on or off for the current site. */
(async () => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let settings = await VeilSettings.get();
  let ping = null;
  try { ping = await chrome.tabs.sendMessage(tab.id, { type: 'veil:ping' }); } catch {}

  let host = '';
  try { host = new URL(tab.url || '').hostname; } catch {}
  const webPage = /^https?:/.test(tab.url || '');

  // Protected-items count for this tab (kept by the service worker).
  const key = `badge:${tab.id}`;
  const n = (await chrome.storage.session.get(key).catch(() => ({})))[key] || 0;
  $('#count').textContent = n ? `${n} protected in this tab` : '';

  function render() {
    const toggle = $('#toggle'), status = $('#status'), row = $('#row');
    $('#host').textContent = ping ? ping.site : (webPage && host) || 'This page';
    $('#resume').hidden = settings.enabled;
    $('#reload').hidden = true;
    row.classList.remove('disabled');
    toggle.disabled = false;
    status.classList.remove('on');

    if (!webPage) {
      toggle.checked = false; toggle.disabled = true; row.classList.add('disabled');
      status.textContent = 'VEIL can’t run on browser pages.';
      return;
    }
    if (!ping) {
      toggle.checked = false; toggle.disabled = true; row.classList.add('disabled');
      status.textContent = 'Reload this page to let VEIL work here.';
      $('#reload').hidden = false;
      return;
    }
    if (!settings.enabled) {
      toggle.checked = false; toggle.disabled = true; row.classList.add('disabled');
      status.textContent = 'VEIL is paused everywhere.';
      return;
    }
    const rule = settings.siteRules[ping.host];
    const on = rule === 'off' ? false : rule === 'on' ? true : ping.kind === 'known' || (ping.kind === 'auto' && ping.aiPage);
    toggle.checked = on;
    if (on) {
      status.textContent = 'Protecting your details on this site';
      status.classList.add('on');
    } else if (rule === 'off') {
      status.textContent = 'Off on this site';
    } else if (ping.kind === 'people') {
      status.textContent = 'Off on messaging and email sites';
    } else {
      status.textContent = 'No AI chat detected. Turn on to protect anyway.';
    }
  }

  $('#toggle').addEventListener('change', async (e) => {
    const rules = { ...settings.siteRules };
    const byDefault = ping.kind === 'known' || (ping.kind === 'auto' && ping.aiPage);
    if (e.target.checked) { if (byDefault) delete rules[ping.host]; else rules[ping.host] = 'on'; }
    else rules[ping.host] = 'off';
    settings = await VeilSettings.set({ siteRules: rules });
    render();
  });

  $('#panel').addEventListener('click', () => {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    window.close();
  });
  $('#reload').addEventListener('click', () => { chrome.tabs.reload(tab.id); window.close(); });
  $('#resume').addEventListener('click', async () => { settings = await VeilSettings.set({ enabled: true }); render(); });

  render();
})();
