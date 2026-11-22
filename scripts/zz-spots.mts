import { buildWorld, isSolidTile, NODES, PROPS, ZONES, zoneAt } from "../lib/baby-game/world"
import { RESIDENTS } from "../lib/baby-game/cast"
import { HOMES } from "../lib/baby-game/homes"
const world = buildWorld(RESIDENTS.map((r) => r.day))
const occ = new Set<string>()
for (const n of NODES) occ.add(`${n.x},${n.y}`)
for (const p of PROPS) occ.add(`${p.x},${p.y}`)
for (const h of Object.values(HOMES)) for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) occ.add(`${h.x + dx},${h.y + dy}`)
const free = (x: number, y: number) => !isSolidTile(world, x, y, 5) && !occ.has(`${x},${y}`)
for (const z of process.argv.slice(2)) {
  const r = (ZONES as any)[z]
  const out: string[] = []
  for (let y = r.y0 + 1; y <= r.y1 - 3; y += 1) for (let x = r.x0 + 2; x <= r.x1 - 2; x += 1) {
    if (zoneAt(x, y) !== z) continue
    if ([-1, 0, 1].every((d) => free(x + d, y)) && free(x, y + 1) && free(x, y + 2) && free(x + 1, y + 2) && free(x - 1, y + 2) && free(x, y + 3)) out.push(`${x},${y}`)
  }
  console.log(z, out.length, out.filter((_, i) => i % 3 === 0).join(" "))
}
