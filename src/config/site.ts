import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type SectionId = 'intro' | 'units' | 'amenities' | 'location' | 'contact';

export type SiteConfig = {
  schemaVersion: 1;
  site: { slug: string; locale: string; url?: string };
  design: {
    colors: { primary: string; accent: string; background: string; surface: string; text: string; muted: string };
    fonts: { heading: string; body: string };
    edges: 'square' | 'soft' | 'rounded' | 'organic';
    gallery: 'editorial' | 'grid' | 'masonry';
    hero: 'overlay' | 'split' | 'minimal';
    units: 'alternating' | 'grid' | 'compact';
    amenities: 'grid' | 'list' | 'band';
    contact: 'banner' | 'card';
  };
  sections: SectionId[];
  contact: { type: 'personal' | 'booking' | 'both' };
  guestGuide: boolean;
};

export const defaultSiteConfig: SiteConfig = {
  schemaVersion: 1,
  site: { slug: 'property', locale: 'en' },
  design: {
    colors: { primary: '#3a471d', accent: '#b1883c', background: '#fdfdfd', surface: '#f7f3e9', text: '#2d2c1c', muted: '#847154' },
    fonts: { heading: 'Cormorant Garamond', body: 'Manrope' },
    edges: 'soft',
    gallery: 'editorial',
    hero: 'overlay',
    units: 'alternating',
    amenities: 'grid',
    contact: 'banner',
  },
  sections: ['intro', 'units', 'amenities', 'location', 'contact'],
  contact: { type: 'both' },
  guestGuide: true,
};

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const path = resolve(process.cwd(), process.env.SITE_CONFIG_FILE ?? '.data/site.json');
    return JSON.parse(await readFile(path, 'utf8')) as SiteConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultSiteConfig;
    throw error;
  }
}
