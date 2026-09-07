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
