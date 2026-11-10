import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { showLayers } from './layers';
const storageKey = 'nature-nook-guide-v2';
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('link', { name, exact: true });
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search the guide', exact: true });
async function fillSearch(page: Page, value: string) {
  if (await page.locator('#search-toggle').isVisible()) await page.locator('#search-toggle').click();
  await search(page).fill(value);
}
const state = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? '{}'), storageKey);
// Overlapping geographic pins have equivalent, full-size controls in the Places list.
// Apply WCAG's equivalent-target exception only to marker target-size findings.
function accessibilityViolations(audit: Awaited<ReturnType<AxeBuilder['analyze']>>) {
  return audit.violations.map(violation => violation.id !== 'target-size' ? violation : {
    ...violation, nodes: violation.nodes.filter(node => !node.html.includes('data-pin-ids=')),
  }).filter(violation => violation.nodes.length);
}
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

test.beforeEach(async ({ context }) => {
  // Never automate against the public map service.
  await context.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: pixel, headers: { 'cache-control': 'public, max-age=604800' } }));
});
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('Apartment entry has header search, image, compact essentials and four sections', async ({ page }) => {
  let mapRequests = 0;
  page.on('request', req => { if (req.url().includes('tile.openstreetmap.org') || /\/_astro\/map\..*\.js/.test(req.url())) mapRequests++; });
  await page.goto('/stay-k7m4');
  await expect(page.locator('#guide')).toHaveAttribute('data-enhanced', 'true');
  await expect(nav(page, 'Apartment')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(['Apartment', 'Recommendations']);
  await expect(page.locator('header #search-toggle')).toBeVisible();
  await expect(search(page)).toBeHidden();
  await expect(page.locator('#search-query')).toHaveAttribute('placeholder', 'What do you need?');
  await expect(page.locator('#stay img')).toHaveCount(1);
  await expect(page.locator('#wifi')).toBeVisible();
  await expect(page.locator('#departure')).toBeVisible();
  await expect(page.locator('#stay [data-topic] > summary')).toHaveText(['Arrival & parking+', 'Equipment & appliances+', 'House rules+', 'Help & safety+']);
  await expect(page.locator('#stay')).toContainText('06:00–10:00');
  expect(mapRequests).toBe(0);
  const wifi = (await page.locator('#wifi').boundingBox())!;
  const checkout = (await page.locator('#departure').boundingBox())!;
  expect(wifi.y).toBe(checkout.y);
  for (const a of await page.getByRole('navigation').getByRole('link').all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await noOverflow(page);
});

test('header search expands, clears and collapses with Escape or tab changes', async ({ page }) => {
  await page.goto('/stay-k7m4');
  await fillSearch(page, 'pizza');
  await expect(page.locator('#search-results')).toContainText('Pizzeria Rustika');
  await search(page).press('Escape');
  await expect(search(page)).toBeHidden();
  await expect(page.locator('#search-toggle')).toBeFocused();
  await fillSearch(page, 'heating');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(search(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
  await nav(page, 'Recommendations').click();
  await expect(search(page)).toBeHidden();
  await expect(page.locator('#search-toggle')).toBeVisible();
});

test('appliance instructions and location are searchable and open their accordion', async ({ page }) => {
  await page.goto('/stay-k7m4');
  await fillSearch(page, 'washing machine');
  await expect(page.locator('#search-results')).toContainText('Availability and location are not confirmed.');
  await page.locator('#search-results a[data-topic="washing-machine"]').click();
  await expect(page.locator('[data-topic="appliances"]')).toHaveAttribute('open', '');
  await expect(page.locator('#washing-machine')).toBeFocused();
  await expect(page.locator('#washing-machine')).toBeInViewport();
});

test('Wi-Fi card copies the displayed demo password with readable feedback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value: string) => { document.body.dataset.copied = value; },
    } });
  });
  await page.goto('/stay-k7m4');
  await page.getByRole('button', { name: 'Copy · Password', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-copied', 'Fern!72Pebble');
  await expect(page.locator('#copy-status')).toHaveText('Copied');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: () => Promise.reject(new Error('blocked')),
    } });
  });
  await page.getByRole('button', { name: 'Copy · Password', exact: true }).click();
  await expect(page.locator('#copy-status')).toContainText('Select and copy');
});

