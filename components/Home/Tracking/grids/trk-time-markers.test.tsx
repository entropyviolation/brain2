import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TrkPlotMarkers } from "./trk-time-markers"

describe("TrkPlotMarkers", () => {
  it("places the now line inside the hour that contains it", () => {
    const { container } = render(
      <div className="trk95 trk-plot" style={{ position: "relative", height: 24 }}>
        <TrkPlotMarkers origin={12 * 60} span={60} axis="x" nowMinute={12 * 60 + 30} sun={null} />
      </div>,
    )
    const now = container.querySelector(".trk-marker-now") as HTMLElement
    expect(now).toBeTruthy()
    expect(now.style.left).toBe("50%")
  })

  it("places sunrise and sunset on the same plot", () => {
    const { container } = render(
      <div className="trk95 trk-plot" style={{ position: "relative", height: 24 }}>
        <TrkPlotMarkers
          origin={6 * 60}
          span={60}
          axis="x"
          nowMinute={null}
          sun={{
            sunriseMinutes: 6 * 60 + 36,
            sunsetMinutes: 18 * 60 + 46,
            sunriseLabel: "6:36 AM",
            sunsetLabel: "6:46 PM",
          }}
        />
      </div>,
    )
    expect(container.querySelector(".trk-marker-sunrise")).toBeTruthy()
    expect(container.querySelector(".trk-marker-sunset")).toBeFalsy()
  })
})
