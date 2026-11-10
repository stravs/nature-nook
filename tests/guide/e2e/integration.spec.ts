import { test, expect } from '@playwright/test';

test('Worker protects guide indexing without applying guide policy to public pages', async ({ request }) => {
  for (const path of ['/stay-k7m4', '/stay-k7m4/sl', '/stay-k7m4/share', '/stay-k7m4/places/hiking/triglav']) {
    const response = await request.get(path, { headers: { Accept: 'text/markdown' } });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    expect(response.headers()['content-security-policy']).toContain("script-src 'self';");
    expect(response.headers()['link']).toBeUndefined();
    const head = await request.head(path);
    expect(head.status()).toBe(200);
    expect(head.headers()['x-robots-tag']).toContain('noindex');
    expect(await head.text()).toBe('');
    const redirect = await request.get(`${path}/`, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(redirect.status());
    expect(new URL(redirect.headers()['location']!, 'https://example.test').pathname).toBe(path);
  }
  for (const path of ['/', '/sl']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['x-robots-tag']).toBeUndefined();
    expect(response.headers()['content-security-policy']).toBeUndefined();
    expect(await response.text()).not.toContain('/stay-k7m4');
  }
  for (const path of ['/guests', '/sl/guests', '/stay-k7m4/missing']) {
    expect((await request.get(path)).status()).toBe(404);
  }
  const route = await request.get('/stay-k7m4/routes/bohinj-valley.geojson');
  expect(route.status()).toBe(200);
  expect(route.headers()['cache-control'] ?? '').not.toContain('immutable');
  expect((await route.json()).type).toBe('FeatureCollection');
});

test('QR share page links to the guide, with print and copy controls', async ({ page }) => {
  await page.goto('/stay-k7m4/share');
  await expect(page.locator('#guide-url')).toHaveAttribute('href', 'https://nature-nook.si/stay-k7m4');
  await expect(page.locator('#guide-qr svg')).toBeVisible();
  await expect(page.locator('#wifi-qr svg')).toBeVisible();
  await expect(page.locator('#wifi-network')).toHaveText('NatureNook-Demo');
  await expect(page.locator('#wifi-password')).toHaveText('Fern!72Pebble');
  await expect(page.getByText('Demo credentials · replace before sharing', { exact: true })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain('Preview only');
  await expect(page.locator('#copy-link')).toBeVisible();
  await expect(page.locator('#print-guide')).toBeVisible();
  await page.getByRole('link', { name: 'Back to guide', exact: true }).click();
  await expect(page.locator('#guide')).toHaveAttribute('data-enhanced', 'true');
});
