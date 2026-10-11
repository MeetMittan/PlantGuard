// Generates PWA PNG icons from an inline SVG source. Run: npm run icons
// Uses sharp, which is already installed as a dependency of Transformers.js.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const leaf = (scale, offset) => `
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M24 38c0-9 2-15 10-21-9 1-15 5-17 12-2-5-1-9 2-13-6 3-8 10-5 17 2 3 5 5 10 5Z" fill="#f7f4ec"/>
    <path d="M24 38c0-6 1-11 6-16" fill="none" stroke="#1f4d36" stroke-width="1.8" stroke-linecap="round"/>
  </g>`;

// "any" icon: rounded tile. Maskable icon: full-bleed background with the mark
// inside the 80% safe zone so platform masks never crop it.
const anySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#1f4d36"/>${leaf(1, 0)}</svg>`;
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#1f4d36"/>${leaf(0.7, 7.2)}</svg>`;
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#1f4d36"/>${leaf(0.8, 4.8)}</svg>`;

await mkdir('public/icons', { recursive: true });
const jobs = [
  [anySvg, 192, 'public/icons/icon-192.png'],
  [anySvg, 512, 'public/icons/icon-512.png'],
  [maskableSvg, 512, 'public/icons/icon-maskable-512.png'],
  [appleSvg, 180, 'public/icons/apple-touch-icon.png'],
];
for (const [svg, size, out] of jobs) {
  await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(out);
  console.log('wrote', out);
}
