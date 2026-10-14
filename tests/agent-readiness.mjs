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
assert.match(robots, /Disallow: \/guests/);
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
console.log('Agent readiness integration checks passed.');
