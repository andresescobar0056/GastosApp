/**
 * Genera iconos PNG para PWA sin dependencias externas.
 * Escribe un PNG con fondo degradado azul oscuro y el icono de la wallet.
 * Uso: node generate-icons.js
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.join(__dirname, 'assets', 'icons');

// ── PNG writer puro (sin dependencias) ──────────────────────────────────────

function writePNG(width, height, pixelFn) {
  // pixelFn(x, y) => [r, g, b, a]
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      row[1 + x * 4]     = r;
      row[1 + x * 4 + 1] = g;
      row[1 + x * 4 + 2] = b;
      row[1 + x * 4 + 3] = a;
    }
    rows.push(row);
  }

  const raw     = Buffer.concat(rows);
  const deflated = zlib.deflateSync(raw, { level: 9 });

  function crc32(buf) {
    let crc = -1;
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c;
      }
      return t;
    })());
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
  }

  function chunk(type, data) {
    const len  = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const head = Buffer.concat([Buffer.from(type), data]);
    const crc  = Buffer.alloc(4); crc.writeUInt32BE(crc32(head));
    return Buffer.concat([len, head, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 6;  // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Pixel renderer del icono de la wallet ───────────────────────────────────

function iconPixel(x, y, w, h) {
  const nx = x / w;  // 0..1
  const ny = y / h;

  // --- Fondo redondeado ---
  const radius = 0.227;  // ~116/512
  const cx = Math.abs(nx - 0.5);
  const cy = Math.abs(ny - 0.5);

  // Esquinas redondeadas (distancia SDF)
  const qx = Math.max(cx - (0.5 - radius), 0);
  const qy = Math.max(cy - (0.5 - radius), 0);
  const dist = Math.sqrt(qx * qx + qy * qy) - radius;

  if (dist > 0.005) return [0, 0, 0, 0]; // transparente fuera del icono

  // Color de fondo degradado azul oscuro
  const t = nx * 0.4 + ny * 0.6;
  const bgR = Math.round(15  + (8  - 15)  * t);
  const bgG = Math.round(22  + (12 - 22)  * t);
  const bgB = Math.round(38  + (20 - 38)  * t);

  // --- Wallet body (rectángulo superior) ---
  // Parte superior de la wallet
  const wL = 0.219, wR = 0.781, wT = 0.258, wB = 0.375;
  const inTopWallet = nx >= wL && nx <= wR && ny >= wT && ny <= wB;

  // Cuerpo principal de la wallet
  const bL = 0.219, bR = 0.781, bT = 0.383, bB = 0.742;
  const inBody = nx >= bL && nx <= bR && ny >= bT && ny <= bB;

  // Compartimento derecho (tarjeta)
  const cL = 0.584, cR = 0.781, cT = 0.5, cB = 0.625;
  const inCard = nx >= cL && nx <= cR && ny >= cT && ny <= cB;

  // Círculo verde (moneda)
  const coinCx = 0.664, coinCy = 0.5625, coinR = 0.0273;
  const inCoin = Math.sqrt((nx - coinCx) ** 2 + (ny - coinCy) ** 2) < coinR;

  if (inCoin) {
    // Verde esmeralda
    return [52, 211, 153, 255];
  }
  if (inCard) {
    // Azul medio oscuro
    return [31, 46, 77, 255];
  }
  if (inBody) {
    // Fondo del cuerpo de la wallet
    return [23, 34, 57, 255];
  }
  if (inTopWallet) {
    // Azul primario
    const bt = (nx - wL) / (wR - wL);
    const r = Math.round(59  + (29  - 59)  * bt);
    const g = Math.round(130 + (78  - 130) * bt);
    const b = Math.round(246 + (216 - 246) * bt);
    return [r, g, b, 255];
  }

  // Suavizar bordes del contenedor
  const aa = dist < -0.003 ? 255 : Math.round(255 * (-dist / 0.003));
  return [bgR, bgG, bgB, aa];
}

// ── Generar y guardar los PNGs ───────────────────────────────────────────────

for (const size of [192, 512]) {
  const buf = writePNG(size, size, iconPixel);
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ icon-${size}.png (${buf.length} bytes)`);
}

// Maskable: misma imagen (el diseño ya tiene safe-zone implícita)
const maskBuf = writePNG(512, 512, iconPixel);
fs.writeFileSync(path.join(iconsDir, 'icon-512-maskable.png'), maskBuf);
console.log('✓ icon-512-maskable.png');

console.log('\n✅ Iconos PNG generados en assets/icons/');
