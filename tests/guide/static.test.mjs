import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { apartment, apartmentInfo, sectionsFor, places, topicsFor, summary } from '../../src/guide/lib/guide-data.ts';
import { normalize, searchDocuments, termsFor } from '../../src/guide/lib/search.ts';

const html = await readFile(new URL('../../dist/stay-k7m4/index.html', import.meta.url), 'utf8');
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const documents = JSON.parse(decode(html.match(/data-documents="([^"]+)"/)[1]));

test('JSON contains public entries, demo Wi-Fi and no host phone', () => {
  assert.equal(places.length, 40);
  assert.equal(new Set(places.map(p => p.id)).size, 40);
  assert.equal(documents.filter(d => d.kind === 'place').length, 34);
  const info = documents.filter(d => d.id.startsWith('useful-info/'));
  assert.equal(info.length, 6);
  assert(info.every(d => d.kind === 'apartment' && d.href.startsWith('/stay-k7m4?view=stay#')));
  assert(!places.some(p => ['hiking/radovna', 'food-drinks/original-restaurant-notes'].includes(p.id)));
  assert.equal(apartment.wifi.network, 'NatureNook-Demo');
  assert.equal(apartment.wifi.password, 'Fern!72Pebble');
  assert.equal(apartmentInfo.contact.messageUrl, null);
  assert.equal(apartment.hostPhone, null);
  assert.equal(apartment.confirmedByOwner, false);
  assert(topicsFor('en').find(t => t.id === 'departure').answer.includes(apartment.checkOut));
  assert(topicsFor('sl').find(t => t.id === 'departure').answer.includes(apartment.checkOut));
});

test('structured apartment instructions are searchable in both languages', () => {
  assert.equal(apartmentInfo.sections.length, 4);
  for (const lang of ['en', 'sl']) {
    const topics = topicsFor(lang);
    assert.equal(new Set(topics.map(topic => topic.id)).size, topics.length);
    const docs = topics.map(topic => ({ ...topic, kind: 'apartment', body: '', href: `/?view=stay#${topic.id}` }));
    for (const section of sectionsFor(lang)) {
      for (const item of section.items) {
        const doc = docs.find(doc => doc.id === item.id);
        assert(doc, item.id);
        assert(doc.answer.includes(item.answer), item.id);
        assert(doc.answer.includes(item.location), item.id);
        assert(!/\{(?:address|checkIn|checkOut|quietHours)\}/.test(doc.answer));
        assert(searchDocuments(docs, item.title).some(doc => doc.id === item.id), item.id);
      }
    }
  }
  assert.match(topicsFor('en').find(topic => topic.id === 'access').answer, /private reservation messages/);
  assert.doesNotMatch(JSON.stringify(apartmentInfo), /"(?:accessCode|doorCode|keySafeCode)"/);
});

test('saved park itinerary has actual road geometry, explicit train connector and ordered stops', async () => {
  const place = places.find(p => p.id === 'day-trips/around-the-national-park');
  assert.equal(place.route, '/stay-k7m4/routes/around-the-national-park.geojson');
  const data = JSON.parse(await readFile(new URL(`../../public${place.route}`, import.meta.url), 'utf8'));
  assert.equal(data.type, 'FeatureCollection');
  const roads = data.features.filter(f => f.properties.mode === 'drive');
  assert.equal(roads.length, 2);
  assert(roads.every(f => f.geometry.type === 'LineString' && f.geometry.coordinates.length > 500));
  const train = data.features.find(f => f.properties.mode === 'train');
  assert.match(train.properties.name, /schematic/);
  assert.equal(train.geometry.coordinates.length, 2);
  const stops = data.features.filter(f => f.geometry.type === 'Point');
  assert.equal(stops.length, 9);
  assert.deepEqual(stops.map(f => f.properties.order), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert(stops.some(f => f.properties.name === 'Vršič Pass'));
  assert(stops.some(f => f.properties.name.includes('Bohinjska Bistrica')));
});

test('every day trip has a saved route with roads, ordered unique stops and a Bled return', async () => {
  for (const place of places.filter(p => p.category === 'day-trips')) {
    assert(place.route, place.id);
    const data = JSON.parse(await readFile(new URL(`../../public${place.route}`, import.meta.url), 'utf8'));
    const built = JSON.parse(await readFile(new URL(`../../dist${place.route}`, import.meta.url), 'utf8'));
    assert.deepEqual(built, data);
    const roads = data.features.filter(f => f.properties.mode === 'drive');
    assert(roads.length > 0);
    assert(roads.every(f => f.geometry.type === 'LineString' && f.geometry.coordinates.length > 500));
    const stops = data.features.filter(f => f.geometry.type === 'Point');
    assert.equal(new Set(stops.map(f => f.geometry.coordinates.join(','))).size, stops.length);
    assert.deepEqual(stops.map(f => f.properties.order), stops.map((_, i) => i + 1));
    assert.deepEqual(roads[0].geometry.coordinates[0], roads.at(-1).geometry.coordinates.at(-1));
    if (!place.id.endsWith('around-the-national-park')) {
      assert.equal(roads.length, 1);
      assert(!data.features.some(f => f.properties.mode === 'train'));
    }
  }
});

test('walks from the door have a host-drawn path starting at the apartment', async () => {
  const walks = places.filter(p => p.category === 'walks');
  assert.deepEqual(walks.map(p => p.id), ['walks/lake', 'walks/market', 'walks/morning-short', 'walks/morning-long', 'walks/sava']);
  for (const place of walks) {
    const data = JSON.parse(await readFile(new URL(`../../public${place.route}`, import.meta.url), 'utf8'));
    const [line] = data.features;
    assert(['walk', 'bike'].includes(line.properties.mode), place.id);
    const [lng, lat] = line.geometry.coordinates[0];
    assert(Math.abs(lat - apartment.coordinates[0]) < 0.001 && Math.abs(lng - apartment.coordinates[1]) < 0.001, place.id);
  }
});

test('trips split long text into a note and numbered stops', () => {
  for (const place of places.filter(p => p.category === 'day-trips')) {
    assert(place.note?.startsWith('The map shows'), place.id);
    assert(place.stops.length >= 3, place.id);
    assert(!place.paragraphs.some(p => p.startsWith('The map shows')), place.id);
  }
});

test('natural phrases, synonyms, accents and literal all-term matching', () => {
  for (const [query, id] of [
    ["what’s the wifi password", 'wifi'], ['what time do we have to check out', 'departure'], ['where can I park', 'parking'],
    ['how do I contact the host', 'contact'], ['pizza', 'food-drinks/rustika'], ['straza', 'hiking/straza'],
    ['rain', 'rainy-day/postojna-cave'], ['taxi', 'useful-info/taxi'], ['walk to the lake', 'walks/lake'], ['vogel', 'day-trips/bohinj-valley'], ['where can we eat pizza', 'food-drinks/rustika'],
  ]) assert(searchDocuments(documents, query).some(d => d.id === id), query);
  assert.deepEqual(searchDocuments(documents, 'wi-fi'), searchDocuments(documents, 'wifi'));
  assert.deepEqual(searchDocuments(documents, 'check-out'), searchDocuments(documents, 'checkout'));
  for (const query of ['pizza nonexistent', '   ', '[.*', '<img onerror=alert(1)>']) assert.equal(searchDocuments(documents, query).length, 0);
  assert.equal(normalize('Straža—Hill'), 'straza hill');
  assert.deepEqual(termsFor('where can I park'), ['parking']);
});

test('ranking prefers title then aliases then body, with stable ties', () => {
  const base = { kind: 'place', aliases: [], answer: '', body: '', href: '/' };
  const docs = [
    { ...base, id: 'body', title: 'One', body: 'pizza' },
    { ...base, id: 'alias', title: 'Two', aliases: ['pizza'] },
    { ...base, id: 'prefix', title: 'Pizza here' },
    { ...base, id: 'exact', title: 'Pizza' },
    { ...base, id: 'tie', title: 'Three', body: 'pizza' },
  ];
  assert.deepEqual(searchDocuments(docs, 'pizza').map(d => d.id), ['exact', 'prefix', 'alias', 'body', 'tie']);
});

test('static output contains namespaced routes, metadata and useful links', async () => {
  assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1);
  for (const place of places) {
    const page = await readFile(new URL(`../../dist/stay-k7m4/places/${place.id}/index.html`, import.meta.url), 'utf8');
    assert.match(page, /<html lang="en">/);
    assert.match(page, /name="robots" content="noindex, follow"/);
    assert.match(page, /Back to guide/);
    assert.doesNotMatch(page, /data-documents=/);
    assert(!summary(place).startsWith('The pin marks'), place.id);
  }
  await assert.rejects(readFile(new URL('../../dist/stay-k7m4/places/hiking/radovna/index.html', import.meta.url)));
  assert.match(await readFile(new URL('../../dist/stay-k7m4/places/useful-info/taxi/index.html', import.meta.url), 'utf8'), /href="tel:\+38641710747"/);
  const sl = await readFile(new URL('../../dist/stay-k7m4/sl/index.html', import.meta.url), 'utf8');
  assert.match(sl, /<html lang="sl">/);
  assert.match(sl, /Iskanje po vodniku/);
  assert.match(sl, /Lokalna priporočila so trenutno/);
});

test('Worker config, external scripts and simple Leaflet tiles', async () => {
  const config = JSON.parse(await readFile(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.html_handling, 'drop-trailing-slash');
  const headers = await readFile(new URL('../../dist/_headers', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../../worker/index.js', import.meta.url), 'utf8');
  assert.match(worker, /worker-src 'none'/);
  assert.match(worker, /connect-src 'self';/);
  assert.match(worker, /img-src 'self' data: https:\/\/tile.openstreetmap.org/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /Cache-Control: public, max-age=31536000, immutable/);
  assert.doesNotMatch(headers, /openfreemap|blob:/);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>[^<]+<\/script>/);
  const assets = await readdir(new URL('../../dist/_astro/', import.meta.url));
  assert(!assets.some(file => /worker.*\.js$/.test(file)));
  const map = await readFile(new URL('../../src/guide/scripts/map.ts', import.meta.url), 'utf8');
  assert.match(map, /https:\/\/tile.openstreetmap.org\/\{z\}\/\{x\}\/\{y\}.png/);
  assert.match(map, /keepBuffer: 0/);
  assert.doesNotMatch(map, /maplibre|setWorkerUrl|openfreemap/);
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert(pkg.dependencies.leaflet);
  assert(!pkg.dependencies['maplibre-gl']);
});
