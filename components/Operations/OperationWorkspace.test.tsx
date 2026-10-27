import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { OPERATION_ATTR, OPERATION_TYPE_ID, resolveOperationPanels } from "@/lib/operation-types"
import { OPERATIONS_FOLDER_ID, operationTaskListId } from "@/lib/operation-lists"
import type { Task } from "@/lib/types"
import { OperationWorkspace } from "./OperationWorkspace"

// The field-plan panels pull in the whole Modules itinerary stack; the workspace
// contract under test is only whether their tabs appear.
vi.mock("./OperationFieldPlanPanels", () => ({
  OperationTimelinePanel: () => <p>Timeline panel</p>,
  OperationLocationsPanel: () => <p>Locations panel</p>,
  OperationPlanDocPanel: () => <p>Plan panel</p>,
}))

vi.mock("@/components/ItemDetail/ItemDetailPopup", () => ({
  TaskDetailPopup: ({
    taskId,
    open,
    onClose,
  }: {
    taskId: string | null
    open: boolean
    onClose: () => void
  }) =>
    open ? (
      <div role="dialog" aria-label="Item detail">
        <span>detail:{taskId}</span>
        <button type="button" onClick={onClose}>
          Close item detail
        </button>
      </div>
    ) : null,
}))

function seedOperation(attributes: Record<string, unknown> = {}): Task {
  const op: Task = {
    id: "op_1",
    description: "Foxtide rebuild",
    type: OPERATION_TYPE_ID,
    stage: "clarified",
    createdAt: new Date("2026-01-01"),
    completed: false,
    lists: [],
    attributes: { [OPERATION_ATTR.stage]: "active", ...attributes },
    links: [],
  }
  useTaskStore.getState().addTask(op)
  return op
}

