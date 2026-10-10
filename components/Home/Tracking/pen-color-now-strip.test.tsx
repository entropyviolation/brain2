import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { PenColorNowStrip } from "./pen-color-now-strip"

describe("PenColorNowStrip", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("searches pen colors and logs the chosen one from this second", async () => {
    const user = userEvent.setup()
    render(<PenColorNowStrip />)

    const search = screen.getByRole("combobox", { name: "Search pen colors" })
    await user.click(search)
    await user.type(search, "work")
    expect(screen.getByRole("option", { name: /Work · Activity/ })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /Work · Location/ })).toBeInTheDocument()

    await user.click(screen.getByRole("option", { name: /Work · Location/ }))
    expect(screen.getByText("Location · starts this second")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Start this pen's clock" }))
    const session = usePenColorSessionStore.getState().session
    expect(session?.penId).toBe("loc-work")
    expect(session?.startedAt).toBeTruthy()
    const started = new Date(session!.startedAt)
    expect(useTimeTrackingStore.getState().entries.find((e) => e.penId === "loc-work")).toMatchObject({
      scopeId: "location",
      startMin: started.getHours() * 60 + started.getMinutes(),
    })
    expect(screen.getByRole("button", { name: "Stop working on Work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pause Work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Stop working on Work" }).querySelector("svg")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Pause Work" }).querySelector("svg")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "STOP WORKING ON WORK" })).not.toBeInTheDocument()
    expect(screen.getByText(/Location · since /)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Pause Work" }))
    expect(usePenColorSessionStore.getState().session?.pausedAt).toBeTruthy()
    expect(screen.getByRole("button", { name: "Resume Work" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Stop working on Work" }))
    expect(usePenColorSessionStore.getState().session).toBeNull()
    expect(useTimeTrackingStore.getState().entries.some((e) => e.penId === "loc-work")).toBe(true)
    expect(screen.getByRole("button", { name: "Start this pen's clock" })).toBeInTheDocument()
  })

  it("creates a typed name on the active view and selects that pen", async () => {
    const user = userEvent.setup()
    const scopeId = useTimeTrackingStore.getState().activeScopeId
    const scopeName = useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)?.name
    render(<PenColorNowStrip />)

    const search = screen.getByRole("combobox", { name: "Search pen colors" })
    await user.click(search)
    await user.type(search, "Balboa Park")
    expect(screen.getByRole("combobox", { name: "View for the new pen" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Create [“"]Balboa Park[”"]/ }))

    const pens = useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)?.pens ?? []
    const created = pens.find((p) => p.name === "Balboa Park")
    expect(created).toBeTruthy()
    expect(screen.getByRole("button", { name: "Start this pen's clock" })).toBeEnabled()
    expect(screen.getByText(new RegExp(`${scopeName} · starts this second`))).toBeInTheDocument()
  })
})
