export const locales = ['en', 'sl'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const languageNames: Record<Locale, string> = {
  sl: 'Slovenščina',
  en: 'English',
};

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function localePath(locale: Locale, path = ''): string {
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return `${prefix}/${cleanPath}`.replace(/\/$/, '') || '/';
}

export function localeFromPath(pathname: string): Locale {
  const candidate = pathname.split('/').filter(Boolean)[0];
  return isLocale(candidate) ? candidate : defaultLocale;
}

export function pathWithoutLocale(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (isLocale(parts[0])) parts.shift();
  return parts.join('/');
}

const ui = {
  sl: {
    stayTitle: 'Kaj vam nudimo', stayAmenities: 'Oprema in udobje', mainNavigation: 'Glavna navigacija', guestGuide: 'Za goste', reserve: 'Rezerviraj', propertyPhoto: 'Fotografija nastanitve', propertyOverview: 'Pregled nastanitve', accommodation: 'Nastanitev', welcome: 'Dobrodošli', restSpace: 'Prostor za oddih', chooseSpace: 'Izberite svoj prostor', units: 'Nastanitvene enote', unit: 'Nastanitvena enota', openUnitPhotos: 'Odpri fotografije enote', photos: 'fotografij', unitDetails: 'Podatki za', unitPhotos: 'Fotografije nastanitvene enote', closeGallery: 'Zapri galerijo', previousPhoto: 'Prejšnja fotografija', nextPhoto: 'Naslednja fotografija', photo: 'Fotografija', pleasantStay: 'Vse za prijetno bivanje', amenitiesTitle: 'Kar vas čaka', location: 'Lokacija', locationCopy: 'Odlično izhodišče za raziskovanje okolice in sproščen oddih v naravi.', mapOf: 'Zemljevid lokacije', holidayStarts: 'Vaš oddih se začne tukaj', bookStay: 'Rezervirajte svoje bivanje', guestRating: 'Ocena gostov', reviews: 'mnenj', bookOnBooking: 'Rezerviraj na Booking.com', contactHost: 'Pišite gostitelju', guests: '{count} gosti', upToGuests: 'do {count} gosti', bedrooms: '{count} spalnice', bathrooms: '{count} kopalnic', parking: 'Brezplačno parkirišče', option: '1 možnost', options: '{count} možnosti', homeTitleFallback: 'Nastanitev',
  },
  en: {
    stayTitle: 'What we offer', stayAmenities: 'Amenities', mainNavigation: 'Main navigation', guestGuide: 'Guest guide', reserve: 'Book now', propertyPhoto: 'Property photo', propertyOverview: 'Property overview', accommodation: 'Accommodation', welcome: 'Welcome', restSpace: 'A place to unwind', chooseSpace: 'Choose your space', units: 'Accommodation units', unit: 'Accommodation unit', openUnitPhotos: 'Open photos of', photos: 'photos', unitDetails: 'Details for', unitPhotos: 'Accommodation unit photos', closeGallery: 'Close gallery', previousPhoto: 'Previous photo', nextPhoto: 'Next photo', photo: 'Photo', pleasantStay: 'Everything for a pleasant stay', amenitiesTitle: 'What awaits you', location: 'Location', locationCopy: 'A perfect base for exploring the surroundings and enjoying a relaxing break in nature.', mapOf: 'Map showing', holidayStarts: 'Your holiday starts here', bookStay: 'Book your stay', guestRating: 'Guest rating', reviews: 'reviews', bookOnBooking: 'Book on Booking.com', contactHost: 'Contact the host', guests: '{count} guests', upToGuests: 'up to {count} guests', bedrooms: '{count} bedrooms', bathrooms: '{count} bathrooms', parking: 'Free parking', option: '1 option', options: '{count} options', homeTitleFallback: 'Accommodation',
  },
} as const;

export type TranslationKey = keyof typeof ui.sl;

export function useTranslations(locale: Locale) {
  return (key: TranslationKey, values: Record<string, string | number> = {}): string => {
    let message: string = ui[locale][key] ?? ui[defaultLocale][key];
    for (const [name, value] of Object.entries(values)) message = message.replaceAll(`{${name}}`, String(value));
    return message;
  };
}
