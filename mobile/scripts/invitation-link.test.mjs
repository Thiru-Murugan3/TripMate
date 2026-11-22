import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationPath } from '../src/invitation-link.mjs';
test('routes trusted cold and warm Android invitation URLs to the same local page',()=>{
 for(const url of ['suttru://invite/abc-123','https://suttru.in/invite/abc-123','https://www.suttru.in/invite/abc-123'])assert.equal(invitationPath(url),'/invite/abc-123');
});
test('rejects unrelated, credentialed and malformed deep links',()=>{
 for(const url of ['https://evil.test/invite/abc','https://suttru.in.evil.test/invite/abc','suttru://elsewhere/abc','suttru://invite/abc/extra','https://user@suttru.in/invite/abc','https://suttru.in/invite/abc?url=evil','https://suttru.in/login','javascript:alert(1)','suttru://invite/%2f%2fevil.test','suttru://invite/'])assert.equal(invitationPath(url),null,url);
});
