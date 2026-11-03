/**
 * lib/mobile/nfc-scan.test.ts — Chip memory and the line posted to the hub
 */
import { describe, expect, it } from "vitest"
import { nfcTagAsksQuantity, nfcTagCatalog, type NfcTag } from "@/lib/ingest/nfc-tag"
import {
  afterNfcRead,
  forgetNfcChip,
  lineForQuantity,
  nfcHubOrigin,
  normalizeNfcUid,
  readNfcChips,
  readNfcHub,
  rememberNfcChip,
  writeNfcHub,
  type NfcTagCatalogRow,
} from "./nfc-scan"

function memory(): Storage {
  const bag = new Map<string, string>()
  return {
    get length() {
      return bag.size
    },
    clear: () => bag.clear(),
    getItem: (key) => bag.get(key) ?? null,
    key: (index) => [...bag.keys()][index] ?? null,
    removeItem: (key) => bag.delete(key),
    setItem: (key, value) => bag.set(key, value),
  }
}

const adderall: NfcTagCatalogRow = {
  id: "adderall",
  name: "Adderall",
  kind: "instant",
  intakeClass: "drug",
  quantity: 1,
}
const door: NfcTagCatalogRow = { id: "door", name: "Door", kind: "toggle" }
const shower: NfcTagCatalogRow = { id: "shower", name: "Shower", kind: "instant" }

describe("nfc scan client", () => {
  it("asks how many only for a dose", () => {
    expect(nfcTagAsksQuantity(adderall)).toBe(true)
    expect(nfcTagAsksQuantity(door)).toBe(false)
    expect(nfcTagAsksQuantity(shower)).toBe(false)
    const rows = nfcTagCatalog([
      {
        id: "adderall",
        name: "Adderall",
        kind: "instant",
        title: "10 mg adderall",
        intakeClass: "drug",
        quantity: 1,
        leftTitle: "left",
        backTitle: "back",
        habitCredit: "done",
      } satisfies NfcTag,
    ])
    expect(rows[0]).toMatchObject({ id: "adderall", intakeClass: "drug", quantity: 1 })
    expect(rows[0]).not.toHaveProperty("habitCredit")
  })

  it("keeps the hub and the chip map on the phone", () => {
    const store = memory()
    expect(readNfcHub(store)).toBeNull()
    writeNfcHub(store, { origin: "http://mac.local:8787", token: "s3cret" })
    expect(readNfcHub(store)).toEqual({ origin: "http://mac.local:8787", token: "s3cret" })
    expect(nfcHubOrigin("http://mac.local:8787/api/scan")).toBe("http://mac.local:8787")
    expect(nfcHubOrigin("notaurl")).toBeNull()

    rememberNfcChip(store, "04:A1:B2", "adderall")
    expect(readNfcChips(store)).toEqual({ "04a1b2": "adderall" })
    expect(normalizeNfcUid("04:A1:B2")).toBe("04a1b2")
    forgetNfcChip(store, "04a1b2")
    expect(readNfcChips(store)).toEqual({})
  })

  it("posts a door immediately and asks before a dose", () => {
    const tags = [adderall, door, shower]
    expect(afterNfcRead("04a1", {}, tags)).toEqual({ action: "bind", uid: "04a1" })
    expect(afterNfcRead("04a1", { "04a1": "door" }, tags)).toEqual({
      action: "post",
      uid: "04a1",
      tag: door,
      text: "nfc:door",
    })
    expect(afterNfcRead("04a1", { "04a1": "shower" }, tags)).toMatchObject({ action: "post", text: "nfc:shower" })
    expect(afterNfcRead("04a1", { "04a1": "adderall" }, tags)).toMatchObject({ action: "ask", tag: adderall })
    expect(afterNfcRead("04a1", { "04a1": "missing" }, tags)).toEqual({ action: "gone", uid: "04a1", tagId: "missing" })
    expect(lineForQuantity("adderall", "")).toEqual({ text: "nfc:adderall" })
    expect(lineForQuantity("adderall", "2")).toEqual({ text: "nfc:adderall 2" })
    expect(lineForQuantity("adderall", "0")).toHaveProperty("error")
  })
})
