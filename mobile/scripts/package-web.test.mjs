import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiUrl, packageWeb } from './package-web.mjs';
test('normalizes public backend origins without duplicating the API path',()=>{
  assert.equal(apiUrl('https://api.suttru.in/'),'https://api.suttru.in/api/v1');
  assert.equal(apiUrl('https://api.suttru.in/api/v1/'),'https://api.suttru.in/api/v1');
  for(const value of ['', 'http://api.suttru.in','https://localhost','https://user:secret@api.suttru.in','https://api.suttru.in/?key=secret','https://api.suttru.in/other','https://api.suttru.in/#fragment'])assert.throws(()=>apiUrl(value));
});
test('packages independent native entry points while preserving the web build and offline files',()=>{
  const root=mkdtempSync(join(tmpdir(),'suttru-package-'));
  try {
    const source=join(root,'web'),target=join(root,'native');mkdirSync(source);
    const html='<head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>App</body>';
    for(const entry of ['index.html','offline.html'])writeFileSync(join(source,entry),html);
    writeFileSync(join(source,'offline-viewer.js'),'offline viewer');writeFileSync(join(source,'offline-store.js'),'offline storage');
    writeFileSync(join(source,'config.js'),'original web config');
    packageWeb(source,target,'https://api.suttru.in');
    for(const entry of ['index.html','offline.html']){
      const content=readFileSync(join(target,entry),'utf8');
      assert.match(content,/suttru-native.js/);assert.match(content,/viewport-fit=cover/);
      assert.equal(readFileSync(join(source,entry),'utf8'),html);
    }
    assert.equal(readFileSync(join(source,'config.js'),'utf8'),'original web config');
    assert.match(readFileSync(join(target,'config.js'),'utf8'),/https:\/\/api.suttru.in\/api\/v1/);
    assert.ok(existsSync(join(target,'offline-store.js')));
    writeFileSync(join(target,'stale.js'),'old');packageWeb(source,target,'https://api.suttru.in');assert.ok(!existsSync(join(target,'stale.js')));
    assert.throws(()=>packageWeb(source,target,'http://bad.example'));
    assert.ok(existsSync(join(target,'index.html')));
  } finally {rmSync(root,{recursive:true,force:true});}
});
