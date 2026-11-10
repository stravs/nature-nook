import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { places, baseFor, apartment } from '../../src/guide/lib/guide-data.ts';

const root = new URL('../../dist/', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const origin = process.env.SITE_URL ?? 'https://nature-nook.si';
const paths = ['/stay-k7m4', '/stay-k7m4/sl', '/stay-k7m4/share', ...places.map(p => `/stay-k7m4/places/${p.id}`)];

test('all guide HTML has canonical/noindex, valid local links and only external scripts', async () => {
  for (const path of paths) {
    const html = await read(`${path.slice(1)}/index.html`);
    const { document } = parseHTML(html);
    assert.match(document.querySelector('meta[name="robots"]').content, /noindex/);
    assert.equal(document.querySelector('link[rel="canonical"]').href, `${origin}${path}`);
    assert.equal(document.querySelector('link[type="text/markdown"]'), null);
    assert.equal(document.querySelector('link[rel="ai-catalog"]'), null);
    assert.doesNotMatch(document.body.textContent, /Preview ·|Predogled ·|Preview only ·/);
    for (const script of document.querySelectorAll('script')) assert(script.hasAttribute('src'), path);
    for (const element of document.querySelectorAll('[href], [src]')) {
      const value = element.getAttribute('href') ?? element.getAttribute('src');
      if (!value?.startsWith('/')) continue;
      const url = new URL(value, origin);
      const pathname = url.pathname;
      assert(pathname.startsWith('/stay-k7m4') || pathname.startsWith('/_astro/'), `${path}: ${value}`);
      const file = /\.[a-z0-9]+$/i.test(pathname) ? pathname.slice(1) : `${pathname.slice(1)}/index.html`;
      await access(new URL(file, root));
    }
  }
});

test('public documents and loaded public assets never advertise the unlisted guide', async () => {
  const publicFiles = ['index.html', 'sl/index.html', 'robots.txt', 'sitemap-index.xml', 'sitemap-0.xml', 'en.md', 'sl.md', 'llms.txt', 'openapi.json', 'api/property/en.json', 'api/property/sl.json', '.well-known/ai-catalog.json', '.well-known/api-catalog'];
  for (const file of publicFiles) {
    const text = await read(file);
    assert.doesNotMatch(text, /stay-k7m4/, file);
    if (file.endsWith('.html')) {
      const { document } = parseHTML(text);
      assert.doesNotMatch(document.querySelector('meta[name="robots"]').content, /noindex/);
      for (const node of document.querySelectorAll('link[rel="stylesheet"], script[src]')) {
        const asset = node.getAttribute('href') ?? node.getAttribute('src');
        if (asset?.startsWith('/_astro/')) assert.doesNotMatch(await read(asset.slice(1)), /stay-k7m4/, asset);
      }
    }
  }
  await assert.rejects(access(new URL('guests/index.html', root)));
  await assert.rejects(access(new URL('sl/guests/index.html', root)));
});

test('language alternates and printable QR target the namespaced guide', async () => {
  for (const lang of ['en', 'sl']) {
    const { document } = parseHTML(await read(`${baseFor(lang).slice(1)}/index.html`));
    assert.equal(document.documentElement.lang, lang);
    for (const alternate of ['en', 'sl']) {
      assert.equal(document.querySelector(`link[hreflang="${alternate}"]`).href, `${origin}${baseFor(alternate)}`);
    }
    assert.match(document.body.textContent, /NatureNook-Demo/);
    assert.match(document.body.textContent, lang === 'en' ? /Demo credentials/ : /Vzorčni podatki/);
  }
  const { document } = parseHTML(await read('stay-k7m4/share/index.html'));
  assert.equal(document.querySelector('#guide-url').href, `${origin}/stay-k7m4`);
  assert(document.querySelector('#guide-qr svg'));
  assert(document.querySelector('#wifi-qr svg'));
  assert.equal(document.querySelector('#wifi-network').textContent, apartment.wifi.network);
  assert.equal(document.querySelector('#wifi-password').textContent, apartment.wifi.password);
});
