/**
 * lib/ingest/bimby-handoff.ts — "send this to tracking bimby: …" in BIM chat
 *
 * A line that names a BIMBY and a colon is handed to that BIMBY's own chat store, word for word,
 * as if it had been typed there. BIM chat does not read it, route it, or file it. The BIMBY runs
 * its usual flow (the Tracking BIMBY proposes blocks that wait for Add in the Tracking tab's chat).
 * To add a BIMBY, add a row to `TARGETS`.
 */
import { useTrackingHelper } from "@/lib/tracking-helper/store"

export type Handoff = { target: string; payload: string }

type Target = {
  id: string
  label: string
  /** Names the person may say, lowercase, without "bimby" or "helper". */
  names: string[]
  /** Runs the payload in that BIMBY's chat and returns what it answered with. */
  run: (payload: string) => Promise<string>
}

const TARGETS: Target[] = [
  {
    id: "tracking",
    label: "Tracking BIMBY",
    names: ["tracking", "track", "time tracking", "timeblock", "time block"],
    run: async (payload) => {
      const store = useTrackingHelper
      if (store.getState().busy) return "The Tracking BIMBY is still working on something. Send it again in a moment."
      const before = store.getState().lines.length
      await store.getState().send(payload, { fromBim: true })
      const reply = store.getState().lines.slice(before).reverse().find((l) => l.who === "helper")
      const open = reply?.blocks?.length ?? 0
      const tail = open ? " It waits for your Add; the Inbox shows a notice you can click." : ""
      return `${reply?.text ?? "No answer came back."}${tail}`
    },
  },
]

const names = TARGETS.flatMap((t) => t.names).sort((a, b) => b.length - a.length).map((n) => n.replace(/\s+/g, "\\s+"))
const NAME = `(${names.join("|")})(?:\\s+(?:bimby|bimbies|helper|bot|chat|agent))*`
const SEND = "(?:(?:please|pls|can\\s+you|could\\s+you|i\\s+want\\s+you\\s+to)\\s+)*(?:send|route|forward|pass|hand|give|relay|tell|ask|say)(?:\\s+(?:this|that|it|the\\s+following|these\\s+words))?(?:\\s+(?:over|off|along))?\\s+(?:(?:to|over\\s+to)\\s+)?(?:the\\s+|my\\s+)?"
const SENDING = new RegExp(`^\\s*${SEND}${NAME}\\s*[:\\-–—]\\s*([\\s\\S]+)$`, "i")
const DIRECT = new RegExp(`^\\s*(?:to|for)\\s+(?:the\\s+|my\\s+)?${NAME}\\s*:\\s*([\\s\\S]+)$`, "i")

function targetOf(name: string): Target | undefined {
  const key = name.toLowerCase().replace(/\s+/g, " ")
  return TARGETS.find((t) => t.names.includes(key))
}

/** The BIMBY and the exact words to hand it, or null when the line is not a handoff. */
export function parseHandoff(text: string): Handoff | null {
  for (const re of [SENDING, DIRECT]) {
    const m = re.exec(text)
    if (m && targetOf(m[1]!)) return { target: targetOf(m[1]!)!.id, payload: m[2]!.trim() }
  }
  const named = /^\s*(?:the\s+)?(tracking|time\s+tracking)\s+(?:bimby|helper)\s*:\s*([\s\S]+)$/i.exec(text)
  if (named && targetOf(named[1]!)) return { target: targetOf(named[1]!)!.id, payload: named[2]!.trim() }
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
    (targetOf(want)?.id === "tracking" ? listBlueprints().find((b) => b.id === "tracking-helper") : undefined)
  return hit ? infoText(hit, { href: agentLabHref(hit) ?? undefined }) : null
}

/** Hands the payload to its BIMBY. Returns BIM's reply text, or null when the line is not a handoff. */
export async function tryHandoff(text: string): Promise<{ text: string; route: string } | null> {
  const info = await parseInfoAsk(text)
  if (info) return { text: info, route: "INFO · BIMBY" }
  const hand = parseHandoff(text)
  if (!hand || !hand.payload) return null
  const target = TARGETS.find((t) => t.id === hand.target)!
  const answer = await target.run(hand.payload)
  return { text: `Sent to the ${target.label}, as written.\n\n${answer}`, route: `HANDOFF · ${target.label}` }
}
