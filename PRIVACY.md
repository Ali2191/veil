# VEIL privacy policy

VEIL does not collect, transmit, sell or share any data. Ever.

- **No network access.** The extension's content security policy is `connect-src 'self'`. VEIL can only read its own packaged files. It has no analytics, no telemetry, no accounts and no server.
- **Everything is processed on your device.** Detection uses rules, checksums and packaged dictionaries. There is no AI model and no cloud service.
- **What is stored, and where.** The mapping between placeholders and your real values, and your "always protect" and "never protect" lists, are stored only in your browser's extension storage, AES-GCM encrypted. The key is a non-extractable WebCrypto key in your browser's IndexedDB. Settings (such as per-site on/off) are stored in plain extension storage and contain no personal details.
- **Retention.** You choose how long placeholders are kept (1–90 days) and can delete them individually or all at once. Uninstalling VEIL removes everything.
- **Why VEIL asks for access to all sites.** AI chat tools live on many domains, including ones VEIL has never seen. VEIL only activates on pages that look like an AI chat; elsewhere it does nothing and does not load your vault.

Questions: open an issue at https://github.com/Ali2191/veil/issues
