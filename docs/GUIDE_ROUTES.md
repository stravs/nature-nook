# Saved trip routes

Imported route provenance from the standalone `guest-guide/` project. References
below to `data/**/*.md` name its historical source notes, not live files in this
site. Live content is `src/guide/data/places.json`. All geometry is served under
`/stay-k7m4/routes/`.

## Around the National Park

File: `public/stay-k7m4/routes/around-the-national-park.geojson` (GeoJSON coordinates use longitude, latitude).

Itinerary follows `data/day-trips/around-the-national-park.md`:
Bled (apartment) → Kranjska Gora → Vršič → Trenta → Bovec → Kobarid → Most na Soči → car train to Bohinjska Bistrica → Bled.

- Driving geometry: saved OSRM car-routing output from `https://routing.openstreetmap.de/routed-car/route/v1/driving/`, using OpenStreetMap data. Generated during implementation, not fetched from a routing service by guests.
- Outbound waypoints (lon, lat): `14.1150088,46.369473;13.7857,46.4846;13.7437123,46.4347793;13.752,46.381;13.552,46.338;13.579,46.247;13.744,46.153;13.7592521,46.1464082`.
- Return waypoints: `13.9591646,46.274266;14.1150088,46.369473`.
- OSRM options: `overview=full&geometries=geojson&steps=false`.
- Station locations were looked up with OpenStreetMap Nominatim. Point features use the road-snapped OSRM locations for driving stops.
- **The orange dashed car-train connection is schematic, not actual railway geometry.** Both the map legend and trip text say this explicitly. Do not present it as a road or navigable rail track.
- Bohinj here means arrival at Bohinjska Bistrica by car train; no extra detour to Lake Bohinj is added.
- Attribution: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright (ODbL). Attribution remains visible in the map footer.

This is a suggested itinerary, not a verified current-access route. Host review still needed, especially the station vehicle-loading approaches. Vršič can close seasonally; routing output is not a road-status check. The car train requires separate timetable/capacity checks. No road fallback is drawn and no Google Maps itinerary link has been added.

## Other day trips

All three routes below use the same saved OSRM car-routing source and options as above. All begin and end at the apartment in Bled. Green lines show roads only; no walking or gondola geometry is fabricated. Duplicate return stops are omitted from point markers. These are suggested itineraries requiring host/access review, not live navigation or verified parking locations.

### Bohinj Valley

File: `public/stay-k7m4/routes/bohinj-valley.geojson`.

Loop: Bled → Pokljuka (Goreljek) → Bohinjska Češnjica → Studor → Stara Fužina → Lake Bohinj at Ribčev Laz → lower Vogel gondola station → Bohinjska Bistrica → Bled.

OSRM waypoints (lon, lat): `14.1150088,46.369473;13.9742852,46.3319835;13.944523,46.2953919;13.9153237,46.2947004;13.8936598,46.2879339;13.8864,46.2774;13.835293,46.2755719;13.9539,46.2723;14.1150088,46.369473`.

Goreljek is the selected Pokljuka stop; the original notes name the plateau, not a specific stopping place. Village coordinates were looked up with Nominatim. The lower Vogel station coordinate is the lower endpoint of the OSM aerialway geometry returned by Nominatim for “Žičnica Vogel”. Mostnica / Voje walks start separately from the Stara Fužina area; the line does not go into the gorge or up the gondola. Check parking, seasonal access and restrictions.

### Radovna and Krma Valleys

File: `public/stay-k7m4/routes/radovna-krma-valleys.geojson`.

Out and back: Bled → Zgornje Gorje → Radovna Valley / road near Lake Kreda → Pr’ Psnak → road near Kovinarska koča → same stops → Bled.

OSRM waypoints (lon, lat): `14.1150088,46.369473;14.0680616,46.3798235;13.991869,46.4163806;13.9405828,46.431929;13.923705,46.4005767;13.9405828,46.431929;13.991869,46.4163806;14.0680616,46.3798235;14.1150088,46.369473`.

Existing guide coordinates supply Kreda, Pr’ Psnak and Kovinarska koča. OSRM snaps the lake coordinate about 122 m to the road; the marker deliberately labels the nearby road, not lake entry or parking. This is a **car-routing profile**, not a verified cycling route, even though the original tip mentions cycling. Check valley road restrictions and hut opening.

### Mojstrana and Vrata Valley

File: `public/stay-k7m4/routes/mojstrana-vrata-valley.geojson`.

Out and back: Bled → Slovenian Alpine Museum → Koča pri Peričniku (roadside access for the waterfall walk) → road near Aljažev dom → same stops → Bled.

OSRM waypoints (lon, lat): `14.1150088,46.369473;13.9362138,46.4579405;13.8963167,46.4385456;13.8434212,46.4090312;13.8963167,46.4385456;13.9362138,46.4579405;14.1150088,46.369473`.

The museum and Aljažev dom use existing guide coordinates. Koča pri Peričniku was looked up with Nominatim; the waterfall itself is not a driving destination. The OSRM route includes **A2 motorway** sections; trip text flags vignette requirements. Vrata can have seasonal vehicle restrictions, managed parking and shuttle arrangements. The road line is **not permission to drive to the hut**. Confirm the permitted vehicle endpoint before publishing as a checked itinerary.

## Adding another route

Save a GeoJSON FeatureCollection under `public/stay-k7m4/routes/`, then set the place's optional `route` field in `src/guide/data/places.json` to `/stay-k7m4/routes/<name>.geojson`. Line features use `properties.mode` (`drive` or `train`). Optional Point features use `properties.name` and `properties.order` for stop tooltips. Use actual routed geometry for roads, not straight lines between towns.

## Walks from the door

Files: `public/stay-k7m4/routes/walk-{lake,market,morning-short,morning-long,sava}.geojson`.

Converted from the host's hand-drawn lines in `docs/legacy-guide/data/routes.json` (same paths as the host's paper map). Text comes from `docs/legacy-guide/content/en/walk-*.md`. Line features use `properties.mode` `walk`, or `bike` for the Sava route. They are approximate and are labelled "hand-drawn" in the guide; they are not routed geometry. Pins sit at the walk's end, or its farthest point for the two morning loops.

## Map display

The Places tab opens recommendations as a list grouped by category (From the door, Food & drinks, Hiking, Day trips, Rainy day), nearest first; walks keep the host's order. One category or All is active at a time; the map shows the same pins. Desktop shows list and map side by side; phones switch with a floating List/Map button, and tapping a card with a pin opens the map with the details sheet. On phones a sideways swipe switches between Apartment and Places (not on the map, category chips or details sheet).

Each trip shows as one pin until selected: Around the National Park at Bovec, the others at their end destination (Lake Bohinj, Kovinarska koča road end, Aljažev dom road end). Selecting a trip or walk draws its route and hides the other pins. Trips also list hiking and food places within 1.5 km of the driving line under "On the way" (places within 5 km of the apartment are skipped). Trip text is split into numbered `stops`; the route disclaimer is in `note` and shown last. Closing a place, or opening the map after picking a category in the phone list, fits every pin in the active category.
