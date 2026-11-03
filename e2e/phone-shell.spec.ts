/**
 * e2e/phone-shell.spec.ts — The phone shell at 375×812 with touch, against `npm run dev`.
 *
 * Every `/api/**` call is answered here, so a run never reads or patches the
 * real vault on this Mac. Native flows (NFC, HealthKit, Always location, the
 * Local Network prompt) need a real iPhone; see `docs/MOBILE_TEST_PLAN.md`.
 */
import { test, expect, type Page, type Route } from "@playwright/test"

const VAULT = {
  "brain2-task-storage": JSON.stringify({
    state: { tasks: [{ id: "e2e-a", title: "Milk", description: "Milk", completed: false, lists: [] }], lists: [], folders: [], removedTaskIds: [], removedListIds: [] },
    version: 1,
  }),
}

type Hub = { canon: "ok" | "down" | 401; posts: unknown[]; canonCalls: number }

async function mockHub(page: Page, hub: Hub) {
  await page.route("**/api/**", async (route: Route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === "POST" && url.endsWith("/api/persist")) {
      hub.posts.push(req.postDataJSON())
      return route.fulfill({ json: { ok: true } })
    }
    if (url.includes("/api/persist")) {
      hub.canonCalls += 1
      if (hub.canon === "down") return route.abort("connectionrefused")
      if (hub.canon === 401) return route.fulfill({ status: 401, json: { error: "token" } })
      return route.fulfill({ json: { ok: true, items: VAULT } })
    }
    if (url.endsWith("/api/sync/status")) return route.fulfill({ json: { ok: true, hasData: true } })
    return route.fulfill({ status: 404, json: {} })
  })
}

async function signIn(page: Page) {
  await page.goto("/mobile/")
  await page.getByLabel("Username").fill("admin")
  await page.getByLabel("Password").fill("admin")
  await page.getByRole("button", { name: "Sign in" }).tap()
}

test.describe("phone shell", () => {
  test("signs in and the Mac key turns ✓", async ({ page }) => {
    const hub: Hub = { canon: "ok", posts: [], canonCalls: 0 }
    await mockHub(page, hub)
    await signIn(page)
    const mac = page.getByRole("button", { name: "Reload from the Mac" })
    await expect(mac).toHaveAttribute("data-status", "live")
    expect(hub.canonCalls).toBeGreaterThanOrEqual(1)
  })

  test("a quiet Mac names why and does not boot on seed rows", async ({ page }) => {
    const hub: Hub = { canon: "down", posts: [], canonCalls: 0 }
    await mockHub(page, hub)
    await signIn(page)
    await expect(page.getByRole("button", { name: "Reload from the Mac" })).toHaveAttribute("data-status", /offline|stale/)
    await expect(page.getByRole("banner").getByRole("status")).toHaveText(/Can.t reach the Mac|Saved copy/)
    expect(hub.posts).toEqual([])
  })

  test("a refused token says hub token", async ({ page }) => {
    await mockHub(page, { canon: 401, posts: [], canonCalls: 0 })
    await signIn(page)
    await expect(page.getByText(/401 \(hub token\)/).first()).toBeVisible()
  })

  test("the keycap deck types, latches shift once, and hides", async ({ page }) => {
    await page.goto("/mobile/")
    const user = page.getByLabel("Username")
    await user.tap()
    const deck = page.getByRole("group", { name: "Keyboard" })
    await expect(deck).toBeVisible()
    await deck.getByRole("button", { name: "shift", exact: true }).tap()
    await deck.getByRole("button", { name: "a", exact: true }).tap()
    await deck.getByRole("button", { name: "b", exact: true }).tap()
    await expect(user).toHaveValue(/Ab$/)
    await deck.getByRole("button", { name: "hide keyboard" }).tap()
    await expect(deck).toBeHidden()
  })

  test("zoom stays unlocked and nothing scrolls sideways", async ({ page }) => {
    await page.goto("/mobile/")
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content")
    expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1(\D|$)/)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test("inputs are at least 16px and sign-in keys at least 44px tall", async ({ page }) => {
    await page.goto("/mobile/")
    for (const label of ["Username", "Password"]) {
      const size = await page.getByLabel(label).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      expect(size).toBeGreaterThanOrEqual(16)
    }
    const box = await page.getByRole("button", { name: "Sign in" }).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })
})
