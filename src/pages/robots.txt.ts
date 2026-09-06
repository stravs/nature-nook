import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ site, url }) => new Response(`User-agent: *\nAllow: /\nDisallow: /setup\nDisallow: /api/\nSitemap: ${new URL('/sitemap-index.xml', site ?? url.origin).href}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
