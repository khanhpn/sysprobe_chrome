import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const sizes = [16, 32, 48, 128];
const purple = [139, 92, 246, 255];
const pale = [246, 242, 255, 255];
const white = [255, 255, 255, 255];

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

const makePng = (size) => {
  const rows = [];
  const outer = Math.round(size * 0.18);
  const chip = Math.round(size * 0.28);
  const chipEnd = size - chip;
  const core = Math.round(size * 0.4);
  const coreEnd = size - core;
  const pin = Math.max(1, Math.round(size * 0.06));

  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x += 1) {
      let color = pale;
      const isChip = inRect(x, y, chip, chip, chipEnd, chipEnd);
      const isCore = inRect(x, y, core, core, coreEnd, coreEnd);
      const isHorizontalPin =
        inRect(x, y, outer, chip, chip, chip + pin) ||
        inRect(x, y, outer, chipEnd - pin, chip, chipEnd) ||
        inRect(x, y, chipEnd, chip, size - outer, chip + pin) ||
        inRect(x, y, chipEnd, chipEnd - pin, size - outer, chipEnd);
      const isVerticalPin =
        inRect(x, y, chip, outer, chip + pin, chip) ||
        inRect(x, y, chipEnd - pin, outer, chipEnd, chip) ||
        inRect(x, y, chip, chipEnd, chip + pin, size - outer) ||
        inRect(x, y, chipEnd - pin, chipEnd, chipEnd, size - outer);

      if (isChip || isHorizontalPin || isVerticalPin) color = purple;
      if (isCore) color = white;
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
