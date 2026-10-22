import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import path from 'node:path';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
function load(relative, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, URL, ...globals };
  vm.runInNewContext(code, context);
  return context.exports;
}
const { getLoginReturnTo } = load('src/shared/lib/auth-return-to.ts');
for (const value of [undefined, ['/docs'], '//evil.example', '/\\evil.example', '/login', '/login/?returnTo=/login', '/%6cogin', '/\n/evil.example', '/%']) {
  assert.equal(getLoginReturnTo(value), '/', String(value));
}
assert.equal(getLoginReturnTo('/?playbookDocument=60#note'), '/?playbookDocument=60#note');
function client(checkStatus, throwOnCheck = false) {
  const redirects = [], calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/me') {
      if (throwOnCheck) throw new Error('offline');
      await new Promise(resolve => setTimeout(resolve, 5));
      return { status: checkStatus };
    }
    return { ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) };
  };
  const window = { location: { pathname: '/', search: '?playbookDocument=60', hash: '#note', replace: url => redirects.push(url) } };
  return { ...load('src/shared/api/client.ts', { fetch, window }), redirects, calls };
}
for (const status of [200, 403, 500]) {
  const c = client(status);
  await assert.rejects(c.request('/api/example'), { status: 401 });
  assert.equal(c.redirects.length, 0);
}
const offline = client(0, true);
await assert.rejects(offline.request('/api/example'), { status: 401 });
assert.equal(offline.redirects.length, 0);
const expired = client(401);
await Promise.allSettled([expired.request('/api/example'), expired.request('/api/example', { method: 'PATCH', body: { title: 'test' } })]);
assert.equal(expired.calls.filter(c => c.url === '/api/auth/me').length, 1);
assert.equal(expired.calls.filter(c => c.options.method === 'PATCH').length, 1, 'never replay writes');
assert.equal(expired.redirects.length, 1);
assert.equal(expired.redirects[0], '/login?returnTo=%2F%3FplaybookDocument%3D60%23note');
assert.equal(expired.calls.find(c => c.url === '/api/auth/me').options.cache, 'no-store');
console.log('PASS: return paths, valid/expired sessions, offline/5xx, concurrent 401, single redirect, no write replay');