test('host message action reveals the preferred contact instructions', async ({ page }) => {
  await page.goto('/stay-k7m4');
  await page.locator('#contact').locator('..').getByText('Message your host', { exact: true }).click();
  await expect(page.locator('#contact').locator('..')).toContainText('Open your reservation');
  await expect(page.locator('#contact').locator('..')).toContainText('Preferred contact:');
});

test('instant direct answers and natural phrases work from either tab', async ({ page }) => {
  await page.goto('/stay-k7m4');
  await fillSearch(page, 'what is the wifi password');
  await expect(page.locator('#search-results')).toContainText('Fern!72Pebble');
  await expect(page.locator('#search-results [data-copy]')).toHaveCount(1);
  await expect(search(page)).toBeFocused();
  await fillSearch(page, 'when do we check-out');
  await expect(page.locator('#search-results')).toContainText('06:00–10:00');
  await search(page).press('Enter');
  await expect(page.locator('#search-results')).toContainText('06:00–10:00');
  await nav(page, 'Recommendations').click();
  await expect(page.locator('#search-toggle')).toBeVisible();
  await fillSearch(page, 'where can we eat pizza');
  await expect(page.locator('#search-results')).toContainText('Pizzeria Rustika');
  await fillSearch(page, 'straza');
  await expect(page.locator('#search-results')).toContainText('Straža Hill');
  await fillSearch(page, 'rain');
  await expect(page.locator('#search-results')).toContainText('Postojna Cave');
});

test('copy direct answers and a blocked clipboard have readable feedback', async ({ page }) => {
  // Override the demo direct answer with a separate synthetic clipboard fixture.
  const fixture = 'TEST-ONLY-NOT-A-REAL-PASSWORD';
  await page.route('http://127.0.0.1:8801/stay-k7m4', async route => {
    const response = await route.fetch();
    let html = await response.text();
    const encoded = html.match(/data-documents="([^"]+)"/)![1]!;
    const decoded = encoded.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const docs = JSON.parse(decoded);
    const wifi = docs.find((doc: { id: string }) => doc.id === 'wifi');
    wifi.copy = fixture; wifi.answer = fixture;
    const replacement = JSON.stringify(docs).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(encoded, replacement);
    await route.fulfill({ response, body: html });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { document.body.dataset.copied = value; } } });
  });
  await page.goto('/stay-k7m4');
  await fillSearch(page, 'wifi password');
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.locator('#copy-status')).toHaveText('Copied');
  await expect(page.locator('body')).toHaveAttribute('data-copied', fixture);
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('blocked')) } }); });
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.locator('#copy-status')).toContainText('Select and copy');
});

test('expandable topics, focused search destination, direct links and Back', async ({ page }) => {
  await page.goto('/stay-k7m4');
  await page.locator('#arrival-parking').click();
  await expect(page.locator('[data-topic="arrival-parking"]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-topic="arrival-parking"]')).toContainText('13:00–23:30');
  await fillSearch(page, 'where can I park');
  await page.locator('#search-results').getByRole('link', { name: 'Parking', exact: true }).click();
  await expect(page.locator('#parking')).toBeFocused();
  await expect(page.locator('[data-topic="arrival-parking"]')).toHaveAttribute('open', '');
  await expect(page.locator('#parking')).toBeInViewport();
  await page.goBack();
  await expect(search(page)).toHaveValue('where can I park');
  await page.goto('/stay-k7m4?view=stay#contact');
  await expect(page.locator('#contact')).toBeFocused();
});

