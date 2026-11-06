// Requires a running dev/preview server and installed Chrome (or CHROME_PATH).
// Tiles are mocked to keep repeatable interaction tests offline and avoid tile traffic.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { parseHTML } from 'linkedom';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:4321';
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  headless: true, args: ['--no-sandbox'],
});
const { document: guide } = parseHTML(await (await fetch(new URL('/guests', base))).text());
const guestPlaces = JSON.parse(guide.querySelector('[data-map-config]').dataset.mapConfig).places;
const placeCount = guestPlaces.length;
const foodCount = guestPlaces.filter((place) => place.category === 'food').length;
const walkCount = guestPlaces.filter((place) => place.category === 'walks').length;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
try {
  for (const locale of ['en', 'sl']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let tileRequests = 0;
    await page.route('https://tile.openstreetmap.org/**', (route) => { tileRequests++; return route.fulfill({ contentType: 'image/png', body: png }); });
    await page.goto(new URL(locale === 'en' ? '/guests' : '/sl/guests', base).href);
    await page.waitForTimeout(400);
    assert.equal(tileRequests, 0, 'Do not load map tiles in the apartment view');
    assert.equal(await page.locator('.guest-sidebar').count(), 0, 'One primary navigation, no competing sidebar');
    assert.equal(await page.locator('.stay-contents a').count(), 6);
    assert.equal(await page.locator('#home-base-heading').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Home base fits mobile');
    await page.locator('[data-go-roaming]').click();
    await page.waitForSelector('#stay', { state: 'hidden' });
    assert.equal(await page.locator('#home-base-heading').isVisible(), false, 'Home base belongs only to Your stay');
    assert.equal(await page.locator('[data-guide-location]').textContent(), locale === 'en' ? 'Out roaming' : 'Na potepu');
    assert.equal(await page.locator('h1:visible').count(), 1);
    assert.ok((await page.locator('.guest-header .language-switcher a').first().getAttribute('href')).endsWith('#explore'));
    await page.waitForSelector('.guest-map-marker');
    assert.equal(await page.locator('.guest-map-marker').count(), placeCount + 1);
    assert.ok(tileRequests > 0);
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), 'home');
    assert.equal(await page.locator('[data-tip-progress]').count(), 0);
    assert.equal(await page.locator('.guest-map-marker .guest-marker-face > svg').count(), placeCount + 1);
    assert.equal(await page.locator('[data-tip-previous]').isDisabled(), true);
    assert.equal(await page.locator('[data-map-list]').getAttribute('open'), null);
    assert.equal(await page.locator('[data-menu-distance]').count(), placeCount);
    assert.equal(await page.locator('[data-tip-distance]').isVisible(), false, 'No distance to the apartment itself');
    const assertSelectedPopup = async () => {
      // The map re-checks the popup position on the frame after a zoom change.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const popup = await page.locator('.guest-tip-popup').boundingBox();
      const map = await page.locator('[data-live-map]').boundingBox();
      if (await page.locator('[data-map-tip]').getAttribute('data-kind') === 'walk') {
        // Walk cards point at the top of the route so the route stays visible.
        const route = await page.locator('.guest-walk.is-selected').boundingBox();
        assert.ok(popup.y + popup.height <= route.y + 8, 'Card sits above the selected route');
      } else {
        const pin = await page.locator('.guest-map-marker.is-selected').boundingBox();
        assert.ok(popup.y + popup.height <= pin.y + 5, 'Card is above the selected pin');
        assert.ok(Math.abs(popup.x + popup.width / 2 - pin.x - pin.width / 2) < 4, 'Card pointer aligns with the selected pin');
      }
      assert.ok(popup.x >= map.x && popup.x + popup.width <= map.x + map.width && popup.y >= map.y, 'Card stays inside the map');
      assert.equal(await page.locator('.map-sidebar [data-map-tip]').count(), 0);
    };
    await assertSelectedPopup();
    const closeTip = page.getByRole('button', { name: locale === 'en' ? 'Close tip' : 'Zapri namig', exact: true });
    await closeTip.click();
    await page.waitForSelector('.guest-tip-popup', { state: 'detached' });
    assert.equal(await page.locator('.guest-tip-popup').count(), 0);
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), 'home');
    assert.equal(await page.locator('.guest-map-marker.is-selected .guest-marker-label').isVisible(), true);
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.guest-tip-popup').count(), 0, 'Zooming does not reopen a dismissed card');
    await page.setViewportSize({ width: 480, height: 844 });
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.guest-tip-popup').count(), 0, 'Resizing does not reopen a dismissed card');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.locator('[data-show-place="home"]').click();
    await assertSelectedPopup();
    await closeTip.focus();
    await page.keyboard.press('Escape');
    await page.waitForSelector('.guest-tip-popup', { state: 'detached' });
    assert.equal(await page.locator('.guest-tip-popup').count(), 0, 'Escape closes the card');
    await page.locator('[data-show-place="home"]').click();
    await assertSelectedPopup();
    assert.equal(await page.locator('[data-map-menu] [data-show-place]').count(), placeCount + 1);
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const mobileMap = await page.locator('.map-stage').boundingBox();
    assert.ok(Math.abs(mobileMap.x) < 2 && Math.abs(mobileMap.width - viewportWidth) < 2, 'Mobile map is edge to edge');
    await page.locator('[data-tip-next]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), 'walk-lake');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), 'walk-market', 'Popup updates preserve keyboard focus');
    await page.locator('[data-show-place="vintgar"]').click();
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), 'vintgar', 'Menu selection updates the map');
    assert.equal(await page.locator('[data-show-place="vintgar"]').getAttribute('aria-pressed'), 'true');
    const gorgeDistance = await page.locator('[data-show-place="vintgar"] [data-menu-distance]').textContent();
    assert.ok((await page.locator('[data-tip-distance]').textContent()).includes(gorgeDistance));
    assert.ok((await page.locator('[data-tip-distance]').textContent()).includes(locale === 'en' ? 'straight line' : 'zračna razdalja'));
    await page.locator('[data-show-place="home"]').click();
    assert.equal(await page.locator('[data-tip-distance]').isVisible(), false);
    await page.locator('[data-tip-next]').click();
    assert.equal(await page.locator('[data-tip-kicker]').textContent(), locale === 'en' ? 'Walks from Nature Nook' : 'Sprehodi od Nature Nook');
    assert.equal(await page.locator('.guest-map-marker.is-selected .guest-marker-label').textContent(), locale === 'en' ? 'To the lake' : 'Do jezera');
    assert.equal(await page.locator('.guest-walk.is-selected').count(), 1, 'The selected walk is highlighted');
    assert.ok((await page.locator('[data-tip-distance]').textContent()).includes(locale === 'en' ? 'along the drawn route' : 'po narisani poti'));
    assert.equal(await page.locator('.guest-marker-label:visible').count(), 1, 'Home stays labelled; the selected pin is identified by its popup');
    await assertSelectedPopup();
    assert.equal(await page.locator('[data-tip-title]').textContent(), locale === 'en' ? 'To the lake' : 'Do jezera');
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('aria-pressed'), 'true');
    // Both the home and the current stop must remain in the unoccluded map area.
    assert.ok(await page.evaluate(() => {
      const map = document.querySelector('[data-live-map]').getBoundingClientRect();
      return ['.is-home', '.is-selected'].every((selector) => {
        const pin = document.querySelector(`.guest-map-marker${selector}`).getBoundingClientRect();
        return pin.x >= map.x && pin.right <= map.right && pin.y >= map.y && pin.bottom <= map.bottom;
      });
    }));
    await page.locator('[data-filter="food"]').click();
    assert.equal(await page.locator('.guest-map-marker').count(), foodCount + 1);
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), 'home');
    assert.equal(await page.locator('.guest-map-marker.activities').count(), 0);
    assert.equal(await page.locator('.guest-walk').count(), 0, 'Routes follow the category filter');
    assert.equal(await page.locator('[data-map-menu] [data-show-place]:visible').count(), foodCount + 1, 'Menu and map filters stay synchronized');
    await page.locator('[data-tip-next]').click();
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), 'union');
    await page.locator('[data-filter="activities"]').click();
    assert.equal(await page.locator('.guest-map-marker').count(), placeCount - foodCount - walkCount + 1);
    await page.locator('[data-filter="walks"]').click();
    assert.equal(await page.locator('.guest-map-marker').count(), walkCount + 1);
    assert.equal(await page.locator('.guest-walk').count(), walkCount);
    await page.locator('[data-map-all]').click();
    assert.equal(await page.locator('.guest-map-marker').count(), placeCount + 1);
    const union = page.locator('.guest-map-marker[data-place-id="union"]');
    await union.focus();
    await page.keyboard.press('Space');
    assert.ok((await page.locator('[data-tip-area]').textContent()).includes('Ljubljanska cesta'));
    assert.equal(await page.locator('[data-show-place="union"]').getAttribute('aria-pressed'), 'true', 'Selecting a map pin updates the menu');
    await page.locator('[data-map-home]').click();
    await assertSelectedPopup();
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), 'home');
    const tour = guestPlaces.map((place) => place.id);
    for (const id of tour) {
      await page.locator('[data-tip-next]').click();
      assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), id);
      await assertSelectedPopup().catch((error) => { throw new Error(`${locale} ${id}: ${error.message}`); });
      if (id === 'union') assert.equal(await page.locator('[data-tip-kicker]').textContent(), locale === 'en' ? 'Eat like a local' : 'Jejte kot domačini');
    }
    assert.equal(await page.locator('[data-tip-kicker]').textContent(), locale === 'en' ? 'Rainy-day ideas' : 'Za deževne dni');
    assert.equal(await page.locator('[data-tip-next]').isDisabled(), true);
    await page.locator('[data-tip-previous]').click();
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), tour.at(-2));
    await page.locator('[data-map-home]').click();
    await page.setViewportSize({ width: 1360, height: 1000 });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.guest-map-marker').count(), placeCount + 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('.map-legend [data-show-place="walk-market"]').click();
    assert.equal(await page.locator('.guest-map-marker.is-selected').getAttribute('data-place-id'), 'walk-market', 'Legend selects a walk');
    assert.equal(await page.locator('.map-legend [data-show-place="walk-market"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.guest-landmark').count(), 10, 'Neighbourhood pins appear close up');
    await assertSelectedPopup();
    await page.locator('[data-map-home]').click();
    const workspace = await page.locator('.map-workspace').boundingBox();
    const desktopViewport = await page.evaluate(() => document.documentElement.clientWidth);
    assert.ok(Math.abs(workspace.x) < 2 && Math.abs(workspace.width - desktopViewport) < 2, 'Desktop map workspace is edge to edge');
    assert.ok((await page.locator('.map-stage').boundingBox()).width > 750, 'Most of the width belongs to the map');
    await assertSelectedPopup();
    await page.locator('.map-stage').scrollIntoViewIfNeeded();
    assert.ok((await page.locator('.guide-views').boundingBox()).y >= 0, 'View switch remains reachable above the map');
    await page.locator('[data-filter="food"]').click();
    await page.evaluate(() => { location.hash = 'place-vintgar'; });
    await page.waitForTimeout(200);
    assert.equal(await page.locator('[data-card="vintgar"]').isVisible(), true);
    assert.equal(await page.locator('[data-filter="all"]').getAttribute('aria-pressed'), 'true');
    assert.ok((await page.locator('[data-tip-area]').textContent()).includes(locale === 'en' ? 'Popular walk' : 'Priljubljen sprehod'));
    await page.locator('.guide-help').click();
    await page.waitForSelector('#explore', { state: 'hidden' });
    assert.equal(await page.locator('#stay').isVisible(), true);
    assert.equal(await page.locator('#explore').isVisible(), false);
    assert.ok(!(await page.locator('.guest-header .language-switcher a').first().getAttribute('href')).includes('#explore'));
    await page.locator('[data-go-roaming]').click();
    assert.equal(await page.locator('.guest-map-marker').count(), placeCount + 1, 'Returning to Explore preserves a usable map');
    await page.locator('[data-return-home]').click();
    await page.waitForSelector('#explore', { state: 'hidden' });
    assert.equal(await page.locator('#home-base-heading').isVisible(), true);
    assert.equal(await page.locator('[data-guide-location]').textContent(), locale === 'en' ? 'Home base' : 'Doma');
    await page.goBack();
    await page.waitForSelector('#stay', { state: 'hidden' });
    assert.equal(await page.locator('.guest-map-marker').count(), placeCount + 1, 'Browser back reopens the map');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${locale}: mobile/desktop map, tour, filtering, keyboard, and deep links passed`);
  }
  const noJs = await browser.newPage({ javaScriptEnabled: false });
  await noJs.goto(new URL('/guests#explore', base).href);
  assert.equal(await noJs.locator('[data-card]:visible').count(), placeCount);
  assert.equal(await noJs.locator('[data-map-experience]').isVisible(), false);
  await noJs.close();
  const blocked = await browser.newPage();
  await blocked.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await blocked.goto(new URL('/guests#explore', base).href);
  await blocked.waitForFunction(() => document.querySelector('[data-map-status]')?.textContent.includes('could not fully load'));
  assert.equal(await blocked.locator('[data-card]:visible').count(), placeCount);
  await blocked.close();
  console.log('No-JS and unavailable-tile fallbacks passed');
} finally {
  await browser.close();
}
