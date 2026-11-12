import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { icons } from '../lib/icons';
import { categoryStyle } from '../lib/category-style';
import type { FeatureCollection } from 'geojson';

export interface MapPlace {
  id: string; title: string; coordinates: [number, number] | null; category: string; route?: string;
}
interface Options {
  root: HTMLElement;
  places: MapPlace[];
  home: { title: string; coordinates: [number, number] };
  position?: { center: [number, number]; zoom: number } | undefined;
  category: string;
  selectedId?: string | undefined;
  onSelect(id?: string): void;
  onMove(position: { center: [number, number]; zoom: number }): void;
}
export function createMap(options: Options) {
  const { root, home, places } = options;
  const feedback = root.querySelector<HTMLElement>('#map-feedback')!;
  const routeStatus = root.querySelector<HTMLElement>('#selected-route-status')!;
  const nearby = root.querySelector<HTMLElement>('#route-nearby')!;
  const nearbyList = root.querySelector<HTMLElement>('#route-nearby-list')!;
  const messages = JSON.parse(root.dataset.messages!);
  // Saved positions stay [longitude, latitude] for compatibility; Leaflet uses [lat, lng].
  const initialCenter: L.LatLngTuple = options.position
    ? [options.position.center[1], options.position.center[0]] : home.coordinates;
  const map = L.map(root.querySelector<HTMLElement>('#map-canvas')!, {
    zoomControl: false, attributionControl: false, minZoom: 7, maxZoom: 19,
    zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
  }).setView(initialCenter, Math.min(19, Math.max(7, options.position?.zoom ?? 13)));
  // Attribution is always visible in the guide's own credits bar.
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  // Bottom controls stack upward: adding Home second places it above zoom.
  const homeButton = root.querySelector<HTMLButtonElement>('#map-home')!;
  const homeControl = new L.Control({ position: 'bottomright' });
  homeControl.onAdd = () => {
    homeButton.hidden = false;
    L.DomEvent.disableClickPropagation(homeButton);
    L.DomEvent.disableScrollPropagation(homeButton);
    return homeButton;
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

  // Keep fitted content clear of the details drawer and the floating List/Map button.
  function visibleMapPadding() {
    const canvas = map.getContainer().getBoundingClientRect();
    let bottom = 24, right = 24;
    for (const id of ['places-drawer', 'mode-toggle']) {
      const rect = root.querySelector<HTMLElement>(`#${id}`)!.getBoundingClientRect();
      if (!rect.height || rect.left >= canvas.right - 1 || rect.right <= canvas.left + 1 || rect.top >= canvas.bottom || rect.top <= canvas.top) continue;
      if (rect.left > canvas.left + canvas.width / 2) right = Math.max(right, canvas.right - rect.left + 16);
      else bottom = Math.max(bottom, canvas.bottom - rect.top + 16);
    }
    return { paddingTopLeft: L.point(24, 24), paddingBottomRight: L.point(right, bottom) };
  }
  function fit(bounds: L.LatLngBounds, maxZoom: number) {
    map.invalidateSize({ animate: false });
    map.fitBounds(bounds, { ...visibleMapPadding(), maxZoom, animate: false });
  }
  const homePane = map.createPane('home-marker');
  homePane.style.zIndex = '625';
  let selectedId = options.selectedId;
  let category = options.category;
  let markers: L.Marker[] = [];
  let routeLayer: L.GeoJSON | undefined;
  let routeRequest: AbortController | undefined;
  // Hiking and food places along the selected day trip.
  let onTheWay = new Set<string>();
  const selected = () => places.find(place => place.id === selectedId);
  const inCategory = (place: MapPlace) => category === 'all' || place.category === category;
  // A selected route shows only itself and its stops; otherwise the active category.
  function visiblePlaces() {
    const current = selected();
    return places.filter(place => place.coordinates && (current?.route
      ? place.id === current.id || onTheWay.has(place.id)
      : place.id === selectedId || inCategory(place)));
  }
  function clearRoute() {
    routeRequest?.abort(); routeRequest = undefined;
    routeLayer?.remove(); routeLayer = undefined;
    routeStatus.hidden = true;
    onTheWay = new Set(); nearby.hidden = true; nearbyList.replaceChildren();
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
        style: feature => {
          const mode = feature?.properties?.mode ?? 'drive';
          const path = mode === 'walk' || mode === 'bike';
          return {
            color: mode === 'train' ? '#b45309' : path ? '#2d5d7b' : '#23483c',
            weight: path ? 6 : 5, opacity: 0.9, lineCap: 'round',
            dashArray: mode === 'train' ? '9 9' : path ? '1 10' : undefined,
            className: `trip-route-${mode}`,
          };
        },
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
          radius: 6, color: '#23483c', weight: 2, fillColor: '#fff', fillOpacity: 1, className: 'trip-route-stop',
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
      const modes = new Set(data.features.map(feature => feature.properties?.mode));
      routeStatus.textContent = modes.has('train') ? messages.routeLegend : modes.has('drive') ? messages.routeDrivingLegend : messages.walkLegend;
      if (place.category === 'day-trips') showOnTheWay(data);
      fit(layer.getBounds(), modes.has('drive') ? 12 : 16);
    } catch {
      if (request.signal.aborted) return;
      routeLayer?.remove(); routeLayer = undefined;
      routeStatus.textContent = messages.routeFailed;
    }
  }
  // Places within 1.5 km of the driving line, excluding Bled itself (within 5 km of home).
  function showOnTheWay(data: FeatureCollection) {
    const points = data.features.flatMap(feature => feature.geometry.type === 'LineString' && feature.properties?.mode === 'drive'
      ? feature.geometry.coordinates.map(([lng, lat]) => [lat!, lng!] as [number, number]) : []);
    const km = (a: [number, number], b: [number, number]) =>
      Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos(a[0] * Math.PI / 180)) * 111.2;
    const found = places.filter(place => place.coordinates && ['hiking', 'food-drinks'].includes(place.category)
      && km(place.coordinates, home.coordinates) > 5 && points.some(point => km(place.coordinates!, point) < 1.5));
    onTheWay = new Set(found.map(place => place.id));
    for (const place of found) {
      const button = document.createElement('button'); button.type = 'button'; button.lang = 'en';
      button.dataset.openPlace = place.id; button.textContent = place.title;
      button.className = 'min-h-12 rounded-full border border-forest/15 bg-white px-4 py-2 text-left text-base font-semibold hover:bg-sage';
      nearbyList.append(button);
    }
    nearby.hidden = !found.length;
    renderMarkers();
  }
  function pin(place: { id: string; title: string; category: string }, isSelected: boolean) {
    const button = document.createElement('button');
    button.type = 'button';
    const style = categoryStyle[place.category];
    const color = isSelected ? 'border-forest bg-white text-forest ring-4 ring-forest/30'
      : `border-white text-white ${place.id === 'home' ? 'bg-forest' : style?.color ?? 'bg-forest'}`;
    button.className = `flex size-12 items-center justify-center rounded-full border-[3px] ${color} shadow-lg`;
    button.setAttribute('aria-pressed', String(isSelected));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', width: '20', height: '20' })) svg.setAttribute(name, value);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', icons[place.id === 'home' ? 'home' : style?.icon ?? 'pin']);
    svg.append(path); button.append(svg);
    button.setAttribute('aria-label', place.title);
    button.dataset.pinIds = JSON.stringify([place.id]);
    return button;
  }
  // Every place gets its own marker. Home uses a higher pane so it always wins overlaps.
  function renderMarkers() {
    markers.forEach(marker => marker.remove()); markers = [];
    const homePlace = { id: 'home', title: home.title, coordinates: home.coordinates, category: 'home' };
    for (const place of [homePlace, ...visiblePlaces()]) {
      const isSelected = place.id === selectedId;
      const button = pin(place, isSelected);
      button.addEventListener('click', () => place.id === 'home' ? showHome() : options.onSelect(place.id));
      L.DomEvent.disableClickPropagation(button);
      markers.push(L.marker(place.coordinates!, {
        keyboard: false,
        zIndexOffset: isSelected ? 1000 : 0,
        pane: place.id === 'home' ? 'home-marker' : 'markerPane',
        icon: L.divIcon({ html: button, className: '', iconSize: [48, 48], iconAnchor: [24, 24] }),
      }).addTo(map));
    }
  }
  function showHome() {
    options.onSelect(undefined);
    fit(L.latLngBounds([home.coordinates]), 15);
    homeButton.focus({ preventScroll: true });
  }
  function select(id: string) {
    const place = places.find(place => place.id === id && place.coordinates);
    clearRoute();
    selectedId = place?.id;
    renderMarkers();
    if (!place) return;
    fit(L.latLngBounds([place.coordinates!]), Math.max(map.getZoom(), 14));
    void showRoute(place);
  }
  // Fit the active category's pins, keeping the apartment in view.
  function showAll() {
    const points = [home.coordinates, ...visiblePlaces().map(place => place.coordinates!)];
    fit(L.latLngBounds(points), 15);
  }
  // With nothing selected, zoom back out to the whole category.
  function clear() {
    clearRoute();
    selectedId = undefined;
    renderMarkers();
    showAll();
  }
  function setCategory(next: string) {
    category = next;
    renderMarkers();
    if (!selectedId) showAll();
  }
  homeButton.addEventListener('click', showHome);
  // A hidden map (search, other tab, phone list) has no size; re-measuring then would shift its centre.
  const resize = () => { const box = map.getContainer(); if (box.clientWidth && box.clientHeight) map.invalidateSize({ animate: false }); };
  new ResizeObserver(resize).observe(map.getContainer());
  renderMarkers();
  const center = map.getCenter();
  options.onMove({ center: [center.lng, center.lat], zoom: map.getZoom() });
  if (selectedId) {
    select(selectedId);
    if (options.position) map.setView(initialCenter, Math.min(19, Math.max(7, options.position.zoom)), { animate: false });
  }
  return { resize, setCategory, select, clear };
}
