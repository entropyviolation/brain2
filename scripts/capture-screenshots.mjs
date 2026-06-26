/**
 * Capture docs/screenshots/*.png from the running Next dev server.
 *
 * Usage:
 *   npm run dev   (or npm run electron:dev — uses port 3000 for Next)
 *   node scripts/capture-screenshots.mjs
 *
 * Options (env):
 *   COGS_URL=http://localhost:3000
 *   PW_CHANNEL=chrome
 *   COGS_FRESH=1   — clear localStorage before load (consistent seed data)
 */
import { chromium } from "playwright"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { SHOTS, GLOBAL_HEADER } from "./screenshot-manifest.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, "..", "docs", "screenshots")
const BASE = process.env.COGS_URL ?? "http://localhost:3000"
const FRESH = process.env.COGS_FRESH !== "0"

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function screenshot(page, file, opts = {}) {
  const p = path.join(OUT, file)
  await page.screenshot({ path: p, fullPage: true, ...opts })
  console.log("  ✓", file)
}

async function clickTopTab(page, name) {
  await page.getByRole("tab", { name, exact: true }).click()
  await wait(700)
}

async function clickHomeSubTab(page, name) {
  await clickTopTab(page, "Home")
  await page.locator('[role="tablist"]').filter({ has: page.getByRole("tab", { name: "Habits" }) }).getByRole("tab", { name, exact: true }).click()
  await wait(500)
}

async function dismissDialogs(page) {
  for (let i = 0; i < 3; i++) {
    const open = page.locator('[role="dialog"][data-state="open"]')
    if ((await open.count()) === 0) break
    await page.keyboard.press("Escape")
    await wait(250)
  }
}

async function clickFmBtn(page, label, { display = false } = {}) {
  const scope = display
    ? page.locator(".fm-toolbar").filter({ hasText: "Display:" })
    : page.locator(".fm-toolbar").filter({ hasText: "View:" })
  await scope.getByRole("button", { name: label, exact: true }).click()
  await wait(400)
}

async function openListByName(page, names) {
  const candidates = Array.isArray(names) ? names : [names]
  await clickTopTab(page, "Lists")
  await wait(600)
  await dismissDialogs(page)

  const tryOpen = async () => {
    for (const name of candidates) {
      const icon = page.locator(".fm-icon").filter({ hasText: name }).first()
      if (await icon.count()) {
        await icon.dblclick()
        await wait(700)
        return name
      }
      const row = page.locator("tr, .fm-list-row").filter({ hasText: name }).first()
      if (await row.count()) {
        await row.dblclick()
        await wait(700)
        return name
      }
    }
    return null
  }

  // Example List appears under All (not Home smart lists).
  const allNav = page.locator(".fm-tree-item").filter({ hasText: "All" }).first()
  if (await allNav.count()) {
    await allNav.click()
    await wait(500)
    let hit = await tryOpen()
    if (hit) return hit
    await clickFmBtn(page, "List")
    hit = await tryOpen()
    if (hit) return hit
  }

  // Fallback: Home smart / habit lists
  const homeNav = page.locator(".fm-tree-item").filter({ hasText: "Home" }).first()
  if (await homeNav.count()) {
    await homeNav.click()
    await wait(400)
    await clickFmBtn(page, "Icons")
    const hit = await tryOpen()
    if (hit) return hit
  }

  throw new Error(`Could not open list: ${candidates.join(", ")}`)
}

