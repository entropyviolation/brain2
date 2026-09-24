import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/ItemDetail/ItemDetailPopup", () => ({
  TaskDetailPopup: ({ open, taskId }: { open: boolean; taskId: string | null }) =>
    open ? <div role="dialog" aria-label="Item detail">{taskId}</div> : null,
}))

import { resetLocalStorage } from "@/tests/test-utils"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { BabyAnimalNest } from "./baby-animal-nest"
import { requestBabyAnimalFriend, rollBabyAnimalFriend } from "@/lib/baby-animal-friend"
import type { Task } from "@/lib/types"

vi.mock("@/lib/baby-animal-friend", () => ({
  rollBabyAnimalFriend: vi.fn(async () => null),
  requestBabyAnimalFriend: vi.fn(async () => null),
  uploadFriendPicture: vi.fn(),
  ensureWeeklyFriend: vi.fn(async () => null),
}))

const sample = {
  id: "p-hedge",
  animalId: "hedgehog",
  displayName: "Little Baby Hedgehog",
  query: "cute baby hedgehog",
  sourceUrl: "https://cdn.example/h.jpg",
  via: "openverse" as const,
  uri: "https://cdn.example/h.jpg",
  foundAt: "2026-09-20T12:00:00.000Z",
}

function todo(id: string, description: string): Task {
  return {
    id,
    description,
    stage: "scheduled",
    createdAt: new Date("2026-09-21T12:00:00"),
    completed: false,
    lists: ["na"],
    urgency: 3,
    importance: 3,
    estimatedDuration: 30,
    cognitiveLoad: 2,
    dependencies: [],
    context: "@work",
    entropy: 0.5,
    rewardValue: 5,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
  }
}

