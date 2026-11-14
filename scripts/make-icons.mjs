import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Dependency-free PNG icon generator.
 * Draws a rounded gradient tile with three ascending bars (growth signal).
 */

const SIZES = [16, 32, 48, 96, 128];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const s = size;
  const radius = s * 0.24;

  const insideRounded = (x, y) => {
    const cx = Math.min(Math.max(x, radius), s - radius);
    const cy = Math.min(Math.max(y, radius), s - radius);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  // vertical bars: x, y, w, h as fractions of size
  const bars = [
    [0.26, 0.56, 0.13, 0.2],
    [0.435, 0.4, 0.13, 0.36],
    [0.61, 0.26, 0.13, 0.5],
  ];

  const inBar = (x, y) => {
    for (const [bx, by, bw, bh] of bars) {
      const x0 = bx * s;
      const y0 = by * s;
      const x1 = (bx + bw) * s;
      const y1 = (by + bh) * s;
      const r = Math.max(0.9, (bw * s) / 2.4);
      const cx = Math.min(Math.max(x, x0 + r), x1 - r);
      const cy = Math.min(Math.max(y, y0 + r), y1 - r);
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) return true;
    }
    return false;
  };

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const i = (y * s + x) * 4;
      if (!insideRounded(px, py)) continue;

      // diagonal gradient violet -> cyan
      const t = Math.min(1, Math.max(0, (px / s) * 0.55 + (py / s) * 0.45));
      let r = Math.round(0x6d + (0x22 - 0x6d) * t);
      let g = Math.round(0x5e + (0xd3 - 0x5e) * t);
      let b = Math.round(0xf8 + (0xee - 0xf8) * t);

      if (inBar(px, py)) {
        r = 255;
        g = 255;
        b = 255;
      }

      // 4x supersample-free softness at small sizes is unnecessary; keep crisp
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(s, s, rgba);
}

const outDir = join(process.cwd(), 'public', 'icon');
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  const file = join(outDir, `${size}.png`);
  writeFileSync(file, render(size));
  console.log('wrote', dirname(file).replace(process.cwd(), '.') + `/${size}.png`);
}
