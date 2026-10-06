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
 *   COGS_ONLY=01-home-daily-habits.png  — capture + rewrite sidecar for listed files only (comma-separated)
 *
 * Before the app boots, init scripts write throwaway Zustand blobs (tracking,
 * sleep, tasks/operations, modules, goals, habit completions, plan logs).
 * POST /api/persist stays blocked so this never lands in a real vault.
 * Each live PNG is copied into docs/screenshots/history/ before overwrite.
 */
import { chromium } from "playwright"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { SHOTS, GLOBAL_HEADER } from "./screenshot-manifest.mjs"
import { archiveShot, writeReelIndex } from "./screenshot-archive.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, "..", "docs", "screenshots")
const BASE = process.env.COGS_URL ?? "http://localhost:3000"
const FRESH = process.env.COGS_FRESH !== "0"
const ONLY = (process.env.COGS_ONLY ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function wantShot(file) {
  return ONLY.length === 0 || ONLY.includes(file)
}

function wantAny(files) {
  return files.some((file) => wantShot(file))
}

async function screenshot(page, file, opts = {}) {
  if (!wantShot(file)) return
  archiveShot(OUT, file)
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
  // Mode deck uses role=radio in a radiogroup (List display vs Folder view).
  const group = display
    ? page.getByRole("radiogroup", { name: "List display" })
    : page.getByRole("radiogroup", { name: "Folder view" })
  await group.getByRole("radio", { name: label, exact: true }).click()
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
  if (!wantAny([
    "01-home-habits-weekly.png",
    "01-home-habits-monthly.png",
    "02-home-plan.png",
    "02-home-plan-week.png",
    "02-home-plan-day.png",
    "02-home-plan-season.png",
    "03-home-todo.png",
    "03-home-todo-just-start.png",
    "03-home-todo-week.png",
    "03-home-todo-month.png",
    "04-home-goals.png",
    "08-home-tracking.png",
    "08-home-tracking-week.png",
    "08-home-tracking-activity.png",
    "08-home-tracking-block.png",
    "08-home-tracking-daylog.png",
  ])) {
    return
  }

  await page.getByRole("tab", { name: /^Weekly / }).click()
  await wait(400)
  await screenshot(page, "01-home-habits-weekly.png")

  await page.getByRole("tab", { name: /^Monthly / }).click()
  await wait(400)
  await screenshot(page, "01-home-habits-monthly.png")

  await clickHomeSubTab(page, "Plan")
  const planTabs = page.locator(".plan95 [role='tablist']")
  await planTabs.getByRole("tab", { name: "Month", exact: true }).click()
  await wait(500)
  await screenshot(page, "02-home-plan.png")

  await planTabs.getByRole("tab", { name: "Week", exact: true }).click()
  await wait(500)
  await screenshot(page, "02-home-plan-week.png")

  await planTabs.getByRole("tab", { name: "Day", exact: true }).click()
  await wait(500)
  await screenshot(page, "02-home-plan-day.png")

  await planTabs.getByRole("tab", { name: "Season", exact: true }).click()
  await wait(500)
  await screenshot(page, "02-home-plan-season.png")

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

  // The same grid over seven days. Ticking Mon–Fri shows the bulk fill armed,
  // which is the thing a week view exists for.
  await page.getByRole("button", { name: "week", exact: true }).click()
  await wait(500)
  await page.getByRole("button", { name: "Mon–Fri" }).click()
  await wait(300)
  await screenshot(page, "08-home-tracking-week.png")
  await page.getByRole("button", { name: "day", exact: true }).click()
  await wait(400)

  await page.getByRole("tab", { name: "Activity Log" }).click()
  await wait(500)
  await screenshot(page, "08-home-tracking-activity.png")

  // The block editor, opened on the afternoon at Ian's — the one block whose
  // other scopes have something to say, which is what "Also happening" is for.
  await page.getByRole("button", { name: "Location", exact: true }).first().click()
  await wait(400)
  await page.getByRole("button").filter({ hasText: "Ian's House" }).first().click()
  await wait(600)
  // Scroll the section into full view: the scopes that have *nothing* for these
  // minutes, and their one-click Attach, are the half worth showing.
  try {
    await page.getByText("nothing here yet").first().scrollIntoViewIfNeeded({ timeout: 5000 })
  } catch {
    // Already on screen, or the companion empty-state copy is not in this seed.
  }
  await wait(400)
  await screenshot(page, "08-home-tracking-block.png")
  await page.keyboard.press("Escape")
  await wait(300)
  await page.getByRole("button", { name: "Activity", exact: true }).first().click()
  await wait(300)

  await page.getByRole("tab", { name: "Day Log" }).click()
  await wait(500)
  await screenshot(page, "08-home-tracking-daylog.png")

  if (wantShot("03-home-todo-just-start.png")) {
    await clickHomeSubTab(page, "To Do")
    await page.getByRole("tab", { name: "Day", exact: true }).click()
    await wait(400)
    const pack = page.locator(".todo-row-closed").filter({ hasText: "Pack the coast bag" })
    await pack.getByRole("button", { name: "Start", exact: true }).click()
    await wait(600)
    await screenshot(page, "03-home-todo-just-start.png")
    await page.getByRole("button", { name: "Exit focus mode" }).click()
    await wait(300)
  }
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

  await clickFmBtn(page, "Spreadsheet", { display: true })
  await screenshot(page, "05-lists-content-spreadsheet.png")

  // Open item detail popup — Default is reading rows, not orbs or a blue link.
  await clickFmBtn(page, "Default", { display: true })
  const named = page
    .locator("[data-testid=list-default-read] .fm-read-name")
    .filter({ hasText: "Photograph the headlands" })
    .first()
  const taskLink = (await named.count())
    ? named
    : page.locator("[data-testid=list-default-read] .fm-read-name").first()
  if (await taskLink.count()) {
    await taskLink.click()
  } else {
    console.warn("  ⚠ no tasks for 21-item-detail-*.png — skipping")
  }
  const detail = page.locator('[role="dialog"][data-state="open"]').last()
  if (await detail.count()) {
    const detailTabs = [
      ["Details", "21-item-detail-popup.png"],
      ["Scheduling", "21-item-detail-scheduling.png"],
      ["Dependencies", "21-item-detail-dependencies.png"],
      ["Subtasks", "21-item-detail-subtasks.png"],
      ["Analysis", "21-item-detail-analysis.png"],
      ["Time", "21-item-detail-time.png"],
      ["Body", "21-item-detail-body.png"],
    ]
    for (const [name, file] of detailTabs) {
      const tab = detail.getByRole("tab", { name, exact: true })
      if (!(await tab.count())) {
        console.warn(`  ⚠ no ${name} tab — skipping ${file}`)
        continue
      }
      await tab.click()
      await wait(350)
      await screenshot(page, file)
    }
    await page.keyboard.press("Escape")
    await wait(300)
  }
}

async function captureScheduler(page) {
  const sch = page.locator(".sch95")
  const funnel = sch.getByRole("button", { name: "Funnel", exact: true })
  await clickTopTab(page, "Scheduler")
  try {
    await funnel.waitFor({ timeout: 20_000 })
  } catch {
    // A Fast Refresh reload during the lazy Scheduler chunk returns the page
    // to Home. Open the tab again once the window is back.
    await clickTopTab(page, "Scheduler")
    await funnel.waitFor({ timeout: 20_000 })
  }

  await funnel.click()
  await wait(300)
  await sch.getByRole("tab", { name: "Always", exact: true }).click()
  await wait(500)
  await screenshot(page, "06-scheduler.png")

  await sch.getByRole("tab", { name: "Day", exact: true }).click()
  await wait(500)
  await screenshot(page, "06-scheduler-day.png")

  await sch.getByRole("button", { name: "Gantt", exact: true }).click()
  await wait(600)
  await screenshot(page, "06-scheduler-gantt.png")

  await sch.getByRole("button", { name: "Dependencies", exact: true }).click()
  await wait(600)
  await screenshot(page, "06-scheduler-dependencies.png")
}

async function captureOperations(page) {
  await clickTopTab(page, "Operations")
  await wait(700)
  await screenshot(page, "10-operations.png")

  await page.getByRole("button", { name: /Coast weekend/ }).click()
  await wait(800)
  const ops = page.locator(".ops95")
  await screenshot(page, "10-operations-workspace.png")

  const panels = [
    ["To do", "10-operations-todo.png"],
    ["Phases", "10-operations-phases.png"],
    ["Parts", "10-operations-parts.png"],
    ["Timeline", "10-operations-timeline.png"],
    ["Locations", "10-operations-locations.png"],
    ["Plan", "10-operations-plan.png"],
    ["Resources", "10-operations-resources.png"],
    ["Log", "10-operations-log.png"],
  ]
  for (const [name, file] of panels) {
    await ops.getByRole("tab", { name, exact: true }).click()
    await wait(name === "Timeline" || name === "Locations" || name === "Plan" ? 1000 : 500)
    await screenshot(page, file)
  }

  await ops.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("heading", { name: "Operation settings" }).waitFor({ timeout: 8000 })
  await wait(400)
  await screenshot(page, "10-operations-settings.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await ops.getByRole("button", { name: "After-action report" }).click()
  await page.getByRole("heading", { name: "After-action report" }).waitFor({ timeout: 8000 })
  await wait(400)
  await screenshot(page, "10-operations-postmortem.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await ops.getByRole("button", { name: "Board" }).click()
  await wait(400)
}

async function captureDocs(page) {
  await clickTopTab(page, "Docs")
  await page.getByRole("heading", { name: "Brainclip Docs — Document Editor" }).waitFor({ timeout: 30_000 })
  await page.getByRole("button", { name: /Coast weekend plan/ }).first().waitFor({ timeout: 15_000 })
  await wait(400)
  await screenshot(page, "12-docs.png")

  await page.getByRole("button", { name: /Coast weekend plan/ }).first().click()
  await wait(800)
  await screenshot(page, "12-docs-reading.png")
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

async function captureAnalytics(page) {
  await clickTopTab(page, "Analytics")
  await wait(600)

  const tabs = [
    ["Behavior", "Habits", "07-analytics.png"],
    ["Behavior", "Points", "07-analytics-points.png"],
    ["Behavior", "Velocity", "07-analytics-velocity.png"],
    ["Time", "Tracking", "07-analytics-tracking.png"],
    ["Time", "Sleep", "07-analytics-sleep.png"],
    ["Time", "Screen Time", "07-analytics-screentime.png"],
    ["Time", "Circadian", "07-analytics-circadian.png"],
    ["Time", "Places", "07-analytics-places.png"],
    ["Time", "Mood field", "07-analytics-mood-field.png"],
    ["Time", "Diversity", "07-analytics-diversity.png"],
    ["Time", "Transitions", "07-analytics-transitions.png"],
    ["Time", "Context Switch", "07-analytics-context-switch.png"],
    ["Time", "Operations", "07-analytics-operations.png"],
    ["Accuracy", "Plan vs Reality", "07-analytics-plan-vs-reality.png"],
    ["Accuracy", "Calibration", "07-analytics-calibration.png"],
    ["Accuracy", "Cycle", "07-analytics-cycle.png"],
    ["Accuracy", "Regret", "07-analytics-regret.png"],
    ["Accuracy", "Goals", "07-analytics-goals.png"],
    ["Behavior", "Streaks", "07-analytics-streaks.png"],
    ["Behavior", "Reflection", "07-analytics-reflection.png"],
    ["Behavior", "Reviews", "07-analytics-reviews.png"],
    ["Behavior", "Overcommit", "07-analytics-overcommit.png"],
    ["Meta", "Observatory", "07-analytics-observatory.png"],
    ["Meta", "Metrics", "07-analytics-metrics.png"],
    ["Meta", "Correlation", "07-analytics-correlation.png"],
    ["Meta", "Spectrum", "07-analytics-spectrum.png"],
    ["Meta", "Cross-section", "07-analytics-cross-section.png"],
    ["Library", "Item Types", "07-analytics-item-types.png"],
    ["Library", "Lists & areas", "07-analytics-lists-areas.png"],
    ["Library", "Attributes", "07-analytics-attributes.png"],
    ["Library", "Tags", "07-analytics-tags.png"],
    ["Library", "Stages", "07-analytics-stages.png"],
    ["Library", "Weight", "07-analytics-weight.png"],
  ]

  for (const [group, tab, file] of tabs) {
    await page.getByRole("tablist", { name: "Analytics groups" }).getByRole("tab", { name: group, exact: true }).click()
    await page.getByRole("tablist", { name: "Analytics views" }).getByRole("tab", { name: tab, exact: true }).click()
    await wait(600)
    await screenshot(page, file)
  }

  // The variant drill-down is the point of the Tracking tab, so document it open.
  await page.getByRole("tablist", { name: "Analytics groups" }).getByRole("tab", { name: "Time", exact: true }).click()
  await page.getByRole("tablist", { name: "Analytics views" }).getByRole("tab", { name: "Tracking", exact: true }).click()
  await wait(600)
  // A pen and a tag can share a name. The pen card renders before the tag card,
  // so first/last picks the right one without guessing at the card markup.
  await page.getByRole("button", { name: /^Break down Social/ }).first().click()
  await wait(700)
  await screenshot(page, "07-analytics-tracking-breakdown.png")
  await page.keyboard.press("Escape")
  await wait(300)

  // The tag drill-down: where a tag's minutes came from, across scopes. Exercise
  // is the interesting one — some of it is a Location block tagged on its own.
  await page.getByRole("button", { name: /^Break down Exercise/ }).last().click()
  await wait(700)
  await screenshot(page, "07-analytics-tracking-tag.png")
  await page.keyboard.press("Escape")
  await wait(300)
}

async function captureDialogs(page) {
  await clickTopTab(page, "Home")
  await wait(400)

  // End-of-day review. The rituals menu labels it Night (today), not "day review".
  await page.locator("[data-home-review-entry]").click()
  await wait(300)
  await page.locator("[data-ritual-slot=day-night]").click()
  await wait(600)
  await screenshot(page, "20-dialog-reviews.png")
  await page.keyboard.press("Escape")
  await wait(300)

  // Morning review lives in the same Rituals menu (Morning), not a header key.
  await page.locator("[data-home-review-entry]").click()
  await wait(300)
  await page.locator("[data-ritual-slot=day-morning]").click()
  await wait(600)
  await screenshot(page, "20-dialog-morning-review.png")
  await page.keyboard.press("Escape")
  await wait(300)

  // Leave Tracking / Habits first — both have their own Settings buttons.
  await clickHomeSubTab(page, "Goals")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await wait(500)
  // The city field autofocuses and drops its suggestion list over everything
  // below it; blur it so the rest of the dialog is actually in the picture.
  await page.getByText("Full App Backup").click()
  await wait(400)
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
  await dismissDialogs(page)
  await wait(300)

  await page.locator("fieldset").filter({ hasText: "System" }).getByRole("button", { name: "Tracking", exact: true }).click()
  await wait(600)
  await screenshot(page, "20-dialog-time-tracking.png")
  await page.keyboard.press("Escape")
  await wait(300)

  await page.getByRole("button", { name: "Metrics" }).click()
  await wait(600)
  await screenshot(page, "20-dialog-metrics.png")
  await page.keyboard.press("Escape")
  await wait(300)

  if (wantShot("20-dialog-completion.png")) {
    await clickHomeSubTab(page, "To Do")
    await page.getByRole("tab", { name: "Day", exact: true }).click()
    await wait(400)
    const pack = page.locator(".todo-row-closed").filter({ hasText: "Pack the coast bag" })
    await pack.getByRole("button", { name: "Done", exact: true }).click()
    await page.getByRole("heading", { name: "Task completed" }).waitFor({ timeout: 8000 })
    await wait(400)
    await screenshot(page, "20-dialog-completion.png")
    await page.getByRole("button", { name: "Undo completion" }).click()
    await wait(400)
  }
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
  const shots = ONLY.length ? SHOTS.filter((s) => wantShot(s.file)) : SHOTS
  for (const shot of shots) {
    const base = shot.file.replace(/\.png$/, ".txt")
    await writeFile(path.join(OUT, base), txtForShot(shot), "utf8")
  }
  console.log(`Wrote ${shots.length} description files`)
}

/**
 * Runs in the page before the app boots. An empty tracker makes every Tracking
 * screenshot an empty-state, so paint a plausible fortnight — including a pen
 * broken down by variants, which is what the Analytics drill-down documents.
 */
function seedTracking() {
  const pad = (n) => String(n).padStart(2, "0")
  const dateKey = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  const scopes = [
    {
      id: "activity",
      name: "Activity",
      pens: [
        {
          id: "act-work",
          name: "Work",
          color: "#2563eb",
          tags: ["tag-work"],
          variantLabel: "What on?",
          variants: [
            { id: "var-deep", name: "Deep work", color: "#1d4ed8" },
            { id: "var-meetings", name: "Meetings", color: "#60a5fa" },
          ],
        },
        { id: "act-rest", name: "Rest", color: "#10b981", tags: ["tag-rest"] },
        {
          id: "act-exercise",
          name: "Exercise",
          color: "#f59e0b",
          tags: ["tag-exercise"],
          variantLabel: "Which?",
          variants: [{ id: "var-run", name: "Run", color: "#d97706" }],
        },
        {
          id: "act-social",
          name: "Social",
          color: "#ec4899",
          tags: ["tag-social"],
          variantLabel: "Who with?",
          variants: [
            { id: "var-elijah", name: "Elijah", color: "#db2777" },
            { id: "var-rebecca", name: "Rebecca", color: "#f472b6" },
          ],
        },
        { id: "act-chores", name: "Chores", color: "#8b5cf6", tags: ["tag-cleaning"] },
        { id: "act-sleep", name: "Sleep", color: "#1e293b", tags: ["tag-sleep"] },
      ],
    },
    {
      id: "location",
      name: "Location",
      pens: [
        { id: "loc-home", name: "Home", color: "#16a34a" },
        { id: "loc-work", name: "Work", color: "#0ea5e9" },
        { id: "loc-out", name: "Outside", color: "#f97316" },
        { id: "loc-transit", name: "Transit", color: "#a855f7" },
        // Carries no tags of its own: the zoo trip below is tagged on the block,
        // which is what the cross-scope tag screenshots are there to show.
        { id: "loc-zoo", name: "San Diego Zoo", color: "#f59e0b" },
        // The "Also happening" example: an afternoon somewhere that usually,
        // but not always, means being social.
        { id: "loc-ians", name: "Ian's House", color: "#14b8a6" },
      ],
    },
    {
      id: "mood",
      name: "Mood",
      pens: [
        { id: "mood-great", name: "Great", color: "#22c55e" },
        { id: "mood-good", name: "Good", color: "#84cc16" },
        { id: "mood-meh", name: "Meh", color: "#eab308" },
        { id: "mood-low", name: "Low", color: "#ef4444" },
      ],
    },
  ]

  // [penId, startMin, endMin, variantIds, title]
  const shape = [
    ["act-sleep", 0, 420, [], ""],
    ["act-rest", 420, 480, [], "Coffee and reading"],
    ["act-work", 510, 660, ["var-deep"], "Ship the tracking rewrite"],
    ["act-work", 660, 720, ["var-meetings"], "Standup + design review"],
    ["act-rest", 720, 765, [], "Lunch"],
    ["act-work", 765, 930, ["var-deep"], "Ship the tracking rewrite"],
    ["act-exercise", 945, 1005, ["var-run"], "Riverside loop"],
    ["act-chores", 1005, 1035, [], "Dishes"],
    ["act-social", 1050, 1170, "social", "Dinner"],
    ["act-rest", 1170, 1290, [], ""],
  ]

  const entries = []
  for (let day = 0; day < 14; day++) {
    const date = dateKey(day)
    // Who you were with rotates, so the drill-down shows a real split rather
    // than one 100% slice — and overlapping days show why "Reach" exists.
    const company = [
      [["var-elijah"], "Dinner with Elijah"],
      [["var-rebecca"], "Dinner with Rebecca"],
      [["var-elijah", "var-rebecca"], "Dinner with Elijah and Rebecca"],
      [["var-elijah"], "Dinner with Elijah"],
    ][day % 4]

    shape.forEach(([penId, startMin, endMin, rawVariants, rawTitle], i) => {
      const variantIds = rawVariants === "social" ? company[0] : rawVariants
      const title = rawVariants === "social" ? company[1] : rawTitle
      // Weekends drop the work blocks so the charts are not 14 identical days.
      const weekend = new Date(`${date}T12:00:00`).getDay() % 6 === 0
      if (weekend && penId === "act-work") return
      // Today is only tracked up to now, like a day in progress.
      if (day === 0 && startMin > new Date().getHours() * 60 + new Date().getMinutes()) return
      entries.push({
        id: `seed-${date}-${i}`,
        date,
        scopeId: "activity",
        penId,
        startMin,
        endMin,
        ...(variantIds.length ? { variantIds } : {}),
        ...(title ? { title } : {}),
      })
    })
  }

  // Location scope, including the zoo trip that also counted as exercise. The
  // Exercise tag sits on the block, not on the pen, so Analytics → By tag shows
  // Location minutes feeding a tag no Location pen carries.
  const zooDay = dateKey(3)
  entries.push(
    { id: `seed-zoo-${zooDay}`, date: zooDay, scopeId: "location", penId: "loc-zoo", startMin: 600, endMin: 840, tagIds: ["tag-exercise"], title: "First trip on the new pass" },
    { id: `seed-loc-${zooDay}-a`, date: zooDay, scopeId: "location", penId: "loc-home", startMin: 0, endMin: 540 },
    { id: `seed-loc-${zooDay}-b`, date: zooDay, scopeId: "location", penId: "loc-transit", startMin: 540, endMin: 600 },
    { id: `seed-loc-${zooDay}-c`, date: zooDay, scopeId: "location", penId: "loc-home", startMin: 900, endMin: 1290 },
  )

  // An afternoon at Ian's, today and once before. The earlier one is the whole
  // point: "Also happening" suggests Social for this pen because the user has
  // actually painted the two over the same minutes, not because the app thinks
  // houses are sociable. Today's is left unattached so the screenshot shows the
  // offer rather than the result.
  let pastParty = 7
  while (pastParty < 14 && new Date(`${dateKey(pastParty)}T12:00:00`).getDay() % 6 !== 0) pastParty++
  if (pastParty < 14) {
    const partyDay = dateKey(pastParty)
    entries.push(
      { id: `seed-ians-${partyDay}`, date: partyDay, scopeId: "location", penId: "loc-ians", startMin: 780, endMin: 1020 },
      { id: `seed-ians-social-${partyDay}`, date: partyDay, scopeId: "activity", penId: "act-social", startMin: 780, endMin: 945, variantIds: ["var-elijah"], title: "BBQ at Ian's" },
    )
  }
  entries.push({
    id: `seed-ians-${dateKey(0)}`,
    date: dateKey(0),
    scopeId: "location",
    penId: "loc-ians",
    startMin: 780,
    endMin: 1020,
  })

  // One night that was painted but never typed. `seedSleep` leaves day 9 out of
  // the log on purpose; with an evening block to pair against the usual morning
  // one, `lib/sleep-inference.ts` reconstructs it and the Sleep tab marks it as
  // read off the grid rather than stated.
  entries.push({
    id: `seed-sleep-evening-${dateKey(10)}`,
    date: dateKey(10),
    scopeId: "activity",
    penId: "act-sleep",
    startMin: 1335,
    endMin: 1440,
  })

  localStorage.setItem(
    "cogs-timegrid-store",
    JSON.stringify({
      state: { scopes, activeScopeId: "activity", selectedPenId: "act-work", selectedVariantIds: [], gridStep: 5, entries },
      version: 4,
    }),
  )
}

/**
 * Nightly sleep log. Bedtimes drift later across the fortnight and wake times
 * hold steady, so the Sleep tab has a real trend and a visible spread to show.
 */
function seedSleep() {
  const pad = (n) => String(n).padStart(2, "0")
  const dateKey = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  const nights = {}
  // Signed minutes from the morning's midnight: negative is the evening before.
  // Bedtimes creep later over the month and wake times hold, so the 30d range
  // has a real trend to report between its two halves.
  const bedtimes = [
    -45, -30, -15, 0, -60, -90, -30, -75, -60, -45, -20, 15, -35, -50, -55,
    -70, -85, -60, -95, -80, -75, -105, -90, -70, -110, -85, -95, -80, -100, -90,
  ]
  const wakes = [
    420, 405, 435, 450, 420, 400, 465, 420, 410, 430, 420, 455, 415, 425, 420,
    415, 430, 405, 440, 420, 410, 450, 425, 415, 435, 420, 405, 430, 445, 420,
  ]

  // Includes day 0 — last night — so the Tracking strip is filled in, not blank.
  for (let day = 0; day < 30; day++) {
    // Day 22 is left blank so the "n blank" line has something to report. Day 9
    // is left out of the log but painted on the grid (see `seedTracking`), so the
    // tab shows a night it reconstructed rather than one it was told about.
    if (day === 9 || day === 22) continue
    const date = dateKey(day)
    nights[date] = {
      date,
      sleptMin: bedtimes[day],
      wokeMin: wakes[day],
      // A mix, so the "% estimated" line and the faded bars both show up.
      sleptPrecision: day % 3 === 0 ? "estimated" : "definite",
      wokePrecision: "definite",
      updatedAt: new Date().toISOString(),
    }
  }

  localStorage.setItem(
    "cogs-sleep-store",
    JSON.stringify({ state: { nights, targetMinutes: 480 }, version: 1 }),
  )
}

/**
 * Throwaway vault for a headless Chrome context. Chrome persist does not
 * hydrate from /api/persist, and newContext() has no profile, so every store
 * the shots need is written here before boot. Keys match Zustand persist
 * (`{ state, version }` on the brain2-* name the store reads).
 */
function seedVault() {
  const pad = (n) => String(n).padStart(2, "0")
  const shift = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return d
  }
  const ymd = (offset) => {
    const d = shift(offset)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const noon = (offset) => {
    const d = shift(offset)
    d.setHours(12, 0, 0, 0)
    return d.toISOString()
  }
  const weekKey = () => {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return `${fmt(monday)}_${fmt(sunday)}`
  }
  const monthKey = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`
  const quarter = `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`
  const nowIso = new Date().toISOString()
  const today = ymd(0)
  const link = (id, relation, targetId) => ({ id, relation, targetId })

  const task = (partial) => ({
    stage: "clarified",
    estimatedDuration: 45,
    cognitiveLoad: 2,
    urgency: 3,
    importance: 3,
    dependencies: [],
    context: "@anywhere",
    entropy: 0.2,
    rewardValue: 20,
    completed: false,
    lists: [],
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    type: "task",
    createdAt: nowIso,
    ...partial,
  })

  const formulas = [
    {
      id: "kind-day",
      name: "Day",
      parentFormulaId: null,
      stages: ["packed", "walked"],
      finishSteps: ["journaled"],
    },
    {
      id: "kind-stop",
      name: "Stop",
      parentFormulaId: "kind-day",
      stages: ["picked"],
      finishSteps: [],
    },
  ]
  const instances = [
    {
      id: "inst-sat",
      formulaId: "kind-day",
      title: "Saturday headlands",
      parentInstanceId: null,
      ideas: [
        {
          id: "idea-tide",
          text: "Low tide is mid-morning — walk the north trail first.",
          createdAt: nowIso,
        },
      ],
    },
    {
      id: "inst-pt",
      formulaId: "kind-stop",
      title: "Point Reyes pull-off",
      parentInstanceId: "inst-sat",
      ideas: [],
    },
  ]

  const days = [0, 1, 2].map((offset) => {
    const cities = ["Mendocino, CA", "Mendocino, CA", "Point Reyes, CA"]
    return {
      date: ymd(offset),
      cityMode: "city",
      city: cities[offset],
      dayNote: offset === 0 ? "Leave before the bridge traffic." : offset === 1 ? "Headlands walk." : "Home before dark.",
      sleepName: offset === 2 ? "" : "Headlands Inn",
      sleepAddress: offset === 2 ? "" : "Mendocino, CA",
      schedule: [
        { id: `sch-${offset}-a`, kind: "plan", time: "09:00", text: offset === 0 ? "Drive Highway 1" : "Walk the north trail" },
        { id: `sch-${offset}-b`, kind: "note", text: "Stop if the light is good." },
      ],
    }
  })

  const tasks = [
    task({
      id: "item-headlands",
      description: "Photograph the headlands",
      title: "Photograph the headlands",
      taskDescription: "North trail at low tide. One roll of the black-and-white, then the bakery on Lansing.",
      lists: ["example"],
      scheduledDate: noon(1),
      scheduledTime: "09:30",
      deadline: noon(3),
      estimatedDuration: 90,
      actualDuration: 40,
      urgency: 4,
      importance: 4,
      dependencies: ["item-film"],
      why: "The weekend only works if the pictures exist before the light goes.",
      consequences: "The trip becomes a drive with nothing to show for the walk.",
      notes: "Bring the small tripod. The overlook faces west.",
      body: "<p>Stand on the north trail until the fog lifts. One frame of the inn roof, then the water.</p>",
      subtasks: [
        { id: "sub-tripod", description: "Pack the small tripod", completed: true, isMolecular: true },
        { id: "sub-frame", description: "One frame of the inn roof", completed: false, isMolecular: true, context: "West overlook, after the fog lifts." },
      ],
      timeLogs: [
        { id: "log-headlands", date: ymd(-1), durationMinutes: 40, notes: "Scouted the overlook", activityLabel: "Scout", taskId: "item-headlands" },
      ],
    }),
    task({
      id: "item-film",
      description: "Buy a roll of black-and-white film",
      lists: ["example"],
      stage: "list",
      urgency: 3,
      importance: 3,
    }),
    task({
      id: "item-wool",
      description: "Pack a wool layer",
      lists: ["example"],
      stage: "list",
    }),
    task({
      id: "item-bakery",
      description: "Note the bakery on Lansing",
      lists: ["example"],
      stage: "list",
    }),
    task({
      id: "item-library",
      description: "Return the library book before Friday",
      lists: ["example", "list-reading"],
      stage: "list",
      deadline: noon(4),
    }),
    task({
      id: "item-shore",
      description: "The Wilder Shore",
      type: "item",
      lists: ["list-reading"],
      stage: "list",
      notes: "Field guide for the headlands walk.",
    }),
    task({
      id: "todo-tide",
      description: "Order a tide chart",
      lists: ["list-errands"],
      stage: "list",
      urgency: 2,
      importance: 3,
    }),
    task({
      id: "todo-inn-call",
      description: "Call the inn about a late arrival",
      lists: ["list-desk"],
      scheduledDate: noon(0),
      scheduledTime: "11:00",
      estimatedDuration: 15,
      dependencies: ["todo-tide"],
      urgency: 3,
      importance: 3,
    }),
    task({
      id: "todo-pack",
      description: "Pack the coast bag",
      lists: ["example"],
      scheduledDate: noon(0),
      scheduledTime: "16:00",
      estimatedDuration: 30,
      urgency: 5,
      importance: 5,
      subtasks: [
        { id: "sub-wool", description: "Fold the wool layer into the top of the bag", completed: false, isMolecular: true },
      ],
    }),
    task({
      id: "todo-email",
      description: "Email the tide chart to the inn",
      scheduledDate: noon(0),
      scheduledTime: "15:00",
      estimatedDuration: 20,
      urgency: 3,
      importance: 4,
      scheduleable: true,
    }),
    task({
      id: "todo-route",
      description: "Print the Highway 1 route",
      scheduledWeek: weekKey(),
      estimatedDuration: 15,
      urgency: 2,
      importance: 3,
    }),
    task({
      id: "todo-letter",
      description: "Write the trip letter",
      scheduledMonth: monthKey,
      estimatedDuration: 40,
      urgency: 2,
      importance: 2,
    }),
    task({
      id: "op-coast",
      description: "Coast weekend",
      type: "operation",
      lists: ["list-desk"],
      importance: 5,
      urgency: 4,
      estimatedDuration: 480,
      attributes: {
        mission: "One quiet weekend on the Mendocino headlands before the quarter turns.",
        stage: "active",
        categories: ["trip"],
        homeNotes: "Inn is booked. Photograph the north trail at low tide and keep the drive under four hours.",
        targetDate: ymd(2),
        panels: ["home", "tasks", "phases", "parts", "timeline", "locations", "plan", "resources", "log", "queue"],
        taskListId: "op-list-op-coast",
        partFormulas: JSON.stringify(formulas),
        partInstances: JSON.stringify(instances),
        itineraryModuleId: "mod-coast-field",
        trackingTagIds: ["tag-rest"],
      },
      links: [
        link("lnk-phase-pack", "has-phase", "phase-pack"),
        link("lnk-phase-drive", "has-phase", "phase-drive"),
        link("lnk-todo-reserve", "has-part", "todo-reserve"),
        link("lnk-res-map", "has-resource", "res-map"),
      ],
      timeLogs: [
        { id: "log-coast", date: today, durationMinutes: 75, notes: "Mapped the north trail", activityLabel: "Planning", taskId: "op-coast" },
      ],
    }),
    task({
      id: "phase-pack",
      description: "Pack the car",
      links: [
        link("lnk-bags", "has-part", "step-bags"),
        link("lnk-step-film", "has-part", "step-film"),
      ],
    }),
    task({
      id: "step-bags",
      description: "Pack the wool layer and the tripod",
      lists: ["op-list-op-coast"],
      completed: true,
      completedDate: noon(-1),
      estimatedDuration: 20,
    }),
    task({
      id: "step-film",
      description: "Put the film in the glove box",
      lists: ["op-list-op-coast"],
      estimatedDuration: 5,
    }),
    task({
      id: "phase-drive",
      description: "Drive Highway 1",
      links: [link("lnk-leave", "has-part", "step-leave")],
    }),
    task({
      id: "step-leave",
      description: "Leave before the bridge traffic",
      lists: ["op-list-op-coast"],
      estimatedDuration: 15,
    }),
    task({
      id: "todo-reserve",
      description: "Reserve the Headlands Inn",
      lists: ["op-list-op-coast"],
      scheduledDate: noon(0),
      estimatedDuration: 20,
      timeLogs: [
        { id: "log-reserve", date: ymd(-2), durationMinutes: 25, notes: "Called and held Friday night", taskId: "todo-reserve" },
      ],
    }),
    task({
      id: "res-map",
      description: "AAA coast map, 2024 edition",
      type: "item",
      stage: "list",
      notes: "Glove box. The inn is marked in pencil.",
    }),
    task({
      id: "place-inn",
      description: "Headlands Inn",
      type: "item",
      lists: ["list-coast-places"],
      stage: "list",
      attributes: {
        address: "Mendocino, CA",
        lat: 39.3077,
        lng: -123.7995,
        placeKind: "Stay",
      },
    }),
    task({
      id: "doc-coast-plan",
      description: "Coast weekend plan",
      type: "note",
      stage: "list",
      body: "<h1>Coast weekend</h1><p>Drive Friday on Highway 1, walk the headlands Saturday at low tide, and be home Sunday before dark. The inn is booked. Keep the film in the glove box.</p><h2>Goals</h2><ul><li>One roll of the north trail</li><li>Dinner at the inn, not the highway</li></ul>",
      attributes: {
        docsFolder: "Trips",
        status: "draft",
        docsFontFamily: "Merriweather",
        docsUpdatedAt: nowIso,
      },
      tags: ["docs", "operation"],
    }),
    task({
      id: "doc-wiring",
      description: "Kiln wiring notes",
      type: "note",
      stage: "list",
      body: "<p>Photograph each connection before disconnecting the old board. Keep the iron oxide note in the studio folder, not here.</p>",
      attributes: {
        docsFolder: "Studio",
        status: "evergreen",
        docsUpdatedAt: nowIso,
      },
      tags: ["docs"],
    }),
    task({
      id: "op-class",
      description: "October class handout",
      type: "operation",
      importance: 3,
      urgency: 2,
      attributes: {
        mission: "A one-page handout for Thursday's intro class.",
        stage: "planning",
        categories: ["project"],
        homeNotes: "Three throws, one collapsed cylinder, a line about slowing the wheel.",
        panels: ["home", "tasks", "phases", "parts", "log", "queue"],
      },
    }),
  ]

  const lists = [
    {
      id: "example",
      name: "Example List",
      color: "#EF4444",
      description: "Weekend packing and the headlands pictures",
      createdAt: nowIso,
      order: 0,
      scheduleable: false,
      detailPanels: ["body"],
    },
    {
      id: "list-reading",
      name: "Reading",
      color: "#a855f7",
      description: "Books for the trip",
      createdAt: nowIso,
      order: 1,
      scheduleable: false,
    },
    {
      id: "list-errands",
      name: "Errands",
      color: "#eab308",
      description: "Out of the house",
      createdAt: nowIso,
      order: 2,
      scheduleable: true,
    },
    {
      id: "list-desk",
      name: "Desk",
      color: "#0ea5e9",
      description: "Calls and drafts",
      createdAt: nowIso,
      order: 3,
      scheduleable: true,
    },
    {
      id: "list-coast-places",
      name: "Places — Coast weekend",
      color: "#14b8a6",
      description: "Places plotted on the operation map",
      createdAt: nowIso,
      order: 4,
      scheduleable: false,
    },
    {
      id: "op-list-op-coast",
      name: "Coast weekend",
      color: "#0f766e",
      description: "To do for the coast weekend operation",
      createdAt: nowIso,
      order: 5,
      scheduleable: false,
    },
  ]

  const folders = [
    {
      id: "folder-home",
      name: "Home",
      createdAt: nowIso,
      listIds: ["example", "list-reading", "list-errands"],
      color: "#64748b",
    },
    {
      id: "folder-desk",
      name: "Desk",
      createdAt: nowIso,
      listIds: ["list-desk"],
      color: "#0ea5e9",
    },
    {
      id: "folder-operations",
      name: "Operations",
      createdAt: nowIso,
      listIds: ["op-list-op-coast"],
      color: "#0f766e",
      description: "One list per operation.",
    },
  ]

  const put = (key, version, state) => {
    localStorage.setItem(key, JSON.stringify({ state, version }))
  }

  put("brain2-task-storage", 17, {
    tasks,
    lists,
    folders,
    removedTaskIds: [],
    removedListIds: [],
    priorityFormula: { urgencyWeight: 1, importanceWeight: 1, effortWeight: 1, cognitiveLoadWeight: 1 },
    priorityWeights: { urgency: 1, importance: 1, cognitiveLoad: 1, entropy: 1 },
  })

  put("brain2-modules-store", 2, {
    modules: [
      { id: "mod-points", type: "analytics-stat", title: "Points this week", config: { stat: "points-week" } },
      { id: "mod-write", type: "writing-prompt", title: "Writing Assignment Generator", config: {} },
      { id: "mod-random", type: "random-task", title: "What should I do now?", config: {} },
      {
        id: "mod-coast-field",
        type: "workspace",
        kind: "workspace",
        title: "Coast weekend — Field plan",
        description: "Day-by-day itinerary and places for the coast weekend.",
        templateId: "itinerary",
        config: {
          operationId: "op-coast",
          planDocId: "doc-coast-plan",
          placesCategoryId: "list-coast-places",
          itineraryUiVersion: 3,
          tripItinerary: {
            startDate: ymd(0),
            endDate: ymd(2),
            showSleep: true,
            globalCity: "Mendocino, CA",
            days,
          },
          activityListNames: ["Must do", "Maybe"],
        },
        views: [
          { id: "view-coast-plan", title: "Plan", kind: "doc", config: { docId: "doc-coast-plan" } },
          { id: "view-coast-timeline", title: "Itinerary", kind: "itinerary-doc", config: {} },
          {
            id: "view-coast-map",
            title: "Locations",
            kind: "trip-map",
            config: { categoryId: "list-coast-places", placesCategoryId: "list-coast-places" },
          },
        ],
      },
    ],
  })

  put("brain2-goals-store", 3, {
    objectives: [
      {
        id: "obj-weekend",
        title: "Take one real weekend away each season",
        description: "Leave the desk. Come back with pictures.",
        createdAt: nowIso,
        priorities: [],
        reviews: [],
      },
    ],
    goals: [
      {
        id: "goal-headlands",
        title: "Walk the Mendocino headlands",
        type: "count",
        target: 1,
        current: 0,
        unit: "walk",
        periodKind: "quarter",
        objectiveIds: ["obj-weekend"],
        points: 20,
        completed: false,
        createdAt: nowIso,
      },
    ],
  })

  const weeklyData = {}
  for (let i = 0; i < 14; i++) {
    const date = ymd(-i)
    weeklyData[date] = {
      "task-4": { completed: i % 3 !== 0 },
      "task-5": { completed: i % 2 === 0 },
      "task-10": { completed: i % 4 !== 0 },
      "task-1": { value: i % 3 === 0 ? 40 : 70, goal: 60 },
      "task-2": { value: i % 2 === 0 ? 35 : 15, goal: 30 },
      "task-14": { text: i % 5 === 0 ? "Sketch the inn roof" : "" },
    }
  }
  put("brain2-habits-store", 25, {
    weeklyData,
    weeklyHabitData: {
      [weekKey()]: {
        "task-w-review": { completed: true },
        "task-w-deep": { value: 6, goal: 10 },
        "task-w-workout": { completed: true },
        "task-w-lesson": { text: "Leave before the bridge, not after." },
      },
    },
    monthlyHabitData: {
      [monthKey]: {
        "task-m-bills": { completed: true },
      },
    },
    contentRev: 0,
  })

  const planLog = (text) =>
    JSON.stringify({
      v: 1,
      entries: [{ id: `plan-${text.slice(0, 12)}`, createdAt: nowIso, text }],
    })
  localStorage.setItem(`dayPlan-${today}`, planLog("Pack before four. Call the inn if the drive runs long."))
  localStorage.setItem(`weekPlan-${weekKey()}`, planLog("Coast weekend sits on Friday through Sunday. Keep Thursday light."))
  localStorage.setItem(
    `quarterPlan-${quarter}`,
    planLog("One weekend away this quarter: Mendocino headlands, then back to the desk."),
  )
}

async function main() {
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({
    channel: process.env.PW_CHANNEL ?? "chrome",
    headless: true,
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  // This throwaway profile must never publish itself to the dev persist hub,
  // or a capture run can seed demo data into a real Electron profile.
  await context.route("**/api/persist", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      : route.continue(),
  )

  if (FRESH) {
    await context.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  }

  // The Next dev indicator is not part of the product. Hide it so a compile
  // badge from the dev server does not sit on every photograph. The document
  // may not exist yet when this init script runs.
  await context.addInitScript(() => {
    const install = () => {
      const root = document.head || document.documentElement
      if (!root || root.querySelector("[data-capture-hide-dev]")) return !!root
      const style = document.createElement("style")
      style.setAttribute("data-capture-hide-dev", "")
      style.textContent = "nextjs-portal{display:none!important}"
      root.appendChild(style)
      return true
    }
    if (!install()) {
      const id = setInterval(() => {
        if (install()) clearInterval(id)
      }, 30)
    }
  })

  // Seeded after the clear, or FRESH would wipe it.
  await context.addInitScript(seedTracking)
  await context.addInitScript(seedSleep)
  await context.addInitScript(seedVault)

  const page = await context.newPage()
  page.on("pageerror", (err) => console.warn("  pageerror:", err.message.split("\n")[0]))

  console.log("Loading", BASE)
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 120_000 })
  await wait(2500)

  // One section with a drifted selector must not abandon the rest of the run,
  // or the `.txt` sidecars (written at the end) never refresh either.
  const sections = [
    ["Home", captureHome],
    ["Lists", captureLists],
    ["Docs", captureDocs],
    ["Scheduler", captureScheduler],
    ["Operations", captureOperations],
    ["Modules", captureModules],
    ["Analytics", captureAnalytics],
    ["Dialogs", captureDialogs],
  ]
  const skipped = []
  const sectionPrefix = {
    Home: ["01-", "02-", "03-", "04-", "08-"],
    Lists: ["05-", "21-"],
    Docs: ["12-"],
    Scheduler: ["06-"],
    Operations: ["10-"],
    Modules: ["09-"],
    Analytics: ["07-"],
    Dialogs: ["20-"],
  }
  for (const [name, capture] of sections) {
    if (ONLY.length && !ONLY.some((file) => (sectionPrefix[name] ?? []).some((p) => file.startsWith(p)))) {
      continue
    }
    console.log(`\n${name}…`)
    try {
      await capture(page)
    } catch (error) {
      skipped.push(name)
      console.warn(`  ! ${name} incomplete:\n${error.message.split("\n").slice(0, 8).join("\n")}`)
      await page.keyboard.press("Escape").catch(() => {})
    }
  }

  await browser.close()

  console.log("\nDescriptions…")
  await writeDescriptions()

  try {
    const reel = writeReelIndex(OUT)
    console.log(`Reel index — ${reel.shotCount} shots, ${reel.frameCount} frames`)
  } catch (error) {
    console.warn(`  ! reel index skipped: ${error.message.split("\n")[0]}`)
  }

  console.log("\nDone —", OUT)
  if (skipped.length) {
    console.log(`Incomplete sections: ${skipped.join(", ")} — those PNGs are stale.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
