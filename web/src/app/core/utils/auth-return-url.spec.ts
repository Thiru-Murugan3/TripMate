import { authReturnUrl } from './auth-return-url';
describe('Authentication return paths',()=>{
 it('keeps invitation tokens while rejecting external and malformed paths',()=>{
  expect(authReturnUrl('/invite/abc-123')).toBe('/invite/abc-123');
  for(const value of [undefined,'https://evil.test','//evil.test','/\\evil.test','/\n/invite',42])expect(authReturnUrl(value)).toBe('/dashboard');
 });
});
