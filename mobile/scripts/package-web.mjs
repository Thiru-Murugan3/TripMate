import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function apiUrl(raw) {
  if (!raw?.trim()) throw new Error('MOBILE_API_BASE must be the public HTTPS backend URL.');
  const url = new URL(raw.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Use a public HTTPS backend URL without credentials, query or fragment.');
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (path && path !== '/api/v1') throw new Error('Backend URL must use its origin or /api/v1 path.');
  return `${url.origin}/api/v1`;
}

export function injectNative(html) {
  if (!html.includes('</head>')) throw new Error('The web entry point must contain a head element.');
  return html.replace(/(<meta[^>]+name=["']viewport["'][^>]+content=["'])([^"']+)(["'])/i,
    (_, before, content, after) => `${before}${content.replace(/,?\s*viewport-fit=[^,]+/g, '')},viewport-fit=cover${after}`)
    .replace('</head>', '<link rel="stylesheet" href="/suttru-native.css"><script defer src="/suttru-native.js"></script></head>');
}

export function packageWeb(source, target, rawApiBase) {
  const api = apiUrl(rawApiBase);
  for (const entry of ['index.html', 'offline.html', 'offline-viewer.js', 'offline-store.js']) {
    if (!existsSync(join(source, entry))) throw new Error(`Build the web app first: missing ${entry}.`);
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  writeFileSync(join(target, 'config.js'), `window.__TRIPMATE_CONFIG__ = ${JSON.stringify({ apiUrl: api })};\n`);
  for (const entry of ['index.html', 'offline.html']) {
    writeFileSync(join(target, entry), injectNative(readFileSync(join(target, entry), 'utf8')));
  }
  // The APK already contains its shell. Avoid a browser SW replacing it with a stale web build.
  // Keep the offline viewer and IndexedDB packs, which do not depend on the service worker.
  writeFileSync(join(target, 'suttru-native.css'), `
html { background:#f8fafc; }
.app-layout app-navbar .navbar { top:var(--safe-area-inset-top,env(safe-area-inset-top,0px)); }
body { padding-top:var(--safe-area-inset-top,env(safe-area-inset-top,0px));
  padding-bottom:var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px));
  padding-left:var(--safe-area-inset-left,env(safe-area-inset-left,0px));
  padding-right:var(--safe-area-inset-right,env(safe-area-inset-right,0px)); }
`);
  return api;
}
