# Integrated guest guide

## URLs and deployment

- English: `/stay-k7m4`
- Slovenian: `/stay-k7m4/sl`
- Recommendation details: `/stay-k7m4/places/<category>/<slug>`
- Printable QR: `/stay-k7m4/share`
- Saved GeoJSON: `/stay-k7m4/routes/<name>.geojson`

The old `/guests` and `/sl/guests` pages are removed. No redirects or legacy
fragment handling. Unknown pages return 404.

One Astro build and the existing Cloudflare Worker serve both property website
and guide. No Pages project, adapter, proxy, authentication service or second
production build is needed. Set `SITE_URL` to the property site's production
origin before building. The QR uses that origin plus `/stay-k7m4`.

```sh
npm ci
npm run build
npm test
npm run test:guide
npm audit

# For manual testing, after browser tests stop their own Worker:
npm run preview:worker
# Separate shell:
npm run test:agents
```

In this container, open `http://172.17.0.2:8801/stay-k7m4` while the local Worker
is running. Recheck `hostname -I` if the container changes. Astro preview does
not exercise Worker headers or Cloudflare slash handling.

Production publication is separate: review first, then explicitly authorize
`npx wrangler deploy`. Integration work does not itself deploy.

## Live content

`src/guide/` is the production source of truth. The sibling `/workspace/guest-guide`
project was copied as a starting point and is not synchronized or needed to build.

| File/directory | Purpose |
| --- | --- |
| `src/guide/data/apartment.json` | Public apartment facts, coordinates, times, approval flag, optional public Wi-Fi/phone |
| `src/guide/data/apartment-info.json` | Structured bilingual appliance, arrival, rules, safety and contact instructions |
| `src/guide/data/messages.json` | Bilingual UI and search messages |
| `src/guide/data/places.json` | 35 validated public recommendations/tips, with full English prose and optional route URLs |
| `src/guide/lib/guide-data.ts` | Validation, localized topic construction, summaries and route helpers |
| `src/guide/lib/search.ts` | On-device deterministic matching; no search service or query tracking |
| `src/guide/components/`, `layouts/`, `scripts/` | Guide-only UI, shell and map |
| `src/guide/styles/global.css` | Existing guide Tailwind theme and local font declarations; imported only by guide layout |
| `public/stay-k7m4/` | Fonts, terrace image, favicon and saved trip geometry |
| `src/pages/stay-k7m4/` | Route entry points and detail/share pages |

Use `baseFor()` and `placePath()` for guide navigation. Media and saved routes
must use the guide prefix, not the website root. Optional instruction images
also require `/stay-k7m4/images/...` paths. Keep all guest pages under this prefix
so the Worker's noindex and security policy cover them.

The public property data and guide apartment facts currently agree on the home
pin, check-in and checkout. They are not automatically synchronized. If those
facts change, update both deliberately and obtain owner approval.

## Content provenance and remaining review

The new JSON is the only live recommendation source. Previous English/Slovenian
Markdown notes, hand-drawn walking geometry and neighbourhood pin data are retained
in `docs/legacy-guide/` for reference. They are outside Astro content collections,
not emitted as pages, and not automatically merged into the new map. No old-map
behaviour or translations are implied by the replacement.

New recommendation prose remains English in both guide views; Slovenian guests
see an explicit fallback notice. The old duplicate/draft notes were not migrated.

Owner review is still required: home/arrival point, parking, appliance availability,
house rules, public contact policy, times, routes and translations. The guide's
`confirmedByOwner` remains false, but preview banners have been removed at the
user's request. Fake Wi-Fi data (`NatureNook-Demo` / `Fern!72Pebble`) is displayed
with a demo label; it is not a working network. No host phone is published.
The share page has a second QR using the standard `WIFI:T:WPA;S:...;P:...;;`
payload with reserved characters escaped. It uses the same JSON fields as the
visible Wi-Fi card, password copy action and search answer. Replace both fields
with approved public credentials before sharing a working Wi-Fi QR. Browser
tests also inject a separate synthetic password to exercise clipboard failures.

Saved driving routes are suggestions, not verified road access or live navigation.
The park itinerary's dashed train connection is schematic. Seasonal restrictions,
parking permissions, motorway vignette requirements and car-train timetables need
review. Original route provenance and waypoints are in `docs/GUIDE_ROUTES.md`.

## Privacy and indexing

The short unlisted suffix reduces casual discovery only. It is not a secret,
password or access-control mechanism. Anyone with the URL can share it. Do not
publish door codes, guest names, reservation information or private credentials.

- No public navigation link to the guide.
- No guide URLs in robots.txt, sitemap, public property APIs, discovery documents
  or Markdown snapshots.
- HTML `noindex, follow` and Worker `X-Robots-Tag` cover the guide pages.
- The Worker never negotiates guest HTML into Markdown.
- Worker applies the guide CSP and disables camera, microphone and geolocation.
  Do not copy the standalone project's global noindex headers into this website.
- Only fingerprinted `/_astro/` resources receive immutable caching. Guide HTML,
  saved GeoJSON and public fonts are not fingerprinted and must not be immutable.

Map code and tiles load on demand. Tiles disclose IP/request metadata and the
site origin to OpenStreetMap. Keep visible attribution and the current referrer
policy. No bulk downloads, tile prefetching, offline caching, geolocation or live
routing requests. The community tile service has no uptime guarantee; choose a
suitable hosted provider if traffic grows. Text remains available without tiles
or JavaScript. Search queries stay on-device, optionally in sessionStorage, not
in URLs or analytics.

## Verification and release

Latest local verification: build and Astro/TypeScript check passed with zero
diagnostics; 13 guide static/integration tests and the existing Worker, SEO,
distance, review and agent-readiness suites passed. Chromium: 76 passed and two
intentional viewport-specific skips. npm audit reported zero vulnerabilities.
The shared container crashed two Chromium pages in a parallel run; the full
serial rerun passed without retries. Browser tests now use one worker.

Static tests validate JSON, matcher behaviour, generated routes, metadata, route
geometry and discovery exclusions. Browser tests exercise mobile/desktop against
Wrangler, not Pages, and mock all tile requests. Existing property-site SEO,
Worker, review regression tests and agent checks remain separate.

Before release, test a real iPhone and Android, screen-reader use and a printed QR.
Automated axe checks are useful but do not establish full accessibility conformance.
Owner approval and deployment permission are still required.

A pre-integration working-tree snapshot (including pre-existing edits) was saved
outside the repository at `/tmp/nature-nook-integration-backup/nature-nook-before.tar.gz`.
This is a local safety copy, not a durable backup or part of deployment.
