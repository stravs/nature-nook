import { searchDocuments, normalize, type SearchDocument } from '../lib/search';
import type { Messages } from '../lib/guide-data';
import type { MapPlace } from './map';

type View = 'stay' | 'map';
const layerIds = ['hiking', 'day-trips', 'food-drinks', 'rainy-day'] as const;
type Layer = typeof layerIds[number];
interface State {
  view: View; layers: Layer[]; query: string; scroll: number; resultScroll: number;
  selectedId?: string | undefined; position?: { center: [number, number]; zoom: number } | undefined;
}
const key = 'nature-nook-guide-v2';
const isLayer = (value: unknown): value is Layer => layerIds.includes(value as Layer);
const viewFrom = (value: unknown): View | undefined => value === 'stay' ? 'stay' : value === 'map' || value === 'places' ? 'map' : undefined;
const root = document.querySelector<HTMLElement>('#guide');
if (root) start(root);
function start(root: HTMLElement) {
  const t: Messages = JSON.parse(root.dataset.messages!);
  const documents: SearchDocument[] = JSON.parse(root.dataset.documents!);
  const places: MapPlace[] = JSON.parse(root.dataset.places!);
  const home = JSON.parse(root.dataset.home!);
  const state: State = { view: 'stay', layers: [...layerIds], query: '', scroll: 0, resultScroll: 0 };
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? '{}');
    state.view = viewFrom(saved.view) ?? 'stay';
    if (Array.isArray(saved.layers)) state.layers = [...new Set(saved.layers.filter(isLayer))] as Layer[];
    else if (isLayer(saved.filter)) state.layers = [saved.filter];
    if (typeof saved.query === 'string') state.query = saved.query;
    if (typeof saved.selectedId === 'string') state.selectedId = saved.selectedId;
    if (Number.isFinite(saved.scroll) && saved.scroll >= 0) state.scroll = saved.scroll;
    if (Number.isFinite(saved.resultScroll) && saved.resultScroll >= 0) state.resultScroll = saved.resultScroll;
    const p = saved.position;
    if (Array.isArray(p?.center) && p.center.length === 2 && p.center.every(Number.isFinite) && Math.abs(p.center[0]) <= 180 && Math.abs(p.center[1]) <= 85 && p.zoom >= 0 && p.zoom <= 20) state.position = p;
  } catch { /* Storage is optional. */ }
  const input = root.querySelector<HTMLInputElement>('#search-query')!;
  const searchControl = root.querySelector<HTMLElement>('#search-control')!;
  const searchToggle = root.querySelector<HTMLButtonElement>('#search-toggle')!;
  const searchForm = root.querySelector<HTMLFormElement>('#guide-search')!;
  function setSearchOpen(open: boolean) {
    searchControl.dataset.expanded = String(open);
    searchToggle.hidden = open;
    searchToggle.setAttribute('aria-expanded', String(open));
    searchForm.hidden = !open;
  }
  searchToggle.addEventListener('click', () => { setSearchOpen(true); input.focus(); });
  searchControl.addEventListener('focusout', event => {
    if (!searchControl.contains(event.relatedTarget as Node | null) && !input.value.trim()) setSearchOpen(false);
  });
  document.addEventListener('pointerdown', event => {
    if (event.target instanceof Node && !searchControl.contains(event.target) && !input.value.trim()) setSearchOpen(false);
  });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    input.value = ''; updateQuery(); setSearchOpen(false); searchToggle.focus();
  });
  const main = root.querySelector<HTMLElement>('#main-content')!;
  const stay = root.querySelector<HTMLElement>('#stay')!;
  const mapView = root.querySelector<HTMLElement>('#map-view')!;
  const output = root.querySelector<HTMLElement>('#search-output')!;
  const results = root.querySelector<HTMLElement>('#search-results')!;
  const count = root.querySelector<HTMLElement>('#search-count')!;
  const topicIds = new Set(documents.filter(doc => doc.kind === 'apartment').map(doc => doc.id));
  const drawer = root.querySelector<HTMLElement>('#places-drawer')!;
  const mapCanvas = root.querySelector<HTMLElement>('#map-canvas')!;
  function syncMapControls() {
    const open = !drawer.hidden;
    root.dataset.panel = open ? 'open' : 'closed';
    mapCanvas.inert = false;
    // The toolbar sits above the mobile bottom drawer and remains usable.
    root.querySelector<HTMLElement>('#map-toolbar')!.inert = false;
  }
  function setPlaces(open: boolean, focus = false) {
    drawer.hidden = !open;
    syncMapControls();
    if (focus) root.querySelector<HTMLElement>(open ? '#places-title' : '#map-home')!.focus({ preventScroll: true });
  }
  window.matchMedia('(min-width: 1024px)').addEventListener('change', syncMapControls);
  setPlaces(false);
  root.querySelector('#close-places')!.addEventListener('click', () => setPlaces(false, true));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !drawer.hidden) { setPlaces(false, true); event.preventDefault(); }
  });
  // Non-modal drawers leave map panning, zooming and place selection usable.
  const observer = new MutationObserver(syncMapControls);
  observer.observe(drawer, { attributes: true, attributeFilter: ['hidden'] });
  let map: ReturnType<typeof import('./map').createMap> | undefined;
  let mapPromise: Promise<void> | undefined;
  const searching = () => !!normalize(state.query);
  function save() { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* Optional. */ } }
  function captureScroll() { if (searching()) state.resultScroll = main.scrollTop; else state.scroll = main.scrollTop; }
  function ensureMap() {
    if (map) { map.resize(); return Promise.resolve(); }
    if (!mapPromise) mapPromise = import('./map').then(({ createMap }) => {
      map = createMap({ root, places, home, layers: state.layers, selectedId: drawer.hidden ? state.selectedId : undefined, position: state.position,
        onSelect(id) { if (id) openDetails(id); else setPlaces(false); state.selectedId = id; save(); }, onMove(position) { state.position = position; save(); },
      });
    }).catch(() => {
      const feedback = root.querySelector<HTMLElement>('#map-feedback')!;
      feedback.textContent = t.mapFailed;
      feedback.hidden = false;
    });
    return mapPromise;
  }
  function renderResults() {
    results.replaceChildren();
    if (!searching()) return;
    const matches = searchDocuments(documents, state.query);
    count.textContent = `${t.results}: ${matches.length}`;
    if (!matches.length) {
      const p = document.createElement('p'); p.textContent = `${t.noResults} “${state.query}”`; results.append(p);
    }
    for (const [kind, label] of [['apartment', t.guestInfo], ['place', t.places]] as const) {
      const group = matches.filter(doc => doc.kind === kind);
      if (!group.length) continue;
      const section = document.createElement('section');
      const heading = document.createElement('h2'); heading.className = 'mb-3 text-xl font-semibold'; heading.textContent = label;
      const list = document.createElement('ul'); list.className = 'space-y-3';
      for (const doc of group) {
        const item = document.createElement('li'); item.className = 'rounded-xl border border-forest/15 bg-white p-4';
        const a = document.createElement('a'); a.href = doc.href; a.textContent = doc.title;
        a.className = 'inline-flex min-h-12 items-center py-2 font-semibold underline';
        if (doc.kind === 'apartment') { a.dataset.topic = doc.id; a.dataset.view = 'stay'; }
        else { item.lang = 'en'; a.dataset.openPlace = doc.id; }
        const answer = document.createElement('p'); answer.textContent = doc.answer; answer.className = 'mt-1';
        item.append(a, answer);
        if (doc.copy) {
          const button = document.createElement('button'); button.type = 'button'; button.dataset.copy = doc.copy; button.textContent = t.copy;
          button.className = 'mt-3 min-h-12 rounded-xl border border-forest/25 px-4 py-2 font-semibold'; item.append(button);
        }
        list.append(item);
      }
      section.append(heading, list); results.append(section);
    }
  }
  function render(topic?: string) {
    input.value = state.query;
    if (normalize(state.query)) setSearchOpen(true);
    else if (!searchControl.contains(document.activeElement)) setSearchOpen(false);
    output.hidden = !searching();
    stay.hidden = searching() || state.view !== 'stay';
    mapView.hidden = searching() || state.view !== 'map';
    root.dataset.view = state.view;
    main.classList.toggle('overflow-hidden!', state.view === 'map' && !searching());
    if (searching() || state.view !== 'map') setPlaces(false);
    root.querySelectorAll<HTMLAnchorElement>('nav [data-view]').forEach(link => {
      if (link.dataset.view === state.view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    renderResults();
    save();
    requestAnimationFrame(() => {
      main.scrollTop = searching() ? state.resultScroll : state.scroll;
      if (topic && topicIds.has(topic)) {
        const target = document.getElementById(topic);
        if (!target) return;
        let ancestor: HTMLElement | null = target;
        while (ancestor && ancestor !== stay) {
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
          ancestor = ancestor.parentElement;
        }
        target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true });
      }
      if (!searching() && state.view === 'map') void ensureMap();
    });
  }
  function navigate(view: View, topic?: string, place?: string) {
    captureScroll();
    history.replaceState({ view: state.view, query: state.query }, '');
    state.view = view; state.query = ''; state.scroll = 0;
    if (place) state.selectedId = place;
    const url = new URL(location.href); url.searchParams.set('view', view); url.searchParams.delete('place'); url.hash = topic ?? '';
    if (place) url.searchParams.set('place', place);
    history.pushState({ view, query: '' }, '', url);
    render(topic);
    if (place) void ensureMap().then(() => map?.selectPlace(place));
  }
  function followUrl(initial = false) {
    const url = new URL(location.href);
    const requested = viewFrom(url.searchParams.get('view') ?? url.hash.slice(1));
    const topic = topicIds.has(url.hash.slice(1)) ? url.hash.slice(1) : undefined;
    const place = url.searchParams.get('place');
    const validPlace = place && places.some(p => p.id === place && p.coordinates) ? place : undefined;
    state.view = validPlace ? 'map' : topic ? 'stay' : requested ?? viewFrom(history.state?.view) ?? state.view;
    if (!initial && typeof history.state?.query === 'string') state.query = history.state.query;
    if (topic || validPlace) state.query = '';
    if (validPlace) {
      state.selectedId = validPlace;
      const category = places.find(place => place.id === validPlace)?.category;
      if (isLayer(category) && !state.layers.includes(category)) { state.layers.push(category); updateLayers(); }
    }
    render(topic);
    if (validPlace) void ensureMap().then(() => map?.selectPlace(validPlace, !initial));
  }
  root.addEventListener('toggle', event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || !details.dataset.placeDetails) return;
    const id = details.dataset.placeDetails;
    root.querySelectorAll<HTMLDetailsElement>('[data-place-details]').forEach(other => { if (other !== details) other.open = false; });
    state.selectedId = id; save();
    void ensureMap().then(() => map?.focusPlace(id));
  }, true);
  function openDetails(id: string) {
    state.selectedId = id; save();
    setPlaces(true);
    root.querySelectorAll<HTMLElement>('[data-place-id]').forEach(item => { item.hidden = item.dataset.placeId !== id; });
    root.querySelector<HTMLElement>('#places-title')!.textContent = places.find(place => place.id === id)?.title ?? '';
    requestAnimationFrame(() => {
      const details = [...root.querySelectorAll<HTMLDetailsElement>('[data-place-details]')].find(el => el.dataset.placeDetails === id)!;
      const alreadyOpen = details.open;
      details.open = true;
      drawer.scrollTop = 0;
      root.querySelector<HTMLElement>('#places-title')!.focus({ preventScroll: true });
      if (alreadyOpen) void ensureMap().then(() => map?.focusPlace(id));
    });
  }
  function updateQuery() {
    captureScroll();
    state.query = input.value; state.resultScroll = 0;
    render();
  }
  input.addEventListener('input', updateQuery);
  searchForm.addEventListener('submit', event => { event.preventDefault(); updateQuery(); });
  root.querySelector('#search-clear')!.addEventListener('click', () => { input.value = ''; updateQuery(); input.focus({ preventScroll: true }); });
  root.addEventListener('click', async event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#places-drawer details[open] > summary')) { event.preventDefault(); return; }
    const copy = event.target.closest<HTMLButtonElement>('[data-copy]');
    if (copy?.dataset.copy) {
      const status = root.querySelector<HTMLElement>('#copy-status')!;
      try { await navigator.clipboard.writeText(copy.dataset.copy); status.textContent = t.copied; }
      catch { status.textContent = t.copyFailed; }
      return;
    }
    const openPlace = event.target.closest<HTMLElement>('[data-open-place], [data-mobile-place]');
    const openId = openPlace?.dataset.openPlace ?? openPlace?.dataset.mobilePlace;
    if (openId && event instanceof MouseEvent && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      const id = openId;
      const category = places.find(place => place.id === id)?.category;
      if (isLayer(category) && !state.layers.includes(category)) { state.layers.push(category); updateLayers(); }
      navigate('map');
      openDetails(id);
      return;
    }
    const layer = event.target.closest<HTMLButtonElement>('[data-filter]');
    if (layer && isLayer(layer.dataset.filter)) {
      const id = layer.dataset.filter;
      state.layers = state.layers.includes(id) ? state.layers.filter(value => value !== id) : [...state.layers, id];
      const selected = places.find(place => place.id === state.selectedId);
      if (selected && !state.layers.includes(selected.category as Layer)) {
        state.selectedId = undefined; setPlaces(false);
      }
      updateLayers();
      save(); return;
    }
    const link = event.target.closest<HTMLAnchorElement>('a[data-view]');
    if (link && event instanceof MouseEvent && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      const view = viewFrom(link.dataset.view); if (!view) return;
      event.preventDefault(); navigate(view, link.dataset.topic); return;
    }
    const language = event.target.closest<HTMLAnchorElement>('[data-language]');
    if (language) {
      const url = new URL(language.href); url.search = location.search; url.hash = location.hash; language.href = url.href;
      captureScroll(); save();
    }
  });
  function updateLayers() {
    const visible = (category?: string) => state.layers.includes(category as Layer);
    root.querySelector<HTMLElement>('#mobile-place-options')!.hidden = state.layers.length === 0;
    root.querySelectorAll<HTMLElement>('[data-mobile-place]').forEach(item => { item.hidden = !visible(item.dataset.category); });
    root.querySelector<HTMLElement>('#mobile-place-choices')!.scrollLeft = 0;
    if (drawer.hidden) root.querySelector<HTMLElement>('#places-title')!.textContent = t.recommendations;
    root.querySelectorAll<HTMLElement>('[data-place-id]').forEach(item => {
      item.hidden = drawer.hidden ? !visible(item.dataset.category) : item.dataset.placeId !== state.selectedId;
    });
    root.querySelectorAll<HTMLElement>('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(visible(button.dataset.filter))));
    map?.setLayers(state.layers);
  }
  main.addEventListener('scroll', () => { captureScroll(); save(); }, { passive: true });
  window.addEventListener('popstate', () => followUrl());
  window.addEventListener('hashchange', () => followUrl());
  window.addEventListener('pagehide', () => { captureScroll(); save(); });
  root.dataset.enhanced = 'true';
  searchControl.hidden = false;
  root.querySelector<HTMLElement>('#filters')!.hidden = false;
  root.querySelector<HTMLElement>('#map-panel')!.hidden = false;
  root.querySelector<HTMLElement>('#map-toolbar')!.hidden = false;
  root.querySelector<HTMLElement>('#map-credits')!.hidden = false;
  updateLayers(); followUrl(true);
  history.replaceState({ view: state.view, query: state.query }, '');
  // Reserve exactly the fixed navigation's height, including safe areas/text zoom.
  const navigation = root.querySelector<HTMLElement>('[data-bottom-navigation]')!;
  new ResizeObserver(() => {
    root.style.paddingBottom = `${navigation.getBoundingClientRect().height}px`;
    map?.resize();
  }).observe(navigation);
}
