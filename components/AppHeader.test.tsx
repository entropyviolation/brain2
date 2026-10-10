/**
 * AppHeader — pinned mill title bar (Nav + friend jewel + milled silver key-wells).
 * Clusters share one flex line. Free width widens Rituals, System, and
 * Capture up to a cap; the clusters stay packed. Narrower than the caps,
 * clusters wrap. A cluster wider than the shell scrolls inside its bay.
 * Keys do not flex-shrink. System icon keys are the gear, question mark, and
 * search glass. Capture is Inbox and Quick Add. Metrics is on Current moment.
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
import { resetScreenHistoryForTests } from "@/lib/screen-history-controller"
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
    resetScreenHistoryForTests()
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
    expect(screen.getByRole("group", { name: "Nav" })).toBeInTheDocument()
    expect(screen.getByTestId("header-nav-back")).toBeDisabled()
    expect(screen.getByTestId("header-nav-forward")).toBeDisabled()
    expect(screen.getByRole("group", { name: "Friend" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Rituals" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "System" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Capture" })).toBeInTheDocument()

    for (const name of [/^Rituals/, "Settings", "Names help mode", "Search", "Now", /^Inbox/, /^Quick Add/]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }

    for (const name of [/^Metrics/, /^Ingest/, /^Bulk Add/, /^From Notes/, /^Phone Notes/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
    }

    expect(screen.getByRole("button", { name: "Settings" })).toHaveClass("b2-shell-icon")
    expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute("title", "Settings")
    expect(screen.getByRole("button", { name: "Search" })).toHaveClass("b2-shell-icon")
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("title", "Search")

    expect(screen.getByRole("button", { name: /^Rituals/ })).toHaveAttribute(
      "title",
      expect.stringMatching(/ritual/i),
    )
    expect(screen.getByRole("button", { name: /^Inbox/ })).toHaveAttribute("title", "1 to revisit")
    expect(screen.getByRole("button", { name: /Quick Add/i })).toHaveClass("b2-shell-go")
    expect(screen.getByTestId("app-header")).toHaveAttribute("data-ui-name", "App header")
    expect(screen.getByTestId("app-header")).toHaveAttribute("data-ui-docs", "components/README.md")
    expect(screen.getByRole("group", { name: "Capture" })).toHaveAttribute("data-ui-name", "Capture")
    expect(screen.getByRole("group", { name: "Capture" })).toHaveAttribute("data-ui-docs", "components/README.md")
  })

  it("wraps clusters at label width instead of shrinking their keys", () => {
    render(<AppHeader onTaskSelect={() => {}} />)
    const header = screen.getByTestId("app-header")
    const body = header.querySelector(".b2-shell-body") as HTMLElement
    const rail = screen.getByRole("toolbar", { name: "Global actions" })
    const capture = screen.getByRole("group", { name: "Capture" })
    const keys = capture.querySelector(".b2-shell-keys") as HTMLElement
    const inbox = screen.getByRole("button", { name: /^Inbox/ })
    const quickAdd = screen.getByRole("button", { name: /Quick Add/i })

    expect(getComputedStyle(body).flexWrap).toBe("wrap")
    expect(getComputedStyle(body).justifyContent).toBe("flex-start")
    expect(getComputedStyle(rail).display).toBe("contents")
    expect(getComputedStyle(capture).flexShrink).toBe("0")
    expect(getComputedStyle(capture).maxWidth).toContain("25rem")
    expect(getComputedStyle(keys).flexWrap).toBe("nowrap")
    expect(getComputedStyle(keys).overflowX).toBe("auto")
    expect(getComputedStyle(keys).justifyContent).toBe("flex-start")
    expect(getComputedStyle(inbox).flexShrink).toBe("0")
    expect(getComputedStyle(inbox).minWidth).toContain("max-content")
    expect(getComputedStyle(inbox).whiteSpace).toBe("nowrap")
    expect(getComputedStyle(quickAdd).marginLeft).toBe("0px")
  })

  it("presses the question mark to set names mode and strikes the mark while on", async () => {
    const user = userEvent.setup()
    render(<AppHeader onTaskSelect={() => {}} />)
    const names = screen.getByRole("button", { name: "Names help mode" })
    expect(names).toHaveAttribute("aria-pressed", "false")
    expect(names).toHaveAttribute("title", "Names help mode")
    expect(names.querySelector(".b2-shell-glyph-strike")).toBeNull()

    await user.click(names)
    expect(names).toHaveAttribute("aria-pressed", "true")
    expect(names).toHaveAttribute("title", "Names help mode")
    expect(names.querySelector(".b2-shell-glyph-strike")).toBeTruthy()
    expect(useUiNamesStore.getState().mode).toBe("names")

    await user.click(names)
    expect(names).toHaveAttribute("aria-pressed", "false")
    expect(names.querySelector(".b2-shell-glyph-strike")).toBeNull()
    expect(useUiNamesStore.getState().mode).toBe("off")
  })

  it("opens search from the magnifying-glass key", async () => {
    const user = userEvent.setup()
    const onOpenSearch = vi.fn()
    render(<AppHeader onTaskSelect={() => {}} onOpenSearch={onOpenSearch} />)
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(onOpenSearch).toHaveBeenCalledOnce()
  })
})
