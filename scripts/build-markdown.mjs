import { readFile, writeFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';

// Only public landing pages. Never turn guest guides into agent documents.
for (const [input, output] of [['dist/index.html', 'dist/en.md'], ['dist/sl/index.html', 'dist/sl.md']]) {
  const { document } = parseHTML(await readFile(input, 'utf8'));
  const canonical = document.querySelector('link[rel="canonical"]').href;
  const structured = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent);
  document.querySelectorAll('script, style, nav, header, footer, dialog, template, noscript, form').forEach((node) => node.remove());
  document.querySelectorAll('.facts span, .unit-facts li').forEach((node) => node.appendChild(document.createTextNode(' · ')));
  // Agent clients should not need browser-style relative URL resolution.
  document.querySelectorAll('[href], [src]').forEach((node) => {
    for (const name of ['href', 'src']) {
      const value = node.getAttribute(name);
      if (value) node.setAttribute(name, new URL(value, canonical).href);
    }
  });
  const converter = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  const markdown = converter.turndown(document.querySelector('main') ?? document.body);
  await writeFile(output, `${markdown}\n\nSource: ${canonical}\n\n\`\`\`json\n${structured.join('\n')}\n\`\`\`\n`);
}
console.log('Built public English and Slovenian Markdown snapshots.');
