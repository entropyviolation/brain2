import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { APP_NAV_KEYS, readStoredTab } from "@/lib/app-navigation"
import { AwardTile } from "./home-award-tile"

vi.mock("@/components/ItemDetail/ItemDetailPopup", () => ({
  TaskDetailPopup: ({ taskId, open }: { taskId: string | null; open: boolean }) =>
    open ? <div data-testid="stacked-item">{taskId}</div> : null,
}))

describe("AwardTile", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.setState({
      tasks: [{ id: "t1", title: "Write report", description: "Write report", lists: [], rewardValue: 3 } as never],
    })
    usePointsStore.getState().addPoints("t1", 3, "Write report", new Date("2026-10-14T12:00:00"))
  })

  it("opens a row's breakdown and the item from it", async () => {
    const user = userEvent.setup()
    render(<AwardTile onHide={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Open Latest award" }))
    await user.click(screen.getByRole("button", { name: /Completed Write report|Write report/ , expanded: false }))
    expect(screen.getByTestId("award-detail")).toHaveTextContent("Item completed")
    expect(screen.getByTestId("award-detail")).toHaveTextContent("Item reward")
    await user.click(screen.getByRole("button", { name: /Write report ›/ }))
    expect(await screen.findByTestId("stacked-item")).toHaveTextContent("t1")
    expect(screen.getByTestId("award-detail")).toBeInTheDocument()
  })

  it("closes the handheld from the corner key", async () => {
    const user = userEvent.setup()
    render(<AwardTile onHide={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Open Latest award" }))
    expect(screen.getByRole("dialog", { name: "Latest award" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog", { name: "Latest award" })).not.toBeInTheDocument()
  })

  it("jumps to the Data Points ledger", async () => {
    const user = userEvent.setup()
    render(<AwardTile onHide={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Open Latest award" }))
    await user.click(screen.getByTestId("home-award-ledger"))
    expect(readStoredTab(APP_NAV_KEYS.appTab, ["home", "analytics"], "home")).toBe("analytics")
    expect(readStoredTab(APP_NAV_KEYS.analyticsTab, ["habits", "points"], "habits")).toBe("points")
  })
})
