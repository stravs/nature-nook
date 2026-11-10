const policy = 'ai-train=no, search=yes, ai-input=yes';

function wantsMarkdown(accept = '') {
  const types = accept.split(',').map((part) => {
    const [type, ...parameters] = part.trim().toLowerCase().split(';');
    const q = parameters.find((parameter) => parameter.trim().startsWith('q='));
    const quality = q ? Number(q.trim().slice(2)) : 1;
    return { type, quality: Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0 };
  });
  const markdown = types.find(({ type }) => type === 'text/markdown');
  const html = types.find(({ type }) => type === 'text/html');
  return markdown && markdown.quality > 0 && (!html || markdown.quality >= html.quality);
}

async function sendEnquiry(request, env) {
  if (request.method !== 'POST') return new Response('Method not allowed\n', { status: 405, headers: { Allow: 'POST' } });
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ ok: false, error: 'invalid' }, { status: 400 });
  const value = (name, max) => String(form.get(name) ?? '').trim().slice(0, max);
  // Honeypot filled in: pretend success so bots learn nothing.
  if (value('website', 200)) return Response.json({ ok: true });
  const enquiry = {
    name: value('name', 100), email: value('email', 200), arrival: value('arrival', 10), departure: value('departure', 10),
    guests: value('guests', 3), message: value('message', 5000), locale: value('locale', 5),
  };
  if (!enquiry.name || !enquiry.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) {
    return Response.json({ ok: false, error: 'invalid' }, { status: 400 });
  }
  // Date inputs send yyyy-mm-dd; the email shows dd.mm.yyyy.
  const date = (value) => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1') || '-';
  const text = [
    `Name: ${enquiry.name}`, `Email: ${enquiry.email}`, `Arrival: ${date(enquiry.arrival)}`, `Departure: ${date(enquiry.departure)}`,
    `Guests: ${enquiry.guests || '-'}`, `Language: ${enquiry.locale || '-'}`, '', enquiry.message,
  ].join('\n');
  try {
    await env.EMAIL.send({
      to: env.ENQUIRY_TO, from: { email: env.ENQUIRY_FROM, name: 'Nature Nook' }, replyTo: { email: enquiry.email, name: enquiry.name },
      subject: `Enquiry from ${enquiry.name}`.replace(/[\r\n]/g, ' '), text,
    });
  } catch (error) {
    console.error('Enquiry email failed:', error.code, error.message);
    return Response.json({ ok: false, error: 'send_failed' }, { status: 502 });
  }
  return Response.json({ ok: true });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/enquiry') return sendEnquiry(request, env);
    const publicResource = path.startsWith('/api/property/') || path.startsWith('/.well-known/') || ['/openapi.json', '/api-docs.md', '/auth.md', '/llms.txt', '/en.md', '/sl.md'].includes(path);
    if (publicResource && request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' } });
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Read-only resource\n', { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Origin': '*' } });
    }
    const guestGuide = path === '/stay-k7m4' || path.startsWith('/stay-k7m4/');
    const publicPage = path === '/' || path === '/sl';
    const markdown = publicPage && wantsMarkdown(request.headers.get('Accept') ?? '');
    const assetUrl = new URL(request.url);
    if (markdown) assetUrl.pathname = path === '/' ? '/en.md' : '/sl.md';
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    const headers = new Headers(response.headers);
    headers.set('Content-Signal', policy);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Frame-Options', 'DENY');
    if (guestGuide) {
      headers.set('X-Robots-Tag', 'noindex, follow');
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; worker-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    }
    if (new URL(request.url).hostname.endsWith('.workers.dev')) headers.set('X-Robots-Tag', 'noindex, follow');
    if (publicPage) {
      headers.append('Vary', 'Accept');
      // Cloudflare's CDN does not use Vary: Accept as a cache key.
      // Keep representation negotiation out of shared caches.
      headers.set('Cache-Control', 'private, no-cache');
      headers.set('CDN-Cache-Control', 'no-store');
      if (markdown) headers.set('Content-Type', 'text/markdown; charset=utf-8');
    }
    if (publicResource) headers.set('Access-Control-Expose-Headers', 'Link, Content-Signal, ETag');
    if (publicResource) headers.set('Access-Control-Allow-Origin', '*');
    if (path === '/.well-known/api-catalog' && response.ok) headers.set('Content-Type', 'application/linkset+json; charset=utf-8');
    if (path.endsWith('.md') && response.ok) headers.set('Content-Type', 'text/markdown; charset=utf-8');
    if (!guestGuide) headers.append('Link', '</.well-known/api-catalog>; rel="api-catalog", </openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json", </api-docs.md>; rel="service-doc"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"');
    return new Response(response.body, { status: response.status, headers });
  },
};
