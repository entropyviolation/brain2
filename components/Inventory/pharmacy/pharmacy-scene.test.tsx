/**
 * Pharmacy scene — add a bottle, take a dose, link a habit and an NFC tag.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useHabitsStore } from "@/lib/habits-store"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { usePharmacyStore } from "@/lib/pharmacy-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { PharmacyScene } from "./pharmacy-scene"
import { bottleSlot, pillsShown } from "./pharmacy-diorama"

vi.mock("./pharmacy-stage", () => ({
  PharmacyStage: () => <div role="img" aria-label="Pharmacy stage" />,
}))

describe("pharmacy diorama helpers", () => {
  it("fills the bottom shelf first and keeps one pill while any are left", () => {
    expect(bottleSlot(0).y).toBeLessThan(bottleSlot(5).y)
    expect(bottleSlot(0).x).toBeLessThan(bottleSlot(1).x)
    expect(pillsShown(0)).toBe(0)
    expect(pillsShown(0.01)).toBe(1)
    expect(pillsShown(1)).toBeGreaterThan(pillsShown(0.5))
  })
})

describe("PharmacyScene", () => {
  beforeEach(() => {
    resetAllStores()
    usePharmacyStore.setState({ items: [], ledger: {}, log: [] })
    useTimeTrackingStore.setState({ entries: [] })
    useIngestStore.setState({ nfcTags: [] })
    useHabitsStore.setState({
      tasks: [{ id: "h1", name: "Chlorophyll", type: TaskType.BOOLEAN, frequency: "daily" } as unknown as WeeklyTask],
      weeklyData: {},
    })
  })

  it("starts empty with a quiet line", () => {
    render(<PharmacyScene surface="desk" />)
    expect(screen.getByText("No bottles yet.")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Pharmacy stage" })).toBeInTheDocument()
  })

  it("adds a bottle, takes a dose from it, and logs an Intake line", async () => {
    const user = userEvent.setup()
    render(<PharmacyScene surface="desk" />)
    await user.type(screen.getByLabelText("Bottle name"), "Adderall")
    await user.clear(screen.getByLabelText("Full bottle"))
    await user.type(screen.getByLabelText("Full bottle"), "30")
    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(screen.getByTestId("pharmacy-added")).toHaveTextContent("Adderall is on the shelf.")
    expect(screen.getByTestId("pharmacy-count")).toHaveTextContent("30")

    await user.click(screen.getByRole("button", { name: "Take 1" }))
    expect(screen.getByTestId("pharmacy-count")).toHaveTextContent("29")
    expect(screen.getByTestId("pharmacy-status")).toHaveTextContent("1 dose taken")
    const intake = useTimeTrackingStore.getState().entries.filter((row) => row.intakeClass === "drug")
    expect(intake).toHaveLength(1)
    expect(intake[0].title).toContain("Adderall")
  })

  it("links a daily habit and makes an NFC tag bound to the bottle", async () => {
    const user = userEvent.setup()
    const item = usePharmacyStore.getState().addItem({ name: "Chlorophyll", capacity: 60, count: 60 })!
    render(<PharmacyScene surface="phone" />)
    await user.click(screen.getByRole("button", { name: /Chlorophyll/ }))
    const panel = screen.getByTestId("pharmacy-panel")
    await user.selectOptions(within(panel).getByLabelText("Linked habit"), "h1")
    expect(usePharmacyStore.getState().items[0]).toMatchObject({ habitId: "h1", habitPer: 1 })

    await user.click(within(panel).getByRole("button", { name: "Make an NFC tag" }))
    expect(useIngestStore.getState().nfcTags[0]).toMatchObject({ id: "chlorophyll", pharmacyId: item.id, intakeClass: "drug" })
  })
})
