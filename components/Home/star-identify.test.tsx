import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoonOrrery } from "@/components/Home/home-moon-orrery"
import { StarIdentifyLabels, StarIdentifyPanel, starFieldVisible } from "@/components/Home/star-identify"
import { nearestNamedStars } from "@/components/Home/naked-eye-stars"
import { planetPlaces } from "@/lib/solar-system"
import { zoomFactor } from "@/lib/sky-zoom"

function Harness({ factor, longitude, planetName }: { factor: number; longitude: number; planetName: string }) {
  return (
    <>
      <svg>
        <StarIdentifyLabels longitude={longitude} factor={factor} />
      </svg>
      <StarIdentifyPanel planetName={planetName} longitude={longitude} />
    </>
  )
}

describe("star identify", () => {
  it("shows the star field at system and wider, and hides it when zoomed in", () => {
    expect(starFieldVisible(zoomFactor("system"))).toBe(true)
    expect(starFieldVisible(zoomFactor("stars"))).toBe(true)
    expect(starFieldVisible(zoomFactor("galaxy"))).toBe(true)
    expect(starFieldVisible(zoomFactor("inner"))).toBe(false)
    expect(starFieldVisible(zoomFactor("earth"))).toBe(false)
    expect(starFieldVisible(zoomFactor("moon"))).toBe(false)
  })

  it("lists five named stars and labels them only while the star field is in view", () => {
    const earth = planetPlaces(new Date(Date.UTC(2000, 0, 1, 12, 0, 0))).find((planet) => planet.id === "earth")!
    const { container, rerender, unmount } = render(
      <Harness factor={zoomFactor("system")} longitude={earth.longitude} planetName={earth.name} />,
    )
    expect(screen.queryByRole("list", { name: "Stars near this longitude" })).toBeNull()
    expect(container.querySelectorAll(".home-sky-star-name")).toHaveLength(0)

    fireEvent.click(screen.getByRole("checkbox", { name: "Stars near" }))
    expect(screen.getByText(`Directions on the sky from the Sun’s neighborhood, not stars orbiting ${earth.name}.`)).toBeInTheDocument()
    const rows = within(screen.getByRole("list", { name: "Stars near this longitude" })).getAllByRole("listitem")
    const expected = nearestNamedStars(earth.longitude)
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.textContent)).toEqual(
      expected.map((star) => `${star.name}V ${star.mag.toFixed(2)}${star.gap.toFixed(1)}°`),
    )
    expect(container.querySelectorAll(".home-sky-star-name")).toHaveLength(5)
    expect([...container.querySelectorAll(".home-sky-star-name")].map((node) => node.textContent)).toEqual(
      expected.map((star) => star.name),
    )

    rerender(<Harness factor={zoomFactor("earth")} longitude={earth.longitude} planetName={earth.name} />)
    expect(container.querySelectorAll(".home-sky-star-name")).toHaveLength(0)
    expect(screen.getByRole("list", { name: "Stars near this longitude" })).toBeInTheDocument()
    unmount()
  })

  it("toggles on the chart without writing the sky-motion store", () => {
    const widget = new Date(2026, 9, 6, 15, 30, 0, 0)
    const { container, unmount } = render(<MoonOrrery date={widget} />)
    const before = localStorage.getItem("brain2-sky-motion")
    const sky = within(screen.getByRole("list", { name: "Sky build" }))
    expect(sky.getByText("Star identify").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Stars").closest("li")).toHaveAttribute("data-state", "done")

    fireEvent.click(screen.getByRole("checkbox", { name: "Stars near" }))
    expect(container.querySelectorAll(".home-sky-star-name")).toHaveLength(5)
    const sirius = [...container.querySelectorAll(".home-sky-star")].find((node) =>
      node.querySelector("title")?.textContent?.startsWith("Sirius"),
    )
    fireEvent.mouseOver(sirius!)
    expect(sirius?.querySelector("title")?.textContent).toMatch(/Sirius · V -1\.44/)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-06T15:30")
    expect(localStorage.getItem("brain2-sky-motion")).toBe(before)
    unmount()
  })
})
