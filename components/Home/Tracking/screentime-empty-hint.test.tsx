/**
 * components/Home/Tracking/screentime-empty-hint.test.tsx
 */
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ScreenTimeEmptyHint } from "./screentime-empty-hint"

const DAY = "2026-09-19"

beforeEach(() => {
  useTimeTrackingStore.setState({
    scopes: [
      ...useTimeTrackingStore.getState().scopes.filter((s) => s.id !== "screentime"),
      { id: "screentime", name: "Screen Time", pens: [] },
    ],
  })
})

describe("ScreenTimeEmptyHint", () => {
  it("explains ActivityWatch without switching the tracking view", () => {
    const before = useTimeTrackingStore.getState().activeScopeId
    render(<ScreenTimeEmptyHint date={DAY} scopeId="screentime" />)
    expect(screen.getByText(/ActivityWatch/)).toBeInTheDocument()
    expect(screen.getByText(/cannot import Apple Screen Time/)).toBeInTheDocument()
    expect(screen.getByText(/Settings → Screen Time/)).toBeInTheDocument()
    expect(useTimeTrackingStore.getState().activeScopeId).toBe(before)
  })

  it("stays silent on other scopes", () => {
    render(<ScreenTimeEmptyHint date={DAY} scopeId="activity" />)
    expect(screen.queryByText(/ActivityWatch/)).toBeNull()
  })
})
