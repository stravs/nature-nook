import { test, expect } from '@playwright/test';
import { showLayers } from './layers';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
test.beforeEach(async ({ context }) => {
  await context.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
});

test('recommendation layers toggle independently, including all hidden, and survive reload', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  await expect(page.locator('#filters button')).toHaveText(['Food & drinks', 'Hiking', 'Day trips', 'Rainy day']);
  // First visit shows food & drinks only, listed first.
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveText(['Food & drinks']);
  await expect(page.locator('#mobile-place-choices button:not([hidden])')).toHaveCount(9);
  await showLayers(page, ['Hiking', 'Food & drinks']);
  await expect(page.locator('#mobile-place-choices button:not([hidden])')).toHaveCount(20);
  await expect(page.locator('#map-canvas button[aria-label="Straža Hill"]')).toBeAttached();
  await expect(page.locator('#map-canvas button[aria-label="Pizzeria Rustika"]')).toBeAttached();
  await expect(page.locator('#mobile-place-choices button:not([hidden])').first()).toHaveAttribute('data-category', 'food-drinks');
  await page.getByRole('button', { name: 'Hiking', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Food & drinks', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#map-canvas button[aria-label="Straža Hill"]')).toHaveCount(0);
  await expect(page.locator('#mobile-place-choices button:not([hidden])')).toHaveCount(9);
  await showLayers(page, []);
  await expect(page.locator('#map-canvas [data-pin-ids]')).toHaveCount(1);
  await expect(page.locator('.leaflet-home-marker-pane button')).toBeAttached();
  await expect(page.locator('#mobile-place-options')).toBeHidden();
  await page.reload();
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#map-canvas [data-pin-ids]')).toHaveCount(1);
});

test('hiding a selected layer closes its details and search can reveal that layer again', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=food-drinks%2Frustika');
  await expect(page.locator('#places-drawer')).toBeVisible();
  await page.getByRole('button', { name: 'Food & drinks', exact: true }).click();
  await expect(page.locator('#places-drawer')).toBeHidden();
  await expect(page.locator('#map-canvas button[aria-label="Pizzeria Rustika"]')).toHaveCount(0);
  await page.locator('#search-toggle').click();
  await page.locator('#search-query').fill('pizza');
  await page.locator('#search-results').getByRole('link', { name: 'Pizzeria Rustika', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Food & drinks', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#places-title')).toHaveText('Pizzeria Rustika');
  await expect(page.locator('#map-canvas button[aria-label="Pizzeria Rustika"]')).toHaveAttribute('aria-pressed', 'true');
});

test('day trips show one pin each, no overview lines, and coexist with hiking', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  await showLayers(page, ['Hiking', 'Day trips']);
  for (const title of ['Bohinj Valley', 'Radovna and Krma Valleys', 'Mojstrana and Vrata Valley', 'Around the National Park']) {
    await expect(page.locator(`#map-canvas button[aria-label="${title}"]`)).toHaveCount(1);
  }
  await expect(page.locator('.trip-route-drive, .trip-route-train')).toHaveCount(0);
  await expect(page.locator('#map-canvas button[aria-label="Straža Hill"]')).toBeAttached();
  await page.getByRole('button', { name: 'Day trips', exact: true }).click();
  await expect(page.locator('#map-canvas button[aria-label="Bohinj Valley"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hiking', exact: true }).click();
  await expect(page.locator('#map-canvas [data-pin-ids]')).toHaveCount(1);
});
