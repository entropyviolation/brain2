import { describe, expect, it, beforeEach, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TagSettingsDialog } from "./tag-settings-dialog"
import { TagSettingsHost } from "./tag-settings-host"
import { openTagSettings, openTagSettingsFromName } from "./open-tag-settings"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { TaskType, type Task } from "@/lib/types"
import { OPERATION_TYPE_ID, OPERATION_ATTR } from "@/lib/operation-types"
import { resetAllStores } from "@/tests/test-utils"

beforeEach(() => {
  resetAllStores()
})

function catalogTag(name: string) {
  return useTimeTrackingStore.getState().tags.find((t) => t.name === name)!
}

describe("TagSettingsDialog", () => {
  it("renames and recolors a catalog tag on Save", () => {
    const tag = catalogTag("Work")
    render(<TagSettingsDialog mode="edit" tag={tag} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText("Tag name"), { target: { value: "Focus" } })
    fireEvent.change(screen.getByLabelText("Tag color"), { target: { value: "#112233" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    const next = useTimeTrackingStore.getState().tags.find((t) => t.id === tag.id)
    expect(next?.name).toBe("Focus")
    expect(next?.color).toBe("#112233")
  })

  it("lists pens, minute habits, done-count habits, and operations", () => {
    const tag = catalogTag("Work")
    useHabitsStore.setState({
      tasks: [
        {
          id: "h-min",
          name: "Deep stretch",
          type: TaskType.GOAL,
          goal: 30,
          frequency: "daily",
          trackingLink: { tagIds: [tag.id] },
        },
        {
          id: "h-count",
          name: "Tagged work",
          type: TaskType.GOAL,
          goal: 3,
          frequency: "daily",
          taggedTaskTag: "work",
        },
      ],
    })
    const op: Task = {
      id: "op_1",
      description: "Ship craft",
      type: OPERATION_TYPE_ID,
      stage: "clarified",
      createdAt: new Date("2026-01-01"),
      completed: false,
      lists: [],
      attributes: { [OPERATION_ATTR.trackingTagIds]: [tag.id] },
    }
    useTaskStore.getState().addTask(op)

    render(<TagSettingsDialog mode="edit" tag={tag} onClose={() => {}} />)

    expect(screen.getByText("Work (Activity)")).toBeInTheDocument()
    expect(screen.getByText("Deep stretch")).toBeInTheDocument()
    expect(screen.getByText("Tagged work")).toBeInTheDocument()
    expect(screen.getByText("Ship craft")).toBeInTheDocument()
  })

  it("deletes a tag after confirm", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const tag = catalogTag("Rest")
    const onDeleted = vi.fn()
    render(<TagSettingsDialog mode="edit" tag={tag} onClose={() => {}} onDeleted={onDeleted} />)

    fireEvent.click(screen.getByRole("button", { name: /Delete/ }))
    expect(useTimeTrackingStore.getState().tags.some((t) => t.id === tag.id)).toBe(false)
    expect(onDeleted).toHaveBeenCalled()
  })

  it("create-from-name adds a catalog tag then opens full settings", async () => {
    render(<TagSettingsHost />)
    openTagSettingsFromName("Item only")

    await waitFor(() => {
      expect(screen.getByText("Item tag only")).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: "Create Tracking tag" }))

    await waitFor(() => {
      expect(screen.getByLabelText("Tag name")).toHaveValue("Item only")
    })
    const created = useTimeTrackingStore.getState().tags.find((t) => t.name === "Item only")
    expect(created).toBeTruthy()
  })

  it("host opens edit settings from openTagSettings", async () => {
    render(<TagSettingsHost />)
    openTagSettings(catalogTag("Sleep").id)

    await waitFor(() => {
      expect(screen.getByLabelText("Tag name")).toHaveValue("Sleep")
    })
  })
})
