import { beforeEach, describe, expect, it } from "vitest"
import { useTaskStore } from "@/lib/task-store"
import { findRemindersList } from "@/lib/reminders"
import { tryCoach, tryRemind, telegramCoachFirst } from "./apply"
import { aboutBlock } from "./context"
import { grounded, learnFromLine, worthLearning } from "./learn"
import { DEFAULT_COACH_PREFS, useMeStore } from "./me-store"
import { coachTick } from "./tick"

const NOW = new Date(2026, 10, 22, 14, 10)

beforeEach(() => {
  useMeStore.setState({ notes: [], prefs: { ...DEFAULT_COACH_PREFS } })
})

describe("memory of you", () => {
  it("keeps, lists and forgets", async () => {
    expect((await tryCoach("my goals are to swim more and launch my shop", NOW))?.text).toMatch(/swim more; launch my shop/)
    expect((await tryCoach("remember that I hate mornings", NOW))?.route).toBe("ME · remember · code")
    const all = (await tryCoach("what do you know about me?", NOW))!.text
    expect(all).toMatch(/Your goals:\n• swim more\n• launch my shop/)
    expect(all).toMatch(/You don't like:\n• I hate mornings/)
    expect((await tryCoach("forget that i hate mornings", NOW))?.text).toBe("Forgotten: I hate mornings.")
    expect(useMeStore.getState().notes.map((n) => n.text)).toEqual(["swim more", "launch my shop"])
    expect(aboutBlock(NOW)).toMatch(/GOALS:\n- swim more/)
  })
  it("does not keep the same thing twice", async () => {
    await tryCoach("my goal is to swim more", NOW)
    await tryCoach("my goal is to swim more.", NOW)
    expect(useMeStore.getState().notes).toHaveLength(1)
  })
  it("leaves other lines alone", async () => {
    expect(await tryCoach("remember that the gate code is 4412", NOW)).toBeNull()
    expect(await tryCoach("forget the milk from groceries", NOW)).toBeNull()
    expect(await tryCoach("bought milk", NOW)).toBeNull()
  })
})

describe("coaching", () => {
  it("answers in code with no model", async () => {
    const said = await tryCoach("what should I do now?", NOW)
    expect(said?.route).toBe("COACH · now · code")
    expect(said?.text).toMatch(/To Do/)
  })
  it("uses the model when one answers, and code when it fails", async () => {
    const call = async () => ({ reply: "Start the shop listing. What's the first photo you need?" })
    expect((await tryCoach("coach me", NOW, { call, model: "qwen2.5:14b-instruct" }))?.text).toMatch(/shop listing/)
    const broken = async () => {
      throw new Error("down")
    }
    expect((await tryCoach("coach me", NOW, { call: broken, model: "m" }))?.route).toBe("COACH · now · code")
  })
  it("sets the switches", async () => {
    await tryCoach("morning brief at 7:30am", NOW)
    await tryCoach("stop the evening check-in", NOW)
    expect(useMeStore.getState().prefs).toMatchObject({ morning: "07:30", morningOn: true, eveningOn: false })
  })
})

describe("timed reminders", () => {
  it("files a Reminder that texts", () => {
    const said = tryRemind("remind me at 5pm to call mom", NOW)
    expect(said?.text).toBe("Okay. I'll text you Nov 22 · 5:00 PM: Call mom.")
    const list = findRemindersList(useTaskStore.getState().lists)!
    const row = useTaskStore.getState().tasks.find((t) => (t.lists ?? []).includes(list.id) && t.title === "Call mom")
    expect(row?.scheduledTime).toBe("17:00")
  })
  it("answers a Telegram line before the executor, and lets the rest through", async () => {
    expect(await telegramCoachFirst("remind me in 20 minutes to check the oven", NOW)).toMatch(/2:30 PM: Check the oven/)
    expect(await telegramCoachFirst("log: coffee", NOW)).toBeNull()
    expect(await telegramCoachFirst("bought milk", NOW)).toBeNull()
  })
})

describe("learning", () => {
  it("keeps only lasting, stated facts", async () => {
    expect(worthLearning("lol")).toBe(false)
    expect(worthLearning("what time is it?")).toBe(false)
    expect(worthLearning("i work as a tattoo artist in brooklyn")).toBe(true)
    expect(grounded("i work as a tattoo artist in brooklyn", "I work as a tattoo artist")).toBe(true)
    expect(grounded("i work as a tattoo artist in brooklyn", "I love painting")).toBe(false)
    // The model added a city the line never said.
    expect(grounded("my sister dana is visiting next week", "My sister Dana lives in Ohio")).toBe(false)
    const call = async () => ({ facts: [{ kind: "who", text: "I work as a tattoo artist" }, { kind: "like", text: "I love painting" }] })
    const kept = await learnFromLine("i work as a tattoo artist in brooklyn", call, "m", NOW)
    expect(kept.map((n) => n.text)).toEqual(["I work as a tattoo artist"])
    expect(kept[0]!.source).toBe("learned")
  })
})

describe("coach texts", () => {
  it("sends each once a day, at or after its time, and skips a slot hours late", async () => {
    const sent: string[] = []
    const send = async (t: string) => {
      sent.push(t)
      return true
    }
    expect(await coachTick(new Date(2026, 10, 22, 8, 59), send)).toEqual([])
    expect(await coachTick(new Date(2026, 10, 22, 9, 0), send)).toEqual(["morning"])
    expect(await coachTick(new Date(2026, 10, 22, 9, 1), send)).toEqual([])
    expect(sent[0]).toMatch(/^Good morning\./)
    // Evening at 21:30; the hub came up at 23:45, too late.
    expect(await coachTick(new Date(2026, 10, 22, 23, 45), send)).toEqual([])
    expect(useMeStore.getState().prefs.lastEvening).toBe("2026-11-22")
    useMeStore.getState().setPrefs({ on: false })
    expect(await coachTick(new Date(2026, 10, 23, 9, 5), send)).toEqual([])
  })
})
