/**
 * app/page.tsx — pin bar stays mounted with item detail.
 */
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { APP_NAV_KEYS, writeStoredId } from "@/lib/app-navigation"
import { useTaskStore } from "@/lib/task-store"

vi.mock("@/components/ItemDetail/ItemDetailPage", () => ({
  EnhancedTaskDetail: ({ taskId }: { taskId: string }) => <div data-testid="item-detail">{taskId}</div>,
}))

vi.mock("@/components/Home/home-dashboard", () => ({
  HomeDashboard: () => <div data-testid="home-desk">home</div>,
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
    vi.spyOn(useTaskStore.persist, "hasHydrated").mockReturnValue(false)
  })

  it("keeps the pinned header mounted when item detail is open", () => {
    writeStoredId(APP_NAV_KEYS.appItemId, "pin-item-1")
    render(<Home />)

    expect(screen.getByTestId("app-header")).toHaveAttribute("data-pin", "viewport")
    expect(screen.getByTestId("item-detail")).toHaveTextContent("pin-item-1")
    expect(screen.queryByRole("tab", { name: "Home" })).not.toBeInTheDocument()
  })

  it("shows the pin bar with the tab strip when no item is open", async () => {
    render(<Home />)

    expect(screen.getByTestId("app-header")).toHaveClass("b2-shell")
    expect(screen.getByRole("tab", { name: "Home" })).toBeInTheDocument()
    expect(await screen.findByTestId("home-desk")).toBeInTheDocument()
  })
})
