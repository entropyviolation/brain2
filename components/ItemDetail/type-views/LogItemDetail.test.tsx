import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { incrementCountForEntry, removeCountTickForEntry, duplicateLogEntry, reassignLogBookList } = vi.hoisted(() => ({
  incrementCountForEntry: vi.fn(() => true),
  removeCountTickForEntry: vi.fn(() => true),
  duplicateLogEntry: vi.fn((): string | null => null),
  reassignLogBookList: vi.fn(() => false),
}))

vi.mock("@/lib/count-statuses", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/count-statuses")>()
  return { ...actual, incrementCountForEntry, removeCountTickForEntry }
})

vi.mock("@/lib/tracking-log-ops", () => ({
  duplicateLogEntry,
  reassignLogBookList,
}))
import { EnhancedTaskDetail } from "@/components/ItemDetail/ItemDetailPage"
import { resetItemDetailSessionForTests } from "@/components/ItemDetail/draft/useItemDetailUnloadGuard"
import { PopupDetailsMain } from "@/components/ItemDetail/popup/PopupDetailsMain"
import { COMPUTER_PROJECT_TYPE_ID } from "@/lib/computer-project-types"
import { useCountStatusesStore } from "@/lib/count-statuses"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useKitchenStore } from "@/lib/kitchen-store"
import {
  LOG_COUNT_TYPE_ID,
  LOG_FOOD_TYPE_ID,
  LOG_SPEND_TYPE_ID,
  LOG_SUBTYPE_IDS,
} from "@/lib/log-item-types"
import { useTaskStore } from "@/lib/task-store"
import { TIMEBLOCK_TYPE_ID } from "@/lib/timeblock-types"
import { trackingItemId } from "@/lib/tracking-lists"
import { LOG_TYPE_ID, THOUGHT_PROCESS_TYPE_ID, TRACKING_ITEM_ATTR } from "@/lib/tracking-item-types"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { isLogItemDetailType, LogItemDetail } from "./LogItemDetail"
import { TimeblockItemDetail } from "./TimeblockItemDetail"

const DAY = "2026-10-27"

function task(partial: Partial<Task> & Pick<Task, "id" | "description">): Task {
  return {
    stage: "clarified",
    createdAt: new Date("2026-10-27"),
    completed: false,
    lists: [],
    ...partial,
  }
}

function paint(
  startMin: number,
  endMin: number,
  extras?: {
    kind?: "instant" | "interval"
    title?: string
    intakeClass?: "food"
    eventKind?: string
    spendAmount?: number
  },
) {
  useTimeTrackingStore.getState().paintMinutes(DAY, "activity", startMin, endMin, "act-work", undefined, undefined, undefined, extras)
  const title = extras?.title
  const entry = useTimeTrackingStore.getState().entries.find((row) => (title ? row.title === title : row.startMin === startMin))
  if (!entry) throw new Error("paint did not leave an entry")
  return entry
}

function logPair() {
  const coffee = paint(540, 540, { kind: "instant", title: "coffee", eventKind: "spend", spendAmount: 450 })
  const tea = paint(600, 600, { kind: "instant", title: "tea", eventKind: "spend", spendAmount: 200 })
  const parent = task({
    id: "spend-coffee",
    description: "coffee",
    type: LOG_SPEND_TYPE_ID,
    attributes: { [TRACKING_ITEM_ATTR.entryId]: coffee.id },
  })
  const other = task({
    id: "spend-tea",
    description: "tea",
    type: LOG_SPEND_TYPE_ID,
    attributes: { [TRACKING_ITEM_ATTR.entryId]: tea.id },
  })
  useTaskStore.setState({ tasks: [parent, other], lists: [], folders: [] })
  return { coffee, tea, parent, other }
}

function pageTask(partial: Partial<Task> & Pick<Task, "id" | "description" | "type">) {
  useTaskStore.getState().addTask({
    stage: "list",
    createdAt: new Date("2026-10-27"),
    completed: false,
    lists: [],
    dependencies: [],
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...partial,
  })
}

