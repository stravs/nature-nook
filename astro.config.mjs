import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { getSiteConfig } from './src/config/site.ts';

const { design } = await getSiteConfig();

export default defineConfig({
  output: 'static',
  site: 'https://nature-nook.si',
  fonts: [
    { name: design.fonts.heading, cssVariable: '--astro-font-heading', provider: fontProviders.google(), weights: ['400 800'], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
    { name: design.fonts.body, cssVariable: '--astro-font-body', provider: fontProviders.google(), weights: ['400 800'], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
  ],
  i18n: { locales: ['en', 'sl'], defaultLocale: 'en', routing: { prefixDefaultLocale: false } },
  integrations: [sitemap()],
});
