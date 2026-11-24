import { describe, expect, it } from "vitest"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { Goal, List, Task } from "@/lib/types"
import { memoryLines, recall } from "./memory"
import { DEFAULT_PROMPTS, fillPrompt, promptFor, slotsIn } from "./prompts"
import { areaItemIds, areaLines, readArea, type AreaVault } from "./read"
import { checkAsk, checkCouncilReply, checkReply, scriptedReply, twoSentences } from "./reply"
import { councilAnswer, councilAsk, geniusContext, speak, voicePrompt } from "./run"
import { dropDangling, MAX_ACTIVE, sanitizeGenius, sanitizeGeniuses, sanitizeMeeting, sanitizeTalk } from "./sanitize"
import { starterGeniuses } from "./starters"
import { sanitizeGeniusesState, sanitizePrompts } from "./store"
import type { CouncilMeeting, Genius, GeniusTalk } from "./types"

const NOW = new Date("2026-11-24T18:00:00Z")
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, lists: [], completed: false, stage: "list", ...extra }) as unknown as Task

function muse(extra: Partial<Genius> = {}): Genius {
  const g = starterGeniuses(NOW.toISOString()).find((x) => x.id === "genius-muse")!
  return { ...g, bindings: { ...g.bindings, listIds: ["album"] }, ...extra }
}

const vault = (tasks: Task[]): AreaVault => ({
  tasks,
  lists: [{ id: "album", name: "Album" } as List],
  habits: [],
  weeklyData: {},
  goals: [{ id: "g1", title: "Release the album", current: 3, target: 10, unit: "songs", completed: false, objectiveIds: [] } as unknown as Goal],
  objectives: [],
  now: NOW,
})

describe("sanitize", () => {
  it("round-trips a starter", () => {
    const g = starterGeniuses()[0]!
    expect(sanitizeGenius(JSON.parse(JSON.stringify(g)))).toEqual(g)
  })
  it("refuses a genius with no id or name, and clamps the charter", () => {
    expect(sanitizeGenius({ name: "x" })).toBeNull()
    expect(sanitizeGenius({ id: "a", name: "A", charter: "z".repeat(999) })!.charter).toHaveLength(280)
  })
  it("rests geniuses past the active cap", () => {
    const rows = Array.from({ length: MAX_ACTIVE + 2 }, (_, i) => ({ id: `g${i}`, name: `G${i}` }))
    const out = sanitizeGeniuses(rows)
    expect(out.filter((g) => g.status === "active")).toHaveLength(MAX_ACTIVE)
    expect(out.at(-1)!.status).toBe("resting")
  })
  it("drops dangling binding ids, keeps the genius", () => {
    const g = muse({ bindings: { objectiveIds: ["o-gone"], goalIds: ["g1"], listIds: ["album", "gone"], habitIds: [], rootItemIds: ["r-gone"] } })
    const out = dropDangling(g, { objectiveIds: new Set(), goalIds: new Set(["g1"]), listIds: new Set(["album"]), habitIds: new Set(), itemIds: new Set() })
    expect(out.bindings).toEqual({ objectiveIds: [], goalIds: ["g1"], listIds: ["album"], habitIds: [], rootItemIds: [] })
  })
  it("caps a talk at twelve lines and drops a meeting pick that was not in it", () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ who: "you", text: `l${i}` }))
    expect(sanitizeTalk({ id: "t", geniusId: "g", task: "x", lines })!.lines).toHaveLength(12)
    expect(sanitizeMeeting({ id: "m", topic: "tonight", geniusIds: ["a"], pickedId: "b" })!.pickedId).toBeNull()
  })
  it("an empty store loads the starters; prompt overrides keep only known ids", () => {
    expect(sanitizeGeniusesState(undefined).geniuses.map((g) => g.name)).toEqual(["Hearth", "Coin", "Muse"])
    expect(sanitizePrompts({ voice: { system: "hi" }, nope: { system: "x" } })).toEqual({ voice: { system: "hi" } })
  })
  it("drops talks of a genius that is gone", () => {
    const s = sanitizeGeniusesState({ geniuses: [{ id: "a", name: "A" }], talks: [{ id: "t", geniusId: "b", task: "x" }] })
    expect(s.talks).toEqual([])
  })
})

