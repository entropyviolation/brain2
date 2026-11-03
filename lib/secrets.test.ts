import { describe, expect, it } from "vitest"
import { createPassphraseRecord, isSecret, secretIds, verifyPassphrase, withoutSecrets } from "@/lib/secrets"
import { searchItems } from "@/lib/search"
import type { Item } from "@/lib/types"

const item = (id: string, title: string, extra: Partial<Item> = {}): Item => ({ id, title, createdAt: new Date(0), ...extra })

describe("secret items", () => {
  const crush = item("a", "Crush on Sam", { secret: true, tags: ["sam"] })
  const plain = item("b", "Lunch with Sam")

  it("flags and filters", () => {
    expect(isSecret(crush)).toBe(true)
    expect(isSecret(plain)).toBe(false)
    expect(withoutSecrets([crush, plain]).map((i) => i.id)).toEqual(["b"])
    expect(withoutSecrets([crush, plain], true)).toHaveLength(2)
    expect([...secretIds([crush, plain])]).toEqual(["a"])
  })

  it("search hides secrets by default and shows them on request", () => {
    expect(searchItems("sam", [crush, plain]).map((r) => r.item.id)).toEqual(["b"])
    expect(searchItems("sam", [crush, plain], { includeSecrets: true }).map((r) => r.item.id).sort()).toEqual(["a", "b"])
  })

  it("matches a secret only by its own text, not a hidden hit", () => {
    expect(searchItems("crush", [crush, plain])).toEqual([])
  })
})

describe("passphrase", () => {
  it("verifies the right one only", async () => {
    const record = await createPassphraseRecord("hunter22")
    expect(await verifyPassphrase("hunter22", record)).toBe(true)
    expect(await verifyPassphrase("hunter23", record)).toBe(false)
    expect(record.hash).not.toContain("hunter22")
  })
})

import { secretHandles, visibleDayNotes, buildHistory } from "@/lib/bim-flow/store-snapshot"
import { withoutSecrets as hide } from "@/lib/secrets"
import type { Task } from "@/lib/types"

describe("secret day notes, entries, people", () => {
  it("drops secret day notes unless included", () => {
    const notes = { "2026-11-01": "ok", "2026-11-02": "crush on Sam" }
    expect(visibleDayNotes(notes, { "2026-11-02": true }, false)).toEqual({ "2026-11-01": "ok" })
    expect(visibleDayNotes(notes, { "2026-11-02": true }, true)).toEqual(notes)
  })

  it("keeps secret entries out of history", () => {
    const base = { date: "2026-11-02", scopeId: "s", penId: "p", startMin: 0, endMin: 30 }
    const entries: { date: string; scopeId: string; penId: string; startMin: number; endMin: number; notes: string; secret?: boolean }[] = [
      { ...base, notes: "public" },
      { ...base, notes: "urinary pain", secret: true },
    ]
    const h = buildHistory({ entries: hide(entries, false), scopes: [], feed: [], tasks: [], dayNotes: {} })
    expect(h.entries.map((e) => e.text)).toEqual(["public"])
  })

  it("lists handles of secret people only", () => {
    const person = (secret: boolean, phone: string) =>
      ({ id: phone, type: "person", secret, personProfile: { phones: [phone] } }) as unknown as Task
    expect(secretHandles([person(true, "+1555"), person(false, "+1666")])).toEqual(["+1555"])
  })
})
