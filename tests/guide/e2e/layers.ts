import { expect, type Page } from '@playwright/test';

export async function showLayers(page: Page, names: string[]) {
  const controls = page.locator('#filters button');
  await expect(controls).toHaveCount(4);
  for (const button of await controls.all()) {
    const wanted = names.includes((await button.innerText()).trim());
    if ((await button.getAttribute('aria-pressed') === 'true') !== wanted) await button.click();
  }
}
