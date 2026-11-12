import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pickCategory, showMap, showList, visibleCards } from './helpers';
const storageKey = 'nature-nook-guide-v3';
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
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(['Apartment', 'Places']);
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
  await nav(page, 'Places').click();
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
  await nav(page, 'Places').click();
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

test('Leaflet loads lazily, categories and markers work with a directions button', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/stay-k7m4');
  await nav(page, 'Places').click();
  await showMap(page);
  await expect(page.locator('#map-feedback')).toBeHidden();
  await expect(page.getByRole('group', { name: 'Filter recommendations' }).getByRole('button')).toHaveText(['All', 'From the door', 'Food & drinks', 'Hiking', 'Day trips', 'Rainy day']);
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveText(['All']);
  for (const [category, count] of Object.entries({ 'From the door': 5, Hiking: 11, 'Day trips': 4, 'Food & drinks': 9, 'Rainy day': 5 })) {
    await pickCategory(page, category);
    await expect(visibleCards(page)).toHaveCount(count);
  }
  await pickCategory(page, 'Food & drinks');
  const pins = await page.locator('[data-pin-ids]').evaluateAll(elements => elements.map(el => JSON.parse((el as HTMLElement).dataset.pinIds!)));
  expect(pins.every(ids => ids.length === 1)).toBe(true);
  expect(pins.flat()).toContain('home');
  const homePane = page.locator('.leaflet-home-marker-pane');
  expect(await homePane.evaluate(el => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(
    await page.locator('.leaflet-marker-pane').evaluate(el => Number(getComputedStyle(el).zIndex)),
  );
  await homePane.locator('button').click();
  await expect(page.locator('#places-drawer')).toBeHidden();
  await fillSearch(page, 'pizza');
  await page.locator('#search-results').getByRole('link', { name: 'Pizzeria Rustika', exact: true }).click();
  const details = page.locator('[data-place-id="food-drinks/rustika"]');
  await expect(details).toBeVisible();
  await expect(details.getByRole('link', { name: 'Directions · Google Maps' })).toHaveAttribute('href', /destination=46\.3712844,14\.1042756/);
  await expect(details.locator('[data-place-facts]')).toHaveText('Food & drinks · Pizza · Riklijeva cesta · 800 m away');
  await page.locator('#close-places').click();
  await expect(page.locator('#places-drawer')).toBeHidden();
  expect(errors).toEqual([]);
});

test('fullscreen map and drawers retain controls, focus and attribution', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  await showMap(page);
  const main = (await page.locator('#main-content').boundingBox())!;
  const map = (await page.locator('#map-canvas').boundingBox())!;
  const width = page.viewportSize()!.width;
  // Desktop keeps the 24rem list beside the map.
  expect(map.x + map.width).toBeCloseTo(width, 0);
  expect(map.width).toBeCloseTo(width >= 1024 ? width - 384 : width, 0);
  await expect(page.locator('#places-drawer')).toBeHidden();
  expect(Math.abs(map.y + map.height - (main.y + main.height))).toBeLessThanOrEqual(2);
  // Phones run the map to the screen bottom; navigation and filters float over it.
  expect(Math.abs(main.y + main.height - page.viewportSize()!.height)).toBeLessThanOrEqual(2);
  if (width < 1024) expect((await page.locator('#filters').boundingBox())!.y).toBeCloseTo(map.y, 0);
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
  // Closing zooms back out to the whole Food & drinks category.
  await expect.poll(async () => (await state(page)).position.zoom).toBeLessThan(14);
  await page.locator('#map-home').click();
  await expect(page.locator('#map-home')).toBeFocused();
  audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibilityViolations(audit)).toEqual([]);
  await expect(page.locator('#map-canvas')).toHaveJSProperty('inert', false);
});

