import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = process.env.TEST_BASE_URL ?? 'http://localhost:8801';
async function get(path, headers) {
  const response = await fetch(new URL(path, base), { headers });
  assert.equal(response.status, 200, path);
  return response;
}
const html = await get('/');
assert.match(html.headers.get('content-type'), /text\/html/);
assert.match(html.headers.get('link'), /rel="api-catalog"/);
assert.match(await html.text(), /rel="ai-catalog"/);
for (const path of ['/', '/sl']) {
  const response = await get(path, { Accept: 'text/markdown' });
  assert.match(response.headers.get('content-type'), /text\/markdown/);
  assert.match(response.headers.get('vary'), /Accept/i);
  assert.equal(response.headers.get('content-signal'), 'ai-train=no, search=yes, ai-input=yes');
  const body = await response.text();
  assert.match(body, /^# /m);
  assert.match(body, /```json/);
  assert.doesNotMatch(body, /<script|<style/);
}
const rejectedMarkdown = await get('/', { Accept: 'text/markdown;q=0, text/html' });
assert.match(rejectedMarkdown.headers.get('content-type'), /text\/html/);
const robots = await (await get('/robots.txt')).text();
assert.match(robots, /Content-Signal:/);
assert.match(robots, /Allow: \/api\/property\//);
assert.doesNotMatch(robots, /Disallow: \/(?:sl\/)?guests/);
for (const locale of ['en', 'sl']) {
  const response = await get(`/api/property/${locale}.json`);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const data = await response.json();
  assert.equal(data.locale, locale);
  assert.equal(data.booking.availability, 'not-provided');
  assert.equal(data.booking.reservations, 'external-only');
  assert.equal(data.contact, undefined);
  assert.equal(data.translations, undefined);
  assert.ok(data.units.length > 0);
}
const catalogResponse = await get('/.well-known/api-catalog');
assert.match(catalogResponse.headers.get('content-type'), /application\/linkset\+json/);
const catalog = await catalogResponse.json();
assert.ok(catalog.linkset[0]['service-desc'][0].href.endsWith('/openapi.json'));
const manifest = await (await get('/.well-known/ai-catalog.json')).json();
assert.equal(manifest.entries.length, 1);
assert.ok(manifest.entries[0].url);
assert.equal(manifest.entries[0].data, undefined);
const index = await (await get('/.well-known/agent-skills/index.json')).json();
for (const skill of index.skills) {
  const response = await get(new URL(skill.url).pathname);
  const artifact = Buffer.from(await response.arrayBuffer());
  assert.equal(skill.digest, `sha256:${createHash('sha256').update(artifact).digest('hex')}`);
}
const openapi = await (await get('/openapi.json')).json();
assert.equal(openapi.openapi, '3.1.0');
assert.deepEqual(openapi.security, []);
assert.equal(Object.keys(openapi.paths).length, 2);
for (const path of ['/auth.md', '/api-docs.md']) {
  const response = await get(path);
  assert.match(response.headers.get('content-type'), /text\/markdown/);
}
assert.match(await (await get('/llms.txt')).text(), /^# /);
assert.equal((await fetch(`${base}/api/property/en.json`, { method: 'POST' })).status, 405);
assert.equal((await fetch(`${base}/api/property/en.json`, { method: 'HEAD' })).status, 200);
assert.equal((await fetch(`${base}/api/property/en.json`, { method: 'OPTIONS' })).status, 204);
assert.equal((await fetch(`${base}/.well-known/nonexistent.json`)).status, 404);
for (const [page, snapshot] of [['/', '/en.md'], ['/sl', '/sl.md']]) {
  const markdown = await get(page, { Accept: 'text/markdown' });
  assert.equal(await markdown.text(), await (await get(snapshot)).text());
  assert.equal(markdown.headers.get('cdn-cache-control'), 'no-store');
  const head = await fetch(new URL(page, base), { method: 'HEAD', headers: { Accept: 'text/markdown' } });
  assert.match(head.headers.get('content-type'), /text\/markdown/);
  assert.equal(await head.text(), '');
}
for (const path of ['/stay-k7m4', '/stay-k7m4/sl', '/stay-k7m4/share', '/stay-k7m4/places/hiking/straza']) {
  const response = await get(path, { Accept: 'text/markdown' });
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
}
const redirect = await fetch(new URL('/sl/', base), { redirect: 'manual' });
assert.ok([301, 302, 307, 308].includes(redirect.status));
assert.equal(new URL(redirect.headers.get('location'), base).pathname, '/sl');
const asset = (await (await get('/')).text()).match(/src="(\/_astro\/[^" ]+\.webp)"/)[1];
assert.match((await get(asset)).headers.get('cache-control'), /max-age=31536000.*immutable/);
assert.equal((await get(asset)).headers.get('link'), null, 'static assets bypass Worker');
console.log('Agent readiness integration checks passed.');
