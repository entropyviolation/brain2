import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessageIngestPanel } from "./MessageIngestPanel"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { UNPAIRED_SUMMARY } from "@/lib/ingest/pairing"

describe("MessageIngestPanel", () => {
  it("simulates a quick-add phrase into the inbox", async () => {
    resetAllStores()
    const user = userEvent.setup()
    render(<MessageIngestPanel />)
    await user.type(screen.getByLabelText(/simulate a message/i), "qa: pick up milk")
    await user.click(screen.getByRole("button", { name: /apply locally/i }))
    expect(screen.getByText(/Inbox: pick up milk/i)).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.some((t) => t.description === "pick up milk")).toBe(true)
  })

  it("points at the AirDrop Screen Time / Call / Text shortcut files", () => {
    resetAllStores()
    render(<MessageIngestPanel />)
    expect(screen.getByText(/iPhone Screen Time \/ Calls \/ Texts Shortcuts/i)).toBeInTheDocument()
    expect(screen.getByText(/Screen Time to Brain2\.shortcut/)).toBeInTheDocument()
    expect(screen.getByText(/iPhone Call to Brain2\.shortcut/)).toBeInTheDocument()
    expect(screen.getByText(/iPhone Text to Brain2\.shortcut/)).toBeInTheDocument()
  })

  it("pairs a refused sender from the log without a code", async () => {
    resetAllStores()
    useIngestStore.setState({
      allowedChats: [],
      events: [
        {
          id: "ing-1",
          at: "2026-09-21T18:00:56.000Z",
          channel: "telegram",
          chatId: "555",
          username: "otherworld",
          raw: "read: grocery list",
          kind: "read",
          status: "ignored",
          summary: UNPAIRED_SUMMARY,
        },
      ],
    })
    const user = userEvent.setup()
    render(<MessageIngestPanel />)

    expect(screen.getByText(/Texted but not paired/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Pair" }))

    expect(useIngestStore.getState().isAllowed("555")).toBe(true)
    expect(screen.queryByText(/Texted but not paired/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Paired chats/i)).toBeInTheDocument()
  })
})
