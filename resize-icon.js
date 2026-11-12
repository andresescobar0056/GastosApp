/**
 * Regenera los iconos PNG de la PWA con fondo #080C14 (color de la app)
 * para que en Android no se vea el fondo blanco del Bubble.png original.
 * Uso: node resize-icon.js
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.join(__dirname, 'assets', 'icons');

// ── Lector PNG ────────────────────────────────────────────────────────────────

function readPNG(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('No es PNG');
  let i = 8, width, height, colorType, idatChunks = [];
  while (i < buf.length) {
    const len  = buf.readUInt32BE(i); i += 4;
    const type = buf.slice(i, i + 4).toString('ascii'); i += 4;
    const data = buf.slice(i, i + len); i += len + 4;
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    if (type === 'IDAT') idatChunks.push(data);
    if (type === 'IEND') break;
  }
  const raw      = zlib.inflateSync(Buffer.concat(idatChunks));
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const stride   = 1 + width * channels;
  const pixels   = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const filter   = raw[y * stride];
    const rowStart = y * stride + 1;
    for (let x = 0; x < width; x++) {
      const src = rowStart + x * channels;
      let r = raw[src] || 0, g = raw[src+1] || 0, b = raw[src+2] || 0;
      let a = channels === 4 ? (raw[src+3] ?? 255) : 255;

      if (filter === 1 && x > 0) {
        const p = rowStart + (x-1)*channels;
        r=(r+raw[p])&0xff; g=(g+raw[p+1])&0xff; b=(b+raw[p+2])&0xff;
        if(channels===4) a=(a+raw[p+3])&0xff;
      }
      if (filter === 2 && y > 0) {
        const p = (y-1)*stride+1+x*channels;
        r=(r+raw[p])&0xff; g=(g+raw[p+1])&0xff; b=(b+raw[p+2])&0xff;
        if(channels===4) a=(a+raw[p+3])&0xff;
      }

      const dst = (y*width+x)*4;
      pixels[dst]=r; pixels[dst+1]=g; pixels[dst+2]=b; pixels[dst+3]=a;
    }
  }
  return { width, height, pixels };
}

// ── Redimensionador bilineal ───────────────────────────────────────────────────

function resize(src, sW, sH, dW, dH) {
  const dst = Buffer.alloc(dW * dH * 4);
  const xR = sW/dW, yR = sH/dH;
  for (let y = 0; y < dH; y++) {
    for (let x = 0; x < dW; x++) {
      const sx = Math.min(Math.floor(x*xR), sW-1);
      const sy = Math.min(Math.floor(y*yR), sH-1);
      const s = (sy*sW+sx)*4, d = (y*dW+x)*4;
      dst[d]=src[s]; dst[d+1]=src[s+1]; dst[d+2]=src[s+2]; dst[d+3]=src[s+3];
    }
  }
  return dst;
}

// ── Compositor: burbuja sobre fondo de color ──────────────────────────────────

function compositeOnBg(pixels, w, h, bgR, bgG, bgB) {
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s  = i * 4;
    const sA = pixels[s+3] / 255;  // alpha de la burbuja
    // Blending: pixel_burbuja * alpha + fondo * (1 - alpha)
    out[s]   = Math.round(pixels[s]   * sA + bgR * (1 - sA));
    out[s+1] = Math.round(pixels[s+1] * sA + bgG * (1 - sA));
    out[s+2] = Math.round(pixels[s+2] * sA + bgB * (1 - sA));
    out[s+3] = 255;
  }
  return out;
}

// ── Escritor PNG ───────────────────────────────────────────────────────────────

function writePNG(w, h, pixels) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w*4);
    row[0] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y*w+x)*4, d = 1+x*4;
      row[d]=pixels[s]; row[d+1]=pixels[s+1]; row[d+2]=pixels[s+2]; row[d+3]=pixels[s+3];
    }
    rows.push(row);
  }
  const raw      = Buffer.concat(rows);
  const deflated = zlib.deflateSync(raw, { level: 9 });

  const table = (() => {
    const t = new Uint32Array(256);
    for (let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[i]=c;}
    return t;
  })();
  const crc32 = buf => { let c=-1; for(let i=0;i<buf.length;i++)c=table[(c^buf[i])&0xff]^(c>>>8); return (c^-1)>>>0; };
  const chunk = (type, data) => {
    const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
    const head=Buffer.concat([Buffer.from(type),data]);
    const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(head));
    return Buffer.concat([len,head,crc]);
  };
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk('IHDR',ihdr), chunk('IDAT',deflated), chunk('IEND',Buffer.alloc(0))
  ]);
}

// ── Main ───────────────────────────────────────────────────────────────────────

const srcBuf = fs.readFileSync(path.join(iconsDir, 'Bubble.png'));
const { width, height, pixels } = readPNG(srcBuf);
console.log(`Bubble.png leído: ${width}x${height}`);

// Color de fondo de la app: #080C14
const BG_R = 0x08, BG_G = 0x0C, BG_B = 0x14;

for (const size of [192, 512]) {
  const resized    = resize(pixels, width, height, size, size);
  const composited = compositeOnBg(resized, size, size, BG_R, BG_G, BG_B);
  const png        = writePNG(size, size, composited);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), png);
  console.log(`✓ icon-${size}.png — fondo #080C14 aplicado`);
}

// Maskable: misma imagen con fondo oscuro (Android puede recortar en círculo)
const r512    = resize(pixels, width, height, 512, 512);
const m512    = compositeOnBg(r512, 512, 512, BG_R, BG_G, BG_B);
const maskBuf = writePNG(512, 512, m512);
fs.writeFileSync(path.join(iconsDir, 'icon-512-maskable.png'), maskBuf);
console.log('✓ icon-512-maskable.png — fondo #080C14 aplicado');

console.log('\n✅ Iconos regenerados. Sube a Netlify para que Android use los nuevos.');
