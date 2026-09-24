/**
 * AppHeader — pinned mill title bar (friend jewel + milled silver key-wells).
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useTaskStore } from "@/lib/task-store"
import { rollBabyAnimalFriend } from "@/lib/baby-animal-friend"
import { useUiNamesStore } from "@/lib/ui-names-store"
import { AppHeader } from "./AppHeader"
import type { Task } from "@/lib/types"

vi.mock("@/lib/baby-animal-friend", () => ({
  rollBabyAnimalFriend: vi.fn(async () => null),
  requestBabyAnimalFriend: vi.fn(async () => null),
  uploadFriendPicture: vi.fn(),
  ensureWeeklyFriend: vi.fn(async () => null),
}))

vi.mock("@/components/Home/Tracking/time-grid", () => ({
  TimeGrid: () => <div data-testid="time-grid" />,
}))

const friend = {
  id: "p-hedge",
  animalId: "hedgehog",
  displayName: "Little Baby Hedgehog",
  query: "cute baby hedgehog",
  sourceUrl: "https://cdn.example/h.jpg",
  via: "openverse" as const,
  uri: "https://cdn.example/h.jpg",
  foundAt: "2026-09-20T12:00:00.000Z",
}

function inboxTask(): Task {
  return {
    id: "inbox-1",
    description: "Untitled idea",
    stage: "inbox",
    createdAt: new Date(),
    estimatedDuration: 1,
    cognitiveLoad: 1,
    urgency: 3,
    importance: 3,
    dependencies: [],
    context: "@inbox",
    entropy: 0.5,
    rewardValue: 5,
    completed: false,
    lists: [],
    allowPartialCompletion: false,
    minimumChunkSize: 15,
  }
}

describe("AppHeader", () => {
  beforeEach(() => {
    resetLocalStorage()
    useBabyAnimalsStore.getState().resetGallery()
    useBabyAnimalsStore.getState().addAndWear(friend)
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask())
    useUiNamesStore.setState({ mode: "off" })
    vi.mocked(rollBabyAnimalFriend).mockClear()
  })

  it("houses BRAIN2, today's friend, and grouped action keys in one cabinet", async () => {
    render(<AppHeader onTaskSelect={() => {}} />)

    const header = screen.getByTestId("app-header")
    expect(header).toHaveClass("b2-shell")
    expect(header).toHaveAttribute("data-pin", "viewport")
    expect(header.querySelector(".b2-shell-power")).toBeTruthy()
    expect(header.querySelector(".b2-shell-caption-mill")).toBeTruthy()
    expect(header.querySelector(".b2-shell-shelf")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "BRAIN2" })).toBeInTheDocument()
    expect(await screen.findByText("Little Baby Hedgehog")).toBeInTheDocument()
    expect(screen.getByRole("toolbar", { name: "Global actions" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Friend" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Review" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "System" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Capture" })).toBeInTheDocument()

    for (const name of [
      /Morning/,
      /^Review/,
      /^Settings/,
      /^Tracking/,
      /^Names/,
      /^Inbox/,
      /^Ingest/,
      /^Metrics/,
      /^Bulk Add/,
      /^From Notes/,
      /^Phone Notes/,
      /^Quick Add/,
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }

    expect(screen.getByRole("button", { name: /^Review/ })).toHaveAttribute(
      "title",
      expect.stringMatching(/end-of-period review/),
    )
    expect(screen.getByRole("button", { name: /^Inbox/ })).toHaveAttribute("title", "1 to revisit")
    expect(screen.getByRole("button", { name: /Quick Add/i })).toHaveClass("b2-shell-go")
    expect(screen.getByTestId("app-header")).toHaveAttribute("data-ui-name", "App header")
    expect(screen.getByTestId("app-header")).toHaveAttribute("data-ui-docs", "components/README.md")
    expect(screen.getByRole("group", { name: "Capture" })).toHaveAttribute("data-ui-name", "Capture")
    expect(screen.getByRole("group", { name: "Capture" })).toHaveAttribute("data-ui-docs", "components/README.md")
  })

  it("presses Names to set the overlay mode and html flag via the store", async () => {
    const user = userEvent.setup()
    render(<AppHeader onTaskSelect={() => {}} />)
    const names = screen.getByRole("button", { name: /^Names$/ })
    expect(names).toHaveAttribute("aria-pressed", "false")
    expect(names).toHaveTextContent("Names")
    expect(names).toHaveAttribute("title", "Show names of UI")

    await user.click(names)
    expect(names).toHaveAttribute("aria-pressed", "true")
    expect(names).toHaveTextContent("Names")
    expect(names).toHaveAttribute("title", "Stop naming")
    expect(screen.getByRole("button", { name: /^Names$/ })).toBe(names)
    expect(useUiNamesStore.getState().mode).toBe("names")

    await user.click(names)
    expect(names).toHaveAttribute("aria-pressed", "false")
    expect(names).toHaveTextContent("Names")
    expect(useUiNamesStore.getState().mode).toBe("off")
  })
})
