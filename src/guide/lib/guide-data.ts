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
  paragraphs: z.array(z.string().min(1)).min(1), links: z.array(z.object({ label: z.string(), href: z.string().refine(s => /^(https?:\/\/|tel:)/.test(s)) })),
  coordinates: coordinates.nullable(), sourceUrl: url.nullable(),
  route: z.string().regex(/^\/stay-k7m4\/routes\/[a-z0-9-]+\.geojson$/).optional(),
}).strict()).parse(placeData);
if (new Set(places.map(p => p.id)).size !== places.length) throw new Error('Duplicate place ID');
export const usefulInfo = places.filter(place => place.group === 'info');
// Food & drinks first, then the rest in data order.
export const recommendations = places.filter(place => place.group !== 'info')
  .sort((a, b) => Number(b.category === 'food-drinks') - Number(a.category === 'food-drinks'));
export type Place = typeof places[number];
export type Language = keyof typeof messages;
export const textFor = (lang: Language) => messages[lang];
export type Messages = ReturnType<typeof textFor>;
export const guideRoot = '/stay-k7m4';
export const baseFor = (lang: Language) => lang === 'en' ? guideRoot : `${guideRoot}/sl`;
export const placePath = (id: string) => `${guideRoot}/places/${id}`;
export const directions = (coords: [number, number]) => `https://www.google.com/maps/dir/?api=1&destination=${coords.join(',')}`;
export const summary = (place: Place) => {
  const p = place.paragraphs.find(p => !/^(the )?(map |pin |coordinates|source)/i.test(p)) ?? place.paragraphs[0]!;
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
