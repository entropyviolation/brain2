/**
 * Mount / usage fixture for gravity + pile agents.
 *
 *   import { ListIconForceLinksOverlay } from ".../list-icon-force-links-overlay"
 *   import { ListIconPhysicsJuice } from ".../list-icon-physics-juice"
 *
 * Gravity (React poses + connection edges):
 *   <ListIconForceLinksOverlay nodes={centers} edges={gravityEdges} width={W} height={H} />
 *
 * Or host:
 *   <ListIconPhysicsJuice mode="gravity" iconPositions={shown} tasks={tasks} width={W} height={H} />
 *
 * Pile (DOM-sampled proximity):
 *   <ListIconPhysicsJuice mode="pile" canvasRootRef={canvasRef} width={W} height={H} />
 */

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ListIconForceLinksOverlay } from "@/components/Lists/lib/list-icon-force-links-overlay"
import { ListIconPhysicsJuice } from "@/components/Lists/lib/list-icon-physics-juice"
import type { Task } from "@/lib/types"

describe("ListIconForceLinksOverlay", () => {
  it("renders weighted cords and marks heavy edges", () => {
    const { container } = render(
      <ListIconForceLinksOverlay
        nodes={[
          { id: "a", x: 20, y: 20 },
          { id: "b", x: 180, y: 40 },
          { id: "c", x: 90, y: 160 },
        ]}
        edges={[
          { a: "a", b: "b", weight: 0.6 },
          { a: "a", b: "c", weight: 2.4 },
        ]}
        width={320}
        height={240}
        reducedMotion={false}
      />,
    )
    const svg = container.querySelector("[data-force-links='on']")
    expect(svg).toBeTruthy()
    const cords = container.querySelectorAll(".fm-force-link-cord")
    expect(cords.length).toBe(2)
    expect(container.querySelector("[data-heavy='on']")).toBeTruthy()
    expect(container.querySelector(".fm-force-link-cord.is-heavy")).toBeTruthy()
  })

  it("stays static under reduced motion (no pulse class)", () => {
    const { container } = render(
      <ListIconForceLinksOverlay
        nodes={[
          { id: "a", x: 0, y: 0 },
          { id: "b", x: 80, y: 0 },
        ]}
        edges={[{ a: "a", b: "b", weight: 3 }]}
        width={200}
        height={100}
        reducedMotion
      />,
    )
    expect(container.querySelector(".fm-force-links.is-static")).toBeTruthy()
    expect(container.querySelector(".fm-force-link-cord.is-heavy")).toBeNull()
    expect(container.querySelector("[data-reduced-motion='on']")).toBeTruthy()
  })
})

describe("ListIconPhysicsJuice gravity mount", () => {
  it("draws cords from tasks + iconPositions when mode is gravity", () => {
    const tasks = [
      {
        id: "a",
        title: "A",
        links: [{ id: "l1", relation: "related", targetId: "b" }],
      },
      { id: "b", title: "B" },
      { id: "c", title: "C" },
    ] as Task[]

    render(
      <ListIconPhysicsJuice
        mode="gravity"
        iconPositions={{
          a: { x: 0, y: 0 },
          b: { x: 120, y: 0 },
          c: { x: 240, y: 0 },
        }}
        tasks={tasks}
        width={400}
        height={300}
        reducedMotion
      />,
    )
    expect(document.querySelector("[data-ui-name='Gravity force links']")).toBeTruthy()
    expect(document.querySelectorAll(".fm-force-link-cord").length).toBeGreaterThanOrEqual(1)
  })

  it("returns null when mode is off", () => {
    const { container } = render(
      <ListIconPhysicsJuice mode="off" width={100} height={100} />,
    )
    expect(container.querySelector("[data-force-links]")).toBeNull()
  })
})