async function captureHome(page) {
  await clickTopTab(page, "Home")

  await clickHomeSubTab(page, "Habits")
  await page.getByRole("tab", { name: /^Daily / }).click()
  await wait(400)
  await screenshot(page, "01-home-daily-habits.png")

  await page.getByRole("tab", { name: /^Weekly / }).click()
  await wait(400)
  await screenshot(page, "01-home-habits-weekly.png")

  await page.getByRole("tab", { name: /^Monthly / }).click()
  await wait(400)
  await screenshot(page, "01-home-habits-monthly.png")

  await clickHomeSubTab(page, "Plan")
  await page.getByRole("tab", { name: "Month View" }).click()
  await wait(500)
  await screenshot(page, "02-home-plan.png")

  await page.getByRole("tab", { name: "Week View" }).click()
  await wait(500)
  await screenshot(page, "02-home-plan-week.png")

  await page.getByRole("tab", { name: "Day View" }).click()
  await wait(500)
  await screenshot(page, "02-home-plan-day.png")

  await clickHomeSubTab(page, "To Do")
  await page.getByRole("tab", { name: "Day", exact: true }).click()
  await wait(400)
  await screenshot(page, "03-home-todo.png")

  await page.getByRole("tab", { name: "Week", exact: true }).click()
  await wait(400)
  await screenshot(page, "03-home-todo-week.png")

  await page.getByRole("tab", { name: "Month", exact: true }).click()
  await wait(400)
  await screenshot(page, "03-home-todo-month.png")

  await clickHomeSubTab(page, "Goals")
  await wait(500)
  await screenshot(page, "04-home-goals.png")

  await clickHomeSubTab(page, "Tracking")
  await page.getByRole("tab", { name: "Time Grid" }).click()
  await wait(500)
  await screenshot(page, "08-home-tracking.png")

  await page.getByRole("tab", { name: "Day Log" }).click()
  await wait(500)
  await screenshot(page, "08-home-tracking-daylog.png")
}

async function captureLists(page) {
  await clickTopTab(page, "Lists")
  await wait(800)
  await dismissDialogs(page)

  await clickFmBtn(page, "Icons")
  await screenshot(page, "05-lists.png")

  await clickFmBtn(page, "List")
  await screenshot(page, "05-lists-list.png")

  await clickFmBtn(page, "Details")
  await screenshot(page, "05-lists-details.png")

  await clickFmBtn(page, "Cards")
  await screenshot(page, "05-lists-cards.png")

  // Open Example List (seeded) for content display modes
  await clickFmBtn(page, "Icons")
  await openListByName(page, ["Example List", "Daily To Do List"])
  await dismissDialogs(page)

  await clickFmBtn(page, "Default", { display: true })
  await screenshot(page, "05-lists-content-default.png")

  await clickFmBtn(page, "Checklist", { display: true })
  await screenshot(page, "05-lists-content-checklist.png")

  await clickFmBtn(page, "Kanban", { display: true })
  await screenshot(page, "05-lists-content-kanban.png")

  await clickFmBtn(page, "Spreadsheet", { display: true })
  await screenshot(page, "05-lists-content-spreadsheet.png")

  // Open item detail popup — click first task row in the list
  await clickFmBtn(page, "Default", { display: true })
  const taskLink = page.locator(".fm-link-text").first()
  if (await taskLink.count()) {
    await taskLink.click()
  } else {
    // Example List empty: skip popup (manifest notes optional capture)
    console.warn("  ⚠ no tasks for 21-item-detail-popup.png — skipping")
  }
  if (await page.locator('[role="dialog"][data-state="open"]').count()) {
    await screenshot(page, "21-item-detail-popup.png")
    await page.keyboard.press("Escape")
    await wait(300)
  }
}

async function captureScheduler(page) {
  await clickTopTab(page, "Scheduler")
  await wait(600)

  await page.getByRole("button", { name: "Funnel" }).click()
  await wait(300)
  await page.getByRole("tab", { name: "Always" }).click()
  await wait(500)
  await screenshot(page, "06-scheduler.png")

  await page.getByRole("tab", { name: "Day" }).click()
  await wait(500)
  await screenshot(page, "06-scheduler-day.png")

  await page.getByRole("button", { name: "Gantt" }).click()
  await wait(600)
  await screenshot(page, "06-scheduler-gantt.png")

  await page.getByRole("button", { name: "Dependencies" }).click()
  await wait(600)
  await screenshot(page, "06-scheduler-dependencies.png")
}

async function captureOperations(page) {
  await clickTopTab(page, "Operations")
  await wait(500)
  await screenshot(page, "10-operations.png")

  await page.getByPlaceholder("New operation name").fill("Demo Operation")
  await page.getByRole("button", { name: "New Operation" }).click()
  await wait(800)
  await screenshot(page, "10-operations-workspace.png")

  await page.getByRole("button", { name: "Back" }).click()
  await wait(400)
}

async function captureModules(page) {
  await clickTopTab(page, "Modules")
  await wait(600)
  await screenshot(page, "09-modules.png")

  await page.getByRole("button", { name: "Build module" }).click()
  await wait(400)
  await page.getByRole("button", { name: "Itinerary Creator" }).click()
  await wait(1200)
  await screenshot(page, "09-modules-workspace.png")
}

