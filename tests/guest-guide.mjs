// Run after npm run build. Checks the static, no-JavaScript fallback.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

for (const locale of ['en', 'sl']) {
  const path = locale === 'en' ? 'dist/guests/index.html' : 'dist/sl/guests/index.html';
  const { document } = parseHTML(await readFile(path, 'utf8'));
  const stay = document.querySelector('[data-guide-panel="stay"]');
  const explore = document.querySelector('[data-guide-panel="explore"]');
  const config = JSON.parse(explore.dataset.mapConfig);
  const cards = [...document.querySelectorAll('[data-card]')];
  assert.equal(cards.length, 36);
  assert.equal(stay.hidden, false, 'Apartment info available without JS');
  assert.equal(explore.hidden, false, 'Recommendations available without JS');
  assert.equal(document.querySelector('[data-map-list]').hasAttribute('open'), true);
  assert.equal(document.querySelector('[data-map-experience]').hidden, true, 'No empty interactive map without JS');
  assert.equal(document.querySelectorAll('.illustrated-map, .explore-guide iframe').length, 0);
  assert.equal(config.locale, locale);
  assert.deepEqual(config.home.coordinates, [46.369473, 14.1150088]);
  for (const place of config.places) {
    assert.ok(place.coordinates.every(Number.isFinite));
    assert.ok(Number.isFinite(place.distanceMeters) && place.distanceMeters > 0);
    assert.match(place.distanceLabel, /^≈ [\d.,]+ (m|km)$/);
    assert.ok(document.querySelector(`[data-show-place="${place.id}"] [data-menu-distance]`));
    assert.equal(place.number, undefined, 'Places are not numbered itinerary stops');
    assert.ok(place.pinLabel);
    assert.ok(place.icon);
    assert.ok(['walks', 'bled', 'hiking', 'trips', 'food', 'rainy'].includes(place.context));
    assert.ok(place.contextLabel);
    assert.ok(place.sourceUrl.startsWith('https://www.openstreetmap.org/'));
    const card = cards.find((card) => card.dataset.card === place.id);
    assert.ok(card);
    if (place.loop) {
      assert.equal(card.querySelector('.place-directions'), null, 'Loops have no Google directions');
      continue;
    }
    const url = new URL(card.querySelector('.place-directions').href);
    assert.equal(url.hostname, 'www.google.com');
    if (place.line) {
      assert.equal(url.pathname, '/maps/dir/');
      assert.equal(url.searchParams.get('destination'), place.coordinates.join(','));
    } else {
      assert.equal(url.pathname, '/maps/search/');
      assert.ok(url.searchParams.get('query'));
    }
    assert.equal(card.querySelector('.place-directions').target, '_blank');
  }
  const walks = config.places.filter((place) => place.line);
  assert.deepEqual(walks.map((walk) => walk.id), ['walk-lake', 'walk-market', 'walk-short', 'walk-long', 'walk-sava']);
  for (const walk of walks) {
    assert.ok(walk.line.length > 5 && walk.line.flat().every(Number.isFinite));
    assert.deepEqual(walk.line[0], [46.369265, 14.115167], 'Walks start on Grič outside the apartment');
    assert.ok(['green', 'blue', 'red'].includes(walk.color));
    assert.ok(document.querySelector(`.map-legend [data-show-place="${walk.id}"][data-walk-color="${walk.color}"]`));
  }
  assert.ok(walks.find((walk) => walk.id === 'walk-long').distanceMeters > walks.find((walk) => walk.id === 'walk-short').distanceMeters);
  assert.equal(config.landmarks.length, 10);
  assert.equal(document.querySelectorAll('[data-fallback-distance]').length, 36, 'Distances also work without JavaScript');
  assert.equal(config.places.find((place) => place.id === 'union').distanceLabel, '≈ 180 m');
  for (const id of ['day-trips', 'more-tips', 'good-to-know']) assert.ok(document.querySelector(`details#${id}[open] .map-place-grid article`), `${id} notes render without JS`);
  assert.ok(stay.querySelector('a[href="tel:+38641710747"]') && stay.querySelector('a[href="tel:+38670851277"]'), 'Taxi numbers');
  const gorge = config.places.find((place) => place.id === 'vintgar');
  assert.ok(gorge.distanceMeters > 3000 && gorge.distanceMeters < 4000);
  assert.ok(gorge.distanceLabel.includes(locale === 'sl' ? ',' : '.'));
  console.log(`${locale}: static guest guide, map data, and distances passed`);
}
