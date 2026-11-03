import { beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { buildContext } from "@/lib/tracking-helper/accept"
import { assemble } from "@/lib/tracking-helper/assemble"
import { SHIPPED_TESTS } from "@/lib/tracking-helper/tests"
import { useTrackingHelper } from "@/lib/tracking-helper/store"
import { tokenize } from "@/lib/tracking-helper/tokens"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { TrackingHelperDialog } from "./tracking-helper-dialog"

const friday = SHIPPED_TESTS[0]!

function seed() {
  const blocks = assemble(friday.wiring!, tokenize(friday.text).tokens, friday.text, buildContext(new Date(friday.now))).blocks
  useTrackingHelper.setState({
    busy: false,
    lines: [
      { id: "u", who: "you", text: friday.text, at: friday.now },
      { id: "h", who: "helper", text: "Timeblocks detected: 7", at: friday.now, route: "log", blocks, decided: {}, account: friday.text },
    ],
  })
}

describe("Tracking Helper dialog", () => {
  beforeEach(() => {
    resetAllStores()
    seed()
  })

  it("draws a card per block with certainty chips, and the legend", () => {
    render(<TrackingHelperDialog open onOpenChange={() => {}} />)
    expect(screen.getByText("Timeblocks detected: 7")).toBeTruthy()
    expect(document.querySelectorAll(".th-card")).toHaveLength(7)
    expect(document.querySelectorAll(".th-bar")).toHaveLength(7)
    expect(screen.getAllByText("from neighbour").length).toBeGreaterThan(0)
    expect(screen.getAllByText("not given")).toHaveLength(1)
    expect(screen.getAllByText("Ocean Beach").length).toBeGreaterThan(0)
  })

  it("editing an end time makes it certain and clears the not-given flag", () => {
    render(<TrackingHelperDialog open onOpenChange={() => {}} />)
    const card = [...document.querySelectorAll<HTMLElement>(".th-card")].find((c) => c.textContent?.includes("foxtide cd work"))!
    fireEvent.click(within(card).getByTitle("Edit end"))
    const input = within(card).getByLabelText("end")
    fireEvent.change(input, { target: { value: "9:15 pm" } })
    fireEvent.keyDown(input, { key: "Enter" })
    const b = useTrackingHelper.getState().lines[1]!.blocks!.find((x) => x.activity === "foxtide cd work")!
    expect(b.endMin).toBe(21 * 60 + 15)
    expect(b.endCert).toBe("exact")
    expect(b.openEnd).toBe(false)
  })

  it("Add writes one block, Dismiss drops another, Add all writes the rest", () => {
    render(<TrackingHelperDialog open onOpenChange={() => {}} />)
    const cards = () => [...document.querySelectorAll<HTMLElement>(".th-card")]
    fireEvent.click(within(cards()[0]!).getByRole("button", { name: "Add" }))
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "activity")).toHaveLength(1)
    fireEvent.click(within(cards()[1]!).getByRole("button", { name: "Dismiss" }))
    expect(useTrackingHelper.getState().lines[1]!.decided).toMatchObject({ [useTrackingHelper.getState().lines[1]!.blocks![0]!.id]: "added" })
    fireEvent.click(screen.getByRole("button", { name: /Add all 5/ }))
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "activity")).toHaveLength(6)
  })

  it("a question is answered with no blocks and the lab door is there", () => {
    useTrackingHelper.setState({ lines: [] })
    render(<TrackingHelperDialog open onOpenChange={() => {}} />)
    expect(screen.getByRole("link", { name: "Flow lab" }).getAttribute("href")).toBe("/lab/tracking-helper")
    expect(screen.getAllByRole("button", { name: /Friday I walked Ocean Beach/ })).toHaveLength(1)
  })
})
