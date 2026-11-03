import { fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Subtask, Task } from "@/lib/types"
import { TodoBreakdown } from "./TodoBreakdown"
import { TaskPrereqDialog } from "./ledger/TaskPrereqDialog"

function s(id: string, extra: Partial<Subtask> = {}): Subtask {
  return { id, description: id, completed: false, ...extra }
}

let latest: Subtask[] = []
function Harness({ initial }: { initial: Subtask[] }) {
  const [steps, setSteps] = useState(initial)
  latest = steps
  return <TodoBreakdown steps={steps} onEstimateChange={() => {}} onStepsChange={setSteps} />
}

const row = (name: string) => screen.getByRole("button", { name }).closest(".step-tree-row") as HTMLElement

describe("step link mode", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("Needs… picks prerequisites by clicking other steps, and the step then shows its lock", () => {
    render(<Harness initial={[s("get better wood"), s("confirm wood"), s("confirm hidden message")]} />)
    fireEvent.click(screen.getByRole("button", { name: "What confirm wood needs first" }))
    expect(screen.getByRole("status").textContent).toContain("confirm wood")
    fireEvent.click(within(row("get better wood")).getByRole("button", { name: "needed?" }))
    expect(latest.find((x) => x.id === "confirm wood")!.dependsOn).toEqual(["get better wood"])
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(within(row("confirm wood")).getByRole("button", { name: /needs get better wood/ })).toBeInTheDocument()
  })

  it("refuses a loop: the waited-on step cannot pick its dependant", () => {
    render(<Harness initial={[s("a"), s("b", { dependsOn: ["a"] })]} />)
    fireEvent.click(screen.getByRole("button", { name: "What a needs first" }))
    expect(within(row("b")).getByRole("button", { name: "needed?" })).toBeDisabled()
  })

  it("Esc ends link mode", () => {
    render(<Harness initial={[s("a"), s("b")]} />)
    fireEvent.click(screen.getByRole("button", { name: "What a needs first" }))
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("status")).toBeNull()
  })
})

function seedTasks(tasks: Partial<Task>[]) {
  useTaskStore.getState().setTasks(
    tasks.map((t) => ({ description: t.id!, stage: "scheduled", createdAt: new Date(), completed: false, lists: [], ...t }) as Task),
  )
}
const task = (id: string) => useTaskStore.getState().tasks.find((t) => t.id === id)!

describe("TaskPrereqDialog", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("links a task it needs, and refuses one that would loop", () => {
    seedTasks([{ id: "cds" }, { id: "wood" }, { id: "print", dependencies: ["cds"] }])
    render(<TaskPrereqDialog taskId="cds" onClose={() => {}} />)
    const search = screen.getByRole("combobox")
    fireEvent.change(search, { target: { value: "wood" } })
    fireEvent.click(screen.getByRole("option", { name: /wood/ }))
    expect(task("cds").dependencies).toEqual(["wood"])
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "print" } })
    fireEvent.click(screen.getByRole("option", { name: /print/ }))
    expect(screen.getByRole("alert").textContent).toContain("That would loop")
    expect(task("cds").dependencies).toEqual(["wood"])
  })
})
