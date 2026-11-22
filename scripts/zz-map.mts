import { buildWorld, isSolidTile, NODES, PROPS, ZONES, EXTENT_W, EXTENT_H, zoneAt } from "../lib/baby-game/world"
import { RESIDENTS } from "../lib/baby-game/cast"
import { HOMES } from "../lib/baby-game/homes"
const world = buildWorld(RESIDENTS.map((r) => r.day))
const [x0, y0, x1, y1] = process.argv.slice(2).map(Number) as [number, number, number, number]
const occ = new Map<string, string>()
for (const n of NODES) occ.set(`${n.x},${n.y}`, "n")
for (const p of PROPS) occ.set(`${p.x},${p.y}`, "P")
for (const h of Object.values(HOMES)) occ.set(`${h.x},${h.y}`, "H")
let head = "    " + Array.from({ length: x1 - x0 + 1 }, (_, i) => String((x0 + i) % 10)).join("")
console.log(head)
for (let y = y0; y <= y1; y++) {
  let row = String(y).padStart(3) + " "
  for (let x = x0; x <= x1; x++) row += occ.get(`${x},${y}`) ?? (isSolidTile(world, x, y, 5) ? "#" : ".")
  console.log(row)
}
