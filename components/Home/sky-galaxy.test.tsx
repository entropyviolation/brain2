import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { GalaxySchematic } from "@/components/Home/sky-galaxy"
import { GALAXY_SCHEMATIC_CAPTION, galaxySchematicLayout } from "@/lib/sky-galaxy"

describe("GalaxySchematic", () => {
  it("captions a face-on galaxy and marks the Sun off center", () => {
    const { container } = render(<GalaxySchematic />)
    expect(screen.getByRole("img", { name: GALAXY_SCHEMATIC_CAPTION })).toBeInTheDocument()
    expect(screen.getByText(GALAXY_SCHEMATIC_CAPTION)).toBeInTheDocument()
    expect(screen.getByText(/Sun in the Orion spur, 27,000 ly from the center/)).toBeInTheDocument()
    expect(screen.getByText(/100,000 ly across/)).toBeInTheDocument()
    expect(screen.getByText("Sun")).toBeInTheDocument()

    const layout = galaxySchematicLayout()
    const dot = container.querySelector(".home-sky-marker")
    expect(dot?.getAttribute("cx")).toBe(String(layout.sun.x))
    expect(dot?.getAttribute("cy")).toBe(String(layout.sun.y))
    expect(Math.hypot(layout.center.x - layout.sun.x, layout.center.y - layout.sun.y)).toBeGreaterThan(40)
  })
})