describe("area read", () => {
  it("counts items on bound lists and under bound roots, never secrets", () => {
    const tasks = [
      task("a", { lists: ["album"] }),
      task("s", { lists: ["album"], secret: true }),
      task("root"),
      task("kid", { parentTaskId: "root" }),
      task("off", { lists: ["other"] }),
    ]
    const g = muse({ bindings: { objectiveIds: [], goalIds: [], listIds: ["album"], habitIds: [], rootItemIds: ["root"] } })
    expect([...areaItemIds(g, tasks)].sort()).toEqual(["a", "kid", "root"])
  })
  it("says when the area stalled", () => {
    const r = readArea(muse({ bindings: { objectiveIds: [], goalIds: ["g1"], listIds: ["album"], habitIds: [], rootItemIds: [] } }), vault([
      task("mix", { lists: ["album"] }),
      task("demo", { lists: ["album"], completed: true, completedDate: new Date("2026-11-15T12:00:00Z") }),
    ]))
    expect(r.openCount).toBe(1)
    expect(r.stalledDays).toBe(9)
    expect(areaLines(r)).toContain("GOAL: Release the album (3 of 10 songs)")
  })
  it("an unbound genius says so", () => {
    expect(areaLines(readArea(starterGeniuses()[0]!, vault([])))).toMatch(/not bound/)
  })
})

describe("memory", () => {
  const g = muse({ notes: [{ id: "n", at: "2026-11-20T00:00:00Z", said: "I hate working at night", about: null, source: "you" }] })
  const talks: GeniusTalk[] = [
    { id: "t1", geniusId: g.id, startedAt: "2026-11-22T00:00:00Z", task: "Mix track 2", taskId: null, outcome: "conceded", lines: [{ at: "x", who: "you", text: "no stems yet" }] },
    { id: "t2", geniusId: "other", startedAt: "2026-11-23T00:00:00Z", task: "Budget", taskId: null, outcome: "open", lines: [{ at: "x", who: "you", text: "secret of coin" }] },
  ]
  const meetings: CouncilMeeting[] = [
    { id: "m", at: "2026-11-23T00:00:00Z", topic: "Tonight", geniusIds: [g.id, "genius-coin"], asks: [{ geniusId: g.id, ask: "Studio time", why: "", by: "model" }], replies: [], pickedId: "genius-coin", pickNote: "rent is due" },
  ]
  it("remembers its own notes, talks and councils, not another genius's talk", () => {
    const text = memoryLines(g, recall(g, talks, meetings), { "genius-coin": "Coin" })
    expect(text).toContain("I hate working at night")
    expect(text).toContain(`"Mix track 2": they said "no stems yet"; you conceded`)
    expect(text).toContain(`you asked "Studio time"; the time went to Coin ("rent is due")`)
    expect(text).not.toContain("secret of coin")
  })
  it("leaves out the talk being had now", () => {
    expect(recall(g, talks, meetings, undefined, "t1").talks).toEqual([])
  })
})

describe("prompts", () => {
  it("fills slots and keeps unknown ones visible", () => {
    expect(fillPrompt("hi {{name}} {{nope}}", { name: "Muse" })).toBe("hi Muse {{nope}}")
    expect(slotsIn(DEFAULT_PROMPTS.voice.user)).toEqual(["memory", "areaRead", "task", "thread", "said"])
  })
  it("an override replaces only its half", () => {
    expect(promptFor("voice", { voice: { system: "S" } })).toEqual({ system: "S", user: DEFAULT_PROMPTS.voice.user })
  })
  it("the voice prompt carries the charter, memory and the task, and flags the last turn", () => {
    const c = geniusContext({ genius: muse(), vault: vault([]), talks: [], meetings: [], names: {} })
    const p = voicePrompt(c, { task: "Mix track 2", lines: [] }, "not tonight")
    expect(p.system).toContain(muse().charter)
    expect(p.user).toContain("THE ASSIGNMENT: Mix track 2")
    expect(p.system).not.toContain("{{")
    const five = Array.from({ length: 5 }, () => ({ at: "x", who: "you" as const, text: "no" }))
    expect(voicePrompt(c, { task: "x", lines: five }, "no").system).toContain("must concede or reschedule")
  })
})