describe("OperationWorkspace", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("shows only the panels the operation has switched on", () => {
    seedOperation()
    render(<OperationWorkspace operationId="op_1" />)

    for (const label of ["Home", "To do", "Phases", "Parts", "Log"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument()
    }
    // Trip-shaped panels are off unless asked for.
    expect(screen.queryByRole("tab", { name: "Locations" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Timeline" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Resources" })).not.toBeInTheDocument()
    // The Queue rail is a default panel, not a tab.
    expect(screen.getByText("To do next")).toBeInTheDocument()
  })

  it("renders a minimal operation as Home only", () => {
    seedOperation({ [OPERATION_ATTR.panels]: ["home"] })
    render(<OperationWorkspace operationId="op_1" />)

    expect(screen.getAllByRole("tab")).toHaveLength(1)
    expect(screen.getByRole("tab", { name: "Home" })).toBeInTheDocument()
    expect(screen.queryByText("To do next")).not.toBeInTheDocument()
  })

  it("shows the renamed Locations tab for operations that enable it", () => {
    seedOperation({ [OPERATION_ATTR.panels]: ["home", "locations", "timeline"] })
    render(<OperationWorkspace operationId="op_1" />)

    expect(screen.getByRole("tab", { name: "Locations" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Timeline" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Activities" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Itinerary" })).not.toBeInTheDocument()
  })

  it("migrates legacy activities/itinerary panel ids", () => {
    seedOperation({ [OPERATION_ATTR.panels]: ["home", "activities", "itinerary"] })
    render(<OperationWorkspace operationId="op_1" />)

    expect(screen.getByRole("tab", { name: "Locations" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Timeline" })).toBeInTheDocument()
  })

  it("adds and removes panels from the Settings dialog", async () => {
    const user = userEvent.setup()
    seedOperation()
    render(<OperationWorkspace operationId="op_1" />)

    await user.click(screen.getByRole("button", { name: "Settings" }))
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("checkbox", { name: /Locations/ }))
    await user.click(within(dialog).getByRole("checkbox", { name: /Phases/ }))
    await user.click(within(dialog).getByRole("button", { name: "Done" }))

    const panels = resolveOperationPanels(useTaskStore.getState().tasks.find((t) => t.id === "op_1"))
    expect(panels).toContain("locations")
    expect(panels).not.toContain("phases")
    expect(screen.getByRole("tab", { name: "Locations" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Phases" })).not.toBeInTheDocument()
  })

  it("files the operation under categories typed in Settings", async () => {
    const user = userEvent.setup()
    seedOperation()
    render(<OperationWorkspace operationId="op_1" />)

    await user.click(screen.getByRole("button", { name: "Settings" }))
    const dialog = screen.getByRole("dialog")
    await user.type(within(dialog).getByLabelText("New category"), "foxtide job")
    await user.click(within(dialog).getByRole("button", { name: "Add category" }))
    await user.type(within(dialog).getByLabelText("New category"), "paid")
    await user.click(within(dialog).getByRole("button", { name: "Add category" }))

    expect(
      useTaskStore.getState().tasks.find((t) => t.id === "op_1")?.attributes?.[OPERATION_ATTR.categories],
    ).toEqual(["foxtide job", "paid"])
  })

  it("reshapes the operation from a preset", async () => {
    const user = userEvent.setup()
    seedOperation()
    render(<OperationWorkspace operationId="op_1" />)

    await user.click(screen.getByRole("button", { name: "Settings" }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Trip/ }))

    const op = useTaskStore.getState().tasks.find((t) => t.id === "op_1")
    expect(resolveOperationPanels(op)).toContain("locations")
    expect(op?.attributes?.[OPERATION_ATTR.categories]).toEqual(["trip"])
  })

  it("backs the To do panel with a real list, and adds items to it", async () => {
    const user = userEvent.setup()
    seedOperation()
    render(<OperationWorkspace operationId="op_1" />)

    await user.click(screen.getByRole("tab", { name: "To do" }))

    const listId = operationTaskListId("op_1")
    const store = useTaskStore.getState()
    expect(store.lists.find((l) => l.id === listId)?.name).toBe("Foxtide rebuild")
    expect(store.folders.find((f) => f.id === OPERATIONS_FOLDER_ID)?.listIds).toContain(listId)
    expect(store.tasks.find((t) => t.id === "op_1")?.attributes?.[OPERATION_ATTR.taskListId]).toBe(listId)

    await user.click(screen.getByRole("button", { name: "Add task" }))
    await user.type(screen.getByLabelText("New task description"), "Order the parts")
    await user.click(screen.getByRole("button", { name: "Add task" }))

    const created = useTaskStore.getState().tasks.find((t) => t.description === "Order the parts")
    expect(created?.lists).toContain(listId)
    // Also a part of the operation, so it feeds progress and the Queue rail.
    const operation = useTaskStore.getState().tasks.find((t) => t.id === "op_1")
    expect(operation?.links?.some((l) => l.relation === "has-part" && l.targetId === created?.id)).toBe(true)
  })

  it("toggles Working on this now into Stop working on {name}", async () => {
    const user = userEvent.setup()
    seedOperation()
    render(<OperationWorkspace operationId="op_1" />)

    await user.click(screen.getByRole("button", { name: "Working on this now" }))
    expect(screen.getByRole("button", { name: "Stop working on Foxtide rebuild" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Stop working on Foxtide rebuild" }))
    expect(screen.getByRole("button", { name: "Working on this now" })).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.some((t) => t.description === "worked on Foxtide rebuild")).toBe(true)
  })

  it("tags the operation from Settings so Tracking/habits can share the label", async () => {
    const user = userEvent.setup()
    seedOperation()
    render(<OperationWorkspace operationId="op_1" />)

    await user.click(screen.getByRole("button", { name: "Settings" }))
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("checkbox", { name: /Work/ }))

    expect(
      useTaskStore.getState().tasks.find((t) => t.id === "op_1")?.attributes?.[OPERATION_ATTR.trackingTagIds],
    ).toEqual(["tag-work"])
  })

  it("asks before deleting the operation", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    seedOperation()
    render(<OperationWorkspace operationId="op_1" onBack={onBack} />)

    await user.click(screen.getByRole("button", { name: "Settings" }))
    await user.click(screen.getByRole("button", { name: "Delete operation" }))
    const confirm = screen.getByRole("dialog", { name: "Are you sure?" })
    expect(within(confirm).getByText(/Foxtide rebuild/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }))
    expect(useTaskStore.getState().tasks.some((t) => t.id === "op_1")).toBe(true)

    await user.click(screen.getByRole("button", { name: "Delete operation" }))
    await user.click(within(screen.getByRole("dialog", { name: "Are you sure?" })).getByRole("button", { name: "Delete" }))
    expect(useTaskStore.getState().tasks.some((t) => t.id === "op_1")).toBe(false)
    expect(onBack).toHaveBeenCalled()
  })

  it("opens settings from the title-row gear", async () => {
    const user = userEvent.setup()
    seedOperation()
    render(<OperationWorkspace operationId="op_1" onBack={() => undefined} />)

    const gear = screen.getByRole("button", { name: "Settings" })
    expect(gear.closest(".ops-fascia-row")).toBeTruthy()
    expect(gear.closest(".ops-menubar")).toBeNull()
    expect(gear).not.toHaveTextContent(/settings/i)
    const menubar = document.querySelector(".ops-menubar")
    expect(menubar?.textContent ?? "").not.toMatch(/settings/i)
    expect(menubar?.textContent ?? "").not.toMatch(/\bboard\b/i)

    await user.click(gear)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("adds a link and a use note on the operation's own resources", async () => {
    const user = userEvent.setup()
    seedOperation({ [OPERATION_ATTR.panels]: ["home", "resources"] })
    render(<OperationWorkspace operationId="op_1" />)

    await user.click(screen.getByRole("tab", { name: "Resources" }))
    const addLink = screen.getByRole("button", { name: "Add link" })
    expect(addLink.className).toContain("ops-keycap")
    expect(addLink.className).toContain("is-primary")
    expect(screen.getByRole("button", { name: "Add file" }).className).toContain("ops-keycap")
    expect(screen.getByRole("button", { name: "Reference file" }).className).toContain("ops-keycap")

    await user.type(screen.getByLabelText("Link address"), "https://example.com/spec")
    await user.click(addLink)

    const note = screen.getByLabelText("What example.com/spec is for here")
    await user.type(note, "the build spec")
    await user.tab()

    const stored = useTaskStore.getState().tasks.find((t) => t.id === "op_1")?.resources
    expect(stored).toHaveLength(1)
    expect(stored?.[0]).toMatchObject({ url: "https://example.com/spec", useNote: "the build spec", name: "example.com/spec" })
    expect(stored?.[0]?.uri).toMatch(/^url:/)
  })

  it("references a file in place instead of copying it", async () => {
    const user = userEvent.setup()
    const pick = vi.fn(async () => [
      { path: "/Users/me/Design/Brief.pdf", name: "Brief.pdf", isDir: false, size: 12, fileId: "1:2" },
    ])
    ;(window as unknown as { desktop?: unknown }).desktop = {
      fileLinks: {
        pathForFile: () => "",
        pick,
        stat: async () => null,
        resolve: async () => ({ status: "ok" }),
        open: async () => "",
        reveal: () => undefined,
        extractText: async () => "",
        previewUrl: async () => "",
      },
    }
    seedOperation({ [OPERATION_ATTR.panels]: ["resources"] })
    render(<OperationWorkspace operationId="op_1" />)

    await user.click(screen.getByRole("tab", { name: "Resources" }))
    await user.click(screen.getByRole("button", { name: "Reference file" }))

    expect(pick).toHaveBeenCalledWith({ folders: false })
    const stored = useTaskStore.getState().tasks.find((t) => t.id === "op_1")?.resources
    expect(stored?.[0]?.link?.path).toBe("/Users/me/Design/Brief.pdf")
    expect(stored?.[0]?.uri).toMatch(/^link:/)
    delete (window as unknown as { desktop?: unknown }).desktop
  })

  it("does not put Why missed on the menubar", () => {
    seedOperation()
    render(<OperationWorkspace operationId="op_1" />)
    expect(screen.queryByRole("button", { name: "Why missed" })).not.toBeInTheDocument()
  })

  it("opens a queue item in the detail popup and does not navigate", async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    seedOperation()
    useTaskStore.getState().addTask({
      id: "task_van",
      description: "Book the van",
      stage: "clarified",
      createdAt: new Date("2026-01-02"),
      completed: false,
      lists: [],
      links: [],
    })
    useTaskStore.setState({
      tasks: useTaskStore.getState().tasks.map((task) =>
        task.id === "op_1"
          ? { ...task, links: [{ id: "link-van", relation: "has-part", targetId: "task_van" }] }
          : task,
      ),
    })
    render(<OperationWorkspace operationId="op_1" onOpenItem={navigate} />)

    await user.click(screen.getByRole("button", { name: "Book the van" }))
    expect(screen.getByRole("dialog", { name: "Item detail" })).toBeInTheDocument()
    expect(screen.getByText("detail:task_van")).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole("tab", { name: "Home" })).toHaveAttribute("data-state", "active")

    await user.click(screen.getByRole("button", { name: "Close item detail" }))
    expect(screen.queryByRole("dialog", { name: "Item detail" })).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Home" })).toHaveAttribute("data-state", "active")

    await user.click(screen.getByRole("button", { name: "Open Book the van" }))
    expect(screen.getByText("detail:task_van")).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Close item detail" }))

    await user.click(screen.getByRole("tab", { name: "To do" }))
    await user.click(await screen.findByTitle("Book the van"))
    expect(screen.getByText("detail:task_van")).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Close item detail" }))
    expect(screen.getByRole("tab", { name: "To do" })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("heading", { name: "Foxtide rebuild" })).toBeInTheDocument()
  })

  it("restores the last workspace panel after remount", async () => {
    const user = userEvent.setup()
    seedOperation()
    const { unmount } = render(<OperationWorkspace operationId="op_1" />)
    await user.click(screen.getByRole("tab", { name: "Log" }))
    expect(screen.getByRole("tab", { name: "Log" })).toHaveAttribute("data-state", "active")
    unmount()
    render(<OperationWorkspace operationId="op_1" />)
    expect(screen.getByRole("tab", { name: "Log" })).toHaveAttribute("data-state", "active")
  })
})
