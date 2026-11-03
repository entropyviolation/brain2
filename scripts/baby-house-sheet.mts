/**
 * scripts/baby-house-sheet.mts — a contact sheet of generated houses
 *
 * `npx tsx scripts/baby-house-sheet.mts out.png [lit] [id ...]` draws every home kind for each id (default: four ids)
 * with `components/BabyGame/housegen.ts`, at 3×, on a cool ground, so a change to the generator can be looked at.
 */
import { deflateSync } from "node:zlib"
import { writeFileSync } from "node:fs"
import { houseRgba, specFor, HOUSE_W } from "../components/BabyGame/housegen"
import type { HomeKind } from "../lib/baby-game/homes"

const [out = "houses.png", litArg, ...rest] = process.argv.slice(2)
const lit = litArg === "lit"
const ids = rest.length ? rest : ["chick", "bunny", "fox", "otter"]
const KINDS: HomeKind[] = ["hutch", "stall", "nest", "burrow", "den", "hollow", "lodge", "igloo", "flat"]
const S = 3
const cw = HOUSE_W * S
const W = cw * KINDS.length
const H = cw * ids.length
const img = new Uint8Array(W * H * 4)
const ground = lit ? [22, 36, 70] : [78, 160, 140]
for (let i = 0; i < W * H; i++) { img[i * 4] = ground[0]!; img[i * 4 + 1] = ground[1]!; img[i * 4 + 2] = ground[2]!; img[i * 4 + 3] = 255 }
ids.forEach((id, row) => KINDS.forEach((kind, col) => {
  const rgba = houseRgba(specFor(kind, id, kind === "flat" ? 3 : 0), lit)
  for (let y = 0; y < HOUSE_W; y++) for (let x = 0; x < HOUSE_W; x++) {
    const a = rgba[(y * HOUSE_W + x) * 4 + 3]! / 255
    if (!a) continue
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
      const o = ((row * cw + y * S + dy) * W + col * cw + x * S + dx) * 4
      for (let k = 0; k < 3; k++) img[o + k] = Math.round(rgba[(y * HOUSE_W + x) * 4 + k]! * a + img[o + k]! * (1 - a))
    }
  }
}))
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(img.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]))
console.log("wrote", out, W, H)
