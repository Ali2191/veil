/* VEIL — supported AI sites, their composers and send buttons.
   Selectors are tried in order; generic fallbacks cover markup changes.
   VEIL runs on every site; these entries only add precise selectors for well-known apps. */
(function (root) {
  'use strict';

  const SITES = [
    { id: 'chatgpt', name: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'],
      composer: ['#prompt-textarea', 'form div.ProseMirror[contenteditable="true"]', 'form textarea'],
      send: ['button[data-testid="send-button"]', '#composer-submit-button', 'button[aria-label="Send prompt"]'] },
    { id: 'claude', name: 'Claude', hosts: ['claude.ai'],
      composer: ['div.ProseMirror[contenteditable="true"]', '[contenteditable="true"][role="textbox"]'],
      send: ['button[aria-label="Send message"]', 'button[aria-label="Send Message"]', 'button[aria-label="Send"]'] },
    { id: 'gemini', name: 'Gemini', hosts: ['gemini.google.com'],
      composer: ['rich-textarea .ql-editor', 'div.ql-editor[contenteditable="true"]'],
      send: ['button.send-button', 'button[aria-label="Send message"]'] },
    { id: 'perplexity', name: 'Perplexity', hosts: ['www.perplexity.ai', 'perplexity.ai'],
      composer: ['#ask-input', 'textarea', 'div[contenteditable="true"][role="textbox"]'],
      send: ['button[data-testid="submit-button"]', 'button[aria-label="Submit"]'] },
    { id: 'copilot', name: 'Copilot', hosts: ['copilot.microsoft.com'],
      composer: ['#userInput', 'textarea'],
      send: ['button[aria-label="Submit message"]', 'button[title="Submit message"]'] },
    { id: 'deepseek', name: 'DeepSeek', hosts: ['chat.deepseek.com'],
      composer: ['#chat-input', 'textarea'],
      send: [] },
    { id: 'grok', name: 'Grok', hosts: ['grok.com'],
      composer: ['div.ProseMirror[contenteditable="true"]', 'textarea'],
      send: ['button[type="submit"][aria-label="Submit"]', 'button[aria-label="Submit"]', 'form button[type="submit"]'] },
    { id: 'mistral', name: 'Le Chat', hosts: ['chat.mistral.ai'],
      composer: ['div.ProseMirror[contenteditable="true"]', 'textarea'],
      send: ['button[aria-label="Send question"]', 'form button[type="submit"]'] },
  ];

  const siteFor = (hostname) => SITES.find((s) => s.hosts.includes(hostname)) || null;

  // Sites where people message other people. A chat box there is not an AI, so VEIL
  // stays off unless the user turns it on explicitly.
  const PEOPLE = /(^|\.)(mail\.google\.com|web\.whatsapp\.com|whatsapp\.com|slack\.com|discord\.com|messenger\.com|facebook\.com|instagram\.com|teams\.microsoft\.com|teams\.live\.com|web\.telegram\.org|telegram\.org|linkedin\.com|x\.com|twitter\.com|reddit\.com|outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com|mail\.yahoo\.com|proton\.me|docs\.google\.com|github\.com|web\.skype\.com|signal\.org|zoom\.us|meet\.google\.com)$/i;

  // Hints that a page is an AI assistant.
  const AI_HOST = /(^|[.-])(ai|chat|chatbot|gpt|llm|bot|copilot|gemini|claude|mistral|deepseek|grok|qwen|kimi|moonshot|doubao|yiyan|tongyi|poe|perplexity|huggingface|hf|ollama|openrouter|groq|cohere|phind|you|pi|character|janitorai|lmarena|arena|together|fireworks|replicate|anthropic|openai|meta|zhipu|bigmodel|z)([.-]|$)|\.ai$/i;
  const AI_TEXT = /\b(AI|A\.I\.|GPT|LLM|chat ?bot|chat ?gpt|assistant|copilot|language model|ask anything|agent)\b/i;
  const AI_BOX = /ask|message|prompt|chat|question|anything|how can i help|what can i|type here|send a|talk to|describe|write/i;

  function classify(hostname) {
    const known = siteFor(hostname);
    if (known) return { kind: 'known', site: known };
    if (PEOPLE.test(hostname)) return { kind: 'people', site: null };
    return { kind: 'auto', site: null };
  }

  const api = { SITES, siteFor, classify, AI_HOST, AI_TEXT, AI_BOX };
  root.VeilSites = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
