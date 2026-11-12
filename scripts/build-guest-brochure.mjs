import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

// Run after `npm run build`. Serve only the built files, on an ephemeral port.
// This avoids starting/stopping a developer's existing Astro preview daemon.
const root = resolve('dist');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (request, response) => {
  try {
    let path = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://build.local').pathname)}`);
    if (!path.startsWith(root + sep)) throw new Error('Outside build directory');
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await mkdir('dist/stay-k7m4', { recursive: true });
  for (const [route, filename, count, width] of [
    ['/stay-k7m4/print', 'guest-brochure-a5.pdf', 8, 148],
    ['/stay-k7m4/print/booklet', 'guest-brochure-booklet-a4.pdf', 4, 297],
  ]) {
    const response = await page.goto(`${origin}${route}`);
    if (!response?.ok()) throw new Error(`Cannot load ${route}`);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, image => image.decode()));
    });
    const overflow = await page.locator('[data-page-content]').evaluateAll(elements => elements
      .filter(element => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1)
      .map(element => element.closest('[data-brochure-page]').getAttribute('data-brochure-page')));
    if (overflow.length) throw new Error(`Brochure overflow on pages ${overflow.join(', ')}; shorten copy, do not shrink text.`);
    const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, tagged: true });
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() !== count) throw new Error(`${filename}: expected ${count} pages, got ${pdf.getPageCount()}`);
    if (pdf.getPages().some(p => Math.abs(p.getWidth() * 25.4 / 72 - width) > 1 || Math.abs(p.getHeight() * 25.4 / 72 - 210) > 1)) {
      throw new Error(`${filename}: incorrect paper size`);
    }
    await writeFile(`dist/stay-k7m4/${filename}`, bytes);
    console.log(`Generated ${filename}: ${count} pages (${Math.round(bytes.length / 1024)} KB)`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
