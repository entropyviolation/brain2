import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { useHomeDaysUntilStore } from "@/lib/home-days-until-store"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { useVocabStore } from "@/lib/vocab-store"
import { HomeWidgetCatalog } from "@/components/Home/home-widget-catalog"

vi.mock("@/lib/city-search", async (original) => ({
  ...(await original<typeof import("@/lib/city-search")>()),
  searchCities: vi.fn(async () => [{ label: "Lima, Peru", name: "Lima", country: "Peru", lat: -12.05, lng: -77.04 }]),
}))

function renderGallery() {
  act(() => useDashboardStore.getState().ensureReady())
  return render(<HomeWidgetCatalog open onOpenChange={() => {}} />)
}

function pick(name: string) {
  return screen.getByRole("option", { name: new RegExp(`^${name}`) })
}

describe("Widget gallery", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("opens on how widgets work and lists every kind by group", () => {
    renderGallery()
    expect(screen.getByRole("heading", { name: "Widgets are little apps" })).toBeInTheDocument()
    const rail = screen.getByRole("listbox", { name: "All widgets" })
    expect(within(rail).getByRole("option", { name: /Language study/ })).toBeInTheDocument()
    expect(within(rail).getByRole("option", { name: /Countdown/ })).toBeInTheDocument()
  })

  it("explains a kind: what it does, how it works, settings, and copies", async () => {
    const user = userEvent.setup()
    renderGallery()
    await user.click(pick("Points"))
    expect(screen.getByRole("heading", { name: "What it does" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument()
    expect(screen.getByText("Period keys on the face")).toBeInTheDocument()
    expect(screen.getByText("As many as you like")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Installed copies" })).toBeInTheDocument()
  })

  it("installs another Points copy with its guide waiting", async () => {
    const user = userEvent.setup()
    renderGallery()
    await user.click(pick("Points"))
    const before = useDashboardStore.getState().copies.filter((copy) => copy.kind === "points").length
    await user.click(screen.getByTestId("widget-install"))
    await user.click(within(screen.getByTestId("widget-install-setup")).getByRole("button", { name: "Install" }))
    const points = useDashboardStore.getState().copies.filter((copy) => copy.kind === "points")
    expect(points).toHaveLength(before + 1)
    expect(points.at(-1)?.guideSeen).toBe(false)
    expect(screen.getByRole("status")).toHaveTextContent("on your Visual dashboard")
  })

  it("installs a Countdown with a name and a date, and Remove deletes its mark", async () => {
    const user = userEvent.setup()
    renderGallery()
    await user.click(pick("Countdown"))
    await user.click(screen.getByTestId("widget-install"))
    const setup = screen.getByTestId("widget-install-setup")
    await user.type(within(setup).getByLabelText("What it counts"), "Launch")
    await user.type(within(setup).getByLabelText("Date"), "2026-12-01")
    await user.click(within(setup).getByRole("switch"))
    await user.click(within(setup).getByRole("button", { name: "Install" }))
    const mark = useHomeDaysUntilStore.getState().items.find((item) => item.label === "Launch")
    expect(mark?.date).toBe("2026-12-01")
    const copy = useDashboardStore.getState().copies.find((entry) => entry.settings.markId === mark?.id)
    expect(copy?.hidden).toBe(false)
    expect(copy?.guideSeen).toBe(true)

    const row = screen.getByText("Countdown · Launch").closest("li")!
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Remove…" }))
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Remove" }))
    expect(useHomeDaysUntilStore.getState().items.some((item) => item.id === mark?.id)).toBe(false)
    expect(useDashboardStore.getState().copies.some((entry) => entry.id === copy?.id)).toBe(false)
  })

  it("installs Language study for a new language with its role and level", async () => {
    const user = userEvent.setup()
    renderGallery()
    await user.click(pick("Language study"))
    await user.click(screen.getByTestId("widget-install"))
    const setup = screen.getByTestId("widget-install-setup")
    await user.click(within(setup).getByLabelText(/German/))
    await user.click(within(setup).getByRole("button", { name: "B1" }))
    expect(within(setup).getByText(/Goethe B1/)).toBeInTheDocument()
    await user.click(within(setup).getByRole("button", { name: "Install" }))
    expect(useVocabStore.getState().languages).toContain("de")
    const copy = useDashboardStore.getState().copies.find((entry) => entry.kind === "vocab" && entry.key === "de")
    expect(copy?.hidden).toBe(false)
    expect(copy?.settings.role).toBe("studied")
    expect(copy?.settings.cefr).toBe("B1")
  })

  it("installs Weather for a searched place, saved as place, lat, and lng", async () => {
    const user = userEvent.setup()
    renderGallery()
    await user.click(pick("Weather"))
    await user.click(screen.getByTestId("widget-install"))
    const setup = screen.getByTestId("widget-install-setup")
    await user.click(within(setup).getByLabelText("A place of its own"))
    await user.type(within(setup).getByLabelText("City"), "Lima")
    await user.click(await within(setup).findByRole("option", { name: "Lima, Peru" }))
    await user.click(within(setup).getByRole("button", { name: "Install" }))
    const copy = useDashboardStore.getState().copies.find((entry) => entry.kind === "weather" && entry.key === "Lima, Peru")
    expect(copy?.settings).toMatchObject({ place: "Lima, Peru", lat: -12.05, lng: -77.04 })
    expect(copy?.hidden).toBe(false)
  })

  it("hides and shows a copy from its page, and opens its settings", async () => {
    const user = userEvent.setup()
    renderGallery()
    await user.click(pick("Moon"))
    const moon = () => useDashboardStore.getState().copies.find((copy) => copy.kind === "moon")!
    const row = document.querySelector(`[data-copy-id="${moon().id}"]`) as HTMLElement
    await user.click(within(row).getByRole("button", { name: "Hide" }))
    expect(moon().hidden).toBe(true)
    await user.click(within(row).getByRole("button", { name: "Show" }))
    expect(moon().hidden).toBe(false)
    await user.click(within(row).getByRole("button", { name: /Settings for/ }))
    await user.click(within(screen.getByTestId("widget-copy-settings")).getByLabelText("Percent lit"))
    expect(moon().settings.readout).toBe("light")
  })

  it("shows the guide again and resets to the old layout", async () => {
    const user = userEvent.setup()
    act(() => {
      useHomeWidgetsStore.setState({ order: ["moon", "points", "pet"], hidden: ["pet"] })
      useDashboardStore.getState().resetDashboard()
    })
    renderGallery()
    const moonId = useDashboardStore.getState().copies.find((copy) => copy.kind === "moon")!.id
    act(() => useDashboardStore.getState().markGuideSeen(moonId, true))
    await user.click(screen.getByRole("button", { name: "Show the guide again" }))
    expect(useDashboardStore.getState().copies.find((copy) => copy.id === moonId)?.guideSeen).toBe(false)

    act(() => useDashboardStore.getState().setStyle("dash"))
    await user.click(screen.getByRole("button", { name: "Reset to my old layout…" }))
    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(useDashboardStore.getState().style).toBe("milled")
  })
})