test('phone list opens details over the map and closing returns to the list', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, 'Phone list');
  await page.goto('/stay-k7m4?view=map');
  await expect(page.locator('#map-view')).toHaveAttribute('data-mode', 'list');
  await expect(page.locator('#place-cards')).toBeVisible();
  // The map is not loaded until it is shown.
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  await expect(page.locator('#mode-toggle')).toHaveAccessibleName('Map');
  await pickCategory(page, 'Hiking');
  // Category buttons swipe sideways on phones.
  expect(await page.locator('#filters').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await page.locator('[data-card="hiking/straza"] a').click();
  await expect(page.locator('#map-view')).toHaveAttribute('data-mode', 'map');
  await expect(page.locator('#place-cards')).toBeHidden();
  await expect(page.locator('[data-place-id="hiking/straza"]')).toBeVisible();
  await expect(page.locator('#mode-toggle')).toBeHidden();
  await expect.poll(async () => (await state(page)).selectedId).toBe('hiking/straza');
  await expect.poll(async () => {
    const pin = (await page.locator('#map-canvas button[aria-label="Straža Hill"]').boundingBox())!;
    const canvas = (await page.locator('#map-canvas').boundingBox())!;
    const drawer = (await page.locator('#places-drawer').boundingBox())!;
    const filters = (await page.locator('#filters').boundingBox())!;
    const visibleTop = Math.max(canvas.y + 24, filters.y + filters.height + 16);
    const visibleBottom = Math.min(canvas.y + canvas.height - 24, drawer.y - 16);
    return Math.abs(pin.y + pin.height / 2 - (visibleTop + visibleBottom) / 2);
  }).toBeLessThan(3);
  await page.locator('#close-places').click();
  await expect(page.locator('#map-view')).toHaveAttribute('data-mode', 'list');
  await expect(page.locator('[data-card="hiking/straza"] a')).toBeFocused();
  await expect(page.locator('#map-canvas button[aria-pressed="true"]')).toHaveCount(0);
  await page.locator('#mode-toggle').click();
  await expect(page.locator('#map-view')).toHaveAttribute('data-mode', 'map');
  await expect(page.locator('#mode-toggle')).toHaveAccessibleName('List');
  await showList(page);
  await pickCategory(page, 'Day trips');
  await page.locator('[data-card="day-trips/bohinj-valley"] a').click();
  await expect(page.locator('.trip-route-drive')).toHaveCount(1);
  await expect(page.locator('#places-title')).toHaveText('Bohinj Valley');
  await expect(page.locator('#place-list > article:not([hidden])')).toHaveCount(1);
  // A place without a pin opens over the list instead.
  await page.locator('#close-places').click();
  await pickCategory(page, 'Rainy day');
  await page.locator('[data-card="rainy-day/postojna-cave"] a').click();
  await expect(page.locator('#map-view')).toHaveAttribute('data-mode', 'list');
  await expect(page.locator('#places-title')).toHaveText('Postojna Cave');
});

test('desktop shows the list, map and details side by side', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, 'Desktop layout');
  await page.goto('/stay-k7m4?view=map');
  const drawer = page.locator('#places-drawer');
  await expect(drawer).toBeHidden();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('#mode-toggle')).toBeHidden();
  const list = (await page.locator('#place-cards').boundingBox())!;
  expect(list.x).toBe(0);
  expect(list.width).toBeCloseTo(384, 0);
  for (const category of ['Hiking', 'Day trips', 'Food & drinks', 'Rainy day', 'From the door']) {
    if (await drawer.isVisible()) await page.locator('#close-places').click();
    await pickCategory(page, category);
    await expect(drawer).toBeHidden();
    const card = visibleCards(page).first();
    const id = (await card.getAttribute('data-card'))!;
    await card.locator('a').click();
    await expect(drawer).toBeVisible();
    await expect(page.locator('#place-cards')).toBeVisible();
    await expect(card.locator('a')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#places-title')).toHaveText((await card.locator('a > span:nth-child(2) > span').first().textContent())!);
    await expect(page.locator(`[data-place-id="${id}"]`)).toBeVisible();
    await expect.poll(async () => (await state(page)).selectedId).toBe(id);
    const detailsBounds = (await drawer.boundingBox())!;
    expect(detailsBounds.x + detailsBounds.width).toBeCloseTo(page.viewportSize()!.width, 0);
    if (category === 'Hiking') await expect.poll(async () => (await state(page)).position.zoom).toBeGreaterThanOrEqual(14);
    if (category === 'Day trips') await expect(page.locator('.trip-route-drive')).toHaveCount(1);
    if (category === 'From the door') await expect(page.locator('.trip-route-walk')).toHaveCount(1);
  }
});

test('Home is an icon-only map control above zoom', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map');
  await showMap(page);
  const home = page.getByRole('button', { name: 'Home pin', exact: true });
  await expect(home).toBeVisible();
  await expect(home).toHaveText('');
  const homeBox = (await home.boundingBox())!;
  const zoomBox = (await page.locator('.leaflet-control-zoom').boundingBox())!;
  expect(homeBox.y + homeBox.height).toBeLessThanOrEqual(zoomBox.y);
  expect(homeBox.x + homeBox.width).toBeCloseTo(zoomBox.x + zoomBox.width, 0);
  if (page.viewportSize()!.width < 1024) {
    const toggle = (await page.locator('#mode-toggle').boundingBox())!;
    expect(toggle.x + toggle.width).toBeLessThanOrEqual(zoomBox.x);
  }
  await home.click();
  await expect(page.locator('#places-drawer')).toBeHidden();
  await expect.poll(async () => (await state(page)).position.zoom).toBe(15);
  await expect(page.locator('.leaflet-home-marker-pane button')).toBeInViewport();
});

test('selected map icon is inverted and resets when switching or closing', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=hiking%2Fstraza');
  const selected = page.locator('#map-canvas button[aria-label="Straža Hill"]');
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await expect(selected).toHaveClass(/bg-white text-forest ring-4/);
  const next = page.locator('#map-canvas button[aria-label="Ojstrica, Osojnica & Kozarca"]');
  await next.dispatchEvent('click');
  await expect(next).toHaveAttribute('aria-pressed', 'true');
  await expect(next).toHaveClass(/bg-white text-forest ring-4/);
  await expect(page.locator('#places-title')).toHaveText('Ojstrica, Osojnica & Kozarca');
  await expect(selected).toHaveAttribute('aria-pressed', 'false');
  await expect(selected).toHaveClass(/bg-moss/);
  await page.locator('#close-places').click();
  await expect(page.locator('#map-canvas button[aria-pressed="true"]')).toHaveCount(0);
});

