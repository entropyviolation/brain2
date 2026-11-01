/**
 * Atlas — draws a hand-built graph, the order chip hides derived edges,
 * a click shows the readout, Find focuses, and the schema plate omits identity.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { KgEdge, KgNode, KnowledgeGraph, SchemaMorphism, SchemaObject } from "@/lib/graph/kg-model"
import { GraphAtlas } from "./GraphAtlas"
import { SchemaCategoryDiagram } from "./SchemaCategoryDiagram"

function graphOf(nodes: KgNode[], edges: KgEdge[]): KnowledgeGraph {
  const out = new Map<string, KgEdge[]>()
  const inn = new Map<string, KgEdge[]>()
  for (const e of edges) {
    out.set(e.s, [...(out.get(e.s) ?? []), e])
    inn.set(e.o, [...(inn.get(e.o) ?? []), e])
  }
  return { nodes: new Map(nodes.map((n) => [n.id, n])), edges, out, in: inn }
}

const fixture = graphOf(
  [
    { id: "item:ada", kind: "item", label: "Ada", typeId: "person" },
    { id: "item:book", kind: "item", label: "Dune", typeId: "book" },
    { id: "item:idea", kind: "item", label: "Spice idea", typeId: "note" },
    { id: "list:reading", kind: "list", label: "Reading" },
    { id: "day:2026-11-01", kind: "day", label: "Nov 1" },
  ],
  [
    { s: "item:ada", p: "related", o: "item:book", graph: "links", order: "recorded" },
    { s: "item:book", p: "member-of", o: "list:reading", graph: "lists", order: "recorded" },
    { s: "item:idea", p: "supports", o: "item:book", graph: "links", order: "recorded" },
    { s: "item:ada", p: "related", o: "item:idea", graph: "derived", order: "derived", proof: "rule-1" },
    { s: "item:book", p: "captured-on", o: "day:2026-11-01", graph: "spine", order: "observed" },
  ],
)

describe("GraphAtlas", () => {
  it("draws every node and edge of the fixture with a count", () => {
    render(<GraphAtlas graph={fixture} />)
    expect(screen.getByTestId("atlas-count")).toHaveTextContent("Showing 5 of 5 nodes · 5 edges")
    expect(screen.getByRole("button", { name: "Ada" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nov 1" })).toBeInTheDocument()
    expect(screen.getByTestId("atlas-edge-item:ada-item:idea")).toHaveAttribute("data-order", "derived")
    expect(screen.getByTestId("atlas-edge-item:ada-item:idea")).toHaveClass("atlas-o-derived")
  })

  it("hides derived edges when the derived chip is off", async () => {
    const user = userEvent.setup()
    render(<GraphAtlas graph={fixture} />)
    await user.click(screen.getByRole("button", { name: /derived 1/ }))
    expect(screen.queryByTestId("atlas-edge-item:ada-item:idea")).not.toBeInTheDocument()
    expect(screen.getByTestId("atlas-edge-item:ada-item:book")).toBeInTheDocument()
    expect(screen.getByTestId("atlas-count")).toHaveTextContent("4 edges")
  })

  it("hides a node kind", async () => {
    const user = userEvent.setup()
    render(<GraphAtlas graph={fixture} />)
    await user.click(screen.getByRole("button", { name: /^day 1/ }))
    expect(screen.queryByRole("button", { name: "Nov 1" })).not.toBeInTheDocument()
    expect(screen.getByTestId("atlas-count")).toHaveTextContent("Showing 4 of 4 nodes")
  })

  it("caps by degree and says so", () => {
    render(<GraphAtlas graph={fixture} initialCap={2} />)
    expect(screen.getByTestId("atlas-count")).toHaveTextContent("Showing 2 of 5 nodes")
    expect(screen.getByRole("button", { name: "Dune" })).toBeInTheDocument()
  })

  it("shows a readout for a clicked node with relation labels", async () => {
    const user = userEvent.setup()
    render(<GraphAtlas graph={fixture} typeLabel={(id) => (id === "book" ? "Book" : id)} />)
    await user.click(screen.getByRole("button", { name: "Dune" }))
    const readout = screen.getByTestId("atlas-readout")
    expect(readout).toHaveTextContent("Dune")
    expect(readout).toHaveTextContent("item")
    expect(readout).toHaveTextContent("Book")
    expect(readout).toHaveTextContent("4 (2 out · 2 in)")
    const ins = within(readout).getByRole("list", { name: "In edges" })
    expect(ins).toHaveTextContent("Ada related to →")
    expect(ins).toHaveTextContent("Spice idea supports →")
    await user.click(within(readout).getByRole("button", { name: /Ada related to/ }))
    expect(screen.getByTestId("atlas-readout")).toHaveTextContent("Ada")
  })

  it("Find focuses a node and dims the far ones", async () => {
    const user = userEvent.setup()
    render(<GraphAtlas graph={fixture} />)
    await user.type(screen.getByRole("searchbox", { name: "Find a node" }), "nov")
    await user.click(within(screen.getByRole("list", { name: "Matching nodes" })).getByRole("button", { name: /Nov 1/ }))
    expect(screen.getByRole("button", { name: "Nov 1" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Ada" })).toHaveClass("atlas-dim")
    expect(screen.getByRole("button", { name: "Dune" })).not.toHaveClass("atlas-dim")
    await user.click(screen.getByRole("button", { name: "2 hops" }))
    expect(screen.getByRole("button", { name: "Ada" })).not.toHaveClass("atlas-dim")
  })

  it("tints by community with the room's tones", () => {
    const communities = new Map([
      ["item:ada", "a"],
      ["item:book", "a"],
      ["item:idea", "b"],
    ])
    render(<GraphAtlas graph={fixture} communities={communities} />)
    expect(screen.getByRole("button", { name: "Ada" })).toHaveClass("atlas-c0")
    expect(screen.getByRole("button", { name: "Spice idea" })).not.toHaveClass("atlas-c0")
  })

  it("says so when every kind is hidden", async () => {
    const user = userEvent.setup()
    render(<GraphAtlas graph={graphOf([{ id: "day:x", kind: "day", label: "X" }], [])} />)
    await user.click(screen.getByRole("button", { name: /^day 1/ }))
    expect(screen.getByText("No nodes in this cut.")).toBeInTheDocument()
  })
})

describe("SchemaCategoryDiagram", () => {
  const objects: SchemaObject[] = [
    { id: "book", label: "Book" },
    { id: "person", label: "Person" },
    { id: "@day", label: "Day" },
  ]
  const morphisms: SchemaMorphism[] = [
    { id: "id:book", dom: "book", cod: "book", label: "identity" },
    { id: "author-of", dom: "person", cod: "book", label: "author of" },
    { id: "read-on", dom: "book", cod: "@day", label: "read on" },
  ]

  it("draws objects and non-identity arrows, and lists domain and codomain on click", async () => {
    const user = userEvent.setup()
    render(<SchemaCategoryDiagram objects={objects} morphisms={morphisms} />)
    expect(screen.getByText("Person")).toBeInTheDocument()
    expect(screen.queryByText("identity")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "author of: Person to Book" }))
    const readout = screen.getByTestId("morphism-readout")
    expect(readout).toHaveTextContent("domain Person")
    expect(readout).toHaveTextContent("codomain Book")
  })
})