test('safe no-results, whitespace and clear keep keyboard focus', async ({ page }) => {
  await page.goto('/stay-k7m4');
  await fillSearch(page, '<img src=x onerror=alert(1)> [.*');
  await expect(page.locator('#search-count')).toHaveText('Results: 0');
  await expect(page.locator('#search-results')).toContainText('No matches');
  await expect(page.locator('#search-results img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(search(page)).toBeFocused();
  await expect(page.locator('#stay')).toBeVisible();
  await fillSearch(page, '   ');
  await expect(page.locator('#search-output')).toBeHidden();
});

test('Leaflet loads lazily, filters and markers work with a directions card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/stay-k7m4');
  await nav(page, 'Recommendations').click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('#map-feedback')).toBeHidden();
  await expect(page.getByRole('group', { name: 'Visible recommendation layers' }).getByRole('button')).toHaveText(['Hiking', 'Day trips', 'Food & drinks', 'Rainy day']);
  for (const [layer, count] of Object.entries({ Hiking: 11, 'Day trips': 4, 'Food & drinks': 9, 'Rainy day': 5 })) {
    await showLayers(page, [layer]);
    await expect(page.locator('#place-list > li:not([hidden])')).toHaveCount(count);
  }
  await showLayers(page, ['Food & drinks']);
  const pins = await page.locator('[data-pin-ids]').evaluateAll(elements => elements.map(el => JSON.parse((el as HTMLElement).dataset.pinIds!)));
  expect(pins.every(ids => ids.length === 1)).toBe(true);
  expect(pins.flat()).toContain('home');
  const homePane = page.locator('.leaflet-home-marker-pane');
  expect(await homePane.evaluate(el => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(
    await page.locator('.leaflet-marker-pane').evaluate(el => Number(getComputedStyle(el).zIndex)),
  );
  await homePane.locator('button').click();
  await expect(page.locator('#selected-card')).toBeHidden();
  await fillSearch(page, 'pizza');
  await page.locator('#search-results').getByRole('link', { name: 'Pizzeria Rustika', exact: true }).click();
  const details = page.locator('[data-place-details="food-drinks/rustika"]');
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('a[href*="destination="]')).toHaveAttribute('href', /destination=46\.3712844,14\.1042756/);
  await page.locator('#close-places').click();
  await expect(page.locator('#selected-card')).toBeHidden();
  expect(errors).toEqual([]);
});

test('fullscreen map and drawers retain controls, focus and attribution', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  const main = await page.locator('#main-content').boundingBox();
  const map = await page.locator('#map-canvas').boundingBox();
  const menu = await page.getByRole('navigation').boundingBox();
  expect(map!.width).toBeCloseTo(page.viewportSize()!.width, 0);
  await expect(page.locator('#places-drawer')).toBeHidden();
  expect(map!.height).toBeGreaterThanOrEqual(main!.height - 49);
  const contentBottom = page.viewportSize()!.width >= 1024 ? page.viewportSize()!.height : menu!.y;
  expect(Math.abs(main!.y + main!.height - contentBottom)).toBeLessThanOrEqual(2);
  await fillSearch(page, 'pizza');
  await page.locator('#search-results').getByRole('link', { name: 'Pizzeria Rustika', exact: true }).click();
  await expect(page.locator('#places-title')).toBeFocused();
  await expect(page.locator('#map-canvas')).toHaveJSProperty('inert', false);
  await expect(page.locator('#map-credits')).toBeVisible();
  let audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibilityViolations(audit)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#places-drawer')).toBeHidden();
  await expect(page.locator('#map-home')).toBeFocused();
  const after = (await state(page)).position;
  expect(after.zoom).toBeGreaterThanOrEqual(14);
  await page.locator('#map-home').click();
  await expect(page.locator('#map-home')).toBeFocused();
  await expect(page.locator('#selected-card')).toBeHidden();
  audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibilityViolations(audit)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#selected-card')).toBeHidden();
  await expect(page.locator('#map-home')).toBeFocused();
  await expect(page.locator('#map-canvas')).toHaveJSProperty('inert', false);
});

test('mobile category options swipe horizontally and open details with map focus', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, 'Mobile options');
  await page.goto('/stay-k7m4?view=map');
  const options = page.locator('#mobile-place-options');
  const choices = page.locator('#mobile-place-choices');
  await showLayers(page, ['Hiking']);
  await expect(options).toBeVisible();
  await expect(choices.locator('button:not([hidden])')).toHaveCount(11);
  expect(await choices.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await choices.evaluate(el => { el.scrollLeft = 200; });
  expect(await choices.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await page.locator('[data-mobile-place="hiking/straza"]').click();
  await expect(page.locator('[data-place-details="hiking/straza"]')).toHaveAttribute('open', '');
  await expect(options).toBeHidden();
  await expect.poll(async () => (await state(page)).selectedId).toBe('hiking/straza');
  await expect.poll(async () => {
    const pin = (await page.locator('#map-canvas button[aria-label="Straža Hill"]').boundingBox())!;
    const canvas = (await page.locator('#map-canvas').boundingBox())!;
    const toolbar = (await page.locator('#map-toolbar').boundingBox())!;
    const drawer = (await page.locator('#places-drawer').boundingBox())!;
    const visibleTop = Math.max(canvas.y + 24, toolbar.y + toolbar.height + 16);
    const visibleBottom = Math.min(canvas.y + canvas.height - 24, drawer.y - 16);
    return Math.abs(pin.y + pin.height / 2 - (visibleTop + visibleBottom) / 2);
  }).toBeLessThan(3);
  await page.locator('#close-places').click();
  await expect(options).toBeVisible();
  await showLayers(page, ['Day trips']);
  await expect(choices.locator('button:not([hidden])')).toHaveCount(4);
  await page.locator('[data-mobile-place="day-trips/bohinj-valley"]').click();
  await expect(page.locator('.trip-route-drive')).toHaveCount(1);
  await expect(page.locator('#places-title')).toHaveText('Bohinj Valley');
  await expect(page.locator('#place-list > li:not([hidden])')).toHaveCount(1);
  await expect(page.locator('#place-list > li:not([hidden]) summary')).toHaveText('Bohinj Valley');
  await expect(page.locator('#selected-card')).toBeHidden();
});

