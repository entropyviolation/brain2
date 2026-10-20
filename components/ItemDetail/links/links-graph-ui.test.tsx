/**
 * LINKS_REDESIGN L3.3, L4.3, L4.4, L2.2, L2.3: the tab's shelf, readout and
 * derived switch; the relation sheet and merge.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import "@/lib/person-relations"
import { resetLocalStorage } from "@/tests/test-utils"
import { RichLinksPanel } from "@/components/ItemDetail/links/RichLinksPanel"
import { RelationsLibrary } from "@/components/Analytics/relations/RelationsLibrary"
import { useItemTypeStore } from "@/lib/item-type-store"
import { getBuiltinItemTypes } from "@/lib/item-types"
import { makeRule } from "@/lib/graph/relation-rules"
import { useLinksViewStore } from "@/lib/graph/links-view-store"
import { addLink, removeLink } from "@/lib/links"
import { createRelationPair, getRelationDef } from "@/lib/relation-registry"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

const t = (id: string, links: [string, string][] = []): Task =>
  ({ id, title: id, description: id, stage: "list", createdAt: new Date(), completed: false, lists: [], links: links.map(([relation, targetId], i) => ({ id: `${id}-${i}`, relation, targetId })) }) as Task

function Host({ initial, onDraft }: { initial: Task; onDraft?: (t: Task) => void }) {
  const [task, setTask] = useState(initial)
  const write = (next: Task) => {
    setTask(next)
    onDraft?.(next)
  }
  return (
    <RichLinksPanel
      task={task}
      addLink={(r, id) => write({ ...task, links: addLink(task.links, r, id, task.id) })}
      removeLink={(id) => write({ ...task, links: removeLink(task.links, id) })}
      writeDraft={(p) => write({ ...task, ...p })}
      onOpenItem={() => undefined}
    />
  )
}

beforeEach(() => {
  resetLocalStorage()
  useItemTypeStore.setState({ types: getBuiltinItemTypes(), relations: [], relationOverrides: {}, relationRules: [] })
  useLinksViewStore.setState({ withDerived: false, mutedSources: [] })
})

describe("Links tab graph furniture", () => {
  it("shows the readout and a triad suggestion; accept writes a draft link", async () => {
    const user = userEvent.setup()
    const me = t("me", [["related", "a"], ["related", "b"]])
    useTaskStore.setState({ tasks: [me, t("a", [["related", "x"]]), t("b", [["related", "x"]]), t("x")], lists: [], folders: [] })
    let draft: Task | null = null
    render(<Host initial={me} onDraft={(d) => (draft = d)} />)
    expect(screen.getByTestId("link-readout").textContent).toMatch(/2 out/)
    expect(screen.getByTestId("link-readout").textContent).toMatch(/1 open/)
    const shelf = screen.getByTestId("link-shelf")
    await user.click(within(shelf).getByRole("button", { name: "Accept x" }))
    expect(draft!.links!.some((l) => l.targetId === "x")).toBe(true)
  })

  it("mute hides a source; dismiss stores the key", async () => {
    const user = userEvent.setup()
    const me = t("me", [["related", "a"], ["related", "b"]])
    useTaskStore.setState({ tasks: [me, t("a", [["related", "x"]]), t("b", [["related", "x"]]), t("x")], lists: [], folders: [] })
    let draft: Task | null = null
    render(<Host initial={me} onDraft={(d) => (draft = d)} />)
    await user.click(screen.getByRole("button", { name: "Dismiss x" }))
    expect(draft!.dismissedLinkSuggestions).toHaveLength(1)
    expect(screen.queryByTestId("link-shelf")).toBeNull()
  })

  it("with derived shows a rule edge with a proof", async () => {
    const user = userEvent.setup()
    useItemTypeStore.setState({ relationRules: [makeRule({ label: "Grandparents", chain: ["parent-of", "parent-of"], head: "grandparent-of" })] })
    const g = t("g", [["parent-of", "p"]])
    useTaskStore.setState({ tasks: [g, t("p", [["parent-of", "c"]]), t("c")], lists: [], folders: [] })
    render(<Host initial={g} />)
    expect(screen.queryByRole("button", { name: "Why is c here?" })).toBeNull()
    await user.click(screen.getByLabelText(/with derived/))
    await user.click(screen.getByRole("button", { name: "Why is c here?" }))
    expect(screen.getByTestId("proof-card").textContent).toMatch(/If \?a/)
  })
})

describe("Relations library sheet", () => {
  it("opens a sheet, saves a trait override on a built-in, and merges a custom relation as an alias", async () => {
    const user = userEvent.setup()
    const [mine] = createRelationPair({ label: "coworker of", symmetric: true })
    useItemTypeStore.getState().addRelations([mine])
    useTaskStore.setState({ tasks: [t("a", [[mine.id, "b"]]), t("b")], lists: [], folders: [] })
    render(<RelationsLibrary />)
    await user.click(screen.getByTestId("relation-row-blocks"))
    await user.click(within(screen.getByTestId("relation-sheet")).getByLabelText(/transitive/))
    expect(useItemTypeStore.getState().relationOverrides.blocks?.traits?.transitive).toBe(true)
    await user.click(screen.getByTestId(`relation-row-${mine.id}`))
    expect(screen.getByTestId("relation-sheet").textContent).toMatch(/Used 1 times/)
    useItemTypeStore.getState().mergeRelation(mine.id, "related")
    expect(getRelationDef(mine.id)?.label).toBe(getRelationDef("related")?.label)
    expect(useTaskStore.getState().tasks[0].links![0].relation).toBe(mine.id)
    useItemTypeStore.getState().unmergeRelation(mine.id)
    expect(getRelationDef(mine.id)?.label).toBe("coworker of")
  })
})
