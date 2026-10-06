import { describe, expect, it, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IngestLogDialog } from "./ingest-log-dialog"
import { resetGpsIngestLogForTests, useGpsIngestLog } from "@/lib/ingest/gps-log"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import type { IngestEvent } from "@/lib/ingest/types"

function row(over: Partial<IngestEvent>): IngestEvent {
  return {
    id: "e",
    at: "2026-09-22T05:00:00.000Z",
    channel: "telegram",
    chatId: "1",
    raw: "x",
    kind: "capture",
    status: "applied",
    summary: "ok",
    ...over,
  }
}

describe("IngestLogDialog", () => {
  beforeEach(() => {
    resetGpsIngestLogForTests()
    useIngestStore.setState({ events: [], pendingByChat: {} })
  })

  it("hides gps tracking points until Show GPS", async () => {
    useIngestStore.setState({
      events: [
        row({
          id: "c",
          at: "2026-09-22T05:00:00.000Z",
          raw: "pick up milk",
          summary: "Inbox: pick up milk",
        }),
        row({
          id: "g",
          at: "2026-09-22T06:00:00.000Z",
          kind: "gps",
          raw: "gps: Home",
          summary: "GPS → Home",
        }),
      ],
    })
    useGpsIngestLog.setState({
      events: [
        row({
          id: "live",
          at: "2026-09-22T07:00:00.000Z",
          kind: "gps",
          raw: "37.77,-122.42",
          summary: "Still at Home",
        }),
      ],
    })
    const user = userEvent.setup()
    render(<IngestLogDialog />)
    await user.click(screen.getByRole("button", { name: "Ingest" }))
    expect(screen.getByText("pick up milk")).toBeInTheDocument()
    expect(screen.queryByText("GPS → Home")).not.toBeInTheDocument()
    expect(screen.queryByText("Still at Home")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show GPS (2)" }))
    expect(screen.getByText("GPS → Home")).toBeInTheDocument()
    expect(screen.getByText("Still at Home")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Hide GPS" }))
    expect(screen.queryByText("GPS → Home")).not.toBeInTheDocument()
    expect(screen.getByText("pick up milk")).toBeInTheDocument()
  })
})
