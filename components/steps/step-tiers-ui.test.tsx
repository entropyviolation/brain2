import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import type { StepTier, Subtask } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { StepTree } from "./StepTree"
import { LevelGauge } from "./LevelGauge"
import { buildStepView } from "./step-tree-view"
import { resetStepFoldsForTests } from "./step-folds"
import { TodoBreakdown } from "@/components/Home/ToDo/TodoBreakdown"
import { getTodoPrefs, resetTodoPrefsForTests, setTodoPrefs } from "@/components/Home/ToDo/todo-prefs"

const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })

let latest: Subtask[] = []
function Harness({ initial, tier }: { initial: Subtask[]; tier?: StepTier }) {
  const [steps, setSteps] = useState(initial)
  latest = steps
  return <StepTree steps={steps} onChange={setSteps} tier={tier} tierTags />
}

beforeEach(() => {
  resetAllStores()
  localStorage.clear()
  resetStepFoldsForTests()
  resetTodoPrefsForTests()
})

describe("Tier filter in the step view", () => {
  const tree = () => [s("goal", { subtasks: [s("bare", { tier: "min" }), s("other")] }), s("loose"), s("extra", { tier: "exceptional" })]

  it("keeps one level's view, greys containers, and counts what it hides", () => {
    const view = buildStepView(tree(), { tier: "min" })
    const steps = view.rows.flatMap((r) => (r.kind === "step" ? [`${r.step.id}${r.greyed ? "*" : ""}`] : []))
    expect(steps).toEqual(["goal*", "bare"])
    expect(view.hidden).toBe(3)
    expect(buildStepView(tree(), { tier: "min", peek: true }).hidden).toBe(0)
    expect(buildStepView(tree(), { tier: "exceptional" }).hidden).toBe(0)
  })

  it("adds nothing to the view without a tier", () => {
    const rows = buildStepView(tree(), {}).rows
    expect(rows.some((r) => r.kind === "step" && r.greyed)).toBe(false)
  })
})

describe("tier tag and spark", () => {
  it("click cycles B, G, E, inherit; the spark sets and clears", async () => {
    const user = userEvent.setup()
    render(<Harness initial={[s("a")]} />)
    const row = screen.getByRole("treeitem", { name: "a" })
    const tag = () => within(row).getByRole("button", { name: /Tier of a/ })
    expect(tag().textContent).toBe("G")
    await user.click(tag())
    expect(latest[0].tier).toBe("min")
    await user.click(tag())
    await user.click(tag())
    expect(latest[0].tier).toBe("exceptional")
    await user.click(tag())
    expect(latest[0].tier).toBeUndefined()
    await user.click(within(row).getByRole("button", { name: "Spark a" }))
    expect(latest[0].sparkedAt).toBeTruthy()
    await user.click(within(row).getByRole("button", { name: "Clear spark on a" }))
    expect(latest[0].sparkedAt).toBeUndefined()
  })
})

describe("LevelGauge", () => {
  it("reads B · G · E with — for an empty level, never 0%", () => {
    const steps = [
      s("back", { tier: "min", subtasks: [s("b0", { completed: true }), s("b1", { completed: true }), s("b2")] }),
      s("holder", { tier: "min", subtasks: [s("h0"), s("h1")] }),
      s("insert", { subtasks: [s("i0", { completed: true }), s("i1"), s("i2"), s("i3")] }),
    ]
    const { container } = render(<LevelGauge steps={steps} />)
    expect(container.textContent).toBe("3/12B33%G31%E—")
  })

  it("draws one weighted bar without tiers", () => {
    const { container } = render(<LevelGauge steps={[s("p", { subtasks: [s("x", { completed: true }), s("y")] }), s("q")]} />)
    expect(container.textContent).toBe("1/4" + "25%")
  })
})

describe("the lid", () => {
  it("filters by the Tier pref and reads minutes for that level", () => {
    setTodoPrefs({ tierView: "min" })
    expect(getTodoPrefs().tierView).toBe("min")
    const steps = [s("goal", { estimatedDuration: 10, subtasks: [s("bare", { tier: "min", estimatedDuration: 15 }), s("rest", { estimatedDuration: 30 })] })]
    render(<TodoBreakdown steps={steps} onEstimateChange={() => {}} onStepsChange={() => {}} />)
    expect(screen.getByText("counts 15m for Bare minimum")).toBeTruthy()
    expect(screen.queryByRole("treeitem", { name: "rest" })).toBeNull()
    expect(screen.getByRole("treeitem", { name: "goal" }).className).toContain("is-greyed")
  })
})
