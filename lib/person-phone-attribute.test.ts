import { describe, expect, it } from "vitest"
import { formatAttributeValue } from "@/components/Lists/attributes/helpers"
import { mergeTypeRegistry } from "@/lib/item-types"
import { personPhoneNumbers } from "@/lib/people-i-know"
import { getPersonTypeDefinition, PERSON_ATTR, PERSON_TYPE_ID } from "@/lib/person-types"

describe("Phone Number on Person", () => {
  it("is a phone attribute on the Person type", () => {
    const attr = getPersonTypeDefinition().attributes?.find((a) => a.id === PERSON_ATTR.phone)
    expect(attr).toMatchObject({ name: "Phone Number", type: "phone" })
  })

  it("is added to a Person type saved before it existed", () => {
    const old = { ...getPersonTypeDefinition(), attributes: [{ id: "birthday", name: "Birthday", type: "datetime" as const }] }
    const person = mergeTypeRegistry([old]).find((t) => t.id === PERSON_TYPE_ID)
    expect(person?.attributes?.map((a) => a.id)).toEqual(["birthday", "phone"])
  })

  it("reads the attribute first, then the older profile list", () => {
    expect(personPhoneNumbers({ attributes: { phone: ["+15551234567", "+15559990000"] } })).toEqual(["+15551234567", "+15559990000"])
    expect(personPhoneNumbers({ personProfile: { phones: ["+15551234567"] } })).toEqual(["+15551234567"])
  })

  it("shows numbers readably", () => {
    expect(formatAttributeValue({ id: "phone", name: "Phone Number", type: "phone" }, ["+15551234567", "+447700900000"])).toBe(
      "+1 (555) 123-4567, +447700900000",
    )
  })
})
