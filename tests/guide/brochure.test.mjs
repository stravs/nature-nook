import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import QRCode from 'qrcode';

const { document } = parseHTML(await readFile('dist/stay-k7m4/print/index.html', 'utf8'));
const places = JSON.parse(await readFile('src/guide/data/places.json', 'utf8'));
const local = places.filter(p => p.id !== 'hiking/vintgar' && p.coordinates && p.coordinates[0] >= 46.34 && p.coordinates[0] <= 46.41 && p.coordinates[1] >= 14.06 && p.coordinates[1] <= 14.14);

test('brochure QR encodes the configured canonical guide URL', async () => {
  const link = document.querySelector('[data-brochure-page="8"] a[href^="https:"]');
  assert(link);
  const expected = await QRCode.toString(link.href, { type: 'svg', margin: 4, errorCorrectionLevel: 'M', color: { dark: '#183c2d', light: '#ffffff' } });
  assert.equal(document.querySelector('[data-brochure-page="8"] svg').outerHTML, parseHTML(expected).document.querySelector('svg').outerHTML);
});

test('first page puts the labelled demo Wi-Fi QR beside the guest guide', async () => {
  const cover = document.querySelector('[data-brochure-page="1"]');
  assert(cover.querySelector('[data-cover-guide] svg'));
  assert(cover.querySelector('[data-cover-wifi]'));
  assert(cover.querySelector('[data-demo-wifi]').textContent.includes('replace before sharing'));
  const apartment = JSON.parse(await readFile('src/guide/data/apartment.json', 'utf8'));
  const escape = value => value.replace(/[\\\\;,:\"]/g, '\\\\$&');
  const payload = `WIFI:T:WPA;S:${escape(apartment.wifi.network)};P:${escape(apartment.wifi.password)};;`;
  const expected = await QRCode.toString(payload, { type: 'svg', margin: 4, errorCorrectionLevel: 'M', color: { dark: '#183c2d', light: '#ffffff' } });
  assert.equal(cover.querySelector('[data-cover-wifi-qr] svg').outerHTML, parseHTML(expected).document.querySelector('svg').outerHTML);
  assert(cover.textContent.includes(apartment.wifi.network));
  assert(cover.textContent.includes(apartment.wifi.password));
});

test('compact brochure has eight pages and correct duplex imposition', async () => {
  assert.deepEqual([...document.querySelectorAll('[data-brochure-page]')].map(p => Number(p.dataset.brochurePage)), [1, 2, 3, 4, 5, 6, 7, 8]);
  const { document: booklet } = parseHTML(await readFile('dist/stay-k7m4/print/booklet/index.html', 'utf8'));
  assert.deepEqual([...booklet.querySelectorAll('[data-brochure-sheet]')].map(s => [...s.querySelectorAll('[data-brochure-page]')].map(p => Number(p.dataset.brochurePage))), [[8, 1], [2, 7], [6, 3], [4, 5]]);
  assert.doesNotMatch(await readFile('dist/sitemap-0.xml', 'utf8'), /stay-k7m4/);
});

test('all Bled destinations appear on one real map and in the local key', async () => {
  assert.equal(local.length, 13);
  const key = document.querySelector('[data-brochure-page="6"]');
  assert.deepEqual([...key.querySelectorAll('[data-brochure-place]')].map(p => p.dataset.brochurePlace).sort(), local.map(p => p.id).sort());
  const pins = [...document.querySelectorAll('[data-map-pin]')].map(p => Number(p.dataset.mapPin));
  assert.deepEqual(pins, Array.from({ length: 13 }, (_, i) => i + 1));
  assert.equal(document.querySelectorAll('[data-brochure-map] image').length, 1);
  assert.equal(document.querySelector('[data-brochure-page="6"] [data-brochure-place="hiking/vintgar"]'), null);
  const map = JSON.parse(await readFile('src/guide/data/brochure-maps.json', 'utf8')).local;
  assert.equal(map.zoom, 15);
  for (const place of local) {
    const [lat, lon] = place.coordinates;
    const s = 256 * 2 ** map.zoom;
    const x = (lon + 180) / 360 * s - map.left;
    const y = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * s - map.top;
    assert(x >= 30 && x <= map.width - 30 && y >= 30 && y <= map.height - 30, `${place.id}: marker outside map safe area`);
  }
  assert((await readFile('public/stay-k7m4/maps/local.webp')).length > 10000);
  assert.equal(document.querySelectorAll('a[href="https://www.openstreetmap.org/copyright"]').length, 1);
});

test('five printed paths preserve saved route geometry and distinguish car/bike travel', async () => {
  const map = JSON.parse(await readFile('src/guide/data/brochure-maps.json', 'utf8')).local;
  const routes = local.filter(place => place.route);
  assert.equal(document.querySelectorAll('[data-map-route]').length, 5);
  for (const place of routes) {
    const source = JSON.parse(await readFile(`public${place.route}`, 'utf8'));
    const expected = source.features.map(feature => feature.geometry.coordinates.map(([lon, lat], i) => {
      const s = 256 * 2 ** map.zoom;
      const x = (lon + 180) / 360 * s - map.left;
      const y = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * s - map.top;
      assert(x >= 0 && x <= map.width && y >= 0 && y <= map.height, `${place.id}: route outside map`);
      return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ')).join(' ');
    assert.equal(document.querySelector(`[data-map-route="${place.id}"] [data-route-line]`).getAttribute('d'), expected);
  }
  const sava = document.querySelector('[data-map-route="walks/sava"]');
  assert(sava.textContent.includes('car/bike'));
  assert(sava.querySelector('[data-route-line]').hasAttribute('stroke-dasharray'));
});

test('farther recommendations are brief mentions, with alpine safety context', () => {
  const beyond = places.filter(p => p.group !== 'info' && !local.includes(p));
  const page = document.querySelector('[data-brochure-page="7"]');
  assert.deepEqual([...page.querySelectorAll('[data-brochure-place]')].map(p => p.dataset.brochurePlace).sort(), beyond.map(p => p.id).sort());
  assert(page.textContent.includes('demanding alpine outings'));
  assert.equal(page.querySelectorAll('[data-map-pin]').length, 0);
});
