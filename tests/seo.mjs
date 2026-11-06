import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

const origin = process.env.SITE_URL ?? 'https://nature-nook.si';
for (const [file, path, language] of [['dist/index.html', '/', 'en'], ['dist/sl/index.html', '/sl', 'sl']]) {
  const { document } = parseHTML(await readFile(file, 'utf8'));
  assert.equal(document.documentElement.lang, language);
  assert.equal(document.querySelector('link[rel="canonical"]').href, new URL(path, origin).href);
  assert.equal(document.querySelectorAll('h1').length, 1);
  for (const lang of ['en', 'sl', 'x-default']) assert.ok(document.querySelector(`link[hreflang="${lang}"]`));
  assert.ok(document.querySelector('meta[name="description"]').content.length > 0);
  assert.equal(document.querySelector('meta[property="og:url"]').content, new URL(path, origin).href);
  assert.ok(document.querySelector('link[type="text/markdown"]'));
  const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
  assert.equal(schema['@type'], 'LodgingBusiness');
  assert.equal(schema.aggregateRating, undefined, 'No self-serving review rich result markup');
  const hero = document.querySelector('main img');
  assert.equal(hero.getAttribute('loading'), 'eager');
  assert.equal(hero.getAttribute('fetchpriority'), 'high');
  for (const image of document.querySelectorAll('main img[src]')) {
    assert.ok(image.hasAttribute('alt'));
    assert.ok(Number(image.getAttribute('width')) > 0);
    assert.ok(Number(image.getAttribute('height')) > 0);
  }
}
for (const file of ['dist/guests/index.html', 'dist/sl/guests/index.html']) {
  const { document } = parseHTML(await readFile(file, 'utf8'));
  assert.match(document.querySelector('meta[name="robots"]').content, /noindex/);
  assert.equal(document.querySelector('link[type="text/markdown"]'), null);
}
assert.doesNotMatch(await readFile('dist/sitemap-0.xml', 'utf8'), /guests|\.md/);
console.log('SEO metadata, languages, schema, image dimensions and guest exclusions passed.');
