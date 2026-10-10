import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ScaleField } from "@/components/Home/home-sky-scale"
import { SCALE_PHOTO_SRC, scaleFlightZoom } from "@/lib/sky-scale"

describe("scale card", () => {
  it("pulls the Moon photograph back onto the Earth photograph", () => {
    const moon = render(<ScaleField stop="moon" blend={0} />)
    const flight = moon.container.querySelector(".home-sky-scale-flight") as HTMLElement
    expect(flight.style.transform).toBe(`scale(${scaleFlightZoom(0)})`)
    expect(moon.container.querySelector('[data-scale-stop="moon"]')).toHaveAttribute("data-scale-kind", "photo")
    const photos = moon.container.querySelectorAll(".home-sky-scale-disk img")
    expect(photos.length).toBeGreaterThanOrEqual(2)
    expect(Array.from(photos).map((img) => img.getAttribute("src"))).toEqual(
      expect.arrayContaining([SCALE_PHOTO_SRC.earth, SCALE_PHOTO_SRC.moon]),
    )
    moon.rerender(<ScaleField stop="moon" blend={1} />)
    expect((moon.container.querySelector(".home-sky-scale-flight") as HTMLElement).style.transform).toBe(
      `scale(${scaleFlightZoom(1)})`,
    )

    const earth = render(<ScaleField stop="earth" blend={0} />)
    expect(earth.container.querySelector('[data-scale-object="moon"]')).toBeTruthy()
    expect(earth.container.querySelector('[data-scale-object="earth"]')).toBeTruthy()
    expect((earth.container.querySelector(".home-sky-scale-flight") as HTMLElement).style.transform).toBe("scale(1)")
  })

  it("keeps the gull beside the person and leaves 10^26 m as one schematic speck", () => {
    const beach = render(<ScaleField stop="person" blend={0} />)
    expect(beach.container.querySelector('[data-scale-object="person"]')).toHaveAttribute("data-scale-image", "person")
    expect(beach.container.querySelector('[data-scale-object="seagull"]')).toHaveAttribute("data-scale-image", "gull")
    expect(beach.container.querySelector('[data-scale-kind="scene"]')).toBeTruthy()

    const universe = render(<ScaleField stop="universe" blend={0} />)
    expect(universe.container.querySelector(".home-sky-scale-flight")).toBeNull()
    expect(universe.container.querySelector(".home-sky-scale-universe")).toHaveAttribute("data-scale-image", "schematic")
    expect(universe.container.querySelector(".home-sky-scale-speck")).toBeTruthy()
    expect(universe.container.textContent).toMatch(/schematic/i)
    expect(universe.container.querySelectorAll(".home-sky-scale-universe > svg circle").length).toBe(1)
  })
})
