/**
 * lib/ingest/bim-resistance.ts — BIM chat's Overcome lane: notice "I can't start", tag it, push, test tactics
 *
 * `tryResistance` runs on a plain line the ladder would only capture. Code detects (`overcome-bimby/detect.ts`); a hit runs the
 * Overcome pipeline, which logs the line as a `chat` resistance entry (the tag) and returns a push whose last tactic is an
 * experiment. Tapping "Started: …" / "Stuck: …" comes back as a line and is marked on that entry. "Stuck" then asks what is in the
 * way (`why: <barrier>`), and a named barrier re-picks tactics for it, skipping what already failed. LLM off means rules only.
 */
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { detectResistance } from "@/lib/overcome-bimby/detect"
import { overcome } from "@/lib/overcome-bimby/run"
import { useOvercomeStore } from "@/lib/overcome-bimby/store"
import { BARRIER_WHY, fillTactic, KIND_HEADING, tacticById, TACTICS } from "@/lib/overcome-bimby/tactics"
import type { Barrier, Tactic } from "@/lib/overcome-bimby/types"

export interface ResistanceReply {
  text: string
  route: string
  choices: { label: string; text: string }[]
}

/** Tactics under their headings ("Shrink the first step", "Cut the decision load"…), the test one marked. */
function grouped(tactics: Tactic[], experiment?: string): string {
  const groups = new Map<string, string[]>()
  for (const t of tactics) {
    const h = KIND_HEADING[t.kind]
    groups.set(h, [...(groups.get(h) ?? []), `• ${t.id === experiment ? "🧪 New to try: " : ""}${t.name}: ${t.do}`])
  }
  return [...groups].map(([h, xs]) => `${h}\n${xs.join("\n")}`).join("\n\n")
}

const tapChoices = (tactics: Tactic[]) =>
  tactics.flatMap((t) => [
    { label: `Started: ${t.name}`, text: `started: ${t.name}` },
    { label: `Stuck: ${t.name}`, text: `stuck: ${t.name}` },
  ])

async function crewFor(llm: boolean) {
  return llm ? await chatCrew().catch(() => null) : null
}

export async function tryResistance(text: string, llm: boolean, now = new Date()): Promise<ResistanceReply | null> {
  const d = detectResistance(text)
  if (!d.hit) return null
  const crew = await crewFor(llm)
  const r = await overcome({ text, call: crew ? ollamaCall(crew.main, AbortSignal.timeout(60_000)) : null, extract: crew?.extract ?? [], prose: crew?.prose ?? [], now, explore: true, source: "chat" })
  return {
    text: `${r.push.message}\n\n${grouped(r.push.tactics, r.experiment)}\n\nTell me which you tried, so I learn what works for you.`,
    route: `RESISTANCE · ${r.reading.barrier} · ${r.reading.task} · ${d.signs.join(", ")} · ${r.readBy === "model" ? "model" : "rules"}`,
    choices: tapChoices(r.push.tactics),
  }
}

/** "started: Two-minute start" / "stuck: …" — marks the newest chat entry that offered that tactic. */
export function tryResistanceOutcome(text: string): ResistanceReply | null {
  const m = /^(started|stuck):\s*(.+)$/i.exec(text.trim())
  if (!m) return null
  const name = m[2]!.trim().toLowerCase()
  const tactic = TACTICS.find((t) => t.name.toLowerCase() === name)
  if (!tactic) return null
  const store = useOvercomeStore.getState()
  const entry = [...store.log].reverse().find((e) => e.source === "chat" && !e.tried && e.offered.includes(tactic.id))
  if (!entry) return null
  const outcome = m[1]!.toLowerCase() === "started" ? "started" : "stuck"
  store.mark(entry.id, tactic.id, outcome)
  if (outcome === "started") {
    return { text: `Good. Logged "${tactic.name}" as a start on ${entry.reading.task}. Reward yourself right after.`, route: "RESISTANCE · started", choices: [] }
  }
  const reset = TACTICS.find((t) => t.id === "reset")!
  return {
    text: `Logged "${tactic.name}" as not working for ${entry.reading.task}. That is data, not failure. ${reset.do}\n\nIf you are still stuck, name why and I will pick different tactics.`,
    route: "RESISTANCE · stuck",
    choices: (Object.keys(BARRIER_WHY) as Barrier[]).filter((b) => b !== "unknown").map((b) => ({ label: BARRIER_WHY[b], text: `why: ${b}` })),
  }
}

/** "why: choices" — the person named what is in the way; pick again for that barrier on the same task. */
export async function tryResistanceWhy(text: string, llm: boolean, now = new Date()): Promise<ResistanceReply | null> {
  const m = /^why:\s*(\w+)$/i.exec(text.trim())
  if (!m || !(m[1]!.toLowerCase() in BARRIER_WHY)) return null
  const barrier = m[1]!.toLowerCase() as Barrier
  const last = [...useOvercomeStore.getState().log].reverse().find((e) => e.source === "chat")
  if (!last) return null
  const crew = await crewFor(llm)
  const r = await overcome({ text: last.said, reading: { ...last.reading, barrier }, call: crew ? ollamaCall(crew.main, AbortSignal.timeout(60_000)) : null, extract: [], prose: crew?.prose ?? [], now, explore: true, source: "chat" })
  return {
    text: `${BARRIER_WHY[barrier]}: fair. Different angle.\n\n${r.push.message}\n\n${grouped(r.push.tactics, r.experiment)}`,
    route: `RESISTANCE · why ${barrier} · ${r.reading.task}`,
    choices: tapChoices(r.push.tactics),
  }
}
