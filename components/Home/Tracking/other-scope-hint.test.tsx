import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { defaultScopes, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { OtherScopeHint } from "./other-scope-hint"

const DAY = "2026-09-19"

beforeEach(() => {
  useTimeTrackingStore.setState({
    scopes: [
      ...defaultScopes(),
      { id: "empty", name: "discrete events", pens: [{ id: "def", name: "Default", color: "#6366f1" }] },
    ],
    entries: [],
    activeScopeId: "empty",
    selectedPenId: "def",
  })
  useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
})

describe("OtherScopeHint", () => {
  it("switches to the view that actually has hours", () => {
    render(<OtherScopeHint date={DAY} scopeId="empty" />)
    fireEvent.click(screen.getByRole("button", { name: /Show Activity/ }))
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("activity")
  })

  it("does not steal the Screen Time view", () => {
    useTimeTrackingStore.setState({
      scopes: [
        ...useTimeTrackingStore.getState().scopes.filter((s) => s.id !== "screentime"),
        { id: "screentime", name: "Screen Time", pens: [] },
      ],
      activeScopeId: "screentime",
    })
    const { container } = render(<OtherScopeHint date={DAY} scopeId="screentime" />)
    expect(container).toBeEmptyDOMElement()
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("screentime")
  })
})
