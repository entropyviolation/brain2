import { describe, expect, it } from "vitest"
import { matchPerson, type PhonePerson } from "./people"

const PEOPLE: PhonePerson[] = [
  { id: "p-jane", name: "Jane Doe", phones: ["(555) 123-4567"] },
  { id: "p-eli", name: "Elijah", nicknames: ["Eli"], emails: ["Eli@Example.com"] },
]

describe("matchPerson", () => {
  it("matches a saved phone in any spelling", () => {
    expect(matchPerson({ handle: "+15551234567" }, PEOPLE)).toEqual({ status: "handle", personId: "p-jane", name: "Jane Doe" })
  })

  it("matches a saved email case-insensitively", () => {
    expect(matchPerson({ handle: "eli@example.com" }, PEOPLE)).toMatchObject({ status: "handle", personId: "p-eli" })
  })

  it("falls back to the Contacts name, nicknames included", () => {
    expect(matchPerson({ handle: "+15550000000", displayName: "Eli" }, PEOPLE)).toMatchObject({ status: "name", personId: "p-eli", name: "Elijah" })
  })

  it("names an unknown party by Contacts name, else the number", () => {
    expect(matchPerson({ handle: "+15550000000", displayName: "Dentist" }, PEOPLE)).toEqual({ status: "unknown", name: "Dentist" })
    expect(matchPerson({ handle: "5550000000" }, PEOPLE)).toEqual({ status: "unknown", name: "+1 (555) 000-0000" })
  })
})
