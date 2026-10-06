/**
 * scripts/speed-timings.mjs — Production timings for the desk
 *
 * Dev-server chunk sizes are a hint only. Point this at a production build
 * (`npm run build && npx serve out`) and a realistic vault already in the
 * browser profile.
 *
 *   SPEED_BASE_URL=http://127.0.0.1:4173 node scripts/speed-timings.mjs
 *
 * Records: first paint, time until the saved tab is visible, a Home → Lists →
 * Analytics → Lists switch, and scripting time for one habit check is left to
 * the performance panel (a scripted click cannot see a private vault). Prints
 * JSON to stdout.
 */
import { chromium } from "playwright"

const base = process.env.SPEED_BASE_URL
if (!base) {
  console.log(
    JSON.stringify({
      ok: false,
      hint: "Set SPEED_BASE_URL to a production server (npm run build && npx serve out).",
    }),
  )
  process.exit(0)
}

const browser = await chromium.launch()
const page = await browser.newPage()
const started = Date.now()
await page.goto(base, { waitUntil: "domcontentloaded" })
const paint = await page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0]
  const paintEntry = performance.getEntriesByName("first-contentful-paint")[0]
  return {
    firstContentfulPaintMs: paintEntry ? Math.round(paintEntry.startTime) : null,
    domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
  }
})
await page.waitForFunction(() => document.documentElement.dataset.navReady === "1")
const savedTabMs = Date.now() - started
const tab = await page.evaluate(() => document.querySelector("[role=tab][data-state=active]")?.textContent ?? "")

async function switchTo(name) {
  const t0 = Date.now()
  await page.getByRole("tab", { name }).click()
  await page.waitForTimeout(50)
  return Date.now() - t0
}

const switches = {}
for (const name of ["Home", "Lists", "Analytics", "Lists"]) {
  switches[name + (switches[name] ? "-back" : "")] = await switchTo(name)
}

console.log(JSON.stringify({ ok: true, paint, savedTabMs, activeTab: tab.trim(), switches }, null, 2))
await browser.close()
