// Generates the PWA icons (teal rounded square with a white checkmark)
// without any image-library dependency by writing PNG chunks directly.
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

function makeIcon(size, { padded }) {
  const teal = [15, 118, 110]
  const bg = [245, 247, 247]
  // maskable icons need the artwork inside the 80% safe zone
  const inset = padded ? size * 0.04 : 0
  const radius = size * 0.18
  const stroke = size * 0.09
  // checkmark geometry (relative to icon square)
  const a = [0.28, 0.52], mid = [0.44, 0.68], b = [0.74, 0.34]
  return png(size, (x, y) => {
    const lo = inset, hi = size - 1 - inset
    // rounded-square coverage test
    const cx = Math.max(lo + radius, Math.min(hi - radius, x))
    const cy = Math.max(lo + radius, Math.min(hi - radius, y))
    const insideSquare =
      x >= lo && x <= hi && y >= lo && y <= hi && Math.hypot(x - cx, y - cy) <= radius
    if (!insideSquare) return padded ? [...bg, 255] : [0, 0, 0, 0]
    const d = Math.min(
      distToSegment(x / size, y / size, a[0], a[1], mid[0], mid[1]),
      distToSegment(x / size, y / size, mid[0], mid[1], b[0], b[1]),
    ) * size
    if (d <= stroke / 2) return [255, 255, 255, 255]
    return [...teal, 255]
  })
}

writeFileSync(join(outDir, 'pwa-192.png'), makeIcon(192, { padded: true }))
writeFileSync(join(outDir, 'pwa-512.png'), makeIcon(512, { padded: true }))
writeFileSync(join(outDir, 'apple-touch-icon.png'), makeIcon(180, { padded: false }))
console.log('icons written to', outDir)
