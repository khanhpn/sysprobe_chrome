import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const sizes = [16, 32, 48, 128];
const transparent = [0, 0, 0, 0];
const bgTop = [14, 23, 42, 255];
const bgBottom = [29, 78, 216, 255];
const cyan = [45, 212, 191, 255];
const blue = [96, 165, 250, 255];
const white = [248, 250, 252, 255];
const slate = [148, 163, 184, 255];

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
};

const putPixel = (row, x, rgba) => {
  const offset = 1 + x * 4;
  row[offset] = rgba[0];
  row[offset + 1] = rgba[1];
  row[offset + 2] = rgba[2];
  row[offset + 3] = rgba[3];
};

const inRect = (x, y, left, top, right, bottom) => x >= left && x < right && y >= top && y < bottom;
const mix = (a, b, amount) => a.map((value, index) => Math.round(value + (b[index] - value) * amount));
const roundedRectAlpha = (x, y, left, top, right, bottom, radius) => {
  const px = x + 0.5;
  const py = y + 0.5;
  const dx = Math.max(left - px, 0, px - right);
  const dy = Math.max(top - py, 0, py - bottom);
  const outside = Math.hypot(dx, dy);
  const cornerX = px < left + radius ? left + radius : px > right - radius ? right - radius : px;
  const cornerY = py < top + radius ? top + radius : py > bottom - radius ? bottom - radius : py;
  const cornerDistance = Math.hypot(px - cornerX, py - cornerY) - radius;
  return Math.max(0, Math.min(1, 1 - Math.max(outside, cornerDistance)));
};

const lineAlpha = (x, y, x1, y1, x2, y2, width) => {
  const px = x + 0.5;
  const py = y + 0.5;
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lengthSq = vx * vx + vy * vy;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lengthSq));
  const distance = Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t));
  return Math.max(0, Math.min(1, 1 - (distance - width / 2)));
};

const over = (base, top, alpha = top[3] / 255) => {
  const nextAlpha = alpha + (base[3] / 255) * (1 - alpha);
  if (nextAlpha === 0) return transparent;
  return [
    Math.round((top[0] * alpha + base[0] * (base[3] / 255) * (1 - alpha)) / nextAlpha),
    Math.round((top[1] * alpha + base[1] * (base[3] / 255) * (1 - alpha)) / nextAlpha),
    Math.round((top[2] * alpha + base[2] * (base[3] / 255) * (1 - alpha)) / nextAlpha),
    Math.round(nextAlpha * 255)
  ];
};

const makePng = (size) => {
  const rows = [];
  const pad = size * 0.08;
  const radius = size * 0.21;
  const chip = {
    left: size * 0.26,
    top: size * 0.28,
    right: size * 0.74,
    bottom: size * 0.72
  };
  const pin = Math.max(1, Math.round(size * 0.055));

  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x += 1) {
      const bgAlpha = roundedRectAlpha(x, y, pad, pad, size - pad, size - pad, radius);
      const shineAlpha = roundedRectAlpha(x, y, size * 0.18, size * 0.15, size * 0.76, size * 0.42, size * 0.15) * 0.28;
      let color = over(transparent, mix(bgTop, bgBottom, y / Math.max(1, size - 1)), bgAlpha);
      color = over(color, white, shineAlpha * bgAlpha);

      const chipAlpha = roundedRectAlpha(x, y, chip.left, chip.top, chip.right, chip.bottom, size * 0.08);
      color = over(color, [15, 23, 42, 255], chipAlpha * bgAlpha);
      color = over(color, cyan, roundedRectAlpha(x, y, chip.left + size * 0.06, chip.top + size * 0.08, chip.right - size * 0.06, chip.bottom - size * 0.08, size * 0.035) * 0.2);

      const pinLeft = size * 0.16;
      const pinRight = size * 0.84;
      for (const yPin of [size * 0.36, size * 0.5, size * 0.64]) {
        const leftPin = inRect(x, y, pinLeft, yPin - pin / 2, chip.left, yPin + pin / 2);
        const rightPin = inRect(x, y, chip.right, yPin - pin / 2, pinRight, yPin + pin / 2);
        if (leftPin || rightPin) color = over(color, slate, 0.86 * bgAlpha);
      }

      const trace =
        lineAlpha(x, y, size * 0.34, size * 0.58, size * 0.46, size * 0.44, size * 0.065) ||
        lineAlpha(x, y, size * 0.46, size * 0.44, size * 0.57, size * 0.53, size * 0.065) ||
        lineAlpha(x, y, size * 0.57, size * 0.53, size * 0.68, size * 0.36, size * 0.065);
      color = over(color, blue, trace * bgAlpha);

      for (const [cx, cy] of [
        [size * 0.34, size * 0.58],
        [size * 0.46, size * 0.44],
        [size * 0.57, size * 0.53],
        [size * 0.68, size * 0.36]
      ]) {
        const dot = Math.max(0, 1 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (size * 0.055));
        color = over(color, white, dot * bgAlpha);
      }

      putPixel(row, x, color);
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0))
  ]);
};

await mkdir(new URL("../icons/", import.meta.url), { recursive: true });
await Promise.all(sizes.map((size) => writeFile(new URL(`../icons/icon${size}.png`, import.meta.url), makePng(size))));
