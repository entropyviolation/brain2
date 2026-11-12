/**
 * lib/ingest/bimby-handoff.ts — "send this to tracking bimby: …", "tell habits bimby i did …" in BIM chat
 *
 * A line that names a BIMBY is handed to that BIMBY's own chat store, word for word, as if it had been
 * typed there. BIM chat does not read it, route it, or file it. The BIMBY runs its usual flow (the
 * Tracking BIMBY proposes blocks that wait for Add; the Habits BIMBY proposes cells that wait for Accept).
 * A line that names no BIMBY but reads as a daily-habit log is handed to the Habits BIMBY too (`tryHabitAuto`).
 * The words start after a colon or dash. With "bimby" or "helper" said, no colon is needed:
 * "tell habits bimby i did skincare, stretched". To add a BIMBY, add a row to `TARGETS`.
 */
import { buildContext } from "@/lib/habit-helper/accept"
import { readHabitLog } from "@/lib/habit-helper/auto"
import { openAsks, openProposals, useHabitsBimby } from "@/lib/habit-helper/store"
import { useTrackingHelper } from "@/lib/tracking-helper/store"
import { useFinanceBimby } from "@/lib/finance-bimby/store"
import { trySocial } from "@/lib/social-bimby/run"

export type Handoff = { target: string; payload: string }

type Target = {
  id: string
  label: string
  /** Names the person may say, lowercase, without "bimby" or "helper". */
  names: string[]
  /** Runs the payload in that BIMBY's chat and returns what it answered with. `habitLineId` is the Habits BIMBY line BIM chat draws as a card; `reportId` is a plan the Report card draws. */
  run: (payload: string) => Promise<{ text: string; habitLineId?: string; reportId?: string }>
}

const TARGETS: Target[] = [
  {
    id: "tracking",
    label: "Tracking BIMBY",
    names: ["tracking", "track", "time tracking", "timeblock", "time block"],
    run: async (payload) => {
      const store = useTrackingHelper
      if (store.getState().busy) return { text: "The Tracking BIMBY is still working on something. Send it again in a moment." }
      const before = store.getState().lines.length
      await store.getState().send(payload, { fromBim: true })
      const reply = store.getState().lines.slice(before).reverse().find((l) => l.who === "helper")
      const open = reply?.blocks?.length ?? 0
      const tail = open ? " It waits for your Add; the Inbox shows a notice you can click." : ""
      return { text: `${reply?.text ?? "No answer came back."}${tail}` }
    },
  },
  {
    id: "habits",
    label: "Habits BIMBY",
    names: ["habits", "habit", "daily habits", "daily habit"],
    run: async (payload) => {
      const store = useHabitsBimby
      if (store.getState().busy) return { text: "The Habits BIMBY is still working on something. Send it again in a moment." }
      const before = store.getState().lines.length
      await store.getState().send(payload, { fromBim: true })
      const reply = store.getState().lines.slice(before).reverse().find((l) => l.who === "bimby")
      if (!reply) return { text: "No answer came back." }
      // The rows are drawn under BIM's reply as the BIMBY's own table (`components/Bim/habit-card.tsx`), so they are not repeated as text.
      const waits = openProposals(reply).length || openAsks(reply).length
      const tail = waits ? "\nNothing is saved until you Accept, here or in the Habits chat." : ""
      return { text: reply.text + tail, ...(waits ? { habitLineId: reply.id } : {}) }
    },
  },
  {
    id: "social",
    label: "Social BIMBY",
    names: ["social", "friends", "friend", "people", "friendship"],
    run: async (payload) => {
      const plan = trySocial(payload, new Date(), { forced: true })
      return plan ? { text: plan.text, reportId: plan.reportId } : { text: "The Social BIMBY found no person to file this under. Name them, e.g. “new friend Masha (@handle) …”." }
    },
  },
  {
    id: "finance",
    label: "Financial BIMBY",
    names: ["financial", "finance", "finances", "money", "budget", "spending"],
    run: async (payload) => {
      const store = useFinanceBimby
      if (store.getState().busy) return { text: "The Financial BIMBY is still working on something. Send it again in a moment." }
      const before = store.getState().lines.length
      await store.getState().send(payload)
      const reply = store.getState().lines.slice(before).reverse().find((l) => l.who === "bimby")
      return { text: reply?.text ?? "No answer came back." }
    },
  },
]

