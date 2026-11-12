import { z } from 'astro/zod';
import apartmentData from '../data/apartment.json' with { type: 'json' };
import placeData from '../data/places.json' with { type: 'json' };
import messages from '../data/messages.json' with { type: 'json' };
import apartmentInfoData from '../data/apartment-info.json' with { type: 'json' };

const coordinates = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
const url = z.url().refine(s => /^https?:/.test(s));
export const apartment = z.object({
  name: z.string().min(1), address: z.string().min(1), coordinates,
  confirmedByOwner: z.boolean(), checkIn: z.string().min(1), checkOut: z.string().min(1), quietHours: z.string().min(1),
  // All values are public. Credentials require explicit owner approval.
  wifi: z.object({ network: z.string().min(1).nullable(), password: z.string().min(1).nullable() }),
  hostPhone: z.string().regex(/^\+?[\d ]+$/).nullable(), sourceUrl: url, slSourceUrl: url,
}).strict().parse(apartmentData);
export const places = z.array(z.object({
  id: z.string().regex(/^[a-z-]+\/[a-z0-9-]+$/), title: z.string().min(1), category: z.string(),
  group: z.enum(['eat', 'see', 'do', 'info']), order: z.number(), area: z.string(), advanced: z.boolean(),
  paragraphs: z.array(z.string().min(1)), links: z.array(z.object({ label: z.string(), href: z.string().refine(s => /^(https?:\/\/|tel:)/.test(s)) })),
  // Optional numbered stops for trips, and a small practical note shown last.
  stops: z.array(z.object({ title: z.string().min(1), text: z.string().min(1) }).strict()).optional(),
  note: z.string().min(1).optional(),
  coordinates: coordinates.nullable(), sourceUrl: url.nullable(),
  route: z.string().regex(/^\/stay-k7m4\/routes\/[a-z0-9-]+\.geojson$/).optional(),
}).strict().refine(p => p.paragraphs.length || p.stops?.length, 'Place needs text')).parse(placeData);
if (new Set(places.map(p => p.id)).size !== places.length) throw new Error('Duplicate place ID');
export const usefulInfo = places.filter(place => place.group === 'info');
export type Place = typeof places[number];
export const categories = ['walks', 'food-drinks', 'hiking', 'day-trips', 'rainy-day'] as const;
export type Category = typeof categories[number];
if (places.some(p => p.group !== 'info' && !categories.includes(p.category as Category))) throw new Error('Unknown place category');
// Straight-line kilometres from the apartment.
export const distanceKm = (coords: [number, number]) =>
  Math.hypot(coords[0] - apartment.coordinates[0], (coords[1] - apartment.coordinates[1]) * Math.cos(coords[0] * Math.PI / 180)) * 111.2;
export const formatDistance = (km: number, lang: 'en' | 'sl') => km < 0.95
  ? `${Math.max(100, Math.round(km * 10) * 100)} m`
  : `${new Intl.NumberFormat(lang, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
// Grouped by category; walks keep the host's order, the rest go nearest first.
const near = (place: Place) => place.category === 'walks' ? place.order : place.coordinates ? distanceKm(place.coordinates) : Infinity;
export const recommendations = places.filter(place => place.group !== 'info')
  .sort((a, b) => categories.indexOf(a.category as Category) - categories.indexOf(b.category as Category) || near(a) - near(b));
export type Language = keyof typeof messages;
export const textFor = (lang: Language) => messages[lang];
export type Messages = ReturnType<typeof textFor>;
export const guideRoot = '/stay-k7m4';
export const baseFor = (lang: Language) => lang === 'en' ? guideRoot : `${guideRoot}/sl`;
export const placePath = (id: string) => `${guideRoot}/places/${id}`;
export const directions = (coords: [number, number]) => `https://www.google.com/maps/dir/?api=1&destination=${coords.join(',')}`;
export const summary = (place: Place) => {
  const texts = [...place.paragraphs, ...(place.stops ?? []).map(stop => stop.text)];
  const p = texts.find(p => !/^(the )?(map |pin |coordinates|source)/i.test(p)) ?? texts[0]!;
  return p.length > 170 ? `${p.slice(0, 167).replace(/\s+\S*$/, '')}…` : p;
};
const localized = z.object({ en: z.string(), sl: z.string() }).strict();
const instructionItem = z.object({
  id: z.string().regex(/^[a-z-]+$/), name: localized, location: localized, instructions: localized,
  aliases: z.array(z.string()),
  image: z.object({
    src: z.string().regex(/^\/stay-k7m4\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpe?g)$/),
    alt: localized, width: z.number().int().positive(), height: z.number().int().positive(),
  }).strict().optional(),
}).strict();
export const apartmentInfo = z.object({
  checkout: localized,
  contact: z.object({ preferred: localized, instructions: localized, messageUrl: url.nullable() }).strict(),
  sections: z.array(z.object({
    id: z.string().regex(/^[a-z-]+$/), title: localized,
    icon: z.enum(['pin', 'home', 'list', 'info']), items: z.array(instructionItem).min(1),
  }).strict()),
}).strict().parse(apartmentInfoData);
const infoIds = apartmentInfo.sections.flatMap(section => [section.id, ...section.items.map(item => item.id)]);
if (new Set(['wifi', 'departure', 'contact', ...infoIds]).size !== infoIds.length + 3) throw new Error('Duplicate apartment topic ID');
export function formatApartment(value: string) {
  return value.replaceAll('{address}', apartment.address).replaceAll('{checkIn}', apartment.checkIn)
    .replaceAll('{checkOut}', apartment.checkOut).replaceAll('{quietHours}', apartment.quietHours);
}
export function sectionsFor(lang: Language) {
  return apartmentInfo.sections.map(section => ({
    id: section.id, title: section.title[lang], icon: section.icon,
    items: section.items.map(item => ({
      ...item, title: item.name[lang], location: item.location[lang],
      answer: formatApartment(item.instructions[lang]),
    })),
  }));
}
export function topicsFor(lang: Language) {
  const t = textFor(lang);
  const sections = sectionsFor(lang);
  return [
    { id: 'wifi', title: t.wifi, answer: apartment.wifi.password ? `${t.network}: ${apartment.wifi.network ?? '—'} · ${t.password}: ${apartment.wifi.password}` : t.wifiHelp, aliases: ['wifi', 'wi-fi', 'internet', 'network', 'name', 'password', 'geslo', 'omrezje'], copy: apartment.wifi.password },
    { id: 'departure', title: t.checkout, answer: `${t.checkout}: ${apartment.checkOut}. ${apartmentInfo.checkout[lang]}`, aliases: ['checkout', 'check-out', 'leave', 'leaving', 'departure', 'odjava', 'odhod'], copy: null },
    ...sections.flatMap(section => [
      { id: section.id, title: section.title, answer: section.items.map(item => `${item.title}: ${item.answer}`).join(' '), aliases: [], copy: null },
      ...section.items.map(item => ({ id: item.id, title: item.title, answer: [item.location, item.answer].filter(Boolean).join(' '), aliases: item.aliases, copy: null })),
    ]),
    { id: 'contact', title: t.contactHost, answer: `${apartmentInfo.contact.preferred[lang]}. ${apartmentInfo.contact.instructions[lang]}${apartment.hostPhone ? ` ${t.hostCall}: ${apartment.hostPhone}` : ''}`, aliases: ['host', 'contact', 'help', 'phone', 'message', 'gostitelj', 'pomoc', 'stik', 'sporocilo'], copy: null },
  ];
}
