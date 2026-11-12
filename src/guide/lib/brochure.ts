import { apartment, recommendations, sectionsFor, type Place } from './guide-data';

export const revision = '2026-11-12';
export const brochureItems = sectionsFor('en').flatMap(section => section.items);
export function instruction(id: string) {
  const item = brochureItems.find(item => item.id === id);
  if (!item) throw new Error(`Missing brochure instruction: ${id}`);
  return item;
}
// Bled, its lakeside hills and nearby villages. Vintgar is a further-afield mention.
export const localPlace = (place: Place) => place.id !== 'hiking/vintgar' && !!place.coordinates && place.coordinates[0] >= 46.34 && place.coordinates[0] <= 46.41 && place.coordinates[1] >= 14.06 && place.coordinates[1] <= 14.14;
const ordered = [...recommendations.filter(localPlace), ...recommendations.filter(p => !localPlace(p))];
export const brochurePlaces = ordered.map((place, index) => ({ ...place, number: index + 1 }));
export const localPlaces = brochurePlaces.filter(localPlace);
export const fartherPlaces = brochurePlaces.filter(p => !localPlace(p));
export const editionPages = [
  { title: 'Around Bled', kind: 'local' },
  { title: 'Your Bled favourites', kind: 'directory' },
  { title: 'Beyond Bled', kind: 'beyond' },
] as const;
export const pageCount = 8;
export const bookletSheets = [[8, 1], [2, 7], [6, 3], [4, 5]] as const;
export const demoWifi = apartment.wifi.network?.endsWith('-Demo') ?? false;
export const usableWifi = apartment.confirmedByOwner && !demoWifi && !!apartment.wifi.network && !!apartment.wifi.password;
export const draft = !apartment.confirmedByOwner || demoWifi;
