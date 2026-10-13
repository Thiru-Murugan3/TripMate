import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function worker() {
  const handlers = {}, cached = [];
  const context = {
    self: { location: { origin: 'https://suttru.test' },
      addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim: async () => {} } },
    caches: { open: async () => ({ addAll: async paths => cached.push(...paths), match: async path => 'cached:' + path }),
      match: async path => 'cached:' + path },
    fetch: async () => { throw Error('offline'); }, URL
  };
  vm.runInNewContext(readFileSync(new URL('../public/offline-worker.js', import.meta.url), 'utf8'), context);
  return { handlers, cached };
}
test('installs a self-contained reader without caching authenticated resources', async () => {
  const { handlers, cached } = worker();
  let installed;
  handlers.install({ waitUntil: promise => { installed = promise; } });
  await installed;
  for (const file of ['/offline.html', '/offline-viewer.js', '/offline-store.js']) assert.ok(cached.includes(file));
  assert.ok(cached.every(path => !path.includes('/api') && !path.includes('config.js')));
});
test('failed navigation opens the offline reader', async () => {
  const { handlers } = worker(); let response;
  handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://suttru.test/trips/1' },
    respondWith: promise => { response = promise; } });
  assert.equal(await response, 'cached:/offline.html');
});
test('API calls, documents and mutations are never intercepted', () => {
  const { handlers } = worker();
  for (const [method, url] of [['GET','https://suttru.test/api/v1/trips'],
      ['GET','https://suttru.test/api/v1/trips/1/documents/2/content'], ['POST','https://suttru.test/api/v1/bookings'],
      ['GET','https://storage.test/signed-document']]) {
    handlers.fetch({ request: { method, mode: 'cors', url }, respondWith: () => assert.fail('Must not cache API traffic') });
  }
});
