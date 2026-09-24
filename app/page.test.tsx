/**
 * app/page.tsx — pin bar stays mounted with item detail; desk stays warm for Lists.
 */
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { APP_NAV_KEYS, applyListsNavigation, writeStoredId, writeStoredTab } from "@/lib/app-navigation"
import { useTaskStore } from "@/lib/task-store"

const listsMounts = vi.fn()

vi.mock("@/components/ItemDetail/ItemDetailPage", () => ({
  EnhancedTaskDetail: ({ taskId, onBack }: { taskId: string; onBack: () => void }) => (
    <div data-testid="item-detail">
      {taskId}
      <button type="button" onClick={onBack}>
        back
      </button>
    </div>
  ),
}))

vi.mock("@/components/Home/home-dashboard", () => ({
  HomeDashboard: () => <div data-testid="home-desk">home</div>,
}))

vi.mock("@/components/Lists/enhanced-list-view", () => ({
  EnhancedCategoryView: ({ onTaskSelect }: { onTaskSelect: (id: string) => void }) => {
    // Count mounts only — re-renders from parent must not look like remounts.
    const { useEffect } = require("react") as typeof import("react")
    useEffect(() => {
      listsMounts()
    }, [])
    return (
      <div data-testid="lists-desk">
        <button type="button" onClick={() => onTaskSelect("item-1")}>
          open item
        </button>
      </div>
    )
  },
}))

vi.mock("@/lib/services/item-mutation-service", () => ({
  initWorkflowEngine: vi.fn(),
  createTaskRepositoryAdapter: vi.fn(() => ({})),
}))

vi.mock("@/lib/baby-animal-friend", () => ({
  rollBabyAnimalFriend: vi.fn(async () => null),
  requestBabyAnimalFriend: vi.fn(async () => null),
  uploadFriendPicture: vi.fn(),
  ensureWeeklyFriend: vi.fn(async () => null),
}))

vi.mock("@/components/Home/Tracking/time-grid", () => ({
  TimeGrid: () => <div data-testid="time-grid" />,
}))

import Home from "./page"

describe("app page shell", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    listsMounts.mockClear()
    vi.spyOn(useTaskStore.persist, "hasHydrated").mockReturnValue(false)
  })

  it("keeps the pinned header mounted when item detail is open", () => {
    writeStoredId(APP_NAV_KEYS.appItemId, "pin-item-1")
    render(<Home />)

    expect(screen.getByTestId("app-header")).toHaveAttribute("data-pin", "viewport")
    expect(screen.getByTestId("item-detail")).toHaveTextContent("pin-item-1")
    // Desk stays in the document (hidden) so Lists can remain warm.
    expect(screen.getByTestId("app-desk")).toHaveAttribute("aria-hidden", "true")
    expect(screen.queryByRole("tab", { name: "Home" })).not.toBeInTheDocument()
  })

  it("shows the pin bar with the tab strip when no item is open", async () => {
    render(<Home />)

    expect(screen.getByTestId("app-header")).toHaveClass("b2-shell")
    expect(screen.getByRole("tab", { name: "Home" })).toBeInTheDocument()
    expect(await screen.findByTestId("home-desk")).toBeInTheDocument()
  })

  it("navigates to a list from item detail without remounting Lists", async () => {
    const user = userEvent.setup()
    writeStoredTab(APP_NAV_KEYS.appTab, "categories")
    render(<Home />)

    expect(await screen.findByTestId("lists-desk")).toBeInTheDocument()
    expect(listsMounts).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "open item" }))
    expect(screen.getByTestId("item-detail")).toHaveTextContent("item-1")
    expect(screen.getByTestId("app-desk")).toHaveAttribute("aria-hidden", "true")
    // Lists stayed mounted under the hidden desk.
    expect(screen.getByTestId("lists-desk")).toBeInTheDocument()
    expect(listsMounts).toHaveBeenCalledTimes(1)

    act(() => {
      applyListsNavigation({
        location: "home",
        openTarget: { type: "category", id: "list-1" },
      })
    })

    expect(screen.queryByTestId("item-detail")).not.toBeInTheDocument()
    expect(screen.getByTestId("app-desk")).not.toHaveAttribute("aria-hidden", "true")
    expect(screen.getByTestId("lists-desk")).toBeInTheDocument()
    expect(listsMounts).toHaveBeenCalledTimes(1)
  })
})
