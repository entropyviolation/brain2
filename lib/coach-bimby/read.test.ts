import { describe, expect, it } from "vitest"
import { parseAboutMe, parseCoachAsk, parseCoachPrefs, parseForget, parseMeAsk, parseTimedReminder } from "./read"

// Sunday 2026-11-22, 14:10 local.
const NOW = new Date(2026, 10, 22, 14, 10)
const at = (r: ReturnType<typeof parseTimedReminder>) => (r ? `${r.when.getMonth() + 1}/${r.when.getDate()} ${String(r.when.getHours()).padStart(2, "0")}:${String(r.when.getMinutes()).padStart(2, "0")} ${r.repeat} · ${r.what}` : null)

describe("timed reminders", () => {
  it("reads a clock before or after the thing", () => {
    expect(at(parseTimedReminder("remind me at 5pm to call mom", NOW))).toBe("11/22 17:00 once · Call mom")
    expect(at(parseTimedReminder("remind me to call mom at 5pm", NOW))).toBe("11/22 17:00 once · Call mom")
    expect(at(parseTimedReminder("remind me to call mom at 5", NOW))).toBe("11/22 17:00 once · Call mom")
  })
  it("reads a day and a part of day", () => {
    expect(at(parseTimedReminder("remind me tomorrow at 9 to pay rent", NOW))).toBe("11/23 09:00 once · Pay rent")
    expect(at(parseTimedReminder("remind me to pay rent tomorrow morning", NOW))).toBe("11/23 09:00 once · Pay rent")
    expect(at(parseTimedReminder("remind me to take out trash tonight", NOW))).toBe("11/22 21:00 once · Take out trash")
    expect(at(parseTimedReminder("remind me on friday to email Dana", NOW))).toBe("11/27 09:00 once · Email Dana")
    expect(at(parseTimedReminder("text me friday at 3pm to email Dana", NOW))).toBe("11/27 15:00 once · Email Dana")
  })
  it("reads in N minutes / hours", () => {
    expect(at(parseTimedReminder("remind me in 20 minutes to check the oven", NOW))).toBe("11/22 14:30 once · Check the oven")
    expect(at(parseTimedReminder("remind me to stretch in an hour", NOW))).toBe("11/22 15:10 once · Stretch")
  })
  it("reads a repeat", () => {
    expect(at(parseTimedReminder("remind me every day at 8am to stretch", NOW))).toBe("11/23 08:00 daily · Stretch")
    expect(at(parseTimedReminder("remind me to take my meds every morning", NOW))).toBe("11/23 09:00 daily · Take my meds")
    expect(at(parseTimedReminder("remind me every monday at 10 to plan the week", NOW))).toBe("11/23 10:00 weekly · Plan the week")
  })
  it("leaves To Dos and cues alone", () => {
    expect(parseTimedReminder("remind me to water the plants", NOW)).toBeNull()
    expect(parseTimedReminder("remind me to stretch if i sit too long", NOW)).toBeNull()
    expect(parseTimedReminder("remind me what my goals are", NOW)).toBeNull()
  })
})

describe("about me", () => {
  it("keeps goals, said in a list", () => {
    expect(parseAboutMe("my goals are to get really good at chess, swim more and launch my shop")).toEqual({ kind: "goal", texts: ["get really good at chess", "swim more", "launch my shop"] })
    expect(parseAboutMe("my main goal this year is to move to new york")).toEqual({ kind: "goal", texts: ["move to new york"] })
    expect(parseAboutMe("I'm working toward a solo show")).toEqual({ kind: "goal", texts: ["a solo show"] })
  })
  it("keeps first-person remembers, not other facts", () => {
    expect(parseAboutMe("remember that I hate mornings")).toEqual({ kind: "dislike", texts: ["I hate mornings"] })
    expect(parseAboutMe("about me: im a graphic designer")).toEqual({ kind: "who", texts: ["I'm a graphic designer"] })
    expect(parseAboutMe("remember that the gate code is 4412")).toBeNull()
    expect(parseAboutMe("my goal?")).toBeNull()
  })
})

describe("asks, forget, coach, prefs", () => {
  it("reads them", () => {
    expect(parseMeAsk("what do you know about me?")).toBe("all")
    expect(parseMeAsk("what are my goals")).toBe("goals")
    expect(parseForget("forget that I hate mornings")).toBe("I hate mornings")
    expect(parseForget("remove milk from groceries")).toBeNull()
    expect(parseCoachAsk("what should I do now?")).toBe("now")
    expect(parseCoachAsk("coach me")).toBe("now")
    expect(parseCoachAsk("morning brief")).toBe("morning")
    expect(parseCoachAsk("am i on track with my goals?")).toBe("goals-check")
    expect(parseCoachPrefs("morning brief at 8am")?.patch).toEqual({ morning: "08:00", morningOn: true, on: true })
    expect(parseCoachPrefs("evening check-in at 10")?.patch).toEqual({ evening: "22:00", eveningOn: true, on: true })
    expect(parseCoachPrefs("stop the morning brief")?.patch).toEqual({ morningOn: false })
    expect(parseCoachPrefs("turn off coach texts")?.patch).toEqual({ on: false })
  })
})

describe("lines that are not the coach's", () => {
  const LATE = new Date(2026, 10, 22, 16, 30)
  it("reads a bare hour already past both ways as the next day's hour, never 4am or midnight", () => {
    expect(at(parseTimedReminder("remind me at 4 to call mom", LATE))).toBe("11/23 16:00 once · Call mom")
    expect(at(parseTimedReminder("remind me at 12 to eat", LATE))).toBe("11/23 12:00 once · Eat")
  })
  it("keeps a bare short day name as a word, and a question word inside the thing", () => {
    expect(parseTimedReminder("remind me to go sit in the sun", NOW)).toBeNull()
    expect(parseTimedReminder("remind me to check the sat results", NOW)).toBeNull()
    expect(at(parseTimedReminder("remind me to ask when the store opens at 5pm", NOW))).toBe("11/22 17:00 once · Ask when the store opens")
    expect(parseTimedReminder("remind me when I get home to call mom", NOW)).toBeNull()
  })
  it("leaves “don't forget …” to the keep lane and an undo to its own lane", () => {
    expect(parseAboutMe("don't forget my keys")).toBeNull()
    expect(parseAboutMe("don't forget I have a dentist appointment at 3")).toBeNull()
    expect(parseForget("delete that")).toBeNull()
    expect(parseForget("remove the last one")).toBeNull()
    expect(parseForget("forget that I hate mornings")).toBe("I hate mornings")
  })
})
