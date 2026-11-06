import type { Locale } from '../i18n';

export type Coordinates = [latitude: number, longitude: number];

export function isValidCoordinates(value: unknown): value is Coordinates {
  return Array.isArray(value) && value.length === 2
    && typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 90
    && typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 180;
}

/** Great-circle distance between pins, not a route, entrance, or travel time. */
export function straightLineDistanceMeters(from: Coordinates, to: Coordinates): number {
  if (!isValidCoordinates(from) || !isValidCoordinates(to)) throw new RangeError('Invalid geographic coordinates');
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = radians(to[0] - from[0]);
  const deltaLongitude = radians(to[1] - from[1]);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(from[0])) * Math.cos(radians(to[0])) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371_008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

/** Round to avoid implying address/route-level accuracy. */
export function formatStraightLineDistance(meters: number, locale: Locale): string {
  if (!Number.isFinite(meters) || meters < 0) throw new RangeError('Invalid distance');
  if (meters === 0) return '0 m';
  if (meters < 10) return '< 10 m';
  const roundedMeters = Math.round(meters / 10) * 10;
  if (roundedMeters < 1000) return `≈ ${roundedMeters} m`;
  const km = new Intl.NumberFormat(locale === 'sl' ? 'sl-SI' : 'en-GB', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(meters / 1000);
  return `≈ ${km} km`;
}
