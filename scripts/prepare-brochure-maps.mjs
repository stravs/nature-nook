import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

// Explicit, one-off Bled print extract, not part of builds or browser requests.
// Reuse cached tiles and respect the OSM tile service's cache policy.
const maps = {
  local: { zoom: 15, center: [46.3608, 14.1028], width: 1350, height: 1200 },
};
const pixel = ([lat, lon], zoom) => {
  const s = 256 * 2 ** zoom, r = lat * Math.PI / 180;
  return [(lon + 180) / 360 * s, (1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * s];
};
await mkdir('/tmp/nature-nook-map-tiles', { recursive: true });
await mkdir('public/stay-k7m4/maps', { recursive: true });
for (const [name, map] of Object.entries(maps)) {
  const [cx, cy] = pixel(map.center, map.zoom);
  map.left = Math.round(cx - map.width / 2);
  map.top = Math.round(cy - map.height / 2);
  const x0 = Math.floor(map.left / 256), y0 = Math.floor(map.top / 256);
  const x1 = Math.floor((map.left + map.width - 1) / 256), y1 = Math.floor((map.top + map.height - 1) / 256);
  const tiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const cache = `/tmp/nature-nook-map-tiles/${map.zoom}-${x}-${y}.png`;
    let input;
    try { input = await readFile(cache); } catch {
      const response = await fetch(`https://tile.openstreetmap.org/${map.zoom}/${x}/${y}.png`, {
        headers: { 'User-Agent': 'NatureNookGuestBrochure/1.0 (https://nature-nook.si; printable guest map)' },
      });
      if (!response.ok) throw new Error(`Tile ${response.status}: ${map.zoom}/${x}/${y}`);
      input = Buffer.from(await response.arrayBuffer());
      await writeFile(cache, input);
    }
    tiles.push({ input, left: (x - x0) * 256, top: (y - y0) * 256 });
  }
  await sharp({ create: { width: (x1 - x0 + 1) * 256, height: (y1 - y0 + 1) * 256, channels: 3, background: '#fff' } })
    .composite(tiles).png().toBuffer().then(buffer => sharp(buffer)
      .extract({ left: map.left - x0 * 256, top: map.top - y0 * 256, width: map.width, height: map.height })
      .modulate({ saturation: 0.55, brightness: 1.03 }).webp({ quality: 90 }).toFile(`public/stay-k7m4/maps/${name}.webp`));
  console.log(`Prepared ${name} map`);
}
await writeFile('src/guide/data/brochure-maps.json', JSON.stringify(maps, null, 2) + '\n');