test('desktop title buttons fit their text on the left and open a details drawer', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, 'Desktop drawer');
  await page.goto('/stay-k7m4?view=map');
  const drawer = page.locator('#places-drawer');
  await expect(drawer).toBeHidden();
  const options = page.locator('#mobile-place-options');
  await showLayers(page, ['Hiking']);
  await expect(options).toBeVisible();
  const bounds = (await options.boundingBox())!;
  expect(bounds.x).toBe(16);
  const buttons = page.locator('#mobile-place-choices button:not([hidden])');
  const firstButton = (await buttons.nth(0).boundingBox())!;
  const secondButton = (await buttons.nth(1).boundingBox())!;
  expect(firstButton.width).toBeLessThan(secondButton.width);
  expect(firstButton.width).toBeLessThan(bounds.width);
  for (const [category, count] of [['Hiking', 11], ['Day trips', 4], ['Food & drinks', 9], ['Rainy day', 5]] as const) {
    if (await drawer.isVisible()) await page.locator('#close-places').click();
    await showLayers(page, [category]);
    await expect(drawer).toBeHidden();
    await expect(options).toBeVisible();
    await expect(page.locator('#mobile-place-choices button:not([hidden])')).toHaveCount(count);
    await expect(page.locator('#places-title')).toHaveText('Host recommendations');
    await expect(page.locator('#place-list > li:not([hidden])')).toHaveCount(count);
    const row = page.locator('#place-list > li:not([hidden])').first();
    await expect(row.locator('details > div')).toBeHidden();
    await expect(page.locator('[data-show-place]')).toHaveCount(0);
    await page.locator('#mobile-place-choices button:not([hidden])').first().click();
    await expect(page.locator('#place-list > li:not([hidden])')).toHaveCount(1);
    await expect(page.locator('#places-title')).toHaveText((await row.locator('[data-place-title]').textContent())!);
    await expect(row.locator('details > div')).toBeVisible();
    await expect(row.locator('details > div p').first()).toBeVisible();
    await expect.poll(async () => (await state(page)).selectedId).toBe(await row.getAttribute('data-place-id'));
    await expect(page.locator('#selected-card')).toBeHidden();
    await expect(drawer).toBeVisible();
    const detailsBounds = (await drawer.boundingBox())!;
    expect(detailsBounds.x + detailsBounds.width).toBeCloseTo(page.viewportSize()!.width, 0);
    if (category === 'Hiking') await expect.poll(async () => (await state(page)).position.zoom).toBeGreaterThanOrEqual(14);
    if (category === 'Day trips') await expect(page.locator('.trip-route-drive')).toHaveCount(1);
  }
});

test('Home is an icon-only map control above zoom', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  await showLayers(page, ['Hiking']);
  const home = page.getByRole('button', { name: 'Home pin', exact: true });
  await expect(home).toBeVisible();
  await expect(home).toHaveText('');
  await expect(page.locator('#map-toolbar #map-home')).toHaveCount(0);
  const homeBox = (await home.boundingBox())!;
  const zoomBox = (await page.locator('.leaflet-control-zoom').boundingBox())!;
  expect(homeBox.y + homeBox.height).toBeLessThanOrEqual(zoomBox.y);
  expect(homeBox.x + homeBox.width).toBeCloseTo(zoomBox.x + zoomBox.width, 0);
  if (page.viewportSize()!.width < 1024) {
    const tiles = (await page.locator('#mobile-place-options').boundingBox())!;
    expect(zoomBox.y + zoomBox.height).toBeLessThanOrEqual(tiles.y);
  }
  await home.click();
  await expect(page.locator('#selected-card')).toBeHidden();
  await expect(page.locator('#places-drawer')).toBeHidden();
  await expect.poll(async () => (await state(page)).position.zoom).toBe(15);
  await expect(page.locator('.leaflet-home-marker-pane button')).toBeInViewport();
});