const names = TARGETS.flatMap((t) => t.names).sort((a, b) => b.length - a.length).map((n) => n.replace(/\s+/g, "\\s+"))
const SUFFIX = "(?:bimby|bimbies|helper|bot|chat|agent)"
const NAME = `(${names.join("|")})(?:\\s+${SUFFIX})*`
/** The name with "bimby" or "helper" said: sure enough to need no colon. */
const NAME_SAID = `(${names.join("|")})\\s+(?:bimby|bimbies|helper)(?:\\s+${SUFFIX})*`
const SEND = "(?:(?:please|pls|can\\s+you|could\\s+you|i\\s+want\\s+you\\s+to)\\s+)*(?:send|route|forward|pass|hand|give|relay|tell|ask|say)(?:\\s+(?:this|that|it|the\\s+following|these\\s+words))?(?:\\s+(?:over|off|along))?\\s+(?:(?:to|over\\s+to)\\s+)?(?:the\\s+|my\\s+)?"
const SENDING = new RegExp(`^\\s*${SEND}${NAME}\\s*[:\\-–—]\\s*([\\s\\S]+)$`, "i")
const DIRECT = new RegExp(`^\\s*(?:to|for)\\s+(?:the\\s+|my\\s+)?${NAME}\\s*:\\s*([\\s\\S]+)$`, "i")
const NAMED = new RegExp(`^\\s*(?:the\\s+|my\\s+)?${NAME_SAID}\\s*:\\s*([\\s\\S]+)$`, "i")
/** "tell habits bimby (that) i did skincare": no colon, so "bimby" or "helper" must be said. */
const BARE = new RegExp(`^\\s*${SEND}${NAME_SAID}[,\\s]+(?:that\\s+)?([\\s\\S]+)$`, "i")

function targetOf(name: string): Target | undefined {
  const key = name.toLowerCase().replace(/\s+/g, " ")
  return TARGETS.find((t) => t.names.includes(key))
}

/** The BIMBY and the exact words to hand it, or null when the line is not a handoff. */
export function parseHandoff(text: string): Handoff | null {
  for (const re of [SENDING, DIRECT, NAMED, BARE]) {
    const m = re.exec(text)
    if (m && targetOf(m[1]!)) return { target: targetOf(m[1]!)!.id, payload: m[2]!.trim() }
  }
  return null
}

const INFO_A = /^\s*(?:the\s+|my\s+)?(.+?)\s+(?:bimby|helper)\s+info(?:rmation)?\s*[?!.]*\s*$/i
const INFO_B = /^\s*(?:info(?:rmation)?\s+(?:on|about|for)|about|tell\s+me\s+about|what\s+(?:is|does))\s+(?:the\s+|my\s+)?(.+?)\s+(?:bimby|helper)\s*[?!.]*\s*$/i

/** The BIMBY a line asks about ("tracking bimby info", "info on the lists bimby"), or null. Names come from the Blueprints. */
export async function parseInfoAsk(text: string): Promise<string | null> {
  const m = INFO_A.exec(text) ?? INFO_B.exec(text)
  if (!m) return null
  const want = m[1]!.toLowerCase().replace(/\s+/g, " ").trim()
  const { listBlueprints } = await import("@/lib/agents/registry")
  const { infoText } = await import("@/lib/agents/info")
  const { agentLabHref } = await import("@/components/Lab/Agents/agent-href")
  const stem = (n: string) => n.toLowerCase().replace(/\s*bimby$/, "")
  const hit =
    listBlueprints().find((b) => stem(b.name) === want) ??
    listBlueprints().find((b) => stem(b.name).replace(/s$/, "") === want.replace(/s$/, "")) ??
    (targetOf(want) ? listBlueprints().find((b) => b.id === ({ tracking: "tracking-helper", habits: "habit-helper", social: "social-bimby", finance: "finance-bimby" } as Record<string, string>)[targetOf(want)!.id]) : undefined)
  return hit ? infoText(hit, { href: agentLabHref(hit) ?? undefined }) : null
}

/** Hands the payload to its BIMBY. Returns BIM's reply text, or null when the line is not a handoff. */
export async function tryHandoff(text: string): Promise<{ text: string; route: string; habitLineId?: string; reportId?: string } | null> {
  const info = await parseInfoAsk(text)
  if (info) return { text: info, route: "INFO · BIMBY" }
  const hand = parseHandoff(text)
  if (!hand || !hand.payload) return null
  const target = TARGETS.find((t) => t.id === hand.target)!
  const answer = await target.run(hand.payload)
  return { text: `Sent to the ${target.label}, as written.\n\n${answer.text}`, route: `HANDOFF · ${target.label}`, ...(answer.habitLineId ? { habitLineId: answer.habitLineId } : {}), ...(answer.reportId ? { reportId: answer.reportId } : {}) }
}

/**
 * A plain line that reads as a daily-habit log ("did skincare, stretched, drank water") goes to the Habits
 * BIMBY without being told to. The test is code (`lib/habit-helper/auto.ts`). `verb` is true when the line
 * starts with one of BIM's commands: only `did …` with two or more habits is taken then, so `did skincare`
 * and every other command stay with the executor. A busy BIMBY takes nothing; the line is filed as before.
 */
export async function tryHabitAuto(text: string, now: Date, verb = false): Promise<{ text: string; route: string; habitLineId?: string } | null> {
  if (verb && !/^\s*did\b/i.test(text)) return null
  if (useHabitsBimby.getState().busy) return null
  const read = readHabitLog(text, buildContext(now), { multiOnly: verb })
  if (!read) return null
  const target = TARGETS.find((t) => t.id === "habits")!
  const answer = await target.run(text)
  return {
    text: `That reads as daily habits, so I sent it to the ${target.label}, as written.\n\n${answer.text}`,
    route: `HANDOFF · ${target.label} · auto`,
    ...(answer.habitLineId ? { habitLineId: answer.habitLineId } : {}),
  }
}
