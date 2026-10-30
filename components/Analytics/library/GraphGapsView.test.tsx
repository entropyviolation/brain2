/**
 * Graph library — empty plate, a recorded link stays recorded, an open triad stays missing.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { useGraphInboxStore } from "@/lib/graph/graph-inbox-store"
import type { GraphProposal } from "@/lib/graph/proposal-schema"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { GraphGapsView } from "./GraphGapsView"

function task(id: string, title: string, links: [string, string][] = [], type?: string): Task {
  return {
    id,
    title,
    description: title,
    type,
    stage: "list",
    createdAt: new Date("2026-10-01T12:00:00"),
    completed: false,
    lists: [],
    links: links.map(([relation, targetId], index) => ({ id: `${id}-${index}`, relation, targetId })),
  }
}

function proposal(partial: Pick<GraphProposal, "id" | "status" | "reason"> & Partial<GraphProposal>): GraphProposal {
  return {
    kind: "link",
    sourceId: "ada",
    relation: "related",
    targetId: "bea",
    origin: "densify:triad",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  }
}

describe("GraphGapsView", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
    useGraphInboxStore.setState({ proposals: [] })
  })

  it("says the slice is empty when nothing is linked", () => {
    render(<GraphGapsView />)
    expect(screen.getByTestId("graph-gaps-plate")).toHaveTextContent("No missing or uncertain graph facts in this slice.")
    expect(screen.queryByTestId("graph-gap-counts")).not.toBeInTheDocument()
  })

  it("does not call a recorded link missing", async () => {
    const user = userEvent.setup()
    useTaskStore.setState({
      tasks: [task("ada", "Ada", [["related", "bea"]]), task("bea", "Bea")],
      lists: [],
      folders: [],
    })
    render(<GraphGapsView />)
    expect(screen.getByTestId("graph-gaps-plate")).toHaveTextContent("No missing or uncertain graph facts in this slice.")
    await user.click(screen.getByRole("button", { name: "Large" }))
    const recorded = screen.getByTestId("graph-edge-recorded-ada-bea")
    expect(recorded).toHaveTextContent("Ada · related to · Bea")
    expect(recorded).not.toHaveTextContent(/missing/i)
    expect(recorded).toHaveAttribute("data-status", "recorded")
    expect(screen.queryByText(/^missing$/i)).not.toBeInTheDocument()
  })

  it("names a missing triad and an open proposal, and a click does not write", async () => {
    const user = userEvent.setup()
    const tasks = [
      task("ada", "Ada", [["related", "xavier"], ["related", "yara"]]),
      task("bea", "Bea", [["related", "xavier"], ["related", "yara"]]),
      task("xavier", "Xavier"),
      task("yara", "Yara"),
    ]
    const proposals = [
      proposal({ id: "open-1", status: "open", reason: "Shared neighbours, still a proposal." }),
      proposal({ id: "kept-1", status: "accepted", reason: "Already accepted and must stay hidden." }),
    ]
    useTaskStore.setState({ tasks, lists: [], folders: [] })
    useGraphInboxStore.setState({ proposals })
    render(<GraphGapsView />)

    expect(screen.getByTestId("graph-gap-counts")).toHaveTextContent(/Missing/)
    expect(screen.getByTestId("graph-gap-counts")).toHaveTextContent(/Uncertain/)
    expect(screen.getByRole("button", { name: /Ada and Bea: missing related to \(triad\)/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /uncertain related to \(proposal, not accepted\)/ })).toBeInTheDocument()
    expect(screen.queryByText(/Already accepted and must stay hidden/)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Ada and Bea: missing related to \(triad\)/ }))
    expect(useTaskStore.getState().tasks.map((item) => item.links)).toEqual(tasks.map((item) => item.links))
    expect(useGraphInboxStore.getState().proposals).toEqual(proposals)

    await user.click(screen.getByRole("button", { name: "Large" }))
    const recorded = screen.getByTestId("graph-edge-recorded-ada-xavier")
    expect(recorded).toHaveTextContent("Ada · related to · Xavier")
    expect(recorded).not.toHaveTextContent(/missing/i)
    expect(screen.getByTestId("graph-edge-missing-triad|ada|bea|related")).toHaveTextContent("missing")
  })
})
