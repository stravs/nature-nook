export type PropertyPhoto = {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type PropertyRoom = {
  name: string;
  description?: string;
  sleeps?: number;
  beds?: string;
};

export type PropertyUnit = {
  id: string;
  name: string;
  type?: string;
  description?: string;
  maxGuests?: number;
  bedrooms?: number;
  bathrooms?: number;
  areaSquareMetres?: number;
  rooms: PropertyRoom[];
  amenities: string[];
  photos: PropertyPhoto[];
  bookingUrl?: string;
};

export type Property = {
  name: string;
  type?: string;
  description: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  photos: PropertyPhoto[];
  amenities: string[];
  units: PropertyUnit[];
  /** Legacy single-unit fields, accepted while saved data is migrated on read. */
  rooms?: PropertyRoom[];
  maxGuests?: number;
  bedrooms?: number;
  bathrooms?: number;
  areaSquareMetres?: number;
  checkIn?: string;
  checkOut?: string;
  bookingUrl: string;
  contact?: { email?: string; phone?: string };
  canonicalUrl?: string;
  translations?: Partial<Record<string, PropertyTranslation>>;
};

export type PropertyTranslation = {
  name?: string;
  type?: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  amenities?: string[];
  photoAlts?: string[];
  units?: Record<string, {
    name?: string;
    type?: string;
    description?: string;
    amenities?: string[];
    photoAlts?: string[];
    rooms?: Array<{ name?: string; description?: string; beds?: string }>;
  }>;
};

export function isProperty(value: unknown): value is Property {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const unitsValid = item.units === undefined || (Array.isArray(item.units)
    && item.units.length > 0
    && item.units.every(isPropertyUnit)
    && new Set(item.units.map((unit) => (unit as PropertyUnit).id)).size === item.units.length);
  return typeof item.name === 'string' && item.name.trim().length > 0
    && typeof item.description === 'string'
    && typeof item.bookingUrl === 'string'
    && Array.isArray(item.photos)
    && Array.isArray(item.amenities)
    && unitsValid;
}

export function isPropertyUnit(value: unknown): value is PropertyUnit {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const optionalPositive = (field: string, allowZero = false) => item[field] === undefined
    || (typeof item[field] === 'number' && Number.isFinite(item[field]) && (allowZero ? item[field] >= 0 : item[field] > 0));
  return typeof item.id === 'string' && item.id.trim().length > 0
    && typeof item.name === 'string' && item.name.trim().length > 0
    && Array.isArray(item.rooms)
    && Array.isArray(item.amenities)
    && Array.isArray(item.photos)
    && optionalPositive('maxGuests')
    && optionalPositive('bedrooms', true)
    && optionalPositive('bathrooms', true)
    && optionalPositive('areaSquareMetres');
}

export function normalizeProperty(property: Property): Property {
  if (property.units?.length) return property;
  const unit: PropertyUnit = {
    id: 'default-unit',
    name: property.type ?? property.name,
    ...(property.type ? { type: property.type } : {}),
    ...(property.maxGuests !== undefined ? { maxGuests: property.maxGuests } : {}),
    ...(property.bedrooms !== undefined ? { bedrooms: property.bedrooms } : {}),
    ...(property.bathrooms !== undefined ? { bathrooms: property.bathrooms } : {}),
    ...(property.areaSquareMetres !== undefined ? { areaSquareMetres: property.areaSquareMetres } : {}),
    rooms: property.rooms ?? [],
    amenities: [],
    photos: [],
    bookingUrl: property.bookingUrl,
  };
  return { ...property, units: [unit] };
}

export function propertyLocation(property: Property): string {
  return [property.address, property.city, property.country].filter(Boolean).join(', ');
}

export function propertyMetaDescription(property: Property): string {
  const location = [property.city, property.country].filter(Boolean).join(', ');
  const text = `${property.name}${location ? `, ${location}` : ''}. ${property.description}`;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 160) return normalized;
  const excerpt = normalized.slice(0, 157);
  return `${excerpt.slice(0, excerpt.lastIndexOf(' ')).replace(/[,.!;:]$/, '')}…`;
}

export function localizeProperty(property: Property, locale: string): Property {
  const translation = property.translations?.[locale];
  if (!translation) return property;
  const localizePhoto = (photo: PropertyPhoto, alt: string | undefined): PropertyPhoto => alt ? { ...photo, alt } : photo;
  const photos = property.photos.map((photo, index) => localizePhoto(photo, translation.photoAlts?.[index] ?? photo.alt));
  const units = property.units.map((unit) => {
    const translated = translation.units?.[unit.id];
    if (!translated) return unit;
    return {
      ...unit,
      ...translated,
      photos: unit.photos.map((photo, index) => localizePhoto(photo, translated.photoAlts?.[index] ?? photo.alt)),
      rooms: unit.rooms.map((room, index) => ({ ...room, ...translated.rooms?.[index] })),
    };
  });
  return { ...property, ...translation, photos, units };
}
