import type * as Leaflet from 'leaflet';
import type { localizedGuestPlaces } from '../data/guest-places';
import { guestMapIcon, type GuestMapIcon } from './guest-map-icons';

type Tip = { id: string; name: string; area: string; description: string; mapsUrl: string | null; coordinates: [number, number] | null };
type MapConfig = {
  locale: 'en' | 'sl';
  home: Tip;
  places: ReturnType<typeof localizedGuestPlaces>;
  landmarks: { id: string; icon: GuestMapIcon; label: string; coordinates: [number, number] }[];
};

export function mountGuestMap(root: HTMLElement) {
  const config: MapConfig = JSON.parse(root.dataset.mapConfig!);
  const en = config.locale === 'en';
  const element = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const fallback = element('[data-map-fallback]');
  if (!config.home.coordinates) {
    fallback.textContent = en ? 'The apartment’s map location is not set yet. Explore the suggestions below.' : 'Lokacija nastanitve še ni nastavljena. Raziščite spodnje namige.';
    return;
  }
  let started = false;
  const start = async () => {
    if (started || root.hidden) return;
    started = true;
    try {
      const L = await import('leaflet');
      const experience = element('[data-map-experience]');
      experience.hidden = false;
      const canvas = element('[data-live-map]');
      const map = L.map(canvas, { zoomControl: false, scrollWheelZoom: false, maxZoom: 19, minZoom: 9, zoomSnap: 0.5 });
      L.control.zoom({ position: 'topright' }).addTo(map);
      // Low-traffic prototype only. Do not prefetch/cache tiles for offline use.
      // Select a production tile service before scaling traffic; see README.
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      // Pixel-art test layer for the Bled walks area, drawn by scripts/storybook-map.mjs.
      map.createPane('storybook').style.zIndex = '250';
      const storybook = L.tileLayer('/storybook/{z}/{x}/{y}.png', {
        pane: 'storybook', className: 'storybook-tiles', minZoom: 15, maxZoom: 19, minNativeZoom: 16, maxNativeZoom: 16,
        bounds: L.latLngBounds([46.343, 14.09], [46.38, 14.135]), attribution: 'Sprites: Kenney (CC0)',
      });
      const storybookButton = root.querySelector<HTMLButtonElement>('[data-storybook]');
      storybookButton?.addEventListener('click', () => {
        const on = !map.hasLayer(storybook);
        if (on) {
          storybook.addTo(map);
          if (map.getZoom() < 15) map.setView(config.home.coordinates!, 16);
        } else storybook.remove();
        storybookButton.setAttribute('aria-pressed', String(on));
      });
      const status = element('[data-map-status]');
      let tileErrors = 0;
      tiles.on('tileerror', () => {
        if (++tileErrors < 3) return;
        status.textContent = en ? 'The background map could not fully load. You can still browse every tip in the list below.' : 'Ozadja zemljevida ni bilo mogoče v celoti naložiti. Vse namige lahko še vedno preberete na spodnjem seznamu.';
        element<HTMLDetailsElement>('[data-map-list]').hidden = false;
        element<HTMLDetailsElement>('[data-map-list]').open = true;
      });
      tiles.on('tileload', () => { tileErrors = 0; status.textContent = ''; });
      const home = config.home;
      const allTips: Tip[] = [home, ...config.places];
      const tourOrder = ['home', ...config.places.map((place) => place.id)];
      let category = 'all';
      let selected = home.id;
      const markers = new Map<string, Leaflet.Marker>();
      const routes = new Map<string, Leaflet.Polyline>();
      const legend = root.querySelector<HTMLElement>('.map-legend');
      const menu = element('[data-map-menu]');
      const tipBox = element('[data-map-tip]');
      const popup = L.popup({
        className: 'guest-tip-popup', offset: L.point(0, -26),
        closeButton: true, closeOnClick: false, closeOnEscapeKey: true,
        autoClose: false, autoPan: false,
      }).setContent(tipBox);
      let hasView = false;
      let popupOpen = true;
      popup.on('remove', () => {
        popupOpen = false;
        delete canvas.dataset.tipOpen;
        // Keep the reusable content in the guide DOM while the Leaflet popup
        // is detached, so selecting another place can update and reopen it.
        element('.map-stage').append(tipBox);
        if (root.hidden) return;
        markers.get(selected)?.getElement()?.focus({ preventScroll: true });
        // With the card closed, show the whole walk.
        const walk = config.places.find((place) => place.id === selected && place.line);
        if (walk) fit([home], walk.line!, true);
      });
      root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && popup.isOpen()) {
          event.preventDefault();
          event.stopPropagation();
          popup.close();
        }
      });
      const showSelectedPopup = () => {
        if (!hasView || root.hidden || !popupOpen) return;
        const tip = allTips.find((tip) => tip.id === selected)!;
        const focused = tipBox.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
        const width = Math.min(300, canvas.clientWidth - 64);
        popup.options.minWidth = width;
        popup.options.maxWidth = width;
        popup.options.maxHeight = Math.max(160, canvas.clientHeight - 190);
        const place = config.places.find((place) => place.id === selected);
        popup.setLatLng(place?.popupAt ?? tip.coordinates!).openOn(map);
        popup.update();
        canvas.dataset.tipOpen = 'true';
        const close = popup.getElement()?.querySelector<HTMLAnchorElement>('.leaflet-popup-close-button');
        close?.setAttribute('aria-label', en ? 'Close tip' : 'Zapri namig');
        close?.setAttribute('title', en ? 'Close tip' : 'Zapri namig');
        // Keep the popup readable without an animated pan that detaches it
        // visually from the newly selected pin.
        const card = popup.getElement()!.getBoundingClientRect();
        const bounds = canvas.getBoundingClientRect();
        const dx = card.left < bounds.left + 12 ? card.left - bounds.left - 12
          : card.right > bounds.right - 12 ? card.right - bounds.right + 12 : 0;
        const dy = card.top < bounds.top + 104 ? card.top - bounds.top - 104 : 0;
        if (dx || dy) map.panBy([dx, dy], { animate: false });
        focused?.focus({ preventScroll: true });
      };
      map.on('zoomend', () => requestAnimationFrame(showSelectedPopup));
      const previous = element<HTMLButtonElement>('[data-tip-previous]');
      const next = element<HTMLButtonElement>('[data-tip-next]');
      const currentTour = () => tourOrder.filter((id) => id === 'home' || config.places.some((place) => place.id === id && (category === 'all' || place.category === category)));
      const padding = (compact = false) => ({
        // The legend covers the bottom-left corner on wide screens.
        paddingTopLeft: L.point(Math.max(42, (legend?.offsetWidth ?? 0) + 28), compact ? 80 : Math.min(tipBox.offsetHeight + 125, canvas.clientHeight - 110)),
        paddingBottomRight: L.point(52, 48),
      });
      const fit = (tips: Tip[], extra: [number, number][] = [], compact = false) => {
        const coordinates = [...tips.flatMap((tip) => tip.coordinates ? [tip.coordinates] : []), ...extra];
        map.invalidateSize();
        map.fitBounds(L.latLngBounds(coordinates), { ...padding(compact), maxZoom: 16, animate: false });
        hasView = true;
        showSelectedPopup();
      };
      const visibleTips = () => allTips.filter((tip) => tip.id === 'home' || config.places.some((place) => place.id === tip.id && (category === 'all' || place.category === category)));
      const nearbyTips = () => visibleTips().filter((tip) => !config.places.find((place) => place.id === tip.id)?.furtherAway);
      const select = (id: string, move = true, openPopup = true) => {
        const tip = allTips.find((tip) => tip.id === id);
        if (!tip?.coordinates) return;
        selected = id;
        popupOpen = openPopup;
        element('[data-tip-title]').textContent = tip.name;
        element('[data-tip-area]').textContent = tip.area;
        element('[data-tip-description]').textContent = tip.description;
        const place = config.places.find((place) => place.id === id);
        const distance = element('[data-tip-distance]');
        distance.hidden = !place?.distanceLabel;
        distance.textContent = place?.distanceLabel ? `${place.distanceLabel} · ${place.distanceNote}` : '';
        tipBox.dataset.kind = place?.line ? 'walk' : 'place';
        if (place?.color) tipBox.dataset.walkColor = place.color;
        else delete tipBox.dataset.walkColor;
        element('[data-tip-kicker]').textContent = place ? place.contextLabel : (en ? 'Your base' : 'Vaše izhodišče');
        const link = element<HTMLAnchorElement>('[data-tip-link]');
        link.hidden = !tip.mapsUrl;
        if (tip.mapsUrl) link.href = tip.mapsUrl;
        link.setAttribute('aria-label', `${tip.area} — Google Maps`);
        const tour = currentTour();
        const index = tour.indexOf(id);
        previous.disabled = index <= 0;
        next.disabled = index === tour.length - 1;
        next.textContent = id === 'home' ? (en ? 'Show me around →' : 'Pokažite mi okolico →') : (en ? 'Next →' : 'Naprej →');
        markers.forEach((marker, markerId) => {
          marker.getElement()?.classList.toggle('is-selected', markerId === id);
          marker.getElement()?.setAttribute('aria-pressed', String(markerId === id));
          marker.setZIndexOffset(markerId === id ? 1000 : 0);
        });
        routes.forEach((route, routeId) => {
          route.getElement()?.classList.toggle('is-selected', routeId === id);
          if (routeId === id) route.bringToFront();
        });
        canvas.dataset.walkSelected = String(Boolean(place?.line));
        legend?.querySelectorAll('[data-show-place]').forEach((button) => button.setAttribute('aria-pressed', String(button.getAttribute('data-show-place') === id)));
        menu.querySelectorAll<HTMLButtonElement>('[data-show-place]').forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.showPlace === id));
          button.classList.toggle('is-current', button.dataset.showPlace === id);
        });
        // Reveal the active item inside its own scroll area without moving
        // the page away from the selected pin.
        requestAnimationFrame(() => {
          const active = menu.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
          if (!active) return;
          const bounds = menu.getBoundingClientRect();
          const item = active.getBoundingClientRect();
          if (item.top < bounds.top) menu.scrollTop += item.top - bounds.top;
          else if (item.bottom > bounds.bottom) menu.scrollTop += item.bottom - bounds.bottom;
          if (item.left < bounds.left) menu.scrollLeft += item.left - bounds.left;
          else if (item.right > bounds.right) menu.scrollLeft += item.right - bounds.right;
        });
        status.textContent = `${tip.area}. ${tip.name}`;
        if (move) {
          // Keep the apartment in view: the point is orientation, not jumping
          // between disconnected close-ups of places.
          fit(id === 'home' ? nearbyTips() : [home, tip], place?.line ?? []);
        }
      };
      config.places.forEach((place) => {
        if (!place.line) return;
        // Colours and dashes come from CSS, after the host's marker pens.
        const route = L.polyline(place.line, { className: `guest-walk walk-${place.color}`, weight: 5, lineCap: 'round', lineJoin: 'round', bubblingMouseEvents: false }).addTo(map);
        route.on('click', () => select(place.id));
        routes.set(place.id, route);
      });
      const landmarks = L.layerGroup(config.landmarks.map((item) => {
        const face = document.createElement('span');
        face.className = 'guest-landmark-face';
        face.innerHTML = guestMapIcon(item.icon);
        const label = document.createElement('span');
        label.className = 'guest-landmark-label';
        label.textContent = item.label;
        face.append(label);
        return L.marker(item.coordinates, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'guest-landmark', html: face, iconSize: [24, 24], iconAnchor: [12, 12] }) });
      }));
      // Neighbourhood pins only make sense close up.
      const toggleLandmarks = () => { if (map.getZoom() >= 16) landmarks.addTo(map); else landmarks.remove(); };
      map.on('zoomend', toggleLandmarks);
      allTips.forEach((tip) => {
        if (!tip.coordinates) return;
        const place = config.places.find((place) => place.id === tip.id);
        const icon = document.createElement('span');
        icon.className = 'guest-marker-face';
        icon.innerHTML = guestMapIcon(tip.id === 'home' ? 'home' : place!.icon);
        const label = document.createElement('span');
        label.className = 'guest-marker-label';
        label.textContent = tip.id === 'home' ? (en ? 'Your stay' : 'Vaša nastanitev') : place!.pinLabel;
        icon.append(label);
        const marker = L.marker(tip.coordinates, {
          title: tip.area, alt: tip.area,
          icon: L.divIcon({ className: `guest-map-marker ${tip.id === 'home' ? 'is-home' : place!.category}${place?.color ? ` walk-${place.color}` : ''}`, html: icon, iconSize: [44, 44], iconAnchor: [22, 22] }),
        }).addTo(map);
        const tooltip = document.createElement('span');
        tooltip.textContent = tip.area;
        marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -18] });
        marker.on('click', () => select(tip.id));
        const makeAccessible = () => {
          const node = marker.getElement();
          node?.setAttribute('aria-label', tip.id === 'home' ? `${en ? 'Your stay' : 'Vaša nastanitev'}: ${tip.area}` : tip.area);
          node?.setAttribute('aria-pressed', String(selected === tip.id));
          node?.classList.toggle('is-selected', selected === tip.id);
          if (node) node.dataset.placeId = tip.id;
          if (node && !node.dataset.spaceKeyBound) {
            node.dataset.spaceKeyBound = 'true';
            node.addEventListener('keydown', (event) => {
              if (event.key === ' ') { event.preventDefault(); select(tip.id); }
            });
          }
        };
        marker.on('add', makeAccessible);
        makeAccessible();
        markers.set(tip.id, marker);
      });
      const setFilter = (value: string) => {
        category = value;
        root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
        config.places.forEach((place) => {
          const marker = markers.get(place.id)!;
          const visible = category === 'all' || place.category === category;
          if (visible && !map.hasLayer(marker)) marker.addTo(map);
          if (!visible && map.hasLayer(marker)) map.removeLayer(marker);
          const route = routes.get(place.id);
          if (route && visible !== map.hasLayer(route)) { if (visible) route.addTo(map); else route.remove(); }
          const card = root.querySelector<HTMLElement>(`[data-card="${place.id}"]`);
          if (card) card.hidden = !visible;
          const item = menu.querySelector<HTMLButtonElement>(`[data-show-place="${place.id}"]`);
          if (item) item.hidden = !visible;
        });
        menu.querySelectorAll<HTMLElement>('[data-menu-group]').forEach((group) => {
          group.hidden = ![...group.querySelectorAll<HTMLButtonElement>('button')].some((button) => !button.hidden);
        });
        if (!currentTour().includes(selected)) selected = home.id;
        select(selected, false);
        fit(visibleTips());
      };
      root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => button.addEventListener('click', () => setFilter(button.dataset.filter!)));
      previous.addEventListener('click', () => { const tour = currentTour(); select(tour[tour.indexOf(selected) - 1]!); });
      next.addEventListener('click', () => { const tour = currentTour(); select(tour[tour.indexOf(selected) + 1]!); });
      element('[data-map-home]').addEventListener('click', () => select('home'));
      element('[data-map-all]').addEventListener('click', () => { setFilter('all'); });
      root.querySelectorAll<HTMLButtonElement>('[data-show-place]').forEach((button) => {
        button.hidden = false;
        button.addEventListener('click', () => {
          if (!currentTour().includes(button.dataset.showPlace!)) setFilter('all');
          select(button.dataset.showPlace!);
        });
      });
      const revealLinkedCard = () => {
        const tip = config.places.find((place) => `#place-${place.id}` === window.location.hash);
        if (!tip) return;
        if (!currentTour().includes(tip.id)) setFilter('all');
        element<HTMLDetailsElement>('[data-map-list]').hidden = false;
        element<HTMLDetailsElement>('[data-map-list]').open = true;
        select(tip.id);
      };
      window.addEventListener('hashchange', revealLinkedCard);
      fallback.hidden = true;
      element<HTMLDetailsElement>('[data-map-list]').open = false;
      element<HTMLDetailsElement>('[data-map-list]').hidden = true;
      select('home', false);
      fit(nearbyTips());
      revealLinkedCard();
      let previousWidth = canvas.clientWidth;
      new ResizeObserver(() => {
        if (root.hidden) return;
        map.invalidateSize();
        if (Math.abs(previousWidth - canvas.clientWidth) > 30) select(selected, true, popupOpen);
        else showSelectedPopup();
        previousWidth = canvas.clientWidth;
      }).observe(canvas);
      new MutationObserver(() => {
        if (!root.hidden) requestAnimationFrame(() => { map.invalidateSize(); showSelectedPopup(); });
      }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
    } catch (error) {
      element('[data-map-experience]').hidden = true;
      element<HTMLDetailsElement>('[data-map-list]').hidden = false;
      element<HTMLDetailsElement>('[data-map-list]').open = true;
      fallback.hidden = false;
      fallback.textContent = en ? 'The interactive map could not load. All our tips and Google Maps links are available below.' : 'Interaktivnega zemljevida ni bilo mogoče naložiti. Vsi namigi in povezave Google Maps so na voljo spodaj.';
      console.error('Guest map failed to load', error);
    }
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !root.hidden) { void start(); observer.disconnect(); }
    });
    observer.observe(root);
  } else {
    void start();
    new MutationObserver(() => { if (!root.hidden) void start(); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  }
}
