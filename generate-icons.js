/* === ReadFlow Icon Generator (pure Node.js, zero dependencies) === */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// --- CRC32 for PNG chunks ---
const crcTable = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// --- Build a valid PNG from a pixel function ---
function createPNG(width, height, pixelFn) {
  // Generate raw RGBA rows (each row prefixed with filter byte 0 = None)
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const off = 1 + x * 4;
      row[off] = r; row[off + 1] = g; row[off + 2] = b; row[off + 3] = a;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type);
    const crcIn = Buffer.concat([typeB, data]);
    const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcIn), 0);
    return Buffer.concat([len, typeB, data, crcVal]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// --- Icon pixel function ---
// 5×7 bitmap for "R"
const R_BITMAP = [
  [1,1,1,0,0],
  [1,0,0,1,0],
  [1,0,0,1,0],
  [1,1,1,0,0],
  [1,0,1,0,0],
  [1,0,0,1,0],
  [1,0,0,1,0],
];

function drawIcon(size) {
  const cx = size / 2, cy = size / 2;
  const bg = [0x1a, 0x1a, 0x2e];
  const circleC = [0x4a, 0x6c, 0xf7];
  const white = [0xff, 0xff, 0xff];
  const circleR = size * 0.30;
  const cornerR = size * 0.08;

  return createPNG(size, size, (x, y) => {
    let r = bg[0], g = bg[1], b = bg[2], a = 255;

    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Circle
    if (dist <= circleR) {
      [r, g, b] = circleC;

      // "R" letter inside circle
      const lx = (x - (cx - circleR * 0.62)) / (circleR * 1.24);
      const ly = (y - (cy - circleR * 0.55)) / (circleR * 1.10);
      if (lx >= 0 && lx < 1 && ly >= 0 && ly < 1) {
        const bx = Math.min(4, Math.floor(lx * 5));
        const by = Math.min(6, Math.floor(ly * 7));
        if (R_BITMAP[by][bx]) [r, g, b] = white;
      }
    }

    // Rounded corners
    const cr = cornerR + 1;
    const inCorner = (cx2, cy2) => Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2) < cornerR;
    if (x < cr && y < cr && !inCorner(cr, cr)) a = 0;
    else if (x > size - cr && y < cr && !inCorner(size - cr, cr)) a = 0;
    else if (x < cr && y > size - cr && !inCorner(cr, size - cr)) a = 0;
    else if (x > size - cr && y > size - cr && !inCorner(size - cr, size - cr)) a = 0;

    return [r, g, b, a];
  });
}

// --- Generate ---
const dir = path.join(__dirname, 'assets', 'icons');

[192, 512].forEach(size => {
  const png = drawIcon(size);
  const dest = path.join(dir, `icon-${size}.png`);
  fs.writeFileSync(dest, png);
  console.log(`✅ icon-${size}.png  (${png.length} bytes)`);
});

console.log('Done! PWA icons ready.');
