import assert from 'node:assert/strict';
import worker from '../worker/index.js';

let assetPath;
const env = { ASSETS: { async fetch(request) {
  assetPath = new URL(request.url).pathname;
  return new Response(request.method === 'HEAD' ? null : `asset:${assetPath}`, {
    headers: { 'Content-Type': assetPath.endsWith('.md') ? 'text/plain' : 'text/html', ETag: `"${assetPath}"` },
  });
} } };
const fetch = (path, options) => worker.fetch(new Request(`https://nature-nook.si${path}`, options), env);
for (const [accept, expected] of [
  ['text/markdown', '/en.md'], ['text/html', '/'],
  ['text/markdown;q=0, text/html', '/'],
  ['text/markdown;q=0.5, text/html;q=0.9', '/'],
  ['text/markdown;q=0.9, text/html;q=0.5', '/en.md'],
  ['text/markdown;q=garbage', '/'], ['text/markdown;q=2', '/'],
]) {
  const response = await fetch('/', { headers: { Accept: accept } });
  assert.equal(assetPath, expected);
  assert.match(response.headers.get('vary'), /Accept/);
  assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('etag'), `"${expected}"`);
}
for (const path of ['/', '/sl']) {
  const response = await fetch(path, { method: 'HEAD', headers: { Accept: 'text/markdown' } });
  assert.equal(assetPath, path === '/' ? '/en.md' : '/sl.md');
  assert.match(response.headers.get('content-type'), /text\/markdown/);
  assert.equal(await response.text(), '');
}
for (const path of ['/stay-k7m4', '/stay-k7m4/sl', '/stay-k7m4/share', '/stay-k7m4/places/hiking/straza']) {
  const response = await fetch(path, { headers: { Accept: 'text/markdown' } });
  assert.equal(assetPath, path);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  assert.match(response.headers.get('content-type'), /text\/html/);
}
assert.equal((await fetch('/', { method: 'POST' })).status, 405);
assert.equal((await fetch('/en.md', { method: 'OPTIONS' })).status, 204);
assert.equal((await fetch('/en.md')).headers.get('access-control-allow-origin'), '*');
console.log('Worker negotiation, HEAD, caching, CORS, methods and guest exclusions passed.');
