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
