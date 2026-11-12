# Printable guest brochure

## Compact Bled-first edition

- `/stay-k7m4/print`: eight A5 pages in reading order (148 × 210 mm).
- `/stay-k7m4/print/booklet`: four A4 landscape sides, already imposed for two duplex sheets.
- `/stay-k7m4/share`: separate existing QR cards.

Page 1 puts Wi-Fi access and the guest-guide QR side by side beneath the welcome image. The cover currently includes a working QR for the demo network, plus readable demo network/password and a prominent “Demo Wi-Fi — replace before sharing” label, as requested. Approved real credentials also render as a connection QR; unapproved non-demo credentials remain hidden. Pages 2–4 cover arrival, equipment, rules and checkout. Page 5 has a larger, muted Bled street map with all 13 mapped local recommendations, including nearby villages. The five saved local routes are drawn as actual SVG paths. Page 6 provides the matching local key with names and practical area/time labels. Page 7 briefly mentions the other 21 recommendations, including Vintgar, grouped by type, with mountain/access cautions. Page 8 has emergency numbers, host contact and the online-guide QR.

This is deliberately a short introduction, not the full guide. Full descriptions, trip stops, saved routes, access notes and useful tips remain online. Missing coordinates are never invented. The Slovenian stay page explicitly labels the print edition English.

Both routes work without JavaScript and make no external requests. The print button waits for assets, checks overflow and opens the browser dialog. Browser Print also works. Routes use canonical/noindex metadata and are excluded from public sitemaps and agent resources. Noindex is not access control.

## Map

`public/stay-k7m4/maps/local.webp` is a bundled OpenStreetMap extract with visible attribution and a copyright link. The numbered SVG overlay uses the same Web Mercator projection. Five coloured paths preserve every coordinate from the saved local GeoJSON routes; no straight-line shortcuts or smoothing are invented. Walking routes are solid, the longer morning loop is dashed, and the Sava car/bike route is dotted and explicitly labelled. White casings improve contrast over a muted basemap. Crowded labels have leader lines to their geographic anchors. All 13 selected Bled-area coordinates appear exactly once; numbers match page 6. Bounds and the explicit Vintgar exclusion are in `src/guide/lib/brochure.ts`. The map uses zoom 15, centred to keep all five routes and the Sava destination visible. Vintgar is mentioned only on page 7.

These are the existing host-drawn routes, not verified navigation. The map is for orientation, not trail navigation, entrances or parking. No regional map or long itineraries are printed.

Normal builds never fetch tiles. To intentionally refresh the one fixed print extract:

```sh
node scripts/prepare-brochure-maps.mjs
```

This uses the existing Sharp dependency, identifies the application and reuses cached tiles in `/tmp/nature-nook-map-tiles`. Respect the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/); do not turn this into bulk/offline tile downloading. The committed WebP and `src/guide/data/brochure-maps.json` support builds and printing without external services. Update the printed extract date after refreshing.

## Print

**Reading copy:** A5, portrait, actual size (100%), no additional margins, no browser headers/footers. Eight pages.

**Folded booklet:** A4, landscape, duplex, **flip on short edge**, actual size (100%), no extra margins or browser headers/footers. Do not enable another booklet or multiple-pages-per-sheet mode. Imposition is `[8,1] [2,7] [6,3] [4,5]`. Each panel has 12 mm safe margins. The 1 mm difference between two panels and A4 is centred.

Print a test, nest the inner sheet inside the outer, fold together and staple at the fold. Background graphics are optional. Physical checks are still needed for grayscale/map legibility, QR scanning and duplex orientation.

## Generate PDFs

```sh
npm ci
npx playwright install chromium
npm run build:brochure
```

Outputs:

- `dist/stay-k7m4/guest-brochure-a5.pdf`: eight A5 pages.
- `dist/stay-k7m4/guest-brochure-booklet-a4.pdf`: four A4 landscape sides.

The generator serves `dist` temporarily, waits for fonts/images, rejects overflowing content, checks PDF dimensions/page counts and closes its browser/server. Standard builds do not need Chromium and remove previously generated PDFs. No unconditional PDF download links are shown.

Set `SITE_URL` before building for the production QR/link origin.

## Editing and approval

- `src/guide/lib/brochure.ts`: local selection, numbering, page plan, imposition and draft/Wi-Fi policy.
- `BrochurePage.astro`: page frame, essentials and emergency page.
- `BrochureContent.astro`: compact local directory and farther-away mentions.
- `BrochureMap.astro`: basemap, projection, pins and map key.
- `Brochure.astro`: preview, instructions and paged-media rules.

Components live under `src/guide/components/`. Shared facts come from existing apartment/instruction/place JSON. Preserve readable body text, full stay instructions and honest safety context. Only paged-media rules use plain CSS; other styling uses Tailwind.

**Draft pending owner review.** The explicitly labelled demo Wi-Fi is printed on the cover for layout review; replace it before sharing with guests. Unapproved non-demo credentials remain hidden and every page is marked draft. Confirm stay details, equipment, safety, host contact and coordinates before release. Do not add door codes or reservation-specific details to public routes, or merely flip the approval flag to hide the draft labels.

## Checks

```sh
npm run build:brochure
npm test
npx playwright test tests/guide/e2e/brochure.spec.ts
```

Static tests cover the eight pages, imposition, QR destination, sitemap exclusion, every local map pin/key entry, local basemap attribution, and all farther-away mentions. Browser checks cover no-JS/external requests, print controls, keyboard switching, accessibility, overflow and PDF dimensions/counts on mobile and desktop. Automated Chromium checks do not replace a physical print or other browser testing.
