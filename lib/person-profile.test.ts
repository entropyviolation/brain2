import { describe, expect, it } from "vitest"
import {
  birthdaySentence,
  calendarSpan,
  cleanPersonProfile,
  daysUntilBirthday,
  formatSpan,
  knownForSentence,
  lastSawSentence,
  lastTogetherDate,
  normalizeInstagram,
  ymdFromDate,
} from "@/lib/person-profile"

describe("person profile spans", () => {
  it("counts years, months, and days from the date met", () => {
    expect(calendarSpan("2020-01-15", "2026-10-10")).toEqual({ years: 6, months: 8, days: 25 })
    expect(formatSpan({ years: 6, months: 8, days: 25 })).toBe("6 years, 8 months, 25 days")
    expect(knownForSentence("2020-01-15", false, "2026-10-10")).toBe("6 years, 8 months, 25 days.")
    expect(knownForSentence("2020-01-15", true, "2026-10-10")).toBe("About 6 years, 8 months, 25 days.")
    expect(knownForSentence(undefined, false, "2026-10-10")).toBe("Date met is not set.")
    expect(knownForSentence("2026-10-10", false, "2026-10-10")).toBe("Just met.")
    expect(knownForSentence("2026-12-01", false, "2026-10-10")).toBe("That date is still ahead.")
  })

  it("reads last seen from a saw-interaction and from joined company paint", () => {
    const profile = cleanPersonProfile({
      interactions: [
        { id: "call", date: "2026-10-09", text: "Called", saw: false },
        { id: "coffee", date: "2026-10-01", text: "Coffee", saw: true },
      ],
    })
    const last = lastTogetherDate(
      profile,
      [
        { kind: "company-pen", penId: "co-together" },
        { kind: "company-timeblock", entryId: "block-1" },
      ],
      [
        { id: "other", date: "2026-10-20", penId: "act-work" },
        { id: "painted", date: "2026-09-02", penId: "co-together" },
        { id: "block-1", date: "2026-10-08", penId: "co-alone" },
      ],
    )
    expect(last).toBe("2026-10-08")
    expect(lastSawSentence(last, "2026-10-10")).toBe("2 days ago.")
    expect(lastSawSentence("2026-10-10", "2026-10-10")).toBe("Today.")
    expect(lastSawSentence(undefined, "2026-10-10")).toBe("No time together recorded yet.")
  })

  it("counts a block painted with their pen without a timeblock row", () => {
    expect(
      lastTogetherDate(undefined, [{ kind: "company-pen", penId: "co-together" }], [
        { id: "painted", date: "2026-10-07", penId: "co-together" },
        { id: "other", date: "2026-10-09", penId: "co-alone" },
      ]),
    ).toBe("2026-10-07")
  })

  it("counts days until the next birthday, and reads February 29 on March 1 in a common year", () => {
    expect(daysUntilBirthday("1990-10-12", { y: 2026, m: 10, d: 10 })).toBe(2)
    expect(daysUntilBirthday("1990-10-10", { y: 2026, m: 10, d: 10 })).toBe(0)
    expect(daysUntilBirthday("1990-10-09", { y: 2026, m: 10, d: 10 })).toBe(364)
    expect(daysUntilBirthday("2000-02-29", { y: 2024, m: 2, d: 29 })).toBe(0)
    expect(daysUntilBirthday("2000-02-29", { y: 2026, m: 2, d: 28 })).toBe(1)
    expect(daysUntilBirthday("2000-02-29", { y: 2026, m: 3, d: 1 })).toBe(0)
    expect(daysUntilBirthday(undefined, ymdFromDate(new Date(2026, 9, 10)))).toBeNull()
    expect(birthdaySentence(2)).toBe("2 days until next birthday.")
    expect(birthdaySentence(0)).toBe("Birthday today.")
    expect(birthdaySentence(null)).toBe("No birthday yet.")
  })

  it("keeps a real biography and drops a blank one", () => {
    expect(
      cleanPersonProfile({
        fullName: "  Ada Lovelace ",
        nicknames: [" Ada ", "ada", "A.L."],
        dateMet: "2019-04-01",
        dateMetEstimated: true,
        instagram: "  @ada ",
        address: { precision: "neighborhood", text: "  SoMa " },
        noteLog: [{ id: "n1", date: "2026-01-02", text: " Brought soup " }],
        giftIdeas: [{ id: "g1", text: " Notebook ", given: true }],
      }),
    ).toEqual({
      fullName: "Ada Lovelace",
      nicknames: ["Ada", "A.L."],
      dateMet: "2019-04-01",
      dateMetEstimated: true,
      instagram: "ada",
      address: { precision: "neighborhood", text: "SoMa" },
      noteLog: [{ id: "n1", date: "2026-01-02", text: "Brought soup" }],
      giftIdeas: [{ id: "g1", text: "Notebook", given: true }],
    })
    expect(cleanPersonProfile({ fullName: "  ", nicknames: [" "], dateMetEstimated: true })).toBeUndefined()
    expect(cleanPersonProfile({ relation: "  sister ", close: true, giftIdeas: [{ id: "g1", text: "Pen" }] })).toEqual({
      relation: "sister",
      close: true,
      giftIdeas: [{ id: "g1", text: "Pen" }],
    })
    expect(cleanPersonProfile({ relation: "   ", close: false })).toBeUndefined()
    expect(cleanPersonProfile({ close: true })).toEqual({ close: true })
    expect(normalizeInstagram("https://instagram.com/ada/?hl=en")).toBe("ada")
    expect(normalizeInstagram("@ada")).toBe("ada")
  })
})
