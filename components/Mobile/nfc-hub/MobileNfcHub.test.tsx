/**
 * components/Mobile/nfc-hub/MobileNfcHub.test.tsx — Write, read, and scan without a radio
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NfcTagCatalogRow } from "@/lib/mobile/nfc-scan"

const bridge = vi.hoisted(() => {
  const api = {
    available: false,
    scan: vi.fn(async () => {
      if (!api.available) throw new Error("NFC is only in the iPhone app.")
      return { id: "04a1b2c3" }
    }),
    read: vi.fn(async () => {
      if (!api.available) throw new Error("NFC is only in the iPhone app.")
      return { text: "" }
    }),
    write: vi.fn(async () => {
      if (!api.available) throw new Error("NFC is only in the iPhone app.")
    }),
  }
  return api
})

const client = vi.hoisted(() => ({
  catalog: [
    { id: "adderall", name: "Adderall", kind: "instant", intakeClass: "drug", quantity: 1 },
    { id: "door", name: "Door", kind: "toggle" },
  ] as NfcTagCatalogRow[],
  load: vi.fn(async () => client.catalog),
  send: vi.fn(async () => ({ ok: true, status: "ok", reply: "Logged left" })),
}))

vi.mock("@/lib/mobile-auth", () => ({
  readMobileSession: () => ({ username: "admin", loggedInAt: "2026-10-28T00:00:00.000Z" }),
}))

vi.mock("@/lib/mobile/nfc-bridge", () => ({
  isNfcPluginAvailable: () => bridge.available,
  scanNfcTag: bridge.scan,
  readNfcTag: bridge.read,
  writeNfcTag: bridge.write,
}))

vi.mock("@/lib/mobile/nfc-scan", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/nfc-scan")>()
  return {
    ...real,
    loadNfcCatalog: client.load,
    sendNfcScan: client.send,
  }
})

import { MobileNfcHubScreen } from "./MobileNfcHub"

describe("Mobile NFC hub", () => {
  beforeEach(() => {
    localStorage.clear()
    bridge.available = false
    bridge.scan.mockClear()
    bridge.read.mockReset()
    bridge.write.mockReset()
    bridge.scan.mockImplementation(async () => {
      if (!bridge.available) throw new Error("NFC is only in the iPhone app.")
      return { id: "04a1b2c3" }
    })
    bridge.read.mockImplementation(async () => {
      if (!bridge.available) throw new Error("NFC is only in the iPhone app.")
      return { text: "" }
    })
    bridge.write.mockImplementation(async () => {
      if (!bridge.available) throw new Error("NFC is only in the iPhone app.")
    })
    client.load.mockClear()
    client.send.mockClear()
    client.send.mockResolvedValue({ ok: true, status: "ok", reply: "Logged left" })
  })

  it("shows the radio is missing, and a tap says the iPhone app is required", async () => {
    render(<MobileNfcHubScreen />)
    expect(screen.getByRole("heading", { name: "NFC hub" })).toBeTruthy()
    expect(screen.getByText(/This browser cannot use the radio/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Read tag" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("NFC is only in the iPhone app.")
  })

  it("writes the testing-settings record and reads it back onto the phone", async () => {
    bridge.available = true
    bridge.read.mockResolvedValue({
      text: JSON.stringify({
        k: "b2test",
        o: "http://other.local:8787",
        t: "from-tag",
        s: "http://other.local:3000",
      }),
    })
    render(<MobileNfcHubScreen />)

    fireEvent.change(screen.getByLabelText("Hub URL"), { target: { value: "http://mac.local:8787/api/scan" } })
    fireEvent.change(screen.getByLabelText("Hub token"), { target: { value: "s3cret" } })
    fireEvent.change(screen.getByLabelText("Sync URL"), { target: { value: "http://192.168.0.150:3000" } })
    fireEvent.click(screen.getByRole("button", { name: "Write testing settings" }))

    await waitFor(() => {
      expect(bridge.write).toHaveBeenCalledWith(
        JSON.stringify({
          k: "b2test",
          o: "http://mac.local:8787",
          t: "s3cret",
          s: "http://192.168.0.150:3000",
        }),
      )
    })
    expect(await screen.findByRole("status")).toHaveTextContent("Testing settings are on the sticker.")

    fireEvent.click(screen.getByRole("button", { name: "Read tag" }))
    expect(await screen.findByRole("button", { name: "Save on this phone" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Save on this phone" }))
    expect(JSON.parse(localStorage.getItem("brain2-nfc-hub") || "{}")).toMatchObject({
      origin: "http://other.local:8787",
      token: "from-tag",
    })
    expect(localStorage.getItem("brain2-mobile-sync-url")).toBe("http://other.local:3000")
  })

  it("says a sticker is blank when the read has no text", async () => {
    bridge.available = true
    render(<MobileNfcHubScreen />)
    fireEvent.click(screen.getByRole("button", { name: "Read tag" }))
    expect(await screen.findByText("This sticker is blank.")).toBeTruthy()
  })

  it("scans a known door through the same hub post", async () => {
    bridge.available = true
    localStorage.setItem("brain2-nfc-chips", JSON.stringify({ "04a1b2c3": "door" }))
    render(<MobileNfcHubScreen />)
    fireEvent.change(screen.getByLabelText("Hub URL"), { target: { value: "http://mac.local:8787" } })
    fireEvent.change(screen.getByLabelText("Hub token"), { target: { value: "s3cret" } })
    fireEvent.click(screen.getByRole("button", { name: "Scan sticker" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Logged left")
    expect(client.send).toHaveBeenCalledWith({ origin: "http://mac.local:8787", token: "s3cret" }, "nfc:door")
  })
})
