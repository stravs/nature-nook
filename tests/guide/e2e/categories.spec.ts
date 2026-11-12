import { test, expect } from '@playwright/test';
import { pickCategory, showMap, visibleCards } from './helpers';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
test.beforeEach(async ({ context }) => {
  await context.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
});

test('one category at a time, nearest first, matching pins, and it survives reload', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  await expect(page.locator('#filters button')).toHaveText(['All', 'From the door', 'Food & drinks', 'Hiking', 'Day trips', 'Rainy day']);
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveText(['All']);
  await expect(visibleCards(page)).toHaveCount(34);
  await expect(page.locator('#place-cards [data-group]:not([hidden]) h3')).toHaveText(['From the door', 'Food & drinks', 'Hiking', 'Day trips', 'Rainy day']);
  await pickCategory(page, 'Food & drinks');
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveText(['Food & drinks']);
  await expect(visibleCards(page)).toHaveCount(9);
  await expect(visibleCards(page).first()).toContainText('Gostilna Union');
  await expect(visibleCards(page).first()).toContainText('200 m away');
  await showMap(page);
  await expect(page.locator('#map-canvas [data-pin-ids]')).toHaveCount(10); // Home + nine.
  await expect(page.locator('#map-canvas button[aria-label="Straža Hill"]')).toHaveCount(0);
  await pickCategory(page, 'Hiking');
  await expect(page.locator('#map-canvas button[aria-label="Straža Hill"]')).toBeAttached();
  await expect(page.locator('#map-canvas button[aria-label="Pizzeria Rustika"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveText(['Hiking']);
  await expect(visibleCards(page)).toHaveCount(11);
});

test('switching away from a selected place closes its details and search can reopen it', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=food-drinks%2Frustika');
  await expect(page.locator('#places-drawer')).toBeVisible();
  await pickCategory(page, 'Hiking');
  await expect(page.locator('#places-drawer')).toBeHidden();
  await expect(page.locator('#map-canvas button[aria-label="Pizzeria Rustika"]')).toHaveCount(0);
  await page.locator('#search-toggle').click();
  await page.locator('#search-query').fill('pizza');
  await page.locator('#search-results').getByRole('link', { name: 'Pizzeria Rustika', exact: true }).click();
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveText(['Food & drinks']);
  await expect(page.locator('#places-title')).toHaveText('Pizzeria Rustika');
  await expect(page.locator('#map-canvas button[aria-label="Pizzeria Rustika"]')).toHaveAttribute('aria-pressed', 'true');
});

test('day trips show one pin each and no lines until one is chosen', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  await pickCategory(page, 'Day trips');
  await showMap(page);
  for (const title of ['Bohinj Valley', 'Radovna and Krma Valleys', 'Mojstrana and Vrata Valley', 'Around the National Park']) {
    await expect(page.locator(`#map-canvas button[aria-label="${title}"]`)).toHaveCount(1);
  }
  await expect(page.locator('#map-canvas [data-pin-ids]')).toHaveCount(5);
  await expect(page.locator('.trip-route-drive, .trip-route-train')).toHaveCount(0);
});

test('walks from the door draw the host’s dotted path', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=walks%2Flake');
  await expect(page.locator('.trip-route-walk')).toHaveCount(1);
  await expect(page.locator('#selected-route-status')).toContainText('hand-drawn');
  await expect(page.locator('#route-nearby')).toBeHidden();
  await expect(page.locator('#places-drawer article:not([hidden]) [data-place-facts]')).toContainText('From the door');
  await page.goto('/stay-k7m4?view=map&place=walks%2Fsava');
  await expect(page.locator('.trip-route-bike')).toHaveCount(1);
});
