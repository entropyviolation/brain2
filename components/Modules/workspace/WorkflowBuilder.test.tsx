/**
 * WorkflowBuilder + WorkflowStepEditor — compose a workflow and assert the
 * produced `WorkflowDefinition` shape persisted to `useWorkflowsStore`.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { WorkflowBuilder } from "./WorkflowBuilder"

describe("WorkflowBuilder", () => {
  beforeEach(() => {
    resetLocalStorage()
    useWorkflowsStore.setState({ workflows: [] })
  })

  it("composes a workflow (trigger + action) and persists the expected shape", async () => {
    const user = userEvent.setup()
    render(<WorkflowBuilder open onClose={() => {}} moduleId="mod-1" />)

    await user.click(screen.getByRole("button", { name: /New workflow/i }))

    const nameInput = await screen.findByLabelText("Workflow name")
    await user.type(nameInput, "Tag finalized")

    // Default trigger is item → create. Add an "Add a tag" action.
    await user.selectOptions(screen.getByLabelText("Add action"), "addTag")

    const tagInput = await screen.findByLabelText(/^Tag 1$/)
    await user.type(tagInput, "finalized")

    await user.click(screen.getByRole("button", { name: /Save workflow/i }))

    const stored = useWorkflowsStore.getState().workflows
    expect(stored).toHaveLength(1)
    const def = stored[0]
    expect(def.name).toBe("Tag finalized")
    expect(def.moduleId).toBe("mod-1")
    expect(def.trigger).toEqual({ kind: "item", event: "create" })
    expect(def.actions).toEqual([{ kind: "addTag", tag: "finalized" }])
    expect(def.enabled).toBe(true)
  })

  it("lets the user change the trigger and add a condition", async () => {
    const user = userEvent.setup()
    render(<WorkflowBuilder open onClose={() => {}} moduleId="mod-2" />)

    await user.click(screen.getByRole("button", { name: /New workflow/i }))
    await user.type(await screen.findByLabelText("Workflow name"), "Manual run")

    await user.selectOptions(screen.getByLabelText("Trigger"), "manual")
    await user.type(screen.getByLabelText("Button label"), "Go")

    await user.click(screen.getByRole("button", { name: /Add condition/i }))
    await user.type(screen.getByLabelText("Condition field 1"), "status")
    await user.selectOptions(screen.getByLabelText("Condition operator 1"), "eq")
    await user.type(screen.getByLabelText("Condition value 1"), "Finalized")

    await user.selectOptions(screen.getByLabelText("Add action"), "addToNextActions")
    await user.click(screen.getByRole("button", { name: /Save workflow/i }))

    const def = useWorkflowsStore.getState().workflows[0]
    expect(def.trigger).toEqual({ kind: "manual", buttonLabel: "Go" })
    expect(def.conditions).toEqual([{ field: "status", operator: "eq", value: "Finalized" }])
    expect(def.actions).toEqual([{ kind: "addToNextActions" }])
  })

  it("reorders action steps", async () => {
    const user = userEvent.setup()
    render(<WorkflowBuilder open onClose={() => {}} moduleId="mod-3" />)

    await user.click(screen.getByRole("button", { name: /New workflow/i }))
    await user.type(await screen.findByLabelText("Workflow name"), "Two steps")

    await user.selectOptions(screen.getByLabelText("Add action"), "addTag")
    await user.type(await screen.findByLabelText(/^Tag 1$/), "first")
    await user.selectOptions(screen.getByLabelText("Add action"), "block")
    await user.type(await screen.findByLabelText(/^Message 2$/), "stop")

    // Move step 2 up so the block action comes first.
    const step2 = screen.getByTestId("action-1")
    await user.click(within(step2).getByTitle("Move up"))

    await user.click(screen.getByRole("button", { name: /Save workflow/i }))

    const def = useWorkflowsStore.getState().workflows[0]
    expect(def.actions).toEqual([
      { kind: "block", message: "stop" },
      { kind: "addTag", tag: "first" },
    ])
  })
})
