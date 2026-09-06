// Generates PWA icons with zero dependencies (pure PNG encoder over zlib).
// PLACEHOLDER ARTWORK: a neutral dot-grid mark. Edit `paint()` to change it,
// then `npm run icons`. Sizes cover Android/Chrome (192/512), maskable (512
// with safe-zone padding) and iOS (180 apple-touch-icon).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG = [0x12, 0x12, 0x12];
const FG = [0xed, 0xed, 0xed];

function paint(size, { maskable }) {
  const px = new Uint8Array(size * size * 4);
  const r = maskable ? 0 : size * 0.22;           // corner radius (none for maskable: OS masks it)
  const pad = maskable ? size * 0.2 : size * 0.16; // maskable safe zone is the inner 80%
  const cells = 5;
  const pitch = (size - pad * 2) / cells;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    // rounded-square background
    const dx = Math.max(Math.abs(x + 0.5 - size / 2) - (size / 2 - r), 0);
    const dy = Math.max(Math.abs(y + 0.5 - size / 2) - (size / 2 - r), 0);
    const inside = maskable || Math.hypot(dx, dy) <= r;
    if (!inside) { px[i + 3] = 0; continue; }
    // dot grid whose dot radius grows left→right (echoes the first module)
    const cx = Math.floor((x - pad) / pitch), cy = Math.floor((y - pad) / pitch);
    let v = 0;
    if (cx >= 0 && cx < cells && cy >= 0 && cy < cells) {
      const lx = (x - pad) / pitch - cx - 0.5, ly = (y - pad) / pitch - cy - 0.5;
      const rad = 0.12 + 0.34 * (cx / (cells - 1)) * (0.6 + 0.4 * Math.sin(cy * 1.7 + cx));
      const d = Math.hypot(lx, ly);
      v = Math.max(0, Math.min(1, (rad - d) * pitch + 0.5));
    }
    px[i] = BG[0] + (FG[0] - BG[0]) * v;
    px[i + 1] = BG[1] + (FG[1] - BG[1]) * v;
    px[i + 2] = BG[2] + (FG[2] - BG[2]) * v;
    px[i + 3] = 255;
  }
  return px;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = [
  ['icon-192.png', 192, false], ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true],
];
for (const [name, size, maskable] of files) {
  writeFileSync(new URL(name, OUT), png(size, paint(size, { maskable })));
  console.log('wrote', name);
}
// Favicon as SVG (same mark, vector).
const dots = [];
for (let cy = 0; cy < 5; cy++) for (let cx = 0; cx < 5; cx++) {
  const rad = 0.12 + 0.34 * (cx / 4) * (0.6 + 0.4 * Math.sin(cy * 1.7 + cx));
  dots.push(`<circle cx="${(16 + (cx + 0.5) * 13.6).toFixed(2)}" cy="${(16 + (cy + 0.5) * 13.6).toFixed(2)}" r="${(rad * 13.6).toFixed(2)}"/>`);
}
writeFileSync(new URL('favicon.svg', OUT),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#121212"/><g fill="#ededed">${dots.join('')}</g></svg>\n`);
console.log('wrote favicon.svg');
