import { test, expect } from "@playwright/test"

test.describe("Lists Module", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Lists" }).click()
  })

  test("shows file manager title", async ({ page }) => {
    await expect(page.getByText("Lists — File Manager")).toBeVisible()
    await expect(page.getByRole("button", { name: "New List" })).toBeVisible()
  })

  test("creates a new list", async ({ page }) => {
    await page.getByRole("button", { name: "New List" }).click()
    await page.getByLabel("List Name").fill("Test List")
    await page.getByRole("button", { name: "Create List" }).click()
    await page.getByRole("button", { name: "All" }).click()
    await expect(page.getByText("Test List")).toBeVisible()
  })

  test("filters by search", async ({ page }) => {
    await page.getByPlaceholder("Search folders, lists, items…").fill("Demo")
    await expect(page.getByText(/Search: Demo/)).toBeVisible()
  })
})