async function captureGraph(page) {
  await clickTopTab(page, "Graph")
  await wait(800)
  await screenshot(page, "11-graph.png")
}

async function captureAnalytics(page) {
  await clickTopTab(page, "Analytics")
  await wait(600)

  const tabs = [
    ["Habits", "07-analytics.png"],
    ["Points", "07-analytics-points.png"],
    ["Tracking", "07-analytics-tracking.png"],
    ["Plan vs Reality", "07-analytics-plan-vs-reality.png"],
    ["Calibration", "07-analytics-calibration.png"],
    ["Streaks", "07-analytics-streaks.png"],
    ["Reflection", "07-analytics-reflection.png"],
    ["Reviews", "07-analytics-reviews.png"],
    ["Metrics", "07-analytics-metrics.png"],
    ["Correlation", "07-analytics-correlation.png"],
    ["Context Switch", "07-analytics-context-switch.png"],
    ["Regret", "07-analytics-regret.png"],
    ["Item Types", "07-analytics-item-types.png"],
  ]

  for (const [tab, file] of tabs) {
    await page.getByRole("tab", { name: tab }).click()
    await wait(600)
    await screenshot(page, file)
  }
}

async function captureDialogs(page) {
  await clickTopTab(page, "Home")
  await wait(400)

  // End-of-period review
  await page.locator("[data-home-review-entry]").click()
  await wait(300)
  await page.getByRole("menuitem", { name: /day review/i }).click()
  await wait(600)
  await screenshot(page, "20-dialog-reviews.png")
  await page.keyboard.press("Escape")
  await wait(300)

  // Morning review
  await page.locator("[data-morning-review-entry]").click()
  await wait(600)
  await screenshot(page, "20-dialog-morning-review.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await page.getByRole("button", { name: "Settings" }).click()
  await wait(500)
  await screenshot(page, "20-dialog-settings.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await page.getByRole("button", { name: "Inbox" }).click()
  await wait(500)
  await screenshot(page, "20-dialog-inbox.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await page.getByRole("button", { name: "Bulk Add" }).click()
  await wait(500)
  await screenshot(page, "20-dialog-bulk-add.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await page.getByRole("button", { name: "Quick Add" }).click()
  await wait(500)
  await screenshot(page, "20-dialog-quick-add.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await page.keyboard.press("Meta+k")
  await wait(600)
  await screenshot(page, "20-dialog-global-search.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await page.getByRole("button", { name: "Tracking" }).click()
  await wait(600)
  await screenshot(page, "20-dialog-time-tracking.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await page.getByRole("button", { name: "Metrics" }).click()
  await wait(600)
  await screenshot(page, "20-dialog-metrics.png")
  await page.keyboard.press("Escape")
  await wait(300)
}

function txtForShot(shot) {
  const sources = shot.sources.map((s) => `  - ${s}`).join("\n")
  return `================================================================================
SCREENSHOT: ${shot.file}
VIEW: ${shot.view}
AREA: ${shot.area}
SOURCE FILES:
${sources}
================================================================================

GLOBAL CHROME (all screens)
${GLOBAL_HEADER.split("\n").map((l) => `  ${l}`).join("\n")}

VIEW-SPECIFIC
${shot.description}
`
}

async function writeDescriptions() {
  for (const shot of SHOTS) {
    const base = shot.file.replace(/\.png$/, ".txt")
    await writeFile(path.join(OUT, base), txtForShot(shot), "utf8")
  }
  console.log(`Wrote ${SHOTS.length} description files`)
}

async function main() {
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({
    channel: process.env.PW_CHANNEL ?? "chrome",
    headless: true,
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  if (FRESH) {
    await context.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  }

  const page = await context.newPage()

  console.log("Loading", BASE)
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 120_000 })
  await wait(2500)

  console.log("\nHome…")
  await captureHome(page)
  console.log("\nLists…")
  await captureLists(page)
  console.log("\nScheduler…")
  await captureScheduler(page)
  console.log("\nOperations…")
  await captureOperations(page)
  console.log("\nModules…")
  await captureModules(page)
  console.log("\nGraph…")
  await captureGraph(page)
  console.log("\nAnalytics…")
  await captureAnalytics(page)
  console.log("\nDialogs…")
  await captureDialogs(page)

  await browser.close()

  console.log("\nDescriptions…")
  await writeDescriptions()

  console.log("\nDone —", OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
