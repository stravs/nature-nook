# Nature nook

Standalone Astro site generated from nature-nook.json.

```sh
npm install
npm run dev
```

## Cloudflare Workers

This is a static Astro site. `wrangler.jsonc` builds the site and deploys
`dist/` as static assets without the Cloudflare Astro adapter.

Use `npx wrangler deploy` as the Cloudflare deploy command. The build runs
through Wrangler, so a separate dashboard build command is optional.
Keep the repository root as the root directory.

## Photos

Store property photos in `src/assets/images/nature-nook/`. The `/images/...`
values in `.data/property.json` are stable asset IDs resolved by `src/lib/images.ts`,
not public file URLs. Keep those IDs in sync when renaming files.

`PropertyImage.astro` uses Astro Image for responsive WebP images with intrinsic
dimensions. The hero loads eagerly; gallery images load lazily. The lightbox and
social metadata use build-time `getImage()` URLs. Photo array order controls the
gallery: property photos first, then unit photos, with duplicates removed.

## SEO and production domain

The production URL comes from `SITE_URL` at build time, then `site.url` in
`.data/site.json` (currently `https://nature-nook.si`). Set it to the final custom
domain and rebuild when changing domains; canonical links, language alternates,
social images, structured data, and robots.txt all use this URL.

The sitemap includes the English and Slovenian property pages with language
alternates. Guest guides remain noindex and are excluded from the sitemap.
After deploying and connecting the domain, submit `/sitemap-index.xml` in Google
Search Console. Keep property descriptions, amenities, and ratings accurate in
`.data/property.json`, since they also supply the page metadata and structured data.
