/**
 * components/Settings/MessageIngestPanel.nfc.test.tsx — NFC tags bay
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { NfcTagsPanel } from "./NfcTagsPanel"

describe("NFC tags settings", () => {
  beforeEach(() => {
    resetAllStores()
    useIngestStore.setState({ nfcTags: [] })
  })

  it("adds a tag, shows the line, and removes it", () => {
    render(<NfcTagsPanel />)
    fireEvent.change(screen.getByLabelText("NFC tag id"), { target: { value: "vitamin-d" } })
    fireEvent.change(screen.getByLabelText("NFC tag name"), { target: { value: "Vitamin D" } })
    fireEvent.change(screen.getByLabelText("NFC event title"), { target: { value: "vitamin D" } })
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }))
    expect(screen.getByText("nfc:vitamin-d")).toBeTruthy()
    expect(useIngestStore.getState().nfcTags.map((tag) => tag.id)).toEqual(["vitamin-d"])
    expect(screen.getByText("Tag id")).toBeTruthy()
    expect(screen.getByText("Name")).toBeTruthy()
    expect(screen.getByText("Kind")).toBeTruthy()
    expect(screen.getByText("Event title")).toBeTruthy()
    expect(screen.getByText("Intake")).toBeTruthy()
    expect(screen.getByText("Quantity")).toBeTruthy()
    expect(screen.getByText("Minutes")).toBeTruthy()
    expect(screen.getByText("Daily habit")).toBeTruthy()
    expect(screen.getByText("Habit credit")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Remove Vitamin D" }))
    expect(screen.queryByText("nfc:vitamin-d")).toBeNull()
    expect(useIngestStore.getState().nfcTags).toEqual([])
  })

  it("downloads a signed shortcut for a saved dose", async () => {
    const saveNfcShortcut = vi.fn().mockResolvedValue({ ok: true, filename: "NFC Adderall.shortcut" })
    ;(window as unknown as { desktop: unknown }).desktop = { saveNfcShortcut }
    render(<NfcTagsPanel />)
    fireEvent.change(screen.getByLabelText("NFC tag id"), { target: { value: "adderall" } })
    fireEvent.change(screen.getByLabelText("NFC tag name"), { target: { value: "Adderall" } })
    fireEvent.change(screen.getByLabelText("NFC intake class"), { target: { value: "drug" } })
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }))
    fireEvent.click(screen.getByRole("button", { name: "Download shortcut for Adderall" }))
    await waitFor(() =>
      expect(saveNfcShortcut).toHaveBeenCalledWith({ id: "adderall", name: "Adderall", askQuantity: true }),
    )
    expect(await screen.findByText("Saved NFC Adderall.shortcut to Downloads.")).toBeTruthy()
  })
})
