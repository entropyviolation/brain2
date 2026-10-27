/**
 * components/Home/Plan/paste-events-dialog.test.tsx — Paste events dialog
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useEventStore } from "@/lib/event-store"
import { PasteEventsDialog } from "./paste-events-dialog"

describe("PasteEventsDialog", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("parses pasted text and imports events into the store", async () => {
    const user = userEvent.setup()
    render(<PasteEventsDialog open={true} onOpenChange={() => {}} />)

    const textarea = screen.getByLabelText(/Event text/i)
    await user.clear(textarea)
    await user.paste("July 10th: DRIVE DAY\nJuly 14th: MEETING - Sync @ 2PM PST")

    await user.click(screen.getByRole("button", { name: /^Parse$/i }))
    expect(await screen.findByRole("checkbox", { name: /Include DRIVE DAY/i })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /Include MEETING - Sync/i })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Import 2 Events/i }))
    const titles = useEventStore.getState().events.map((e) => e.title)
    expect(titles).toContain("DRIVE DAY")
    expect(titles).toContain("MEETING - Sync")
  })
})
