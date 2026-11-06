// Storybook (pixel-art) map TEST for the guest guide: renders the Bled walks
// area at zoom 16 into Web Mercator tiles in public/storybook/16/{x}/{y}.png.
// Geography: OpenStreetMap (ODbL) via Overpass, cached in scripts/storybook/.cache/.
// Sprites: Kenney "Tiny Town" (CC0), scripts/storybook/tiny-town.png.
// Run: CHROME_PATH=/path/to/chrome node scripts/storybook-map.mjs
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const ZOOM = 16;
const BBOX = { south: 46.343, west: 14.09, north: 46.38, east: 14.135 };
const CASTLE = [46.3697, 14.1005];
const cacheDir = new URL('./storybook/.cache/', import.meta.url);
const sheetFile = new URL('./storybook/tiny-town.png', import.meta.url);
const out = new URL('../public/storybook/', import.meta.url);

const worldSize = 256 * 2 ** ZOOM;
const project = (lat, lon) => {
  const sin = Math.sin(lat * Math.PI / 180);
  return [(lon + 180) / 360 * worldSize, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize];
};
const [minX, minY] = project(BBOX.north, BBOX.west).map((value) => Math.floor(value / 256));
const [maxX, maxY] = project(BBOX.south, BBOX.east).map((value) => Math.floor(value / 256));
const local = (point) => {
  const [x, y] = project(point.lat, point.lon);
  return [Math.round(x - minX * 256), Math.round(y - minY * 256)];
};

// Join multipolygon member ways end to end into closed rings.
const samePoint = (a, b) => a.lat === b.lat && a.lon === b.lon;
function rings(element) {
  if (element.type === 'way') return element.geometry ? [element.geometry.map(local)] : [];
  const parts = (element.members ?? []).filter((member) => member.type === 'way' && member.geometry).map((member) => [...member.geometry]);
  const result = [];
  while (parts.length) {
    let ring = parts.shift();
    while (!samePoint(ring[0], ring.at(-1))) {
      const index = parts.findIndex((part) => samePoint(part[0], ring.at(-1)) || samePoint(part.at(-1), ring.at(-1)));
      if (index < 0) break;
      const [part] = parts.splice(index, 1);
      ring = ring.concat((samePoint(part[0], ring.at(-1)) ? part : part.reverse()).slice(1));
    }
    result.push(ring.map(local));
  }
  return result;
}

