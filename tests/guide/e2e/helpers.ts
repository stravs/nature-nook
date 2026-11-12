import { expect, type Page } from '@playwright/test';

export async function pickCategory(page: Page, name: string) {
  const button = page.locator('#filters').getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

// Phones open Recommendations as a list; the floating toggle shows the map.
export async function showMap(page: Page, waitForMap = true) {
  await expect(page.locator('#guide')).toHaveAttribute('data-enhanced', 'true');
  const toggle = page.locator('#mode-toggle');
  if (await toggle.isVisible() && await page.locator('#map-view').getAttribute('data-mode') === 'list') await toggle.click();
  if (waitForMap) await expect(page.locator('.leaflet-container')).toBeVisible();
}

export async function showList(page: Page) {
  const toggle = page.locator('#mode-toggle');
  if (await toggle.isVisible() && await page.locator('#map-view').getAttribute('data-mode') === 'map') await toggle.click();
  await expect(page.locator('#place-cards')).toBeVisible();
}

export const visibleCards = (page: Page) => page.locator('#place-cards [data-group]:not([hidden]) [data-card]');
