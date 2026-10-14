import { createHash } from 'node:crypto';
import { localizeProperty, type Property } from '../domain/property';

export type AgentResource = { body: string; contentType: string };

/** Explicit allowlist: never serialize translations, contact details or guest-guide data wholesale. */
export function publicProperty(source: Property, locale: 'en' | 'sl', origin: string) {
  const p = localizeProperty(source, locale);
  return {
    schemaVersion: 1,
    locale,
    name: p.name,
    type: p.type,
    description: p.description,
    location: { address: p.address, city: p.city, country: p.country, latitude: p.latitude, longitude: p.longitude },
    amenities: p.amenities,
    units: p.units.map((u) => ({
      id: u.id, name: u.name, type: u.type, description: u.description,
      maxGuests: u.maxGuests, bedrooms: u.bedrooms, bathrooms: u.bathrooms,
      areaSquareMetres: u.areaSquareMetres, amenities: u.amenities,
    })),
    booking: {
      url: p.bookingUrl,
      availability: 'not-provided', prices: 'not-provided', reservations: 'external-only',
    },
    sourceUrl: new URL(locale === 'sl' ? '/sl' : '/', origin).href,
    limitations: 'Build-time public information, not live inventory. Follow the booking link to verify availability, prices and terms. This API cannot create or confirm reservations.',
  };
}

