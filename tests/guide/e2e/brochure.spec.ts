import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import AxeBuilder from '@axe-core/playwright';

for (const [route, order, count, width] of [
  ['/stay-k7m4/print', [1, 2, 3, 4, 5, 6, 7, 8], 8, 148],
  ['/stay-k7m4/print/booklet', [8, 1, 2, 7, 6, 3, 4, 5], 4, 297],
] as const) {
  test(`${route}: complete without JavaScript or external requests`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const external: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
    });
    await page.goto(`${baseURL}${route}`);
    await expect(page.locator('[data-brochure-page]')).toHaveCount(8);
    expect(await page.locator('[data-brochure-page]').evaluateAll(elements => elements.map(e => Number(e.getAttribute('data-brochure-page'))))).toEqual(order);
    await expect(page.getByText('use your browser’s Print menu', { exact: false })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await expect(page.locator('[data-brochure-page="8"] a[href="tel:112"]')).toBeVisible();
    await expect(page.locator('[data-brochure-page="8"] svg')).toBeVisible();
    expect(external).toEqual([]);
    await context.close();
  });

  test(`${route}: no overflow and correct print dimensions`, async ({ page }, testInfo) => {
    await page.goto(route);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, image => image.decode()));
    });
    await expect(page.locator('#print-brochure')).toBeHidden();
    const overflow = await page.locator('[data-page-content]').evaluateAll(elements => elements.filter(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map(e => e.parentElement?.getAttribute('data-brochure-page')));
    expect(overflow).toEqual([]);
    if (testInfo.project.name === 'desktop') {
      const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false }));
      expect(pdf.getPageCount()).toBe(count);
      for (const p of pdf.getPages()) {
        expect(p.getWidth() * 25.4 / 72).toBeCloseTo(width, 0);
        expect(p.getHeight() * 25.4 / 72).toBeCloseTo(210, 0);
      }
    }
  });
}

test('draft labels, credentials, QR destination and linked recommendations', async ({ page }) => {
  await page.goto('/stay-k7m4/print');
  await expect(page.locator('[data-brochure-page] header')).toContainText(Array(8).fill('Draft · owner review'));
  const cover = page.locator('[data-brochure-page="1"]');
  await expect(cover.locator('[data-cover-guide] svg')).toBeVisible();
  await expect(cover.locator('[data-demo-wifi]')).toContainText('Demo Wi-Fi — replace before sharing');
  await expect(cover.locator('[data-cover-wifi-qr] svg')).toBeVisible();
  await expect(cover.locator('[data-cover-wifi]')).toContainText('NatureNook-Demo');
  await expect(cover.locator('[data-cover-wifi]')).toContainText('Fern!72Pebble');
  await expect(page.locator('[data-brochure-page="8"] [role="img"]')).toHaveAttribute('aria-label', 'QR code linking to https://nature-nook.si/stay-k7m4');
  const links = page.locator('[data-brochure-place] a');
  await expect(links).toHaveCount(34);
  for (const link of await links.all()) expect(await link.getAttribute('href')).toMatch(/^https:\/\/nature-nook\.si\/stay-k7m4\/places\//);
  await expect(page.locator('[data-brochure-map] image')).toHaveCount(1);
  await expect(page.locator('[data-map-pin]')).toHaveCount(13);
});

test('print action and keyboard-accessible format switch', async ({ page }) => {
  await page.goto('/stay-k7m4/print');
  await page.evaluate(() => { window.print = () => { document.body.dataset.printCalled = 'true'; }; });
  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-called', 'true');
  const booklet = page.getByRole('link', { name: 'A4 folded booklet' });
  await booklet.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/print\/booklet$/);
  await expect(page.getByRole('link', { name: 'A4 folded booklet' })).toHaveAttribute('aria-current', 'page');
});

test('brochure preview has no serious accessibility violations', async ({ page }) => {
  await page.goto('/stay-k7m4/print');
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
