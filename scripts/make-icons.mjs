// Generates the WW Co-pilot icons: a One UI squircle with a brand-green
// gradient and a white "WW" monogram drawn as one rounded zigzag stroke.
// No image library: PNG chunks are written directly; each pixel is
// supersampled 4×4 for smooth edges. Run with `npm run icons`.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(outDir, { recursive: true })

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0 // no filter
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y)
      raw.writeUInt32BE(((r << 24) | (g << 16) | (b << 8) | a) >>> 0, row + 1 + x * 4)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}


const distToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// Brand green, lighter at the top (matches --accent #0f7a45 in tokens.css).
const TOP = [24, 150, 88]
const BOTTOM = [12, 104, 60]
const WHITE = [255, 255, 255]

// "WW" as one zigzag across the middle, in a unit square (0..1).
const W_PATH = [
  [0.19, 0.335], [0.27, 0.665], [0.345, 0.43], [0.42, 0.665], [0.5, 0.335],
  [0.58, 0.665], [0.655, 0.43], [0.73, 0.665], [0.81, 0.335],
]
const STROKE = 0.044 // half width of the stroke, as a share of the glyph box

/** Distance from (x, y) to the WW zigzag scaled by `k` around the centre. */
function glyphDist(x, y, k) {
  const u = 0.5 + (x - 0.5) / k
  const v = 0.5 + (y - 0.5) / k
  let d = Infinity
  for (let i = 1; i < W_PATH.length; i++) {
    const [ax, ay] = W_PATH[i - 1]
    const [bx, by] = W_PATH[i]
    d = Math.min(d, distToSegment(u, v, ax, ay, bx, by))
  }
  return d * k
}

/** One UI squircle (superellipse, n = 5) filling `inset`..1-`inset`. */
function inSquircle(x, y, inset) {
  const r = 0.5 - inset
  const nx = Math.abs(x - 0.5) / r
  const ny = Math.abs(y - 0.5) / r
  return nx ** 5 + ny ** 5 <= 1
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

/**
 * shape 'squircle': transparent outside the squircle (browsers, desktops).
 * shape 'full': the whole square is painted (iOS and maskable icons, which the
 * system crops itself). `k` scales the glyph (smaller for maskable's safe zone).
 */
function makeIcon(size, { shape, inset = 0, k = 1 }) {
  const S = 4 // supersampling per axis
  return png(size, (px, py) => {
    let cover = 0
    let ink = 0
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const x = (px + (sx + 0.5) / S) / size
        const y = (py + (sy + 0.5) / S) / size
        if (shape === 'squircle' && !inSquircle(x, y, inset)) continue
        cover++
        if (glyphDist(x, y, k) <= STROKE * k) ink++
      }
    }
    if (cover === 0) return [0, 0, 0, 0]
    const bg = mix(TOP, BOTTOM, py / size)
    const [r, g, b] = mix(bg, WHITE, ink / cover)
    return [r, g, b, Math.round((255 * cover) / (S * S))]
  })
}

writeFileSync(join(outDir, 'pwa-192.png'), makeIcon(192, { shape: 'squircle', inset: 0.04 }))
writeFileSync(join(outDir, 'pwa-512.png'), makeIcon(512, { shape: 'squircle', inset: 0.04 }))
writeFileSync(join(outDir, 'favicon-32.png'), makeIcon(32, { shape: 'squircle', inset: 0 }))
// Android crops maskable icons to a circle or squircle: keep the glyph inside the middle 80%.
writeFileSync(join(outDir, 'maskable-512.png'), makeIcon(512, { shape: 'full', k: 0.82 }))
// iOS draws its own rounded corners and shows transparency as black: fully opaque.
writeFileSync(join(outDir, 'apple-touch-icon.png'), makeIcon(180, { shape: 'full', k: 0.92 }))

const svgPath = W_PATH.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 64).toFixed(1)} ${(y * 64).toFixed(1)}`).join(' ')
writeFileSync(
  join(outDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${TOP})"/><stop offset="1" stop-color="rgb(${BOTTOM})"/></linearGradient></defs>
  <path d="M32 0C6 0 0 6 0 32s6 32 32 32 32-6 32-32S58 0 32 0Z" fill="url(#g)"/>
  <path d="${svgPath}" fill="none" stroke="#fff" stroke-width="${(STROKE * 2 * 64).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`,
)
console.log('icons written to', outDir)