export function agentResources(property: Property, origin: string): Record<string, AgentResource> {
  const url = (path: string) => new URL(path, origin).href;
  const resources: Record<string, AgentResource> = {};
  const text = (path: string, body: string, contentType = 'text/markdown; charset=utf-8') => {
    resources[path] = { body, contentType };
  };
  const json = (path: string, value: unknown, contentType = 'application/json; charset=utf-8') => text(path, JSON.stringify(value, null, 2) + '\n', contentType);
  const skill = `---
name: explore-nature-nook
description: Find public Nature Nook accommodation information and the external booking link. Use when answering questions about the property, amenities or capacity.
---

# Explore Nature Nook

1. Fetch ${url('/api/property/en.json')} for English or ${url('/api/property/sl.json')} for Slovenian.
2. Use only the returned public facts. Data is a build-time snapshot; localized content can fall back to English.
3. For readable pages, request ${url('/')} or ${url('/sl')} with Accept: text/markdown.
4. For availability, prices, booking terms or reservations, provide the returned booking.url. These are not available through this API.
5. Do not claim that a reservation was made or confirmed. Do not collect payment or personal guest data.
6. Guest guides are not part of this public API. Do not retrieve or reproduce guest-only access instructions.

API reference: ${url('/openapi.json')}
Authentication: none. No registration, credentials or authorization header is required.
`;
  text('.well-known/agent-skills/explore-nature-nook/SKILL.md', skill);
  json('.well-known/agent-skills/index.json', {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [{ name: 'explore-nature-nook', type: 'skill-md', description: 'Read public accommodation facts and find the external booking link; no reservations or live inventory.', url: url('/.well-known/agent-skills/explore-nature-nook/SKILL.md'), digest: `sha256:${createHash('sha256').update(skill).digest('hex')}` }],
  });
  text('auth.md', `# Nature Nook auth.md

## Audience and access

Agents and browsers may read public pages and the property API anonymously. No registration or provisioning endpoint exists. No API key, OAuth token, cookie or Authorization header is required.

## Supported methods

GET and HEAD retrieve public information. The site does not offer authenticated or write APIs. Do not send credentials or guest personal data. Booking is handled externally and subject to the booking provider's own terms and authentication.
`);
  text('api-docs.md', `# Nature Nook public property API

GET ${url('/api/property/en.json')} (English) or ${url('/api/property/sl.json')} (Slovenian).

No authentication required. Responses are JSON snapshots generated from the same property data as the website at build time. Missing fields mean information is not supplied; do not infer values. Localized fields may fall back to English.

The API exposes public description, location, amenities, unit capacity and an external booking link. It does not expose guest instructions, credentials, contact records, prices, availability or booking actions. Only GET and HEAD are supported; other methods return 405.

OpenAPI: ${url('/openapi.json')}
`);
  for (const locale of ['en', 'sl'] as const) json(`api/property/${locale}.json`, publicProperty(property, locale, origin));
  json('openapi.json', {
    openapi: '3.1.0', info: { title: `${property.name} public property API`, version: '1.0.0', description: 'Read-only build-time public information. No live prices, availability or reservations.' },
    servers: [{ url: origin }], security: [],
    paths: Object.fromEntries((['en', 'sl'] as const).map((locale) => [`/api/property/${locale}.json`, { get: {
      operationId: `getProperty${locale === 'en' ? 'English' : 'Slovenian'}`, summary: `Public property information (${locale})`,
      responses: { '200': { description: 'Public property snapshot', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicProperty' }, example: publicProperty(property, locale, origin) } } }, '405': { description: 'Only GET and HEAD are supported' } },
    } }])),
    components: { schemas: { PublicProperty: {
      type: 'object', required: ['schemaVersion', 'locale', 'name', 'description', 'location', 'amenities', 'units', 'booking', 'sourceUrl', 'limitations'],
      properties: {
        schemaVersion: { type: 'integer', const: 1 }, locale: { type: 'string', enum: ['en', 'sl'] }, name: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' },
        location: { type: 'object', properties: { address: { type: 'string' }, city: { type: 'string' }, country: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' } } },
        amenities: { type: 'array', items: { type: 'string' } },
        units: { type: 'array', items: { type: 'object', required: ['id', 'name', 'amenities'], properties: { id: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' }, maxGuests: { type: 'number' }, bedrooms: { type: 'number' }, bathrooms: { type: 'number' }, areaSquareMetres: { type: 'number' }, amenities: { type: 'array', items: { type: 'string' } } } } },
        booking: { type: 'object', required: ['url', 'availability', 'prices', 'reservations'], properties: { url: { type: 'string', format: 'uri' }, availability: { const: 'not-provided' }, prices: { const: 'not-provided' }, reservations: { const: 'external-only' } } },
        sourceUrl: { type: 'string', format: 'uri' }, limitations: { type: 'string' },
      },
    } } },
  });
  json('.well-known/api-catalog', { linkset: [{
    anchor: url('/api/property/en.json'),
    'service-desc': [{ href: url('/openapi.json'), type: 'application/vnd.oai.openapi+json' }],
    'service-doc': [{ href: url('/api-docs.md'), type: 'text/markdown' }],
  }] }, 'application/linkset+json; charset=utf-8');
  json('.well-known/ai-catalog.json', {
    specVersion: '1.0', host: { displayName: property.name, identifier: `https://${new URL(origin).host}/` },
    entries: [{ identifier: `urn:air:${new URL(origin).hostname}:api:property`, displayName: 'Public accommodation information', type: 'application/vnd.oai.openapi+json', url: url('/openapi.json'), representativeQueries: ['What amenities does Nature Nook offer?', 'How many guests can stay at Nature Nook?', 'Where can I book Nature Nook?'] }],
  });
  text('llms.txt', `# ${property.name}

> Public accommodation information in English and Slovenian. Reservations are handled by the external booking provider, not this website.

${property.description}

## Public information

- [English homepage](${url('/')}): Property overview; supports Accept: text/markdown.
- [Slovenian homepage](${url('/sl')}): Localized overview; supports Accept: text/markdown.
- [English property facts](${url('/api/property/en.json')}): Read-only JSON snapshot.
- [Slovenian property facts](${url('/api/property/sl.json')}): Read-only localized JSON snapshot.
- [Booking provider](${property.bookingUrl}): Verify current prices, availability and booking terms here.

## Agent resources

- [API documentation](${url('/api-docs.md')})
- [OpenAPI description](${url('/openapi.json')})
- [Agent skills](${url('/.well-known/agent-skills/index.json')})
- [Authentication information](${url('/auth.md')})
- [Capability catalog](${url('/.well-known/ai-catalog.json')})

No live inventory, prices, reservation actions or guest-only instructions are available through the public API. Content signals permit search and AI input, but not AI training.
`, 'text/plain; charset=utf-8');
  return resources;
}
