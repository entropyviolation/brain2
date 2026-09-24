import { test, expect, type Locator } from "@playwright/test"

/**
 * Playwright has no `getByDisplayValue`, and React-controlled inputs do not keep
 * the `value` *attribute* in sync, so an attribute selector would miss. Read the
 * live DOM property instead.
 */
async function expectSomeInputValue(scope: Locator, expected: string | RegExp) {
  await expect
    .poll(async () =>
      scope.locator("input, textarea").evaluateAll(
        (els, pattern) =>
          els.some((el) => {
            const value = (el as HTMLInputElement | HTMLTextAreaElement).value ?? ""
            return typeof pattern === "string"
              ? value === pattern
              : new RegExp(pattern.source, pattern.flags).test(value)
          }),
        expected as string | { source: string; flags: string },
      ),
    )
    .toBe(true)
}

test.describe("Item types own the detail view", () => {
  test("Manage Item Types shows catalog Book layout and implied-action rules", async ({ page }) => {
    await page.goto("/")
    await page.locator('button[aria-haspopup="dialog"]').filter({ hasText: /^Settings$/ }).click()
    const settings = page.getByRole("dialog", { name: /Settings/i })
    await expect(settings).toBeVisible()
    await settings.getByRole("button", { name: /Manage Item Types/i }).click()

    const typesDialog = page.getByRole("dialog", { name: /Item Types/i })
    await expect(typesDialog).toBeVisible()
    await page.getByText("Shopping item").first().waitFor()

    await typesDialog.getByRole("button", { name: /A reading-list entry/i }).click()
    const bookEditor = page.getByRole("dialog", { name: /Edit Book/i })
    await expect(bookEditor).toBeVisible()
    await expect(bookEditor.getByText("Detail panels")).toBeVisible()
    await expect(bookEditor.getByText("Hero image attribute")).toBeVisible()
    await expectSomeInputValue(bookEditor, /read \{delta\} pages of \{title\}/)
  })

  test("a Furniture wishlist item opens without Scheduling", async ({ page }) => {
    const listName = `Wishlist ${Date.now()}`
    await page.goto("/")
    await page.getByRole("tab", { name: "Lists" }).click()
    await page.getByRole("button", { name: "New List" }).click()
    await page.getByLabel("List Name").fill(listName)
    await page.getByRole("button", { name: "Create List" }).click()

    await page.getByText(listName, { exact: true }).dblclick()

    await page.getByRole("button", { name: "List Settings" }).click()
    const listDialog = page.getByRole("dialog")
    await expect(listDialog).toBeVisible()
    await listDialog.getByRole("combobox").first().click()
    await page.getByRole("option", { name: "Furniture" }).click()
    await listDialog.getByRole("button", { name: /Save Changes/i }).click()

    await page.getByRole("button", { name: /^Add Item$/i }).first().click()
    await page.getByLabel(/item description/i).fill("big area rug")
    await page.getByLabel(/item description/i).press("Enter")

    await page.getByText("big area rug", { exact: true }).click()
    const itemDialog = page.getByRole("dialog").last()
    await expectSomeInputValue(itemDialog, "big area rug")
    await expect(itemDialog.getByRole("tab", { name: /Details/i })).toBeVisible()
    await expect(itemDialog.getByRole("tab", { name: /Scheduling/i })).toHaveCount(0)
    await expect(itemDialog.getByText(/No photo yet/i)).toBeVisible()
    await expect(itemDialog.getByText("Show in Scheduler")).toHaveCount(0)
    await expect(itemDialog.getByText("Repeated Task Settings")).toHaveCount(0)
  })

  test("increasing Book pages read logs a Done row", async ({ page }) => {
    const listName = `Reading ${Date.now()}`
    await page.goto("/")
    await page.getByRole("tab", { name: "Lists" }).click()
    await page.getByRole("button", { name: "New List" }).click()
    await page.getByLabel("List Name").fill(listName)
    await page.getByRole("button", { name: "Create List" }).click()

    await page.getByText(listName, { exact: true }).dblclick()

    await page.getByRole("button", { name: "List Settings" }).click()
    const listDialog = page.getByRole("dialog")
    await expect(listDialog).toBeVisible()
    await listDialog.getByRole("combobox").first().click()
    await page.getByRole("option", { name: "Book", exact: true }).click()
    await listDialog.getByRole("button", { name: /Save Changes/i }).click()

    await page.getByRole("button", { name: /^Add Item$/i }).first().click()
    await page.getByLabel(/item description/i).fill("Dune")
    await page.getByLabel(/item description/i).press("Enter")

    await page.getByText("Dune", { exact: true }).click()
    const itemDialog = page.getByRole("dialog").last()
    await expect(itemDialog.getByText(/No cover yet/i)).toBeVisible()
    await expect(itemDialog.getByRole("tab", { name: /Scheduling/i })).toHaveCount(0)

    const pagesRead = itemDialog.locator("label", { hasText: /^Pages read$/i }).locator("..").locator("input")
    await pagesRead.fill("12")
    await pagesRead.blur()
    await itemDialog.getByRole("button", { name: /Save Changes/i }).click()

    await page.getByRole("tab", { name: "Home" }).click()
    await page.getByRole("tab", { name: "To Do" }).click()
    await expect(page.getByText(/read 12 pages of Dune/i)).toBeVisible()
  })
})
