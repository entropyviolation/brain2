import { describe, expect, it } from "vitest"
import { tallyTextPeople } from "./phone-sync/text-people.mjs"
import { planTextPeople } from "./texts-people-bimby"

const msg = (handle: string, direction: "in" | "out", at: number, members?: unknown[]) => ({
  type: "message",
  at,
  direction,
  party: { handle },
  ...(members ? { members } : {}),
})

describe("tallyTextPeople", () => {
  it("keeps one-to-one handles with texts both ways since the floor", () => {
    const rows = tallyTextPeople(
      [
        msg("(555) 123-4567", "in", 200),
        msg("+15551234567", "out", 300),
        msg("+15550000001", "in", 300), // only inbound
        msg("+15550000002", "in", 50), // too old
        msg("+15550000002", "out", 300),
        msg("+15550000003", "in", 300, [{ handle: "x" }]), // group
        msg("+15550000003", "out", 300, [{ handle: "x" }]),
      ],
      100,
    )
    expect(rows).toEqual([{ handle: "+15551234567", inbound: 1, outbound: 1, last: 300 }])
  })
})

describe("planTextPeople", () => {
  const row = (handle: string) => ({ handle, inbound: 1, outbound: 1, last: 1 })

  it("creates one person per Contacts name, skipping unnamed, owned and done numbers", () => {
    const steps = planTextPeople(
      [row("+15551110001"), row("+15551110002"), row("+15551110003"), row("+15551110004"), row("+15551110005")],
      { "+15551110001": "Ana Ruiz", "+15551110002": "ana ruiz", "+15551110004": "Bo", "+15551110005": "Cy" },
      [{ id: "p1", names: ["Someone"], handles: ["+15551110004"] }],
      new Set(["+15551110005"]),
    )
    expect(steps).toEqual([{ kind: "create", name: "Ana Ruiz", handles: ["+15551110001", "+15551110002"] }])
  })

  it("links to a person who already has that name or nickname", () => {
    const steps = planTextPeople(
      [row("+15551110001")],
      { "+15551110001": "Shelby" },
      [{ id: "p9", names: ["Shelby Seal", "Shelby"], handles: [] }],
      new Set(),
    )
    expect(steps).toEqual([{ kind: "link", personId: "p9", name: "Shelby", handles: ["+15551110001"] }])
  })
})
