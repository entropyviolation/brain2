import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Subtask } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { StepTree } from "./StepTree"
import { resetStepFoldsForTests } from "./step-folds"
import { TodoBreakdown } from "@/components/Home/ToDo/TodoBreakdown"
import { SubtaskTree } from "@/components/ItemDetail/tabs/subtasks/SubtaskTree"
import { setTodoPrefs } from "@/components/Home/ToDo/todo-prefs"

const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })
const shape = (list: Subtask[]): unknown => list.map((x) => (x.subtasks?.length ? { [x.description]: shape(x.subtasks) } : x.description))

let latest: Subtask[] = []
function Harness({ initial, onBeforeMove, ...rest }: { initial: Subtask[]; onBeforeMove?: (l: string) => void; hideLocked?: boolean; nextOnly?: boolean }) {
  const [steps, setSteps] = useState(initial)
  latest = steps
  return <StepTree steps={steps} onChange={setSteps} onBeforeMove={onBeforeMove} {...rest} />
}
const rowOf = (name: string) => screen.getByRole("treeitem", { name })
const nameKey = (name: string) => within(rowOf(name)).getByRole("button", { name })

beforeEach(() => {
  resetAllStores()
  localStorage.clear()
  resetStepFoldsForTests()
})

describe("StepTree composer", () => {
  it("waits for a request, then Enter goes deeper, empty Enter steps out, Shift+Enter stays", async () => {
    const user = userEvent.setup()
    render(<Harness initial={[]} />)
    expect(screen.queryByRole("textbox")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Add the first step" }))
    await user.type(screen.getByLabelText("Add step"), "a{Enter}")
    await user.type(screen.getByLabelText("Add step under a"), "b{Enter}")
    await user.type(screen.getByLabelText("Add step under b"), "{Enter}")
    await user.type(screen.getByLabelText("Add step under a"), "c{Shift>}{Enter}{/Shift}")
    await user.type(screen.getByLabelText("Add step under a"), "{Enter}{Enter}")
    expect(shape(latest)).toEqual([{ a: ["b", "c"] }])
    expect(screen.queryByRole("textbox")).toBeNull()
    // Each open branch ends in one quiet + step; no blank lines.
    expect(screen.getAllByRole("button", { name: "+ step" })).toHaveLength(2)
  })

  it("makes one step per pasted line", () => {
    render(<Harness initial={[s("a")]} />)
    fireEvent.click(screen.getAllByRole("button", { name: "+ step" })[0])
    fireEvent.paste(screen.getByLabelText("Add step"), { clipboardData: { getData: () => "x\ny\n\nz" } })
    expect(shape(latest)).toEqual(["a", "x", "y", "z"])
  })
})

describe("StepTree selection and moves", () => {
  it("Shift-click selects a visible range, Cmd-click toggles", () => {
    render(<Harness initial={[s("a"), s("b"), s("c"), s("d")]} />)
    fireEvent.click(nameKey("a"))
    fireEvent.click(nameKey("c"), { shiftKey: true })
    expect(["a", "b", "c", "d"].map((n) => rowOf(n).getAttribute("aria-selected"))).toEqual(["true", "true", "true", "false"])
    fireEvent.click(nameKey("b"), { metaKey: true })
    expect(rowOf("b").getAttribute("aria-selected")).toBe("false")
  })

  it("drags a multi-selection onto a row to nest it, children along, one undo per move", () => {
    const before = vi.fn()
    render(<Harness initial={[s("a", { subtasks: [s("a1")] }), s("b"), s("c")]} onBeforeMove={before} />)
    fireEvent.click(nameKey("a"))
    fireEvent.click(nameKey("b"), { metaKey: true })
    const dot = rowOf("a").querySelector(".step-tree-dot")!
    fireEvent.dragStart(dot)
    fireEvent.dragOver(rowOf("c"))
    fireEvent.drop(rowOf("c"))
    expect(shape(latest)).toEqual([{ c: [{ a: ["a1"] }, "b"] }])
    expect(before).toHaveBeenCalledTimes(1)
  })

  it("refuses a step into its own branch", () => {
    render(<Harness initial={[s("a", { subtasks: [s("a1")] })]} />)
    fireEvent.dragStart(rowOf("a").querySelector(".step-tree-dot")!)
    fireEvent.dragOver(rowOf("a1"))
    fireEvent.drop(rowOf("a1"))
    expect(shape(latest)).toEqual([{ a: ["a1"] }])
    expect(screen.getByRole("status").textContent).toMatch(/cannot go inside itself/)
  })

  it("keys act only on a focused row: Alt+arrows reorder, Tab nests, Shift+Tab lifts", () => {
    const before = vi.fn()
    render(<Harness initial={[s("a"), s("b"), s("c")]} onBeforeMove={before} />)
    fireEvent.keyDown(rowOf("b"), { key: "ArrowUp", altKey: true })
    expect(shape(latest)).toEqual(["b", "a", "c"])
    fireEvent.keyDown(rowOf("c"), { key: "Tab" })
    expect(shape(latest)).toEqual(["b", { a: ["c"] }])
    fireEvent.keyDown(rowOf("c"), { key: "Tab", shiftKey: true })
    expect(shape(latest)).toEqual(["b", "a", "c"])
    fireEvent.keyDown(rowOf("b"), { key: "ArrowDown", altKey: true })
    expect(shape(latest)).toEqual(["a", "b", "c"])
    expect(before).toHaveBeenCalledTimes(4)
    // From a button inside a row, nothing moves.
    fireEvent.keyDown(nameKey("a"), { key: "Tab" })
    expect(shape(latest)).toEqual(["a", "b", "c"])
  })
})

describe("StepTree in the lid", () => {
  function Lid({ initial, onHostKey }: { initial: Subtask[]; onHostKey: (key: string) => void }) {
    const [steps, setSteps] = useState(initial)
    latest = steps
    return (
      <div onKeyDown={(e) => onHostKey(e.key)}>
        <TodoBreakdown
          steps={steps}
          onEstimateChange={() => {}}
          onStepsChange={setSteps}
          clock={{ onStart: () => {}, onStop: () => {} }}
        />
      </div>
    )
  }

  it("keeps ▶ on every open step, nested too, and none on done steps", () => {
    render(<Lid initial={[s("a", { subtasks: [s("a1"), s("a2", { completed: true })] }), s("b")]} onHostKey={() => {}} />)
    for (const n of ["a", "a1", "b"]) expect(within(rowOf(n)).getByRole("button", { name: `Working on ${n} now` })).toBeInTheDocument()
    expect(within(rowOf("a2")).queryByRole("button", { name: /Working on/ })).toBeNull()
  })

  it("Esc clears a step selection first; the next Esc reaches the lid. Ledger keys stay out of the tree", () => {
    const host = vi.fn()
    render(<Lid initial={[s("a"), s("b")]} onHostKey={host} />)
    fireEvent.click(nameKey("a"))
    fireEvent.keyDown(rowOf("a"), { key: "d" })
    expect(host).not.toHaveBeenCalled()
    fireEvent.keyDown(rowOf("a"), { key: "Escape" })
    expect(rowOf("a").getAttribute("aria-selected")).toBe("false")
    expect(host).not.toHaveBeenCalled()
    fireEvent.keyDown(rowOf("a"), { key: "Escape" })
    expect(host).toHaveBeenCalledWith("Escape")
  })

  it("Hide locked hides waiting steps, says so calmly, peeks, and brings them back when the prerequisite is ticked", () => {
    act(() => setTodoPrefs({ hideLocked: true }))
    render(<Lid initial={[s("a"), s("b", { dependsOn: ["a"] }), s("c")]} onHostKey={() => {}} />)
    expect(screen.queryByRole("treeitem", { name: "b" })).toBeNull()
    expect(screen.getByText(/Everything else is waiting, not forgotten\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "1 hidden" }))
    expect(rowOf("b")).toHaveClass("is-peek")
    fireEvent.click(screen.getByRole("button", { name: "1 hidden" }))
    fireEvent.click(within(rowOf("a")).getByRole("checkbox"))
    expect(rowOf("b")).toBeInTheDocument()
    expect(screen.queryByText(/waiting, not forgotten/)).toBeNull()
  })

  it("Show next only shows the branch's next step and opens in one click", () => {
    act(() => setTodoPrefs({ showNextOnly: true }))
    const kids = [s("x", { estimatedDuration: 30 }), s("y", { estimatedDuration: 5 }), s("z", { estimatedDuration: 10 })]
    render(<Lid initial={[s("p", { subtasks: kids })]} onHostKey={() => {}} />)
    expect(rowOf("y")).toBeInTheDocument()
    expect(screen.queryByRole("treeitem", { name: "x" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "+ 2 more" }))
    expect(rowOf("x")).toBeInTheDocument()
    expect(rowOf("z")).toBeInTheDocument()
  })
})

describe("both hosts", () => {
  it("draw the same outline (names and nesting) even though the detail tab is its own tree", () => {
    const steps = [s("a", { subtasks: [s("a1")] }), s("b")]
    const { unmount } = render(<TodoBreakdown steps={steps} onEstimateChange={() => {}} onStepsChange={() => {}} />)
    const lid = screen.getAllByRole("treeitem").map((r) => [Number(r.getAttribute("aria-level")) - 1, r.getAttribute("aria-label")])
    unmount()
    const { container } = render(<SubtaskTree steps={steps} onChange={() => {}} />)
    // SubtaskTree is its own outline (nested lists, not treeitems): read depth and name off each row.
    const detail = [...container.querySelectorAll("li.id-sub-item")].map((li) => [
      Number(li.getAttribute("data-depth")),
      (li.querySelector("input.id-sub-name") as HTMLInputElement).value,
    ])
    expect(detail).toEqual(lid)
    expect(lid).toEqual([[0, "a"], [1, "a1"], [0, "b"]])
  })
})
