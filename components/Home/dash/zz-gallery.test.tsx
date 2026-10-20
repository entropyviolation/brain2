import { readFileSync, writeFileSync } from "node:fs"
import { act, render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { usePointsStore } from "@/lib/points-store"
import { HomeOverview } from "@/components/Home/home-overview"
import { HomeWidgetCatalog } from "@/components/Home/home-widget-catalog"
import { useDashboardEditMode } from "@/components/Home/widgets/edit-mode"
import "./dash-faces"

vi.mock("@/components/Reviews/RitualWalkDialog", () => ({ RitualWalkDialog: () => null }))

const OUT = process.env.SCENES_OUT ?? "/tmp"
const CSS = [
  "app/win95.css", "components/Home/home-chrome.css", "components/Home/Habits/habit-chrome.css",
  "components/Home/home-widget-face.css", "components/Home/Habits/cockpit-switch.css", "components/Home/visual-dashboard.css", "components/Home/dash/dash.css",
].map((f) => { try { return readFileSync(f, "utf8") } catch { return "" } }).join("\n")

function dump(name: string) {
  const html = document.body.innerHTML
  writeFileSync(`${OUT}/${name}.html`, `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Silkscreen&family=Karla&display=swap" rel="stylesheet">
<style>:root{--font-dotgothic:"DotGothic16";--font-silkscreen:"Silkscreen";--font-karla:"Karla"} body{margin:0;padding:20px;background:#008080}
[role=dialog]{position:relative!important;inset:auto!important;transform:none!important;margin:16px auto!important}
${CSS}</style></head><body class="win95-app"><div class="home95" style="max-width:1100px">${html}</div></body></html>`)
}

const D = new Date()

describe("gallery", () => {
  for (const style of ["milled", "dash"] as const) {
    for (const kind of ["points", "vocab", "pet"]) {
      it(`${style} ${kind}`, () => {
        resetAllStores()
        usePointsStore.getState().addPoints("t", 42, "Morning run", D)
        const r = render(<HomeOverview currentDate={D} />)
        act(() => useDashboardStore.getState().setStyle(style))
        r.unmount()
        const g = render(<HomeWidgetCatalog open onOpenChange={() => {}} initialKind={kind} />)
        dump(`gallery-${style}-${kind}`)
        g.unmount()
        cleanup()
      })
    }
  }
})