test('selected map icon uses home green and resets when switching or closing', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=hiking%2Fstraza');
  const selected = page.locator('#map-canvas button[aria-label="Straža Hill"]');
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await expect(selected).toHaveClass(/bg-forest ring-4/);
  const next = page.locator('#map-canvas button[aria-label="Ojstrica, Osojnica & Kozarca"]');
  await next.dispatchEvent('click');
  await expect(next).toHaveAttribute('aria-pressed', 'true');
  await expect(next).toHaveClass(/bg-forest ring-4/);
  await expect(selected).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#close-places').click();
  await expect(page.locator('#map-canvas button[aria-pressed="true"]')).toHaveCount(0);
});

test('an open place card leaves map panning and zooming enabled', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=hiking%2Fstraza');
  await expect(page.locator('#places-drawer details[open] [data-place-title]')).toHaveText('Straža Hill');
  await expect(page.locator('#map-canvas')).toHaveJSProperty('inert', false);
  const canvas = (await page.locator('#map-canvas').boundingBox())!;
  const card = (await page.locator('#places-drawer').boundingBox())!;
  const x = canvas.x + canvas.width / 4;
  const y = Math.min(canvas.y + 180, card.y > canvas.y ? card.y - 40 : canvas.y + 180);
  const before = (await state(page)).position;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 80, y + 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).position.center).not.toEqual(before.center);
  const zoom = (await state(page)).position.zoom;
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => (await state(page)).position.zoom).toBeGreaterThan(zoom);
  await expect(page.locator('#places-drawer')).toBeVisible();
});

test('search opens full place details inline without losing top search', async ({ page }) => {
  await page.goto('/stay-k7m4');
  await fillSearch(page, 'pizza');
  await page.locator('#search-results').getByRole('link', { name: 'Pizzeria Rustika', exact: true }).click();
  await expect(page.locator('[data-place-details="food-drinks/rustika"]')).toHaveAttribute('open', '');
  await expect(page.locator('#search-control')).toBeVisible();
  await expect(nav(page, 'Recommendations')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#places-title')).toBeFocused();
});

test('query/detail return, category and map state survive, search requests nothing', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=food-drinks%2Frustika');
  await expect(page.locator('#places-drawer details[open] [data-place-title]')).toHaveText('Pizzeria Rustika');
  await page.getByRole('button', { name: 'Close recommendations', exact: true }).click();
  await showLayers(page, ['Food & drinks']);
  await page.locator('[data-mobile-place="food-drinks/rustika"]').click();
  await page.waitForLoadState('networkidle');
  const before = await state(page);
  const requests: string[] = [];
  page.on('request', req => requests.push(req.url()));
  await fillSearch(page, 'rain');
  await expect(page.locator('#search-results')).toContainText('Postojna Cave');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  expect((await state(page)).layers).toEqual(['food-drinks']);
  expect((await state(page)).selectedId).toBe(before.selectedId);
  expect((await state(page)).position).toEqual(before.position);
  expect(requests).toEqual([]);
  await fillSearch(page, 'taxi');
  await page.goto('/stay-k7m4/places/useful-info/taxi');
  await page.getByRole('link', { name: 'Back to guide', exact: true }).click();
  await expect(search(page)).toHaveValue('taxi');
});