describe("BabyAnimalNest", () => {
  beforeEach(() => {
    resetLocalStorage()
    useBabyAnimalsStore.getState().resetGallery()
    useBabyAnimalsStore.getState().addAndWear(sample)
    useHabitsStore.getState().setTasks([])
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().setFolders([
      { id: "naf", name: "Next Actions", createdAt: new Date("2026-09-21"), listIds: ["na"] },
    ])
    useTaskStore.getState().setTasks([todo("a", "Water the plants"), todo("b", "Walk around the block")])
    vi.mocked(rollBabyAnimalFriend).mockClear()
    vi.mocked(requestBabyAnimalFriend).mockClear()
    vi.spyOn(Math, "random").mockReturnValue(0.99)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the stored friend name and photograph", async () => {
    render(<BabyAnimalNest />)
    expect(await screen.findByText("Little Baby Hedgehog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Gallery" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ask Little Baby Hedgehog for a mission" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Name a baby animal" })).not.toBeInTheDocument()
    const img = document.querySelector(".baby-nest-screen img")
    expect(img?.getAttribute("src")).toBe("https://cdn.example/h.jpg")
    expect(document.querySelector(".baby-nest-scan")).toBeNull()
    expect(document.querySelector(".baby-friend-bubble")).toBeNull()
    expect(rollBabyAnimalFriend).not.toHaveBeenCalled()
  })

  function chatButton() {
    return screen.getByRole("button", { name: /Ask Little Baby Hedgehog/i })
  }

  it("opens this friend's details from the photograph", async () => {
    const user = userEvent.setup()
    render(<BabyAnimalNest />)
    await user.click(screen.getByRole("button", { name: "Open details for Little Baby Hedgehog" }))
    expect(await screen.findByRole("heading", { name: "Little Baby Hedgehog" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Journal" })).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("suggests an open Next Action in a chat bubble, then another from the chat button", async () => {
    const user = userEvent.setup()
    render(<BabyAnimalNest />)
    await user.click(chatButton())
    const first = screen.getByRole("status").textContent ?? ""
    expect(first).toMatch(/Water the plants|Walk around the block/)
    expect(rollBabyAnimalFriend).not.toHaveBeenCalled()
    await user.click(chatButton())
    const second = screen.getByRole("status").textContent ?? ""
    expect(second).toMatch(/Water the plants|Walk around the block/)
    expect(first === second ? /Water the plants|Walk around the block/.test(second) : first !== second).toBe(true)
    if (first.includes("Water the plants")) expect(second).toContain("Walk around the block")
    if (first.includes("Walk around the block")) expect(second).toContain("Water the plants")
  })

  it("opens mission details from the bubble and skips the mission from the chat button", async () => {
    const user = userEvent.setup()
    render(<BabyAnimalNest />)
    await user.click(chatButton())
    expect(useBabyAnimalsStore.getState().friendMissions[0]?.status).toBe("offered")
    await user.click(screen.getByRole("button", { name: "Show mission details" }))
    expect(await screen.findByRole("heading", { name: /Mission from Little Baby Hedgehog/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept mission" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Decline mission" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open item" })).not.toBeInTheDocument()
    const before = useBabyAnimalsStore.getState().friendMissions[0]?.taskId
    await user.keyboard("{Escape}")
    await user.click(chatButton())
    const missions = useBabyAnimalsStore.getState().friendMissions
    expect(missions.some((row) => row.taskId === before && row.status === "declined")).toBe(true)
    expect(missions[0]?.status).toBe("offered")
  })

  it("opens the item popup over the mission sheet", async () => {
    const user = userEvent.setup()
    render(<BabyAnimalNest />)
    await user.click(chatButton())
    await user.click(screen.getByRole("button", { name: "Show mission details" }))
    const title = useBabyAnimalsStore.getState().friendMissions[0]?.title ?? ""
    fireEvent.click(screen.getByRole("button", { name: `Open ${title}` }))
    expect(await screen.findByRole("dialog", { name: "Item detail" })).toHaveTextContent(
      useBabyAnimalsStore.getState().friendMissions[0]?.taskId ?? "",
    )
    expect(screen.getByRole("heading", { name: /Mission from Little Baby Hedgehog/i })).toBeInTheDocument()
  })

  it("accepts a mission until the end of the day and cheers when it is finished", async () => {
    const user = userEvent.setup()
    render(<BabyAnimalNest />)
    await user.click(chatButton())
    await user.click(screen.getByRole("button", { name: "Show mission details" }))
    await user.click(screen.getByRole("button", { name: "Accept mission" }))
    const mission = useBabyAnimalsStore.getState().friendMissions[0]
    expect(mission?.status).toBe("accepted")
    expect(mission?.deadline).toBeTruthy()
    expect(screen.getByText(/until the end of today/i)).toBeInTheDocument()
    const task = useTaskStore.getState().tasks.find((row) => row.id === mission?.taskId)
    expect(task).toBeTruthy()
    await act(async () => {
      useTaskStore.getState().updateTask({ ...task!, completed: true })
    })
    expect(await screen.findByRole("heading", { name: "You did it" })).toBeInTheDocument()
    expect(useBabyAnimalsStore.getState().friendMissions.find((row) => row.id === mission?.id)?.status).toBe("done")
  })

  it("logs a decline through smaller tasks, a first step, and a reason", async () => {
    const user = userEvent.setup()
    render(<BabyAnimalNest />)
    await user.click(chatButton())
    await user.click(screen.getByRole("button", { name: "Show mission details" }))
    await user.click(screen.getByRole("button", { name: "Decline mission" }))
    expect(screen.getByText(/smaller tasks/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "No, keep it whole" }))
    expect(screen.getByText("Just the first step, then?")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "No, not even that" }))
    await user.type(screen.getByLabelText(/Why are you declining/i), "Too big for today")
    await user.click(screen.getByRole("button", { name: "Decline" }))
    const mission = useBabyAnimalsStore.getState().friendMissions[0]
    expect(mission?.status).toBe("declined")
    expect(mission?.declineReason).toBe("Too big for today")
    expect(mission?.log.map((row) => row.note)).toEqual([
      "offered",
      "breakdown-no",
      "first-step-no",
      "declined",
    ])
  })

  it("closes the bubble with Escape or the close control", async () => {
    const user = userEvent.setup()
    render(<BabyAnimalNest />)
    await user.click(chatButton())
    expect(screen.getByRole("status")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    await user.click(chatButton())
    await user.click(screen.getByRole("button", { name: "Close chat" }))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("powers on the CRT bezel when the suggestion bubble opens", async () => {
    const user = userEvent.setup()
    render(<BabyAnimalNest />)
    expect(document.querySelector(".baby-nest-crt.is-powering")).toBeNull()
    await user.click(screen.getByRole("button", { name: /Ask Little Baby Hedgehog/i }))
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(document.querySelector(".baby-nest-crt.is-powering")).toBeTruthy()
  })

  it("skips CRT power-on when prefers-reduced-motion is reduce", async () => {
    const user = userEvent.setup()
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    render(<BabyAnimalNest />)
    await user.click(screen.getByRole("button", { name: /Ask Little Baby Hedgehog/i }))
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(document.querySelector(".baby-nest-crt.is-powering")).toBeNull()
  })

  it("opens the gallery to request a named animal", async () => {
    const user = userEvent.setup()
    render(<BabyAnimalNest />)
    await user.click(screen.getByRole("button", { name: "Gallery" }))
    expect(await screen.findByRole("heading", { name: "Baby animal friend" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Remove" }).length).toBeGreaterThan(1)
    await user.type(screen.getByRole("textbox", { name: "Name a baby animal" }), "Tiny Cute Striped Polecat")
    await user.click(screen.getByRole("button", { name: "Name" }))
    expect(requestBabyAnimalFriend).toHaveBeenCalledWith("Tiny Cute Striped Polecat")
  })

  it("says hi again when a previously seen friend is assigned again", async () => {
    render(<BabyAnimalNest />)
    expect(screen.queryByRole("status")).toBeNull()
    useBabyAnimalsStore.getState().addAndWear({
      id: "p-fox",
      animalId: "fox",
      displayName: "tiny baby fox kit",
      query: "fox",
      sourceUrl: "https://cdn.example/f.jpg",
      via: "openverse",
      uri: "https://cdn.example/f.jpg",
      foundAt: "2026-09-21T00:00:00.000Z",
    })
    useBabyAnimalsStore.getState().wearPhoto("p-hedge")
    expect(await screen.findByRole("status")).toHaveTextContent(/Hi again|remember me|Look who it is|Miss me/)
  })
})