test('an open place card leaves map panning and zooming enabled', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=hiking%2Fstraza');
  await expect(page.locator('#places-title')).toHaveText('Straža Hill');
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

test('search opens full place details without losing top search', async ({ page }) => {
  await page.goto('/stay-k7m4');
  await fillSearch(page, 'pizza');
  await page.locator('#search-results').getByRole('link', { name: 'Pizzeria Rustika', exact: true }).click();
  await expect(page.locator('[data-place-id="food-drinks/rustika"]')).toBeVisible();
  await expect(page.locator('#search-control')).toBeVisible();
  await expect(nav(page, 'Places')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#places-title')).toBeFocused();
});

test('query/detail return, category and map state survive, search requests nothing', async ({ page }) => {
  await page.goto('/stay-k7m4?view=map&place=food-drinks%2Frustika');
  await expect(page.locator('#places-title')).toHaveText('Pizzeria Rustika');
  await page.getByRole('button', { name: 'Close recommendations', exact: true }).click();
  await showList(page);
  await pickCategory(page, 'Food & drinks');
  await page.locator('[data-card="food-drinks/rustika"] a').click();
  await page.waitForLoadState('networkidle');
  const before = await state(page);
  const requests: string[] = [];
  page.on('request', req => requests.push(req.url()));
  await fillSearch(page, 'rain');
  await expect(page.locator('#search-results')).toContainText('Postojna Cave');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  expect((await state(page)).category).toBe('food-drinks');
  expect((await state(page)).selectedId).toBe(before.selectedId);
  // The open search box can change the map height by a pixel; the view must stay put otherwise.
  const after = (await state(page)).position;
  expect(after.zoom).toBe(before.position.zoom);
  after.center.forEach((value: number, i: number) => expect(value).toBeCloseTo(before.position.center[i], 4));
  await expect(page.locator('#places-title')).toHaveText('Pizzeria Rustika');
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
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(['Apartma', 'Kraji']);
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
  await showMap(page, false);
  await expect(page.locator('#map-feedback')).toContainText('Map unavailable');
  await fillSearch(page, 'checkout');
  await expect(page.locator('#search-results')).toContainText('06:00–10:00');
  await nav(page, 'Apartment').click();
  await expect(page.locator('#wifi')).toBeVisible();
});

test('tile failure leaves drawers, attribution and search usable', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.goto('/stay-k7m4?view=map');
  await showMap(page);
  await expect(page.locator('#map-feedback')).toContainText('Map unavailable');
  await fillSearch(page, 'pizza');
  await page.locator('#search-results').getByRole('link', { name: 'Pizzeria Rustika', exact: true }).click();
  await expect(page.locator('#places-title')).toBeFocused();
  await expect(page.locator('#place-list > article:not([hidden])')).toHaveCount(1);
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
  await expect(page.locator('#places-drawer')).toBeHidden();
  await expect(page.locator('#place-cards [data-card]')).toHaveCount(34);
  await expect(page.locator('[data-card="food-drinks/rustika"] a')).toHaveAttribute('href', '/stay-k7m4/places/food-drinks/rustika');
  await page.locator('#arrival-parking').click();
  await expect(page.locator('[data-topic="arrival-parking"]')).toHaveAttribute('open', '');
  await expect(page.locator('#wifi')).toBeVisible();
  await nav(page, 'Places').click();
  await expect(page.getByRole('heading', { name: 'From the door', exact: true })).toBeInViewport();
  await noOverflow(page);
  await context.close();
});

test('320px, 200% text and reduced motion retain search and navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/stay-k7m4');
  for (const name of ['Apartment', 'Places']) {
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
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(accessibilityViolations(audit), url).toEqual([]);
    if (url === '/stay-k7m4?view=map') {
      await showMap(page);
      const mapAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(accessibilityViolations(mapAudit), 'map').toEqual([]);
    }
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

test('phones swipe between Apartment and Places but not on the category chips', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, 'Phone swipe');
  const swipe = (selector: string, dx: number) => page.locator(selector).first().evaluate((el, dx) => {
    const box = el.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + Math.min(box.height / 2, 40);
    const touch = (clientX: number) => new Touch({ identifier: 1, target: el, clientX, clientY: y });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(x)], changedTouches: [touch(x)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(x + dx)] }));
  }, dx);
  await page.goto('/stay-k7m4?view=stay');
  await expect(page.locator('#guide')).toHaveAttribute('data-enhanced', 'true');
  await swipe('#stay h2', -120);
  await expect(nav(page, 'Places')).toHaveAttribute('aria-current', 'page');
  await swipe('#filters', 120);
  await expect(nav(page, 'Places')).toHaveAttribute('aria-current', 'page');
  await swipe('#place-cards h3', 120);
  await expect(nav(page, 'Apartment')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#stay')).toBeVisible();
});