function popup(activeTypeId: string, item: Task, isTask = false) {
  return render(
    <PopupDetailsMain
      task={item}
      lists={[]}
      commitReminder={vi.fn()}
      touchDraft={vi.fn()}
      setTask={vi.fn()}
      getDraft={() => item}
      handleNavigateToList={vi.fn()}
      activeTypeId={activeTypeId}
      openItem={vi.fn()}
      viewAsTypeId={undefined}
      detailView={{ panels: ["details"], capabilities: {} }}
      handleCreateAttribute={vi.fn()}
      bindTextList={vi.fn()}
      caps={{}}
      isTask={isTask}
    />,
  )
}

describe("LogItemDetail", () => {
  beforeEach(() => {
    resetAllStores()
    resetItemDetailSessionForTests()
    incrementCountForEntry.mockReset()
    incrementCountForEntry.mockReturnValue(true)
    removeCountTickForEntry.mockReset()
    removeCountTickForEntry.mockReturnValue(true)
    duplicateLogEntry.mockReset()
    duplicateLogEntry.mockReturnValue(null)
    reassignLogBookList.mockReset()
    reassignLogBookList.mockReturnValue(false)
    useItemTypeStore.getState().resetTypes()
    useKitchenStore.setState({
      foods: [],
      recipes: [],
      orders: [],
      stock: [],
      plates: [],
      plan: [],
      grocery: [],
      pinnedIds: [],
    })
  })

  it("treats log, thought process, and each log subtype as the log desk", () => {
    expect(isLogItemDetailType(LOG_TYPE_ID)).toBe(true)
    expect(isLogItemDetailType(THOUGHT_PROCESS_TYPE_ID)).toBe(true)
    for (const id of LOG_SUBTYPE_IDS) expect(isLogItemDetailType(id)).toBe(true)
    expect(isLogItemDetailType(TIMEBLOCK_TYPE_ID)).toBe(false)
    expect(isLogItemDetailType("task")).toBe(false)
    expect(isLogItemDetailType(COMPUTER_PROJECT_TYPE_ID)).toBe(false)
  })

  it("keeps the log on the item until Edit the clock, then Close dismisses the editor", async () => {
    const user = userEvent.setup()
    const entry = paint(540, 540, { kind: "instant", title: "coffee", eventKind: "spend", spendAmount: 450 })
    const item = task({
      id: "spend-1",
      description: "coffee",
      type: LOG_SPEND_TYPE_ID,
      attributes: { [TRACKING_ITEM_ATTR.entryId]: entry.id },
    })
    useTaskStore.setState({ tasks: [item], lists: [], folders: [] })
    render(<LogItemDetail task={item} typeId={LOG_SPEND_TYPE_ID} />)
    expect(screen.getByLabelText("Log")).toHaveTextContent("coffee")
    expect(screen.queryByRole("heading", { name: /coffee/ })).not.toBeInTheDocument()
    expect(useTaskStore.getState().tasks[0]?.attributes).toEqual(item.attributes)
    expect(useTimeTrackingStore.getState().entries.map((row) => row.id)).toEqual([entry.id])

    await user.click(screen.getByRole("button", { name: "Edit the clock" }))
    expect(screen.getByRole("heading", { name: /coffee/ })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("heading", { name: /coffee/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit the clock" })).toBeInTheDocument()
    expect(useTaskStore.getState().tasks[0]?.attributes).toEqual(item.attributes)
  })

  it("says the record is gone and does not recreate it", () => {
    const item = task({
      id: "gone",
      description: "left room",
      type: LOG_TYPE_ID,
      attributes: { [TRACKING_ITEM_ATTR.entryId]: "missing-entry" },
    })
    render(<LogItemDetail task={item} typeId={LOG_TYPE_ID} />)
    expect(screen.getByText("This record is no longer on the grid.")).toBeInTheDocument()
    expect(screen.queryByLabelText("Count toward")).not.toBeInTheDocument()
    expect(useTimeTrackingStore.getState().entries).toEqual([])
  })

  it("calls incrementCountForEntry for each add, including a second add", async () => {
    const user = userEvent.setup()
    const entry = paint(540, 540, { kind: "instant", title: "coffee", eventKind: "spend", spendAmount: 450 })
    useCountStatusesStore.setState({
      counts: [
        {
          id: "joints",
          name: "joints",
          ticks: [{ id: "t1", date: DAY, startMin: 600, sourceEntryId: entry.id }],
        },
      ],
    })
    render(
      <LogItemDetail
        task={task({
          id: "spend-count",
          description: "coffee",
          type: LOG_SPEND_TYPE_ID,
          attributes: { [TRACKING_ITEM_ATTR.entryId]: entry.id },
        })}
        typeId={LOG_SPEND_TYPE_ID}
      />,
    )
    expect(await screen.findByLabelText("Counts for this log")).toHaveTextContent("joints")
    await user.click(screen.getByRole("button", { name: "joints" }))
    await user.click(screen.getByRole("button", { name: "Add to count" }))
    await user.click(screen.getByRole("button", { name: "Add to count" }))
    expect(incrementCountForEntry).toHaveBeenCalledTimes(2)
    expect(incrementCountForEntry).toHaveBeenNthCalledWith(1, "joints", entry.id)
    expect(incrementCountForEntry).toHaveBeenNthCalledWith(2, "joints", entry.id)
    expect(useCountStatusesStore.getState().counts.find((row) => row.id === "joints")?.ticks).toHaveLength(1)
  })

  it("removes this log from a count through removeCountTickForEntry", async () => {
    const user = userEvent.setup()
    const entry = paint(540, 540, { kind: "instant", title: "coffee", eventKind: "spend", spendAmount: 450 })
    useCountStatusesStore.setState({
      counts: [
        {
          id: "joints",
          name: "joints",
          ticks: [{ id: "t1", date: DAY, startMin: 600, sourceEntryId: entry.id }],
        },
      ],
    })
    render(
      <LogItemDetail
        task={task({
          id: "spend-remove",
          description: "coffee",
          type: LOG_SPEND_TYPE_ID,
          attributes: { [TRACKING_ITEM_ATTR.entryId]: entry.id },
        })}
        typeId={LOG_SPEND_TYPE_ID}
      />,
    )
    await user.click(await screen.findByRole("button", { name: "Remove joints" }))
    expect(removeCountTickForEntry).toHaveBeenCalledTimes(1)
    expect(removeCountTickForEntry).toHaveBeenCalledWith("joints", entry.id)
  })

  it("opens the desk from a tracking-entry id when the attribute is empty", async () => {
    const entry = paint(540, 540, { kind: "instant", title: "coffee", eventKind: "spend", spendAmount: 450 })
    render(
      <LogItemDetail
        task={task({
          id: trackingItemId(entry.id),
          description: "coffee",
          type: LOG_SPEND_TYPE_ID,
        })}
        typeId={LOG_SPEND_TYPE_ID}
      />,
    )
    expect(screen.getByLabelText("Log")).toHaveTextContent("coffee")
    expect(await screen.findByLabelText("Count toward")).toBeInTheDocument()
  })

  it("copies another log and stores related on the new pointer", async () => {
    const user = userEvent.setup()
    const { tea, parent } = logPair()
    const before = useTimeTrackingStore.getState().entries.find((row) => row.id === tea.id)
    duplicateLogEntry.mockImplementation((entryId: string) => {
      const source = useTimeTrackingStore.getState().entries.find((row) => row.id === entryId)
      if (!source) return null
      const copyId = `${entryId}-copy`
      useTimeTrackingStore.setState({
        entries: [...useTimeTrackingStore.getState().entries, { ...source, id: copyId }],
      })
      return copyId
    })
    render(<LogItemDetail task={parent} typeId={LOG_SPEND_TYPE_ID} />)
    expect(await screen.findByRole("button", { name: "Copy" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: /tea/ }))
    await user.click(screen.getByRole("button", { name: "Attach" }))
    expect(duplicateLogEntry).toHaveBeenCalledTimes(1)
    expect(duplicateLogEntry).toHaveBeenCalledWith(tea.id)
    expect(reassignLogBookList).not.toHaveBeenCalled()
    const source = useTimeTrackingStore.getState().entries.find((row) => row.id === tea.id)
    expect(source?.date).toBe(before?.date)
    expect(source?.startMin).toBe(before?.startMin)
    const copy = useTaskStore.getState().tasks.find((row) => row.id === trackingItemId(`${tea.id}-copy`))
    expect(copy?.links).toEqual([expect.objectContaining({ relation: "related", targetId: parent.id })])
    expect(useTaskStore.getState().tasks.find((row) => row.id === "spend-tea")?.links ?? []).toEqual([])
    expect(screen.getByLabelText("Attached logs")).toHaveTextContent("tea")
    expect(screen.getByLabelText("Attached logs")).toHaveTextContent("10:00 AM")
  })

  it("moves another log by linking that pointer and leaves its clock", async () => {
    const user = userEvent.setup()
    const { coffee, tea, parent, other } = logPair()
    render(<LogItemDetail task={parent} typeId={LOG_SPEND_TYPE_ID} />)
    await user.click(await screen.findByRole("button", { name: "Move" }))
    await user.click(screen.getByRole("button", { name: /tea/ }))
    await user.click(screen.getByRole("button", { name: "Attach" }))
    expect(duplicateLogEntry).not.toHaveBeenCalled()
    expect(reassignLogBookList).not.toHaveBeenCalled()
    const linked = useTaskStore.getState().tasks.find((row) => row.id === other.id)
    expect(linked?.links).toEqual([expect.objectContaining({ relation: "related", targetId: parent.id })])
    const entry = useTimeTrackingStore.getState().entries.find((row) => row.id === tea.id)
    expect(entry?.date).toBe(DAY)
    expect(entry?.startMin).toBe(600)
    expect(useTimeTrackingStore.getState().entries.map((row) => row.id).sort()).toEqual([coffee.id, tea.id].sort())
    expect(screen.getByLabelText("Attached logs")).toHaveTextContent("tea")
    expect(screen.getByLabelText("Attached logs")).toHaveTextContent("10:00 AM")
  })

  it("reads a count and leaves the ticks on the shelf", () => {
    useCountStatusesStore.setState({
      counts: [
        {
          id: "joints",
          name: "joints",
          ticks: [{ id: "t1", date: DAY, startMin: 600 }],
        },
      ],
    })
    const item = task({
      id: "count-item-joints",
      description: "joints",
      type: LOG_COUNT_TYPE_ID,
      attributes: { [TRACKING_ITEM_ATTR.entryId]: "joints" },
    })
    render(<LogItemDetail task={item} typeId={LOG_COUNT_TYPE_ID} />)
    expect(screen.getByLabelText("Count")).toHaveTextContent("joints")
    expect(screen.getByLabelText("joints ticks")).toHaveTextContent("2026-10-27")
    expect(screen.getByText("Editing stays on the Tracking count shelf.")).toBeInTheDocument()
    expect(screen.queryByLabelText("Count toward")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Attach")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Increment/ })).not.toBeInTheDocument()
    expect(useCountStatusesStore.getState().counts.find((row) => row.id === "joints")?.ticks).toHaveLength(1)
  })

  it("says a missing count is no longer on the grid", () => {
    const before = useCountStatusesStore.getState().counts.map((row) => row.id)
    const item = task({
      id: "count-item-gone",
      description: "gone",
      type: LOG_COUNT_TYPE_ID,
      attributes: { [TRACKING_ITEM_ATTR.entryId]: "missing-count" },
    })
    render(<LogItemDetail task={item} typeId={LOG_COUNT_TYPE_ID} />)
    expect(screen.getByText("This record is no longer on the grid.")).toBeInTheDocument()
    expect(useCountStatusesStore.getState().counts.map((row) => row.id)).toEqual(before)
  })

  it("renders the food desk for a log-food item", async () => {
    const entry = paint(12 * 60, 12 * 60, {
      kind: "instant",
      title: "oatmeal",
      intakeClass: "food",
      eventKind: "intake.food",
    })
    const item = task({
      id: "food-1",
      description: "oatmeal",
      type: LOG_FOOD_TYPE_ID,
      attributes: { [TRACKING_ITEM_ATTR.entryId]: entry.id },
    })
    render(<LogItemDetail task={item} typeId={LOG_FOOD_TYPE_ID} />)
    expect(screen.queryByText("Meals, snacks, nutrients, and what is in the kitchen.")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Food" }))
    expect(screen.getByText("Meals, snacks, nutrients, and what is in the kitchen.")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("oatmeal")
    expect(screen.queryByRole("heading", { name: /oatmeal/ })).not.toBeInTheDocument()
  })

  it("renders the block editor for an interval and leaves an instant closed", async () => {
    const block = paint(540, 600, { title: "deep work" })
    render(
      <TimeblockItemDetail
        task={task({
          id: "block-1",
          description: "deep work",
          type: TIMEBLOCK_TYPE_ID,
          attributes: { [TRACKING_ITEM_ATTR.entryId]: block.id },
        })}
      />,
    )
    expect(screen.getByRole("heading", { name: /deep work|Work/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("heading", { name: /deep work|Work/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit the clock" })).toBeInTheDocument()

    const instant = paint(600, 600, { kind: "instant", title: "left room" })
    render(
      <TimeblockItemDetail
        task={task({
          id: "instant-1",
          description: "left room",
          type: TIMEBLOCK_TYPE_ID,
          attributes: { [TRACKING_ITEM_ATTR.entryId]: instant.id },
        })}
      />,
    )
    expect(screen.getByText("This is an instant on the grid.")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: /left room/ })).not.toBeInTheDocument()
  })

  it("says a missing block is no longer on the grid", () => {
    render(
      <TimeblockItemDetail
        task={task({
          id: "block-gone",
          description: "gone",
          type: TIMEBLOCK_TYPE_ID,
          attributes: { [TRACKING_ITEM_ATTR.entryId]: "missing-block" },
        })}
      />,
    )
    expect(screen.getByText("This block is no longer on the grid.")).toBeInTheDocument()
    expect(useTimeTrackingStore.getState().entries).toEqual([])
  })

  it("renders the food desk from the page and the popup", async () => {
    const entry = paint(12 * 60, 12 * 60, {
      kind: "instant",
      title: "oatmeal",
      intakeClass: "food",
      eventKind: "intake.food",
    })
    pageTask({
      id: "food-page",
      description: "oatmeal",
      type: LOG_FOOD_TYPE_ID,
      attributes: { [TRACKING_ITEM_ATTR.entryId]: entry.id },
    })
    const page = render(<EnhancedTaskDetail taskId="food-page" onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Food" }))
    expect(screen.getByText("Meals, snacks, nutrients, and what is in the kitchen.")).toBeInTheDocument()
    page.unmount()

    popup(
      LOG_FOOD_TYPE_ID,
      task({
        id: "food-popup",
        description: "oatmeal",
        type: LOG_FOOD_TYPE_ID,
        attributes: { [TRACKING_ITEM_ATTR.entryId]: entry.id },
      }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Food" }))
    expect(screen.getByText("Meals, snacks, nutrients, and what is in the kitchen.")).toBeInTheDocument()
  })

  it("renders the block editor from the page and the popup", () => {
    const entry = paint(540, 600)
    pageTask({
      id: "block-page",
      description: "Work block",
      type: TIMEBLOCK_TYPE_ID,
      attributes: { [TRACKING_ITEM_ATTR.entryId]: entry.id },
    })
    const page = render(<EnhancedTaskDetail taskId="block-page" onBack={vi.fn()} />)
    expect(screen.getByRole("heading", { name: /Work ·/ })).toBeInTheDocument()
    page.unmount()

    popup(
      TIMEBLOCK_TYPE_ID,
      task({
        id: "block-popup",
        description: "Work block",
        type: TIMEBLOCK_TYPE_ID,
        attributes: { [TRACKING_ITEM_ATTR.entryId]: entry.id },
      }),
    )
    expect(screen.getByRole("heading", { name: /Work ·/ })).toBeInTheDocument()
  })

  it("keeps a task and a computer project on their own desks", () => {
    pageTask({
      id: "task-1",
      description: "Write release notes",
      type: "task",
      estimatedDuration: 45,
    })
    const taskPage = render(<EnhancedTaskDetail taskId="task-1" onBack={vi.fn()} />)
    expect(screen.getByRole("heading", { name: "Write release notes" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Scheduling" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Food" })).not.toBeInTheDocument()
    expect(screen.queryByText("This block is no longer on the grid.")).not.toBeInTheDocument()
    taskPage.unmount()

    pageTask({
      id: "proj-1",
      description: "Brain2",
      type: COMPUTER_PROJECT_TYPE_ID,
    })
    const projectPage = render(<EnhancedTaskDetail taskId="proj-1" onBack={vi.fn()} />)
    expect(screen.getByLabelText("Computer project")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Food" })).not.toBeInTheDocument()
    projectPage.unmount()

    popup(
      "task",
      task({ id: "task-popup", description: "Write release notes", type: "task", estimatedDuration: 45 }),
      true,
    )
    expect(screen.getByText("Detailed Description")).toBeInTheDocument()
    expect(screen.queryByText("Meals, snacks, nutrients, and what is in the kitchen.")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Computer project")).not.toBeInTheDocument()
  })
})
