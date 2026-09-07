import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const images = import.meta.glob<ImageMetadata>('../assets/images/**/*.jpg', {
  eager: true,
  import: 'default',
});

/** Resolve the stable image IDs in property data to imported Astro assets. */
export function photoSource(url: string): ImageMetadata {
  const image = images[`../assets${url}`];
  if (!image) throw new Error(`Missing property image: ${url}`);
  return image;
}

export async function fullPhoto(url: string) {
  return getImage({ src: photoSource(url), format: 'webp' });
}
