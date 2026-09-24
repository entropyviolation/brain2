import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * `title` is the field of record and `itemTitle()` is the only way to read a
 * name. That is a convention until something enforces it, and conventions about
 * a field that is *usually* a mirror decay invisibly: a direct `description`
 * read looks right in every test, and then one day a rename writes only the
 * other field and half the app shows the old name. (That is exactly what
 * happened with `renameDocument`.)
 *
 * So: this scan fails on a new direct display read. The allowlist should only
 * ever shrink.
 */

const ROOTS = ["components", "lib", "app"]

/** `{task.description}`, `${todo.description}`, `label={t.description}`. */
const DISPLAY_READ = /[{$]\{?(?:task|todo|item|t|p|doc|place)\.description\}/

const ALLOWED = new Map([
  // The name editors. Each reads and writes the same field in lockstep;
  // reading `title` while writing `description` is how a body gets clobbered.
  ["components/ItemDetail/ItemDetailPage.tsx", "item name editor"],
  ["components/ItemDetail/ItemDetailPopup.tsx", "item name editor"],
  ["components/spreadsheet/SheetGrid.tsx", "editable name column"],
  ["components/Modules/workspace/itinerary/TripActivitiesView.tsx", "place name editor"],
  // Tracking belongs to another agent; these are pure display and should be
  // converted when that work lands.
  ["components/Home/Tracking/actual-day-view.tsx", "pending Tracking owner"],
  ["components/Home/Tracking/tracking-activity-log.tsx", "pending Tracking owner"],
])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe("nothing new reads an item's name off `description`", () => {
  it("has no direct display reads outside the allowlist", () => {
    const root = join(__dirname, "..")
    const offenders = ROOTS.flatMap((r) => sourceFiles(join(root, r)))
      .map((f) => relative(root, f))
      .filter((f) => !ALLOWED.has(f))
      .filter((f) => DISPLAY_READ.test(readFileSync(join(root, f), "utf8")))

    expect(offenders, "use itemTitle() / itemTitleOrUntitled() from lib/item-utils").toEqual([])
  })

  it("keeps the allowlist honest — every entry still has a read to justify it", () => {
    const root = join(__dirname, "..")
    const stale = [...ALLOWED.keys()].filter((f) => !DISPLAY_READ.test(readFileSync(join(root, f), "utf8")))
    expect(stale, "these files are clean now; drop them from ALLOWED").toEqual([])
  })
})
