import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { SettingsDialog } from "../settings-dialog"
import {
  SETTINGS_PAGES,
  SETTINGS_PAGE_STORAGE_KEY,
  readStoredSettingsPage,
  stepSettingsPage,
  type SettingsPageId,
} from "./settings-pages"

const required = {
  open: true as const,
  onOpenChange: vi.fn(),
  tasks: [],
  weeklyData: {},
  onImportData: vi.fn(),
  onResetData: vi.fn(),
  accomplishmentThreshold: 80,
  accomplishmentBonus: 50,
  onAccomplishmentThresholdChange: vi.fn(),
  onAccomplishmentBonusChange: vi.fn(),
}

/** Every control the dialog had before the pages, by the page it lives on now. */
const SETTINGS_BY_PAGE: Record<SettingsPageId, ((panel: HTMLElement) => HTMLElement)[]> = {
  "good-day": [
    (p) => within(p).getByLabelText(/Completion to feel accomplished/i),
    (p) => within(p).getByLabelText(/Accomplishment bonus/i),
    (p) => within(p).getByLabelText("Morning ritual"),
  ],
  "beat-past": [
    (p) => within(p).getByLabelText("Higher than yesterday"),
    (p) => within(p).getByLabelText("Higher than last week"),
    (p) => within(p).getByLabelText("Above the prior 7 days"),
    (p) => within(p).getByLabelText("Above the prior 30 days"),
  ],
  "new-habits": [
    (p) => within(p).getByLabelText("Daily default points"),
    (p) => within(p).getByLabelText("Weekly default points"),
    (p) => within(p).getByLabelText("Monthly default points"),
    (p) => within(p).getByLabelText("Season default points"),
    (p) => within(p).getByLabelText("Default points for all periods"),
    (p) => within(p).getByRole("button", { name: "Apply" }),
  ],
  colors: [
    (p) => within(p).getByLabelText("Percent LED tint"),
    (p) => within(p).getByLabelText("All-time points"),
    (p) => within(p).getByLabelText("Today's points"),
    (p) => within(p).getByLabelText("This week points"),
    (p) => within(p).getByLabelText("This month points"),
    (p) => within(p).getByLabelText("Yes/No habit icon"),
    (p) => within(p).getByLabelText("Goal-based habit icon"),
    (p) => within(p).getByLabelText("Text habit icon"),
    (p) => within(p).getByLabelText("Incremental habit icon"),
    (p) => within(p).getByRole("button", { name: "Reset defaults" }),
  ],
  pictures: [
    (p) => within(p).getByRole("button", { name: /Change image/i }),
    (p) => within(p).getAllByRole("button", { name: "Change gem" })[0],
  ],
  backup: [
    (p) => within(p).getByRole("button", { name: /Export/i }),
    (p) => within(p).getByLabelText("Import"),
    (p) => within(p).getByRole("button", { name: /^Import$/i }),
    (p) => within(p).getByRole("button", { name: /Reset habits/i }),
  ],
}

function activePanel(): HTMLElement {
  const panels = screen.getAllByRole("tabpanel")
  const active = panels.filter((p) => p.getAttribute("data-state") === "active")
  expect(active).toHaveLength(1)
  return active[0]
}

describe("Habits settings pages", () => {
  beforeEach(() => {
    resetAllStores()
    window.localStorage.removeItem(SETTINGS_PAGE_STORAGE_KEY)
  })

  it("opens on the first page with its name and count", () => {
    render(<SettingsDialog {...required} />)
    expect(screen.getByTestId("settings-page-name")).toHaveTextContent("Good day")
    expect(screen.getByTestId("settings-page-count")).toHaveTextContent(`1 / ${SETTINGS_PAGES.length}`)
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
  })

  it("flips with the › and ‹ keys and holds at the ends", async () => {
    const user = userEvent.setup()
    render(<SettingsDialog {...required} />)
    const next = screen.getByRole("button", { name: "Next page" })
    await user.click(next)
    expect(screen.getByTestId("settings-page-name")).toHaveTextContent("Beat your past")
    expect(screen.getByTestId("settings-page-count")).toHaveTextContent(`2 / ${SETTINGS_PAGES.length}`)
    for (let i = 0; i < SETTINGS_PAGES.length; i++) {
      if (!(next as HTMLButtonElement).disabled) await user.click(next)
    }
    expect(screen.getByTestId("settings-page-name")).toHaveTextContent("Backup")
    expect(next).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Previous page" }))
    expect(screen.getByTestId("settings-page-name")).toHaveTextContent("Pictures")
  })

  it("flips with ← → outside text fields only", () => {
    render(<SettingsDialog {...required} />)
    const dialog = screen.getByRole("dialog")
    fireEvent.keyDown(dialog, { key: "ArrowRight" })
    expect(screen.getByTestId("settings-page-name")).toHaveTextContent("Beat your past")
    fireEvent.keyDown(dialog, { key: "ArrowLeft" })
    expect(screen.getByTestId("settings-page-name")).toHaveTextContent("Good day")
    fireEvent.keyDown(screen.getByLabelText(/Accomplishment bonus/i), { key: "ArrowRight" })
    expect(screen.getByTestId("settings-page-name")).toHaveTextContent("Good day")
  })

  it("opens a page from the strip and remembers it", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<SettingsDialog {...required} />)
    await user.click(screen.getByRole("tab", { name: "Colors" }))
    expect(screen.getByTestId("settings-page-count")).toHaveTextContent(`4 / ${SETTINGS_PAGES.length}`)
    expect(window.localStorage.getItem(SETTINGS_PAGE_STORAGE_KEY)).toBe("colors")
    unmount()
    render(<SettingsDialog {...required} />)
    expect(screen.getByTestId("settings-page-name")).toHaveTextContent("Colors")
  })

  it("puts every setting on exactly one page", async () => {
    const user = userEvent.setup()
    render(<SettingsDialog {...required} />)
    expect(Object.keys(SETTINGS_BY_PAGE)).toEqual(SETTINGS_PAGES.map((p) => p.id))
    const seen = new Set<HTMLElement>()
    for (const page of SETTINGS_PAGES) {
      await user.click(screen.getByRole("tab", { name: page.title }))
      const panel = activePanel()
      for (const find of SETTINGS_BY_PAGE[page.id]) {
        const control = find(panel)
        expect(seen.has(control)).toBe(false)
        seen.add(control)
        for (const other of screen.getAllByRole("tabpanel")) {
          if (other !== panel) expect(other.contains(control)).toBe(false)
        }
      }
    }
  })

  it("keeps a staged import across a flip", async () => {
    const user = userEvent.setup()
    render(<SettingsDialog {...required} />)
    await user.click(screen.getByRole("tab", { name: "Backup" }))
    await user.type(screen.getByLabelText("Import"), "abc")
    await user.click(screen.getByRole("tab", { name: "Good day" }))
    await user.click(screen.getByRole("tab", { name: "Backup" }))
    expect(screen.getByLabelText("Import")).toHaveValue("abc")
  })
})

describe("settings page helpers", () => {
  it("steps and clamps", () => {
    expect(stepSettingsPage("good-day", -1)).toBe("good-day")
    expect(stepSettingsPage("good-day", 1)).toBe("beat-past")
    expect(stepSettingsPage("backup", 1)).toBe("backup")
  })

  it("falls back to the first page on junk or blocked storage", () => {
    window.localStorage.setItem(SETTINGS_PAGE_STORAGE_KEY, "nope")
    expect(readStoredSettingsPage()).toBe("good-day")
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(readStoredSettingsPage()).toBe("good-day")
    spy.mockRestore()
  })
})
