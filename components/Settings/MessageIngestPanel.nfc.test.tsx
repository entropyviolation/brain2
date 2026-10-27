/**
 * components/Settings/MessageIngestPanel.nfc.test.tsx — NFC tag form
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { MessageIngestPanel } from "./MessageIngestPanel"

describe("NFC tags in Message ingest", () => {
  beforeEach(() => {
    resetAllStores()
    useIngestStore.setState({ nfcTags: [] })
  })

  it("adds a tag, shows the line, and removes it", () => {
    render(<MessageIngestPanel />)
    fireEvent.change(screen.getByLabelText("NFC tag id"), { target: { value: "vitamin-d" } })
    fireEvent.change(screen.getByLabelText("NFC tag name"), { target: { value: "Vitamin D" } })
    fireEvent.change(screen.getByLabelText("NFC event title"), { target: { value: "vitamin D" } })
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }))
    expect(screen.getByText("nfc:vitamin-d")).toBeTruthy()
    expect(useIngestStore.getState().nfcTags.map((tag) => tag.id)).toEqual(["vitamin-d"])
    fireEvent.click(screen.getByRole("button", { name: "Remove Vitamin D" }))
    expect(screen.queryByText("nfc:vitamin-d")).toBeNull()
    expect(useIngestStore.getState().nfcTags).toEqual([])
  })
})