describe("reply checks", () => {
  it("keeps two sentences", () => {
    expect(twoSentences("One. Two! Three?")).toBe("One. Two!")
  })
  it("refuses bad JSON shapes, long lines, shame, and pressing on the last turn", () => {
    expect(checkReply(null, 1).ok).toBe(false)
    expect(checkReply({ line: "x".repeat(300), stance: "press" }, 1).ok).toBe(false)
    expect(checkReply({ line: "Don't be lazy.", stance: "press" }, 1).ok).toBe(false)
    expect(checkReply({ line: "Try it.", stance: "shout" }, 1).ok).toBe(false)
    expect(checkReply({ line: "Try it.", stance: "split" }, 1).ok).toBe(false)
    expect(checkReply({ line: "Try it.", stance: "press" }, 6).ok).toBe(false)
    expect(checkReply({ line: "Fair.", stance: "concede" }, 6).ok).toBe(true)
  })
  it("keeps a note it would like to remember", () => {
    const c = checkReply({ line: "Got it.", stance: "soften", keep: { said: "no stems yet" } }, 1)
    expect(c.ok && c.value.keep).toEqual({ said: "no stems yet", about: null })
  })
  it("the script reschedules to the time you named and concedes on the last turn", () => {
    expect(scriptedReply({ turn: 1, said: "tomorrow morning", task: "x" })).toMatchObject({ stance: "reschedule", when: "tomorrow" })
    expect(scriptedReply({ turn: 6, said: "no", task: "x" }).stance).toBe("concede")
    expect(scriptedReply({ turn: 2, said: "meh", task: "Mix" })).toMatchObject({ stance: "split", smaller: "Start Mix, five minutes" })
  })
  it("council: yieldsTo maps names to ids, never to itself", () => {
    const ids = { coin: "genius-coin", muse: "genius-muse" }
    const a = checkCouncilReply({ line: "Coin first.", yieldsTo: "Coin" }, "genius-muse", ids)
    expect(a.ok && a.value.yieldsTo).toBe("genius-coin")
    const b = checkCouncilReply({ line: "Me.", yieldsTo: "Muse" }, "genius-muse", ids)
    expect(b.ok && b.value.yieldsTo).toBeNull()
    expect(checkAsk({ ask: "" }, "g").ok).toBe(false)
  })
})

describe("run", () => {
  const c = () => geniusContext({ genius: muse(), vault: vault([task("mix", { lists: ["album"] })]), talks: [], meetings: [], names: {} })
  const fake = (out: unknown): ModelCall => async () => out
  it("uses the model when its JSON passes, and returns the exact prompt sent", async () => {
    const r = await speak({ context: c(), talk: { task: "Mix", lines: [] }, said: "no stems", run: { call: fake({ line: "Then get the stems first.", stance: "split", smaller: "Email Sam for stems" }), ladder: ["m"] } })
    expect(r.by).toBe("model")
    expect(r.value.smaller).toBe("Email Sam for stems")
    expect(r.user).toContain(`THEY SAY NOW: "no stems"`)
  })
  it("falls back to the script on bad JSON, a thrown call, or no model", async () => {
    const bad = await speak({ context: c(), talk: { task: "Mix", lines: [] }, said: "meh", run: { call: fake({ nope: 1 }), ladder: ["m"] } })
    expect(bad).toMatchObject({ by: "script", why: "no line" })
    const down = await speak({ context: c(), talk: { task: "Mix", lines: [] }, said: "meh", run: { call: async () => { throw new Error("Ollama 500") }, ladder: ["m"] } })
    expect(down.by).toBe("script")
    const off = await speak({ context: c(), talk: { task: "Mix", lines: [] }, said: "meh", run: { call: null, ladder: [] } })
    expect(off.why).toBe("model off")
  })
  it("a hand-edited prompt is sent as written", async () => {
    let seen = ""
    const call: ModelCall = async (req) => { seen = req.system; return { line: "Ok.", stance: "concede" } }
    await speak({ context: c(), talk: { task: "Mix", lines: [] }, said: "x", run: { call, ladder: ["m"] }, prompt: { system: "EDITED", user: "U" } })
    expect(seen).toBe("EDITED")
  })
  it("council ask and answer", async () => {
    const ask = await councilAsk({ context: c(), topic: "Tonight", run: { call: fake({ ask: "Two hours on the mix.", why: "Nothing moved in a week." }), ladder: ["m"] } })
    expect(ask.value).toMatchObject({ geniusId: "genius-muse", by: "model" })
    const script = await councilAsk({ context: c(), topic: "Tonight", run: { call: null, ladder: [] } })
    expect(script.value.ask).toContain("mix")
    const ans = await councilAnswer({ context: c(), topic: "Tonight", asks: [ask.value], names: { "genius-coin": "Coin" }, run: { call: fake({ line: "Coin can have it.", yieldsTo: "coin" }), ladder: ["m"] } })
    expect(ans.value.yieldsTo).toBe("genius-coin")
  })
})

describe("a named time", () => {
  it("only reschedule or concede passes when they named a time; the script reschedules to it", () => {
    expect(checkReply({ line: "It has great tips.", stance: "press" }, 2, 6, "I'll start it this weekend").ok).toBe(false)
    expect(checkReply({ line: "This weekend, then.", stance: "reschedule", when: "this weekend" }, 2, 6, "I'll start it this weekend").ok).toBe(true)
    expect(scriptedReply({ turn: 2, said: "I'll start it this weekend", task: "x" })).toMatchObject({ stance: "reschedule", when: "this weekend" })
  })
})
