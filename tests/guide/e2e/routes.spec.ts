import { test, expect } from '@playwright/test';
import { showLayers } from './layers';

const tripUrl = '/stay-k7m4?view=map&place=day-trips%2Faround-the-national-park';
const routeUrl = '**/routes/around-the-national-park.geojson';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
test.beforeEach(async ({ context }) => {
  await context.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
});

test('trip loads its saved roads and schematic train, then clears on close or another selection', async ({ page }) => {
  let requests = 0;
  page.on('request', request => { if (request.url().endsWith('.geojson')) requests++; });
  await page.goto('/stay-k7m4');
  await expect(page.locator('#guide')).toHaveAttribute('data-enhanced', 'true');
  expect(requests).toBe(0);
  await page.goto(tripUrl);
  await expect(page.locator('.trip-route-drive')).toHaveCount(2);
  await expect(page.locator('.trip-route-train')).toHaveCount(1);
  await expect(page.locator('#selected-card')).toHaveCount(0);
  await expect(page.locator('#place-list > li:not([hidden])')).toHaveCount(1);
  await expect(page.locator('[data-place-details="day-trips/around-the-national-park"]')).toHaveAttribute('open', '');
  await expect(page.locator('#places-drawer')).toContainText('Most na Soči has a car train');
  await expect(page.locator('#selected-route-status')).toContainText('schematic car-train');
  await expect(page.locator('#selected-directions')).toBeHidden();
  await expect(page.locator('#map-credits')).toBeVisible();
  // The full loop is fitted, rather than zooming into the Vršič destination pin.
  const zoom = await page.evaluate(() => JSON.parse(sessionStorage.getItem('nature-nook-guide-v2')!).position.zoom);
  expect(zoom).toBeLessThan(12);
  await page.locator('#close-places').click();
  await expect(page.locator('.trip-route-drive, .trip-route-train')).toHaveCount(0);
  await page.goto(tripUrl);
  await expect(page.locator('.trip-route-drive')).toHaveCount(2);
  // Marker remains selectable on desktop; navigation exercises the same selection on mobile.
  await page.locator('#close-places').click();
  await page.locator('#map-home').click();
  await expect(page.locator('#selected-route-status')).toBeHidden();
  await expect(page.locator('#selected-card')).toBeHidden();
  await expect(page.locator('#places-drawer')).toBeHidden();
});

test('Day trips shows all four clickable paths instead of destination icons', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  for (const id of ['bohinj-valley', 'radovna-krma-valleys', 'mojstrana-vrata-valley', 'around-the-national-park']) {
    await showLayers(page, ['Day trips']);
    await expect(page.locator('#places-drawer')).toBeHidden();
    await expect(page.locator('.day-trip-overview')).toHaveCount(6);
    await expect(page.locator('#routes-overview-choices button')).toHaveCount(4);
    await expect(page.locator('[data-pin-ids]')).toHaveCount(1); // Home only.
    await expect(page.locator('#map-canvas')).toHaveJSProperty('inert', false);
    await page.locator(`.day-trip-overview[data-trip-id="day-trips/${id}"]`).first().dispatchEvent('click');
    await expect(page.locator('.day-trip-overview')).toHaveCount(6);
    await expect(page.locator('.trip-route-drive')).toHaveCount(id === 'around-the-national-park' ? 2 : 1);
    await page.locator('#close-places').click();
    await expect(page.locator('.day-trip-overview')).toHaveCount(6);
  }
  await page.locator('[data-mobile-place="day-trips/bohinj-valley"]').click();
  await expect(page.locator('[data-place-details="day-trips/bohinj-valley"]')).toHaveAttribute('open', '');
  await page.locator('#close-places').click();
  await showLayers(page, ['Hiking']);
  await expect(page.locator('.day-trip-overview')).toHaveCount(0);
  await expect(page.locator('#routes-overview')).toBeHidden();
});

for (const [id, title, stops] of [
  ['bohinj-valley', 'Bohinj Valley', 8],
  ['radovna-krma-valleys', 'Radovna and Krma Valleys', 5],
  ['mojstrana-vrata-valley', 'Mojstrana and Vrata Valley', 4],
] as const) {
  test(`${title} draws roads and stops without a train legend`, async ({ page }) => {
    await page.goto(`/stay-k7m4?view=map&place=day-trips%2F${id}`);
    await expect(page.locator('#places-drawer details[open] [data-place-title]')).toHaveText(title);
    await expect(page.locator('.trip-route-drive')).toHaveCount(1);
    await expect(page.locator('.trip-route-stop')).toHaveCount(stops);
    await expect(page.locator('.trip-route-train')).toHaveCount(0);
    await expect(page.locator('#selected-route-status')).toContainText('suggested driving route');
    await expect(page.locator('#selected-route-status')).not.toContainText('car-train');
    await expect(page.locator('#selected-directions')).toBeHidden();
    await page.locator('#close-places').click();
    await expect(page.locator('.trip-route-drive, .trip-route-stop')).toHaveCount(0);
  });
}

test('overview keeps working when one route fails and cancels when category changes', async ({ page }) => {
  await page.route('**/routes/bohinj-valley.geojson', route => route.fulfill({ status: 404, body: 'Missing' }));
  await page.goto('/stay-k7m4?view=map');
  await showLayers(page, ['Day trips']);
  await expect(page.locator('#routes-overview-status')).toContainText('Some routes could not load');
  await expect(page.locator('#routes-overview-choices button')).toHaveCount(3);
  await expect(page.locator('.day-trip-overview')).toHaveCount(5);
  await showLayers(page, ['Hiking']);
  await expect(page.locator('.day-trip-overview')).toHaveCount(0);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/routes/*.geojson', async route => {
    await gate;
    try { await route.continue(); } catch { /* Category switch aborts requests. */ }
  });
  await showLayers(page, ['Day trips']);
  await expect(page.locator('#routes-overview-status')).toHaveText('Loading route…');
  await showLayers(page, ['Hiking']);
  release();
  await expect(page.locator('#routes-overview')).toBeHidden();
  await expect(page.locator('.day-trip-overview')).toHaveCount(0);
});

test('a missing route leaves a usable pin and details', async ({ page }) => {
  await page.route(routeUrl, route => route.fulfill({ status: 404, body: 'Missing' }));
  await page.goto(tripUrl);
  await expect(page.locator('#selected-route-status')).toContainText('Route unavailable');
  await expect(page.locator('#places-drawer details[open] [data-place-title]')).toHaveText('Around the National Park');
  await expect(page.locator('#places-drawer details[open]')).toBeVisible();
  await expect(page.locator('.trip-route-drive, .trip-route-train')).toHaveCount(0);
});

test('closing while a route is loading prevents stale geometry', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(routeUrl, async route => {
    await gate;
    try { await route.continue(); } catch { /* Request may already be aborted. */ }
  });
  await page.goto(tripUrl);
  await expect(page.locator('#selected-route-status')).toHaveText('Loading route…');
  await page.locator('#close-places').click();
  release();
  await expect(page.locator('#selected-route-status')).toBeHidden();
  await expect(page.locator('.trip-route-drive, .trip-route-train')).toHaveCount(0);
  await expect(page.locator('#selected-card')).toBeHidden();
});
