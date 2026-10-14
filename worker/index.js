import TurndownService from 'turndown';
import { parseHTML } from 'linkedom';

const policy = 'ai-train=no, search=yes, ai-input=yes';

function wantsMarkdown(accept = '') {
  const types = accept.split(',').map((part) => {
    const [type, ...parameters] = part.trim().toLowerCase().split(';');
    const q = parameters.find((parameter) => parameter.trim().startsWith('q='));
    return { type, quality: q ? Number(q.trim().slice(2)) : 1 };
  });
  const markdown = types.find(({ type }) => type === 'text/markdown');
  const html = types.find(({ type }) => type === 'text/html');
  return markdown && markdown.quality > 0 && (!html || markdown.quality >= html.quality);
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const publicResource = path.startsWith('/api/property/') || path.startsWith('/.well-known/') || ['/openapi.json', '/api-docs.md', '/auth.md', '/llms.txt'].includes(path);
    if (publicResource && request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' } });
    }
    if (publicResource && !['GET', 'HEAD'].includes(request.method)) {
      return new Response('Read-only resource\n', { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Origin': '*' } });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Content-Signal', policy);
    if (publicResource) headers.set('Access-Control-Allow-Origin', '*');
    if (path === '/.well-known/api-catalog' && response.ok) headers.set('Content-Type', 'application/linkset+json; charset=utf-8');
    if (path.endsWith('.md') && response.ok) headers.set('Content-Type', 'text/markdown; charset=utf-8');
    headers.append('Link', '</.well-known/api-catalog>; rel="api-catalog", </openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json", </api-docs.md>; rel="service-doc"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"');
    if (!headers.get('content-type')?.includes('text/html')) {
      return new Response(response.body, { status: response.status, headers });
    }
    const vary = headers.get('Vary');
    if (!vary?.split(',').some((value) => value.trim().toLowerCase() === 'accept')) {
      headers.set('Vary', vary ? `${vary}, Accept` : 'Accept');
    }
    if (request.method !== 'GET' || !response.ok || !wantsMarkdown(request.headers.get('Accept') ?? '')) {
      return new Response(response.body, { status: response.status, headers });
    }
    const sourceResponse = response.clone();
    // HTMLRewriter removes page chrome before the HTML-to-Markdown conversion.
    const cleaned = await new HTMLRewriter()
      .on('script, style, nav, header, footer, dialog, template, noscript', {
        element(element) { element.remove(); },
      })
      .transform(response).text();
    const converter = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    const { document } = parseHTML(cleaned);
    // Preserve separation between inline facts and retain useful structured data.
    document.querySelectorAll('.facts span, .unit-facts li').forEach((element) => element.appendChild(document.createTextNode(' · ')));
    const { document: sourceDocument } = parseHTML(await sourceResponse.text());
    const structured = [...sourceDocument.querySelectorAll('script[type="application/ld+json"]')].map((element) => element.textContent).filter(Boolean);
    const markdown = converter.turndown(document.body) + (structured.length ? '\n\n```json\n' + structured.join('\n') + '\n```' : '') + '\n';
    headers.set('Content-Type', 'text/markdown; charset=utf-8');
    // These validators and encodings describe the original HTML, not this body.
    for (const name of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified']) {
      headers.delete(name);
    }
    return new Response(markdown, { status: response.status, headers });
  },
};
