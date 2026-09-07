import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { getSiteConfig } from './src/config/site.ts';

const { design, site } = await getSiteConfig();

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL ?? site.url ?? 'https://nature-nook.si',
  trailingSlash: 'never',
  fonts: [
    { name: design.fonts.heading, cssVariable: '--astro-font-heading', provider: fontProviders.google(), weights: ['400 800'], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
    { name: design.fonts.body, cssVariable: '--astro-font-body', provider: fontProviders.google(), weights: ['400 800'], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
  ],
  i18n: { locales: ['en', 'sl'], defaultLocale: 'en', routing: { prefixDefaultLocale: false } },
  integrations: [sitemap({
    filter: (page) => !/\/guests\/?$/.test(new URL(page).pathname),
    i18n: { defaultLocale: 'en', locales: { en: 'en', sl: 'sl' } },
  })],
});
