import { it } from "vitest"
import { spriteGrid } from "./sprites"
it("ascii", () => {
  const out: string[] = []
  for (const id of ["raccoon", "lamb", "goat", "piglet", "shipcat"]) for (const v of ["side", "front"] as const) {
    out.push(`== ${id} ${v}`)
    const g = spriteGrid(id, v)
    const rows = g.filter((r) => /[^.]/.test(r))
    out.push(...rows.map((r) => r.replace(/\./g, " ")))
  }
  require("fs").writeFileSync("/private/tmp/claude-501/-Users-otherworld-brain2/fe9f1f7e-ede9-484e-b899-2d5edd5edc01/scratchpad/ascii.txt", out.join("\n"))
})