test('useful info lives in Apartment and search opens it there', async ({ page }) => {
  await page.goto('/stay-k7m4');
  await expect(page.getByRole('heading', { name: 'Useful info', exact: true })).toBeVisible();
  await expect(page.locator('#stay details[lang="en"]')).toHaveCount(6);
  await expect(page.locator('#place-list [data-place-id^="useful-info/"]')).toHaveCount(0);
  await fillSearch(page, 'taxi');
  await page.locator('#search-results a[data-topic="useful-info/taxi"]').click();
  await expect(nav(page, 'Apartment')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[id="useful-info/taxi"]')).toBeFocused();
  await expect(page.locator('#stay a[href="tel:+38641710747"]')).toBeVisible();
});

test('English/Slovenian switch preserves context and gives localized apartment answers', async ({ page }) => {
  await page.goto('/stay-k7m4?view=stay#arrival');
  await expect(page.locator('header #search-toggle')).toBeVisible();
  await expect(page.locator('header [data-language="sl"]')).toBeHidden();
  await page.locator('header summary').click();
  await page.getByRole('link', { name: 'SL', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'sl');
  await expect(page.locator('#arrival')).toBeFocused();
  await expect(page.locator('#arrival')).toHaveText('Prijava');
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(['Apartma', 'Priporočila']);
  await page.locator('#search-toggle').click();
  await page.getByRole('searchbox', { name: 'Iskanje po vodniku' }).fill('kdaj je odjava');
  await expect(page.locator('#search-results')).toContainText('06:00–10:00');
  await page.locator('header summary').click();
  await page.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('blocked map and storage leave global search and apartment usable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
  });
  await page.route('**/_astro/map.*.js', route => route.abort());
  await page.goto('/stay-k7m4?view=map');
  await expect(page.locator('#map-feedback')).toContainText('Map unavailable');
  await fillSearch(page, 'checkout');
  await expect(page.locator('#search-results')).toContainText('06:00–10:00');
  await nav(page, 'Apartment').click();
  await expect(page.locator('#wifi')).toBeVisible();
});

test('tile failure leaves drawers, attribution and search usable', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.goto('/stay-k7m4?view=map');
  await expect(page.locator('#map-feedback')).toContainText('Map unavailable');
  await fillSearch(page, 'pizza');
  await page.locator('#search-results').getByRole('link', { name: 'Pizzeria Rustika', exact: true }).click();
  await expect(page.locator('#places-title')).toBeFocused();
  await expect(page.locator('#place-list > li:not([hidden])')).toHaveCount(1);
  await expect(page.locator('#map-credits')).toContainText('© OpenStreetMap contributors');
  await fillSearch(page, 'checkout');
  await expect(page.locator('#search-results')).toContainText('06:00–10:00');
});

test('no JavaScript preserves native sections and all recommendations', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/stay-k7m4`);
  await expect(page.locator('#guide-search')).toBeHidden();
  await expect(page.locator('#filters')).toBeHidden();
  await expect(page.locator('#place-list > li')).toHaveCount(29);
  await page.locator('#arrival-parking').click();
  await expect(page.locator('[data-topic="arrival-parking"]')).toHaveAttribute('open', '');
  await expect(page.locator('#wifi')).toBeVisible();
  await nav(page, 'Recommendations').click();
  await expect(page.getByRole('heading', { name: 'Host recommendations', exact: true })).toBeInViewport();
  await noOverflow(page);
  await context.close();
});

test('320px, 200% text and reduced motion retain search and navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/stay-k7m4');
  for (const name of ['Apartment', 'Recommendations']) {
    await nav(page, name).click();
    await noOverflow(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await expect(page.locator('#search-control')).toBeVisible();
    await noOverflow(page);
    await fillSearch(page, 'pizza');
    await noOverflow(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
});

test('WCAG automated checks: apartment, map, search, no-results, Slovenian and detail', async ({ page }) => {
  for (const url of ['/stay-k7m4', '/stay-k7m4?view=map', '/stay-k7m4/sl', '/stay-k7m4/places/hiking/triglav']) {
    await page.goto(url);
    if (url === '/stay-k7m4?view=map') await expect(page.locator('.leaflet-container')).toBeVisible();
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(accessibilityViolations(audit), url).toEqual([]);
  }
  await page.goto('/stay-k7m4');
  for (const query of ['parking', 'nothing matches abcdef']) {
    await fillSearch(page, query);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(accessibilityViolations(audit), query).toEqual([]);
  }
});

test('Cloudflare Worker runtime: real 404, headers and detail routes', async ({ request }) => {
  const home = await request.get('/stay-k7m4');
  expect(home.status()).toBe(200);
  expect(home.headers()['content-security-policy']).toContain("worker-src 'none'");
  expect(home.headers()['x-robots-tag']).toBe('noindex, follow');
  const missing = await request.get('/not-a-real-page/');
  expect(missing.status()).toBe(404);
  const sl = await request.get('/stay-k7m4/sl');
  expect(await sl.text()).toContain('<html lang="sl">');
  for (const id of ['hiking/straza', 'food-drinks/rustika', 'useful-info/taxi']) expect((await request.get(`/stay-k7m4/places/${id}`)).status()).toBe(200);
});
