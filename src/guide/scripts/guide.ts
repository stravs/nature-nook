import { searchDocuments, normalize, type SearchDocument } from '../lib/search';
import type { Messages } from '../lib/guide-data';
import type { MapPlace } from './map';

type View = 'stay' | 'map';
type Mode = 'list' | 'map';
const categoryIds = ['all', 'walks', 'food-drinks', 'hiking', 'day-trips', 'rainy-day'] as const;
type Category = typeof categoryIds[number];
interface State {
  view: View; category: Category; mode: Mode; query: string; scroll: number; resultScroll: number;
  selectedId?: string | undefined; position?: { center: [number, number]; zoom: number } | undefined;
}
const key = 'nature-nook-guide-v3';
const isCategory = (value: unknown): value is Category => categoryIds.includes(value as Category);
const viewFrom = (value: unknown): View | undefined => value === 'stay' ? 'stay' : value === 'map' || value === 'places' ? 'map' : undefined;
const root = document.querySelector<HTMLElement>('#guide');
if (root) start(root);
function start(root: HTMLElement) {
  const t: Messages = JSON.parse(root.dataset.messages!);
  const documents: SearchDocument[] = JSON.parse(root.dataset.documents!);
  const places: MapPlace[] = JSON.parse(root.dataset.places!);
  const home = JSON.parse(root.dataset.home!);
  const state: State = { view: 'stay', category: 'all', mode: 'list', query: '', scroll: 0, resultScroll: 0 };
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? '{}');
    state.view = viewFrom(saved.view) ?? 'stay';
    if (isCategory(saved.category)) state.category = saved.category;
    if (saved.mode === 'map') state.mode = 'map';
    if (typeof saved.query === 'string') state.query = saved.query;
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
  const menu = root.querySelector<HTMLDetailsElement>('details[data-menu]')!;
  document.addEventListener('pointerdown', event => {
    if (!(event.target instanceof Node)) return;
    if (!menu.contains(event.target)) menu.open = false;
    if (!searchControl.contains(event.target) && !input.value.trim()) setSearchOpen(false);
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary')!.focus(); event.stopPropagation(); }
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
  const title = root.querySelector<HTMLElement>('#places-title')!;
  const cardList = root.querySelector<HTMLElement>('#place-cards')!;
  const desktop = window.matchMedia('(min-width: 1024px)');
  let map: ReturnType<typeof import('./map').createMap> | undefined;
  let mapPromise: Promise<void> | undefined;
  // Set when a mobile card switched to the map, so closing the details returns to the list.
  let returnToList = false;
  const searching = () => !!normalize(state.query);
  const mapVisible = () => state.view === 'map' && !searching() && (desktop.matches || state.mode === 'map');
  function save() { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* Optional. */ } }
  function captureScroll() { if (searching()) state.resultScroll = main.scrollTop; else state.scroll = main.scrollTop; }
  function ensureMap() {
    if (!mapVisible()) return Promise.resolve();
    if (map) { map.resize(); return Promise.resolve(); }
    if (!mapPromise) mapPromise = import('./map').then(({ createMap }) => {
      map = createMap({ root, places, home, category: state.category, position: state.position,
        onSelect(id) { if (id) openPlace(id); else closePlace(false); },
        onMove(position) { state.position = position; save(); },
      });
    }).catch(() => {
      const feedback = root.querySelector<HTMLElement>('#map-feedback')!;
      feedback.textContent = t.mapFailed;
      feedback.hidden = false;
    });
    return mapPromise;
  }
  // Phone map mode: map fills the screen behind the filters and navigation.
  function syncFullMap() { root.dataset.fullMap = String(state.view === 'map' && !searching() && state.mode === 'map'); }
  function setMode(mode: Mode) {
    state.mode = mode; mapView.dataset.mode = mode; syncFullMap(); save();
    void ensureMap();
  }
  function setCategory(category: Category) {
    state.category = category;
    root.querySelectorAll<HTMLElement>('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    root.querySelectorAll<HTMLElement>('[data-group]').forEach(group => { group.hidden = category !== 'all' && group.dataset.group !== category; });
    cardList.scrollTop = 0;
    const selected = places.find(place => place.id === state.selectedId);
    if (selected && category !== 'all' && selected.category !== category) closePlace(false);
    map?.setCategory(category);
    save();
  }
  function markCard(id?: string) {
    root.querySelectorAll<HTMLElement>('[data-card] > a').forEach(link => link.setAttribute('aria-current', String(link.dataset.openPlace === id)));
  }
  function openPlace(id: string, fromCard = false) {
    const place = places.find(place => place.id === id);
    if (!place) return;
    if (state.category !== 'all' && place.category !== state.category) setCategory(place.category as Category);
    state.selectedId = id; save();
    root.querySelectorAll<HTMLElement>('[data-place-id]').forEach(item => { item.hidden = item.dataset.placeId !== id; });
    title.textContent = place.title;
    drawer.hidden = false; root.dataset.panel = 'open';
    markCard(id);
    // On phones a place with a pin is shown on the map; the details sheet sits below it.
    if (!desktop.matches && state.mode === 'list' && place.coordinates) { returnToList = fromCard; setMode('map'); }
    drawer.scrollTop = 0;
    title.focus({ preventScroll: true });
    void ensureMap().then(() => map?.select(id));
  }
  function closePlace(viaClose: boolean) {
    const id = state.selectedId;
    state.selectedId = undefined; save();
    drawer.hidden = true; root.dataset.panel = 'closed';
    markCard();
    map?.clear();
    if (!viaClose) { returnToList = false; return; }
    if (returnToList) { returnToList = false; setMode('list'); }
    const card = root.querySelector<HTMLElement>(`[data-card="${CSS.escape(id ?? '')}"] > a`);
    if (mapVisible()) root.querySelector<HTMLElement>('#map-home')!.focus({ preventScroll: true });
    else card?.focus();
  }
  root.querySelector('#close-places')!.addEventListener('click', () => closePlace(true));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !drawer.hidden) { closePlace(true); event.preventDefault(); }
  });
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
    mapView.dataset.mode = state.mode;
    root.dataset.view = state.view;
    syncFullMap();
    main.classList.toggle('overflow-hidden!', state.view === 'map' && !searching());
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
      void ensureMap();
    });
  }
  function navigate(view: View, topic?: string) {
    captureScroll();
    history.replaceState({ view: state.view, query: state.query }, '');
    state.view = view; state.query = ''; state.scroll = 0;
    const url = new URL(location.href); url.searchParams.set('view', view); url.searchParams.delete('place'); url.hash = topic ?? '';
    history.pushState({ view, query: '' }, '', url);
    render(topic);
  }
  function followUrl(initial = false) {
    const url = new URL(location.href);
    const requested = viewFrom(url.searchParams.get('view') ?? url.hash.slice(1));
    const topic = topicIds.has(url.hash.slice(1)) ? url.hash.slice(1) : undefined;
    const place = url.searchParams.get('place');
    const validPlace = place && places.some(p => p.id === place) ? place : undefined;
    state.view = validPlace ? 'map' : topic ? 'stay' : requested ?? viewFrom(history.state?.view) ?? state.view;
    if (!initial && typeof history.state?.query === 'string') state.query = history.state.query;
    if (topic || validPlace) state.query = '';
    render(topic);
    if (validPlace) openPlace(validPlace);
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
    const plainClick = event instanceof MouseEvent && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
    const copy = event.target.closest<HTMLButtonElement>('[data-copy]');
    if (copy?.dataset.copy) {
      const status = root.querySelector<HTMLElement>('#copy-status')!;
      try { await navigator.clipboard.writeText(copy.dataset.copy); status.textContent = t.copied; }
      catch { status.textContent = t.copyFailed; }
      return;
    }
    const open = event.target.closest<HTMLElement>('[data-open-place]');
    if (open?.dataset.openPlace && plainClick) {
      event.preventDefault();
      if (state.view !== 'map' || searching()) navigate('map');
      openPlace(open.dataset.openPlace, !!open.closest('[data-card]'));
      return;
    }
    const filter = event.target.closest<HTMLButtonElement>('[data-filter]');
    if (filter && isCategory(filter.dataset.filter)) { setCategory(filter.dataset.filter); return; }
    if (event.target.closest('#mode-toggle')) { returnToList = false; setMode(state.mode === 'list' ? 'map' : 'list'); return; }
    const link = event.target.closest<HTMLAnchorElement>('a[data-view]');
    if (link && plainClick) {
      const view = viewFrom(link.dataset.view); if (!view) return;
      event.preventDefault(); menu.open = false; navigate(view, link.dataset.topic); return;
    }
    const language = event.target.closest<HTMLAnchorElement>('[data-language]');
    if (language) {
      const url = new URL(language.href); url.search = location.search; url.hash = location.hash; language.href = url.href;
      captureScroll(); save();
    }
  });
  // Phones: swipe sideways between Apartment and Places (not on the map, chips or details sheet).
  let swipe: { x: number; y: number } | undefined;
  main.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    swipe = touch && event.touches.length === 1 && !desktop.matches && !searching()
      && !(event.target instanceof Element && event.target.closest('#filters, #map-area, #places-drawer'))
      ? { x: touch.clientX, y: touch.clientY } : undefined;
  }, { passive: true });
  main.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    if (!swipe || !touch) return;
    const dx = touch.clientX - swipe.x, dy = touch.clientY - swipe.y;
    swipe = undefined;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return;
    const view: View = dx < 0 ? 'map' : 'stay';
    if (view === state.view) return;
    navigate(view);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      main.animate([{ transform: `translateX(${dx < 0 ? 48 : -48}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' });
    }
  }, { passive: true });
  desktop.addEventListener('change', () => void ensureMap());
  main.addEventListener('scroll', () => { captureScroll(); save(); }, { passive: true });
  window.addEventListener('popstate', () => followUrl());
  window.addEventListener('hashchange', () => followUrl());
  window.addEventListener('pagehide', () => { captureScroll(); save(); });
  root.dataset.enhanced = 'true';
  root.dataset.panel = 'closed';
  searchControl.hidden = false;
  for (const id of ['#filters', '#map-area', '#mode-toggle']) root.querySelector<HTMLElement>(id)!.hidden = false;
  setCategory(state.category);
  followUrl(true);
  history.replaceState({ view: state.view, query: state.query }, '');
}
