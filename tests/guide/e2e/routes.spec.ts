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

test('trip pins sit at Bovec and route end points; selecting one draws its route', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  await showLayers(page, ['Day trips']);
  await expect(page.locator('[data-pin-ids]')).toHaveCount(5); // Home + four trips.
  await expect(page.locator('.trip-route-drive')).toHaveCount(0);
  const places = JSON.parse((await page.locator('#guide').getAttribute('data-places'))!);
  const pin = (id: string) => places.find((place: { id: string }) => place.id === `day-trips/${id}`).coordinates;
  expect(pin('around-the-national-park')).toEqual([46.337835, 13.552123]); // Bovec
  expect(pin('mojstrana-vrata-valley')).toEqual([46.409318, 13.843388]);
  await page.locator('#map-canvas button[aria-label="Bohinj Valley"]').dispatchEvent('click');
  await expect(page.locator('.trip-route-drive')).toHaveCount(1);
  await expect(page.locator('[data-place-details="day-trips/bohinj-valley"]')).toHaveAttribute('open', '');
});

test('a trip lists and pins hiking and food places on the way, whatever the layers', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=day-trips%2Fmojstrana-vrata-valley');
  await expect(page.locator('.trip-route-drive')).toHaveCount(1);
  const nearby = page.locator('#route-nearby');
  await expect(nearby).toBeVisible();
  await expect(nearby.locator('button')).toHaveText(['Vrata Valley', 'Peričnik Waterfall']);
  await expect(page.getByRole('button', { name: 'Hiking', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#map-canvas button[aria-label="Peričnik Waterfall"]')).toBeAttached();
  // Bled places are home, not on the way.
  await expect(nearby).not.toContainText('Pizzeria Rustika');
  await page.locator('#close-places').click();
  await expect(nearby).toBeHidden();
  await expect(page.locator('#map-canvas button[aria-label="Peričnik Waterfall"]')).toHaveCount(0);
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
