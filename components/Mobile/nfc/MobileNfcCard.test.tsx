/**
 * components/Mobile/nfc/MobileNfcCard.test.tsx — Dose prompt, then the hub line
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NfcTagCatalogRow } from "@/lib/mobile/nfc-scan"

const bridge = vi.hoisted(() => ({
  available: true,
  scan: vi.fn(async () => ({ id: "04a1b2c3" })),
}))

const client = vi.hoisted(() => ({
  catalog: [
    { id: "adderall", name: "Adderall", kind: "instant", intakeClass: "drug", quantity: 1 },
    { id: "door", name: "Door", kind: "toggle" },
  ] as NfcTagCatalogRow[],
  load: vi.fn(async () => client.catalog),
  send: vi.fn(async () => ({ ok: true, status: "ok", reply: "Logged 2 10 mg adderall" })),
}))

vi.mock("@/lib/mobile/nfc-bridge", () => ({
  isNfcPluginAvailable: () => bridge.available,
  scanNfcTag: bridge.scan,
}))

vi.mock("@/lib/mobile/nfc-scan", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/nfc-scan")>()
  return {
    ...real,
    loadNfcCatalog: client.load,
    sendNfcScan: client.send,
  }
})

import { MobileNfcCard } from "./MobileNfcCard"

describe("MobileNfcCard", () => {
  beforeEach(() => {
    localStorage.clear()
    bridge.available = true
    bridge.scan.mockClear()
    client.load.mockClear()
    client.send.mockClear()
    client.send.mockResolvedValue({ ok: true, status: "ok", reply: "Logged 2 10 mg adderall" })
  })

  it("stays hidden when the phone cannot read NFC", () => {
    bridge.available = false
    const { container } = render(<MobileNfcCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it("binds a chip, asks how many for a dose, and posts the line", async () => {
    render(<MobileNfcCard />)
    fireEvent.change(screen.getByLabelText("Hub URL"), { target: { value: "http://mac.local:8787/api/scan" } })
    fireEvent.change(screen.getByLabelText("Hub token"), { target: { value: "s3cret" } })
    fireEvent.click(screen.getByRole("button", { name: "Save hub" }))
    await screen.findByText("Hub saved.")

    fireEvent.click(screen.getByRole("button", { name: "Scan sticker" }))
    await screen.findByRole("button", { name: "Adderall" })
    fireEvent.click(screen.getByRole("button", { name: "Adderall" }))
    await screen.findByLabelText("How many Adderall?")

    fireEvent.change(screen.getByLabelText("How many Adderall?"), { target: { value: "2" } })
    fireEvent.click(screen.getByRole("button", { name: "Log" }))

    await waitFor(() => {
      expect(client.send).toHaveBeenCalledWith({ origin: "http://mac.local:8787", token: "s3cret" }, "nfc:adderall 2")
    })
    expect(await screen.findByText("Logged 2 10 mg adderall")).toBeTruthy()
  })

  it("posts a known door with no question", async () => {
    localStorage.setItem("brain2-nfc-hub", JSON.stringify({ origin: "http://mac.local:8787", token: "s3cret" }))
    localStorage.setItem("brain2-nfc-chips", JSON.stringify({ "04a1b2c3": "door" }))
    client.send.mockResolvedValue({ ok: true, status: "ok", reply: "Logged left" })

    render(<MobileNfcCard />)
    fireEvent.click(await screen.findByRole("button", { name: "Scan sticker" }))

    await waitFor(() => {
      expect(client.send).toHaveBeenCalledWith({ origin: "http://mac.local:8787", token: "s3cret" }, "nfc:door")
    })
    expect(screen.queryByLabelText(/How many/)).toBeNull()
  })
})
