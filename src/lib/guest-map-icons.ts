export type GuestMapIcon = 'home' | 'lake' | 'landmark' | 'viewpoint' | 'nature' | 'food' | 'coffee' | 'walk' | 'bus' | 'bakery' | 'market' | 'info' | 'shop' | 'fuel' | 'post';

// Shared by server-rendered list badges and client-rendered map markers.
// Only static, authored SVG paths are interpolated here; never place content.
const paths: Record<GuestMapIcon, string> = {
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
  lake: '<path d="M2 12c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 18c3-4 5 4 8 0s5 4 8 0 4 0 4 0M7 6h10"/>',
  landmark: '<path d="M4 21V7h4v3h3V4h3v6h3V7h3v14ZM10 21v-5h4v5"/>',
  viewpoint: '<path d="m2 20 7-13 5 9 3-5 5 9ZM7 11l2 2 2-2M18 3v3M16.5 4.5h3"/>',
  nature: '<path d="m12 2-7 10h4l-5 6h6v4h4v-4h6l-5-6h4Z"/>',
  food: '<path d="M5 3v6m4-6v6M3 3v5a4 4 0 0 0 8 0V3M7 12v9M20 21V3c-4 2-5 7-5 10h5"/>',
  coffee: '<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 10h2a3 3 0 0 1 0 6h-2M3 22h16M7 2v3m5-3v3"/>',
  walk: '<path d="M8 3.5c1.6 0 2.5 1.6 2.3 3.7S9 10.5 7.8 10.3 5.9 8.4 6 6.4 6.6 3.5 8 3.5ZM6.8 12.6l3 .5-.4 2.3a1.5 1.5 0 0 1-3-.5ZM16 9.5c1.4 0 2 1.9 1.8 3.9s-1.2 3.3-2.4 3.1-1.9-1.9-1.8-3.9.9-3.1 2.4-3.1ZM14.4 18.6l3-.5.4 2.3a1.5 1.5 0 0 1-3 .5Z"/>',
  bus: '<path d="M6 17V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v11ZM6 11h12M8 20v-3m8 3v-3M9 14h.01M15 14h.01"/>',
  bakery: '<path d="M4 15c0-5 3.6-8 8-8s8 3 8 8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM9 8.5 10.5 13M15 8.5 13.5 13M12 7v6"/>',
  market: '<path d="M4 10h16l-1.5 9h-13ZM8 10l3-6m5 6-3-6M9 14v2m3-2v2m3-2v2"/>',
  info: '<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-5m0-3h.01"/>',
  shop: '<path d="M5 8h14l-1 12H6ZM9 8a3 3 0 0 1 6 0"/>',
  fuel: '<path d="M5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M4 21h11M7 8h5M14 11h2a2 2 0 0 1 2 2v3a1 1 0 0 0 2 0V8l-2-2"/>',
  post: '<path d="M3 6h18v12H3ZM3 7l9 6 9-6"/>',
};

export function guestMapIcon(icon: GuestMapIcon): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[icon]}</svg>`;
}