const roadWidths = {
  motorway: 9, trunk: 9, primary: 9, secondary: 8, tertiary: 7, residential: 6, unclassified: 6,
  living_street: 5, pedestrian: 5, service: 4, track: 4, footway: 3, path: 3, cycleway: 3, steps: 3, bridleway: 3,
};
const scene = {
  width: (maxX - minX + 1) * 256, height: (maxY - minY + 1) * 256,
  water: [], wood: [], meadow: [], sand: [], buildings: [], roads: [], rivers: [],
  castle: local({ lat: CASTLE[0], lon: CASTLE[1] }),
};
// Three small queries: the public Overpass servers often reject one big one.
const area = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
const queries = {
  areas: `nwr["landuse"](${area});nwr["natural"~"wood|water|scrub|grassland|heath|wetland|beach"](${area});nwr["leisure"~"park|pitch|garden|swimming_area"](${area});`,
  lines: `way["highway"](${area});way["waterway"](${area});`,
  buildings: `way["building"](${area});`,
};
const osm = [];
for (const [name, query] of Object.entries(queries)) {
  const file = new URL(`part-${name}.json`, cacheDir);
  if (!await access(file).then(() => true, () => false)) {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', headers: { 'User-Agent': 'nature-nook-storybook-map/1.0' },
      body: new URLSearchParams({ data: `[out:json][timeout:140];(${query});out geom;` }),
    });
    const text = await response.text();
    if (!response.ok || !text.startsWith('{')) throw new Error(`Overpass ${name} failed (${response.status}); try again later`);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, text);
  }
  osm.push(...JSON.parse(await readFile(file, 'utf8')).elements);
}
for (const element of osm) {
  const tags = element.tags ?? {};
  if (tags.highway && roadWidths[tags.highway] && element.geometry && tags.area !== 'yes') {
    scene.roads.push({ width: roadWidths[tags.highway], points: element.geometry.map(local) });
  } else if (tags.waterway && element.geometry && tags.waterway !== 'riverbank') {
    scene.rivers.push({ width: tags.waterway === 'river' ? 9 : 4, points: element.geometry.map(local) });
  } else if (tags.building) {
    scene.buildings.push({ id: element.id, rings: rings(element) });
  } else if (tags.natural === 'water' || tags.waterway === 'riverbank' || ['reservoir', 'basin'].includes(tags.landuse)) {
    scene.water.push(rings(element));
  } else if (tags.natural === 'wood' || tags.landuse === 'forest') {
    scene.wood.push(rings(element));
  } else if (tags.natural === 'beach' || tags.leisure === 'swimming_area') {
    scene.sand.push(rings(element));
  } else if (['meadow', 'farmland', 'grass', 'village_green'].includes(tags.landuse) || ['grassland', 'scrub', 'heath'].includes(tags.natural) || ['park', 'garden', 'pitch'].includes(tags.leisure)) {
    scene.meadow.push(rings(element));
  }
}
console.log(`Area: ${maxX - minX + 1}×${maxY - minY + 1} tiles, ${scene.buildings.length} buildings, ${scene.roads.length} roads, ${scene.wood.length} woods, ${scene.water.length} water areas`);

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const sheet = `data:image/png;base64,${(await readFile(sheetFile)).toString('base64')}`;
const { tiles, preview } = await page.evaluate(async ({ scene, sheet }) => {
  const image = new Image();
  image.src = sheet;
  await image.decode();
  let seed = 7;
  const random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const canvas = (width = scene.width, height = scene.height) => {
    const element = document.createElement('canvas');
    element.width = width; element.height = height;
    const context = element.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    return [element, context];
  };
  const sprite = (context, index, x, y) => context.drawImage(image, (index % 12) * 16, Math.floor(index / 12) * 16, 16, 16, x, y, 16, 16);
  // A repeating texture made of randomly chosen sheet tiles.
  const texture = (choices, size = 128) => {
    const [element, context] = canvas(size, size);
    for (let y = 0; y < size; y += 16) for (let x = 0; x < size; x += 16) {
      let roll = random();
      const [index] = choices.find(([, weight]) => (roll -= weight) < 0) ?? choices[0];
      sprite(context, index, x, y);
    }
    return element;
  };
  const water = (() => {
    const [element, context] = canvas(32, 32);
    context.fillStyle = '#4f9fe0'; context.fillRect(0, 0, 32, 32);
    context.fillStyle = '#3b84c9'; [[3, 5], [19, 13], [7, 23], [24, 28]].forEach(([x, y]) => context.fillRect(x, y, 5, 1));
    context.fillStyle = '#a8daf8'; [[12, 3], [2, 15], [22, 21]].forEach(([x, y]) => context.fillRect(x, y, 3, 1));
    return element;
  })();
  const [main, ctx] = canvas();
  const path = (ringsList) => {
    const shape = new Path2D();
    for (const ring of ringsList) ring.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
    return shape;
  };
  // Draw shapes into a mask, snap its alpha to on/off for crisp pixel edges,
  // then fill the mask with a texture and copy it onto the map.
  const crisp = (draw, fill) => {
    const [element, context] = canvas();
    context.fillStyle = context.strokeStyle = '#000';
    context.lineCap = context.lineJoin = 'round';
    draw(context);
    const pixels = context.getImageData(0, 0, scene.width, scene.height);
    for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] > 110 ? 255 : 0;
    context.putImageData(pixels, 0, 0);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = typeof fill === 'string' ? fill : context.createPattern(fill, 'repeat');
    context.fillRect(0, 0, scene.width, scene.height);
    ctx.drawImage(element, 0, 0);
    return pixels;
  };
  const fillAll = (list) => (context) => list.forEach((ringsList) => context.fill(path(ringsList), 'evenodd'));
  const strokeLines = (list, extra = 0) => (context) => list.forEach(({ width, points }) => {
    context.lineWidth = width + extra;
    context.stroke(path([points]));
  });

  ctx.fillStyle = ctx.createPattern(texture([[0, 0.8], [1, 0.15], [2, 0.05]]), 'repeat');
  ctx.fillRect(0, 0, scene.width, scene.height);
  crisp(fillAll(scene.meadow), texture([[1, 0.55], [0, 0.4], [2, 0.05]]));
  crisp(fillAll(scene.sand), texture([[40, 0.7], [39, 0.3]]));
  crisp((context) => { context.lineWidth = 4; scene.water.forEach((ringsList) => context.stroke(path(ringsList))); strokeLines(scene.rivers, 3)(context); }, '#2d5a7b');
  crisp((context) => { fillAll(scene.water)(context); strokeLines(scene.rivers)(context); }, water);
  const roadMask = crisp(strokeLines(scene.roads, 2), '#9a6a3e');
  crisp(strokeLines(scene.roads), texture([[40, 0.8], [39, 0.2]], 64));
  // Mostly red roofs, every third building grey, like the sprite town.
  const roofs = (grey) => scene.buildings.filter(({ id }) => (id % 3 === 0) === grey).map(({ rings }) => rings);
  crisp(fillAll(roofs(false)), texture([[53, 1]], 16));
  crisp(fillAll(roofs(true)), texture([[49, 1]], 16));
  crisp((context) => { context.lineWidth = 1.5; scene.buildings.forEach(({ rings }) => context.stroke(path(rings))); }, '#2e2433');

  // Trees on a jittered grid inside each wood, kept off roads and paths.
  const trees = [];
  const onRoad = (x, y) => [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]].some(([dx, dy]) => {
    const px = Math.round(x + dx), py = Math.round(y + dy);
    return px >= 0 && py >= 0 && px < scene.width && py < scene.height && roadMask.data[(py * scene.width + px) * 4 + 3];
  });
  for (const ringsList of scene.wood) {
    const shape = path(ringsList);
    const xs = ringsList.flat().map(([x]) => x), ys = ringsList.flat().map(([, y]) => y);
    for (let y = Math.min(...ys); y < Math.max(...ys); y += 10) for (let x = Math.min(...xs); x < Math.max(...xs); x += 11) {
      const tx = x + (random() - 0.5) * 6, ty = y + (random() - 0.5) * 6;
      if (ctx.isPointInPath(shape, tx, ty, 'evenodd') && !onRoad(tx, ty)) trees.push([tx, ty, random() < 0.7 ? 16 : random() < 0.6 ? 28 : 5]);
    }
  }
  trees.sort((a, b) => a[1] - b[1]).forEach(([x, y, index]) => sprite(ctx, index, Math.round(x - 8), Math.round(y - 14)));

  // Bled Castle: one hand-built landmark from the castle stones.
  const [cx, cy] = scene.castle;
  [[99, 100, 100, 101], [111, 112, 113, 114], [123, 124, 125, 126]].forEach((row, r) => row.forEach((index, c) => sprite(ctx, index, cx - 32 + c * 16, cy - 32 + r * 16)));

  const tiles = [];
  for (let ty = 0; ty < scene.height / 256; ty++) for (let tx = 0; tx < scene.width / 256; tx++) {
    const [element, context] = canvas(256, 256);
    context.drawImage(main, -tx * 256, -ty * 256);
    tiles.push({ tx, ty, png: element.toDataURL('image/png') });
  }
  return { tiles, preview: main.toDataURL('image/png') };
}, { scene, sheet });
await browser.close();

await rm(out, { recursive: true, force: true });
for (const { tx, ty, png } of tiles) {
  const dir = new URL(`${ZOOM}/${minX + tx}/`, out);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL(`${minY + ty}.png`, dir), Buffer.from(png.split(',')[1], 'base64'));
}
await writeFile(new URL('preview.png', cacheDir), Buffer.from(preview.split(',')[1], 'base64'));
console.log(`Wrote ${tiles.length} tiles to public/storybook/${ZOOM}/ (x ${minX}–${maxX}, y ${minY}–${maxY})`);
