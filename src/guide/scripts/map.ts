import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { icons } from '../lib/icons';
import type { FeatureCollection } from 'geojson';

export interface MapPlace {
  id: string; title: string; summary: string; coordinates: [number, number] | null;
  group: string; category: string; href: string; directions: string | null; route?: string;
}
interface Options {
  root: HTMLElement;
  places: MapPlace[];
  home: { title: string; coordinates: [number, number] };
  position?: { center: [number, number]; zoom: number } | undefined;
  layers: string[];
  selectedId?: string | undefined;
  onSelect(id?: string): void;
  onMove(position: { center: [number, number]; zoom: number }): void;
}
export function createMap(options: Options) {
  const { root, home, places } = options;
  const feedback = root.querySelector<HTMLElement>('#map-feedback')!;
  const card = root.querySelector<HTMLElement>('#places-drawer')!;
  const routeStatus = root.querySelector<HTMLElement>('#selected-route-status')!;
  const messages = JSON.parse(root.dataset.messages!);
  // Saved positions stay [longitude, latitude] for compatibility; Leaflet uses [lat, lng].
  const initialCenter: L.LatLngTuple = options.position
    ? [options.position.center[1], options.position.center[0]] : home.coordinates;
  const map = L.map(root.querySelector<HTMLElement>('#map-canvas')!, {
    zoomControl: false, attributionControl: false, minZoom: 7, maxZoom: 19,
    zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
  }).setView(initialCenter, Math.min(19, Math.max(7, options.position?.zoom ?? 13)));
  // Attribution is always visible in the guide's bar, outside both drawers.
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  // Bottom controls stack upward: adding Home second places it above zoom.
  const homeControl = new L.Control({ position: 'bottomright' });
  homeControl.onAdd = () => {
    const button = root.querySelector<HTMLButtonElement>('#map-home')!;
    button.hidden = false;
    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.disableScrollPropagation(button);
    return button;
  };
  homeControl.addTo(map);
  let tileFailed = false;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, updateWhenIdle: true, keepBuffer: 0,
  }).on('load', () => { if (!tileFailed) feedback.hidden = true; })
    .on('tileerror', () => { tileFailed = true; feedback.textContent = messages.mapFailed; feedback.hidden = false; })
    .addTo(map);
  map.on('moveend', () => {
    const center = map.getCenter();
    options.onMove({ center: [center.lng, center.lat], zoom: map.getZoom() });
  });

  function visibleMapPadding() {
    const canvas = map.getContainer().getBoundingClientRect();
    const toolbar = root.querySelector<HTMLElement>('#map-toolbar')!.getBoundingClientRect();
    const top = Math.max(24, toolbar.bottom - canvas.top + 16);
    let bottom = 24;
    let right = 24;
    let left = 24;
    for (const id of ['places-drawer', 'mobile-place-options', 'routes-overview']) {
      const rect = root.querySelector<HTMLElement>(`#${id}`)!.getBoundingClientRect();
      if (rect.height && rect.left < canvas.right - 1 && rect.right > canvas.left + 1 && rect.top < canvas.bottom && rect.top > canvas.top) {
        if (rect.left > canvas.left + canvas.width / 2 && rect.width < canvas.width / 2) right = Math.max(right, canvas.right - rect.left + 16);
        else if (rect.right < canvas.left + canvas.width / 2 && rect.width < canvas.width / 2) left = Math.max(left, rect.right - canvas.left + 16);
        else bottom = Math.max(bottom, canvas.bottom - rect.top + 16);
      }
    }
    return { paddingTopLeft: L.point(left, top), paddingBottomRight: L.point(right, bottom) };
  }
  function centerPlace(coordinates: [number, number], zoom: number) {
    map.invalidateSize({ animate: false });
    map.fitBounds(L.latLngBounds([coordinates]), { ...visibleMapPadding(), maxZoom: zoom, animate: false });
  }
  const homePane = map.createPane('home-marker');
  homePane.style.zIndex = '625';
  let selectedId = options.selectedId;
  let layers = new Set(options.layers);
  let markers: L.Marker[] = [];
  let routeLayer: L.GeoJSON | undefined;
  let routeRequest: AbortController | undefined;
  const overview = root.querySelector<HTMLElement>('#routes-overview')!;
  const overviewStatus = root.querySelector<HTMLElement>('#routes-overview-status')!;
  const overviewChoices = root.querySelector<HTMLElement>('#routes-overview-choices')!;
  const overviewLayers = L.featureGroup().addTo(map);
  let overviewRequest: AbortController | undefined;
  function clearOverview() {
    overviewRequest?.abort(); overviewRequest = undefined;
    overviewLayers.clearLayers(); overviewChoices.replaceChildren(); overview.hidden = true;
  }
  async function showOverview(fit = false) {
    clearOverview();
    if (!layers.has('day-trips')) return;
    const request = new AbortController(); overviewRequest = request;
    overview.hidden = false; overviewStatus.textContent = messages.routeLoading;
    const trips = places.filter(place => place.category === 'day-trips' && place.route);
    const colors = ['#23483c', '#2563eb', '#9333ea', '#be123c'];
    const results = await Promise.allSettled(trips.map(async (place, index) => {
      const response = await fetch(place.route!, { signal: request.signal });
      if (!response.ok) throw new Error('Route unavailable');
      const data: FeatureCollection = await response.json();
      if (request.signal.aborted) return;
      const color = colors[index % colors.length]!;
      const layer = L.geoJSON(data, {
        filter: feature => feature.geometry.type !== 'Point',
        style: feature => ({
          color: feature?.properties?.mode === 'train' ? '#b45309' : color,
          weight: 5, opacity: 0.85,
          dashArray: feature?.properties?.mode === 'train' ? '9 9' : undefined,
          className: 'day-trip-overview',
        }),
        onEachFeature: (_feature, path) => {
          const label = document.createElement('span'); label.textContent = place.title;
          path.bindTooltip(label);
          path.on('click', () => selectPlace(place.id));
          path.on('add', () => (path as L.Path).getElement()?.setAttribute('data-trip-id', place.id));
        },
      });
      if (!layer.getBounds().isValid()) throw new Error('Invalid route');
      overviewLayers.addLayer(layer);
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'flex min-h-12 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-paper';
      const swatch = document.createElement('span'); swatch.className = 'h-1 w-5 shrink-0 rounded';
      swatch.style.backgroundColor = color;
      button.append(swatch, document.createTextNode(place.title));
      button.addEventListener('click', () => selectPlace(place.id));
      overviewChoices.append(button);
    }));
    if (request.signal.aborted) return;
    const failed = results.some(result => result.status === 'rejected');
    overviewStatus.textContent = failed ? messages.routeOverviewFailed : '';
    overview.hidden = !failed;
    const bounds = overviewLayers.getBounds();
    if (fit && bounds.isValid()) {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds, { ...visibleMapPadding(), maxZoom: 12, animate: false });
    }
  }
  function clearRoute() {
    routeRequest?.abort(); routeRequest = undefined;
    routeLayer?.remove(); routeLayer = undefined;
    routeStatus.hidden = true;
    renderMarkers();
  }
  async function showRoute(place: MapPlace) {
    if (!place.route) return;
    const request = new AbortController();
    routeRequest = request;
    routeStatus.textContent = messages.routeLoading; routeStatus.hidden = false;
    try {
      const response = await fetch(place.route, { signal: request.signal });
      if (!response.ok) throw new Error('Route unavailable');
      const data: FeatureCollection = await response.json();
      if (request.signal.aborted) return;
      const layer = L.geoJSON(data, {
        style: feature => ({
          color: feature?.properties?.mode === 'train' ? '#b45309' : '#23483c',
          weight: 5, opacity: 0.9,
          dashArray: feature?.properties?.mode === 'train' ? '9 9' : undefined,
          className: `trip-route-${feature?.properties?.mode ?? 'drive'}`,
        }),
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
          radius: 6, color: '#23483c', weight: 2, fillColor: '#fff', fillOpacity: 1,
        }),
        onEachFeature: (feature, layer) => {
          if (feature.geometry.type !== 'Point') return;
          const label = document.createElement('span');
          label.textContent = `${feature.properties.order}. ${feature.properties.name}`;
          layer.bindTooltip(label);
        },
      });
      if (!layer.getBounds().isValid()) throw new Error('Invalid route');
      routeLayer = layer.addTo(map);
      const hasTrain = data.features.some(feature => feature.properties?.mode === 'train');
      routeStatus.textContent = hasTrain ? messages.routeLegend : messages.routeDrivingLegend;
      map.invalidateSize({ animate: false });
      map.fitBounds(layer.getBounds(), { ...visibleMapPadding(), maxZoom: 12, animate: false });
    } catch {
      if (request.signal.aborted) return;
      routeLayer?.remove(); routeLayer = undefined;
      routeStatus.textContent = messages.routeFailed;
      renderMarkers();
    }
  }
  function showHome() {
    clearRoute();
    selectedId = undefined; options.onSelect(undefined);
    renderMarkers();
    card.hidden = true;
    centerPlace(home.coordinates, 15);
    root.querySelector<HTMLButtonElement>('#map-home')!.focus({ preventScroll: true });
  }

  function selectPlace(id: string, _focus = true, inline = false) {
    const place = places.find(place => place.id === id && place.coordinates);
    if (!place?.coordinates) return;
    if (!inline) { options.onSelect(id); return; }
    clearRoute();
    selectedId = id;
    renderMarkers();
    centerPlace(place.coordinates, Math.max(map.getZoom(), 14));
    void showRoute(place);
  }
  // Every place gets its own marker. Home uses a higher pane so it always wins overlaps.
  function renderMarkers() {
    markers.forEach(marker => marker.remove()); markers = [];
    const candidates = [{ id: 'home', title: home.title, coordinates: home.coordinates, group: 'home', category: 'home' },
      ...places.filter(place => place.coordinates && layers.has(place.category) && (!place.route || place.id === selectedId))];
    for (const place of candidates) {
      const button = document.createElement('button');
      button.type = 'button';
      const group = place.group;
      const selected = place.id === selectedId;
      const color = selected ? 'bg-forest ring-4 ring-forest/25' : group === 'eat' ? 'bg-clay' : group === 'do' ? 'bg-moss' : 'bg-forest';
      button.className = `flex size-12 items-center justify-center rounded-full border-[3px] border-white ${color} text-base font-bold text-white shadow-lg`;
      button.setAttribute('aria-pressed', String(selected));
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', width: '20', height: '20' })) svg.setAttribute(name, value);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', icons[group === 'home' ? 'home' : group === 'eat' ? 'food' : group === 'do' ? 'hiking' : 'pin']);
      svg.append(path); button.append(svg);
      button.setAttribute('aria-label', place.title);
      button.dataset.pinIds = JSON.stringify([place.id]);
      button.addEventListener('click', () => place.id === 'home' ? showHome() : selectPlace(place.id));
      L.DomEvent.disableClickPropagation(button);
      markers.push(L.marker(place.coordinates!, {
        keyboard: false,
        zIndexOffset: selected ? 1000 : 0,
        pane: place.id === 'home' ? 'home-marker' : 'markerPane',
        icon: L.divIcon({ html: button, className: '', iconSize: [48, 48], iconAnchor: [24, 24] }),
      }).addTo(map));
    }
  }
  new ResizeObserver(() => map.invalidateSize({ animate: false })).observe(map.getContainer());
  function setLayers(next: string[]) {
    const hadTrips = layers.has('day-trips');
    layers = new Set(next);
    if (selectedId && !layers.has(places.find(place => place.id === selectedId)?.category ?? '')) {
      selectedId = undefined; clearRoute(); card.hidden = true; options.onSelect(undefined);
    }
    renderMarkers();
    if (!layers.has('day-trips')) clearOverview();
    else if (!hadTrips) void showOverview(true);
  }
  root.querySelector('#map-home')!.addEventListener('click', showHome);
  function closeCard() {
    clearRoute();
    card.hidden = true; selectedId = undefined; options.onSelect(undefined);
    renderMarkers();
    root.querySelector<HTMLButtonElement>('#map-home')!.focus({ preventScroll: true });
  }
  root.querySelector('#close-places')!.addEventListener('click', closeCard);
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && selectedId && event.defaultPrevented) closeCard(); });
  renderMarkers();
  if (layers.has('day-trips')) void showOverview();
  const center = map.getCenter();
  options.onMove({ center: [center.lng, center.lat], zoom: map.getZoom() });
  if (selectedId) {
    selectPlace(selectedId, false);
    if (options.position) map.setView(initialCenter, Math.min(19, Math.max(7, options.position.zoom)), { animate: false });
  }
  return { resize: () => map.invalidateSize({ animate: false }), setLayers, selectPlace,
    focusPlace: (id: string) => selectPlace(id, false, true),
  };
}
