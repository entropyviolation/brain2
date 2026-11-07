/**
 * lib/lists-helper/session.ts — The Lists BIMBY's conversation (pure state machine over a Port)
 *
 * One line in, replies out. It holds three small things: the list you are working in, the one plan waiting for
 * your yes, and a duplicate review in progress. Nothing is written until a plan is approved ("yes", or "yes 137"
 * when it touches more than 25 items) or a duplicate is merged on purpose. A merge you click is its own approval.
 * Undo keeps the last five. Plan: `components/Lab/ListsHelper/README.md`.
 */

import { LISTS_HELPER_HREF, listsHelperBlueprint } from "@/lib/agents/adapters/lists-helper"
import { infoText, isInfoRequest } from "@/lib/agents/info"
import { applyPlan, undoPlan } from "./apply"
import { parseIntent, swapName } from "./parse"
import { closest, titleOf } from "./resolve"
import { runTool, TOOLS } from "./tools"
import { traceOf, type TraceLine } from "./trace"
import { CONFIRM_COUNT_ABOVE, type Candidate, type DupGroup, type Plan, type Port, type ToolCall, type ToolResult, type Undo } from "./types"

export interface Choice {
  label: string
  text: string
  tone?: "go" | "stop" | "plain"
  /** A second small key on this choice that opens its detail (items, folder) without picking it. */
  peek?: string
}

/** The one key every question carries, so no question is a dead end. */
export const CANCEL: Choice = { label: "Cancel", text: "cancel", tone: "stop" }

export interface DupCard {
  group: DupGroup
  index: number
  total: number
  items: { id: string; title: string; type: string; lists: string[]; created: string; filled: number }[]
}

export type Reply =
  | { kind: "say"; text: string; choices?: Choice[] }
  | { kind: "answer"; text: string; rows?: string[]; candidates?: Candidate[]; choices?: Choice[] }
  | { kind: "plan"; plan: Plan; confirm: string; choices: Choice[] }
  | { kind: "dup"; card: DupCard; choices: Choice[] }
  | { kind: "result"; text: string; undoable: boolean }
  | { kind: "help" }
  | { kind: "trace"; lines: TraceLine[] }

export interface Session {
  listId?: string
  pending?: { call: ToolCall; plan: Plan }
  review?: { groups: DupGroup[]; i: number; merged: number; dismissed: number; skipped: number }
  undo: Undo[]
  /**
   * Set when a name could not be pinned down. "Other…" (`search <kind>s`) reads the next line as words to search
   * that kind by; `line` is the request to finish with the pick (null: just look up the id).
   */
  lost?: { noun: string; line: string | null; words?: string; searching?: boolean }
  /** The last question that offered things to pick from, so a peek at one can step back to all of them. */
  ask?: Extract<Reply, { kind: "say" | "answer" }>
}

export const newSession = (): Session => ({ undo: [] })

const YES = /^(yes|y|yep|yeah|confirm|approve|apply|do it|go ahead|go|ok|okay|sure)\b/i
const NO = /^(no|n|nope|cancel|never mind|nevermind|stop|abort|don'?t)\b/i

function card(port: Port, review: NonNullable<Session["review"]>): DupCard {
  const w = port.world()
  const group = review.groups[review.i]!
  return {
    group,
    index: review.i + 1,
    total: review.groups.length,
    items: group.ids.map((id) => {
      const t = w.tasks.find((x) => x.id === id)!
      return {
        id,
        title: titleOf(t),
        type: w.types.find((x) => String(x.id) === String(t.type ?? "item"))?.name ?? String(t.type ?? "item"),
        lists: (t.lists ?? []).map((l) => w.lists.find((x) => x.id === l)?.name ?? l).filter((n) => !/^__/.test(n)),
        created: new Date(t.createdAt).toISOString().slice(0, 10),
        filled: Object.keys(t.attributes ?? {}).length,
      }
    }),
  }
}

const REVIEW_CHOICES: Choice[] = [
  { label: "Merge", text: "merge", tone: "go" },
  { label: "Not duplicates", text: "dismiss", tone: "plain" },
  { label: "Skip", text: "skip", tone: "plain" },
  { label: "Stop", text: "stop", tone: "stop" },
]

function nextCard(port: Port, s: Session): Reply[] {
  const r = s.review!
  // A group is stale if an item vanished or the group is now under two items.
  const w = port.world()
  while (r.i < r.groups.length && r.groups[r.i]!.ids.some((id) => !w.tasks.some((t) => t.id === id))) r.i++
  if (r.i >= r.groups.length) {
    const sum = `That's all of them. Merged ${r.merged}, marked ${r.dismissed} as not duplicates, skipped ${r.skipped}.`
    s.review = undefined
    return [{ kind: "say", text: sum }]
  }
  return [{ kind: "dup", card: card(port, r), choices: REVIEW_CHOICES }]
}

function planReply(plan: Plan): Reply {
  const confirm = plan.total > CONFIRM_COUNT_ABOVE ? `yes ${plan.total}` : "yes"
  return {
    kind: "plan",
    plan,
    confirm,
    choices: [
      { label: plan.total > CONFIRM_COUNT_ABOVE ? `Yes, ${plan.total}` : "Yes, do it", text: confirm, tone: "go" },
      { label: "Cancel", text: "cancel", tone: "stop" },
    ],
  }
}

/** One line in; the new session and the replies. The input session is not mutated. */
export function step(prev: Session, text: string, port: Port): { session: Session; replies: Reply[] } {
  const s: Session = { ...prev, undo: [...prev.undo], review: prev.review ? { ...prev.review } : undefined }
  const t = text.trim()
  const lower = t.toLowerCase()
  const replies: Reply[] = []
  const done = () => ({ session: s, replies })

  // 1. A plan is waiting for yes or no.
  if (s.pending) {
    const { call, plan } = s.pending
    const needN = plan.total > CONFIRM_COUNT_ABOVE
    if (NO.test(lower)) {
      s.pending = undefined
      replies.push({ kind: "say", text: "Cancelled. Nothing was changed." })
      return done()
    }
    if (YES.test(lower)) {
      const typed = /\b(\d+)\b/.exec(lower)?.[1]
      if (needN && Number(typed) !== plan.total) {
        replies.push({ kind: "say", text: `That touches ${plan.total} items. Type "yes ${plan.total}" to confirm, or cancel.`, choices: planReply(plan).kind === "plan" ? (planReply(plan) as Extract<Reply, { kind: "plan" }>).choices : undefined })
        return done()
      }
      s.pending = undefined
      const out = applyPlan(port, call, plan)
      if (!out.ok) replies.push({ kind: "say", text: out.reason })
      else {
        s.undo = [...s.undo, out.undo].slice(-5)
        replies.push({ kind: "result", text: out.done, undoable: true })
      }
      return done()
    }
    // Anything else drops the plan and is read as a new request.
    s.pending = undefined
    replies.push({ kind: "say", text: "I dropped that plan without changing anything." })
  }

  // 2. A duplicate review is open.
  if (s.review) {
    const r = s.review
    const group = r.groups[r.i]
    if (group && /^(merge|yes|y|merge them|do it)\b/.test(lower)) {
      const res = runTool(port.world(), { tool: "merge-items", ids: group.ids }, { now: port.now() })
      if (res.kind !== "plan") {
        replies.push({ kind: "say", text: res.kind === "error" ? res.text : "Those can't be merged any more." })
        r.skipped++
      } else {
        const out = applyPlan(port, { tool: "merge-items", ids: group.ids }, res.plan)
        if (out.ok) {
          s.undo = [...s.undo, out.undo].slice(-5)
          r.merged++
          replies.push({ kind: "result", text: out.done, undoable: true })
        } else {
          r.skipped++
          replies.push({ kind: "say", text: out.reason })
        }
      }
      r.i++
      replies.push(...nextCard(port, s))
      return done()
    }
    if (group && /^(dismiss|not (a )?dup\w*|no|n|not duplicates|keep both|separate)\b/.test(lower)) {
      port.dismiss(group.key)
      r.dismissed++
      r.i++
      replies.push({ kind: "say", text: "Okay. I won't suggest those two together again." })
      replies.push(...nextCard(port, s))
      return done()
    }
    if (group && /^(skip|next|later|pass)\b/.test(lower)) {
      r.skipped++
      r.i++
      replies.push(...nextCard(port, s))
      return done()
    }
    if (/^(stop|done|quit|exit|enough|cancel)\b/.test(lower)) {
      replies.push({ kind: "say", text: `Stopped. Merged ${r.merged}, marked ${r.dismissed} as not duplicates, ${r.groups.length - r.i} not yet looked at.` })
      s.review = undefined
      return done()
    }
    if (!/^undo\b/.test(lower)) {
      replies.push({ kind: "say", text: "Merge, not duplicates, skip, or stop?", choices: REVIEW_CHOICES })
      return done()
    }
  }

  // An interrupted change the person chose to keep.
  if (/^keep( it| them)?( as is)?$/.test(lower)) {
    replies.push({ kind: "say", text: 'Okay, left as it is. "undo" still puts the old values back if you change your mind.' })
    return done()
  }

  // A peek: look at one of the offered lists before picking it.
  const peek = /^peek list (\S+)$/i.exec(t)
  if (peek) return peekReplies(port, s, peek[1]!, t, replies)
  if (/^back to (the )?choices$/i.test(t) && s.ask) {
    replies.push(s.ask)
    return done()
  }

  // A search opened by "Other…": the next line is words to search by, not a request.
  const search = /^search(?:\s+(?:for\s+)?(?:the\s+)?(list|folder|item type|type)s?)?(?:\s*[:\-]\s*|\s+)?(.*)$/i.exec(t)
  if (s.lost?.searching && !search && !/^(cancel|never mind|nevermind|stop|no)\b/i.test(lower)) {
    return searchReplies(port, s, t, replies)
  }
  if (s.lost?.searching && /^(cancel|never mind|nevermind|stop|no)\b/i.test(lower)) {
    s.lost = undefined
    replies.push({ kind: "say", text: "Okay, never mind." })
    return done()
  }
  // Cancel with nothing waiting: drop whatever question is open.
  if (/^(cancel|never mind|nevermind)\b/i.test(lower) && !search) {
    s.lost = undefined
    s.ask = undefined
    replies.push({ kind: "say", text: "Okay, cancelled. Nothing was changed." })
    return done()
  }
  if (search && (search[1] || s.lost)) {
    const noun = search[1] ? (/type/i.test(search[1]) ? "item type" : search[1].toLowerCase()) : s.lost!.noun
    s.lost = { noun, line: s.lost?.noun === noun ? s.lost.line : null, words: s.lost?.noun === noun ? s.lost.words : undefined, searching: true }
    if (search[2]?.trim()) return searchReplies(port, s, search[2].trim(), replies)
    replies.push({ kind: "say", text: `Type a few words of the ${noun}'s name and I'll search every ${noun}. "cancel" to stop.` })
    return done()
  }

  // 3. A new request. "info" is answered from the Blueprint and changes nothing.
  if (isInfoRequest(t)) {
    replies.push({ kind: "say", text: infoText(listsHelperBlueprint(), { href: LISTS_HELPER_HREF }) })
    return done()
  }
  const intent = parseIntent(port.world(), t, { listId: s.listId, now: port.now() })
  const world = port.world()
  const trace = (result?: ToolResult, outcome?: string) => replies.push({ kind: "trace", lines: traceOf(world, t, intent, result, outcome) })
  switch (intent.kind) {
    case "help":
      trace(undefined, "Showing the tools.")
      replies.push({ kind: "help" })
      return done()
    case "none":
      trace(undefined, "Asked what was meant.")
      replies.push({
        kind: "say",
        text: "I didn't catch a list or item job in that. I work from a short set of tools. Say \"help\" to see them, or try \"find duplicate items\".",
        choices: [{ label: "Help", text: "help" }, { label: "Find duplicates", text: "help me find and merge duplicate items" }, CANCEL],
      })
      return done()
    case "error":
      trace(undefined, `Stopped: ${intent.text}${intent.suggest?.length ? ` (${intent.suggest.length} wordings offered)` : ""}`)
      s.lost = intent.other ? { noun: intent.other.noun, line: intent.other.line, words: intent.other.words } : undefined
      {
        const reply: Extract<Reply, { kind: "say" }> = {
          kind: "say",
          text: intent.text,
          choices: [...(intent.suggest ?? []), ...(intent.other ? [{ label: "Other…", text: `search ${intent.other.noun}s` }] : []), CANCEL],
        }
        s.ask = intent.suggest?.some((c) => c.peek) ? reply : undefined
        replies.push(reply)
      }
      return done()
    case "focus":
      trace(undefined, intent.listId ? `Working list is now "${intent.name}".` : "Working list cleared.")
      s.listId = intent.listId ?? undefined
      replies.push({ kind: "say", text: intent.listId ? `Working in "${intent.name}". "add ..." goes there now.` : "No list in focus." })
      return done()
    case "undo": {
      const last = s.undo.pop()
      replies.push(last ? { kind: "result", text: undoPlan(port, last), undoable: false } : { kind: "say", text: "Nothing to undo." })
      return done()
    }
    case "tool": {
      const res = runTool(port.world(), intent.call, { now: port.now(), isDismissed: port.isDismissed })
      trace(res, res.kind === "error" ? `Tool refused: ${res.text}` : res.kind === "answer" ? "Answered. Nothing to approve." : res.kind === "plan" ? `Plan ready: ${res.plan.total} item(s) touched. Waiting for your yes.` : `${res.groups.length} group(s) found.`)
      if (res.kind === "error") replies.push({ kind: "say", text: res.text })
      else if (res.kind === "answer") {
        const reply: Extract<Reply, { kind: "answer" }> = { kind: "answer", text: res.text, rows: res.rows, candidates: res.candidates, ...(res.candidates?.length ? { choices: [CANCEL] } : {}) }
        s.ask = res.candidates?.some((c) => c.peek) ? reply : undefined
        replies.push(reply)
      }
      else if (res.kind === "plan") {
        s.pending = { call: intent.call, plan: res.plan }
        replies.push(planReply(res.plan))
      } else {
        if (!res.groups.length) {
          replies.push({ kind: "say", text: `No duplicates among ${res.scope}.` })
        } else {
          s.review = { groups: res.groups, i: 0, merged: 0, dismissed: 0, skipped: 0 }
          replies.push({ kind: "say", text: `${res.groups.length} possible ${res.groups.length === 1 ? "duplicate" : "duplicates"} among ${res.scope}. One at a time:` })
          replies.push(...nextCard(port, s))
        }
      }
      return done()
    }
  }
}

/** A list laid open before it is picked: where it is filed, what is on it, and keys to take it, go back, or cancel. */
function peekReplies(port: Port, s: Session, listId: string, line: string, replies: Reply[]): { session: Session; replies: Reply[] } {
  const w = port.world()
  const list = w.lists.find((l) => l.id === listId)
  if (!list) {
    replies.push({ kind: "say", text: "That list is gone.", choices: [CANCEL] })
    return { session: s, replies }
  }
  const items = w.tasks.filter((t) => (t.lists ?? []).includes(list.id) && !t.stepOf)
  const byType = new Map<string, number>()
  for (const t of items) {
    const name = w.types.find((x) => String(x.id) === String(t.type ?? "item"))?.name ?? String(t.type ?? "item")
    byType.set(name, (byType.get(name) ?? 0) + 1)
  }
  const folder = w.folders?.find((f) => f.listIds.includes(list.id))?.name
  const done = items.filter((t) => t.completed).length
  const rows = [
    `${folder ? `In folder "${folder}"` : "Not in a folder"} · made ${new Date(list.createdAt).toISOString().slice(0, 10)} · id ${list.id}`,
    `Item types: ${[...byType].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n} ${c}`).join(", ") || "none"}${done ? ` · ${done} finished` : ""}`,
    ...items.slice(0, 8).map(titleOf),
    ...(items.length > 8 ? [`… and ${items.length - 8} more`] : []),
  ]
  // The line the person would have sent by clicking this one.
  const use = [...(s.ask?.kind === "say" ? s.ask.choices ?? [] : []), ...(s.ask?.kind === "answer" ? s.ask.candidates ?? [] : [])].find((c) => c.peek === line)
  const choices: Choice[] = [
    ...(use?.text ? [{ label: "Pick this one", text: use.text, tone: "go" as const }] : []),
    ...(s.ask ? [{ label: "Back to the choices", text: "back to the choices" }] : []),
    CANCEL,
  ]
  replies.push({ kind: "answer", text: `"${list.name}" has ${items.length} ${items.length === 1 ? "item" : "items"}:`, rows, choices })
  return { session: s, replies }
}

/** The names of one kind of thing, for the "Other…" search. */
function poolOf(port: Port, noun: string): { id: string; name: string; detail?: string }[] {
  const w = port.world()
  if (noun === "folder") return (w.folders ?? []).map((f) => ({ id: f.id, name: f.name, detail: `${f.listIds.length} lists` }))
  if (noun === "item type") return w.types.map((t) => ({ id: String(t.id), name: t.name }))
  return w.lists.filter((l) => !/^__/.test(l.id)).map((l) => ({ id: l.id, name: l.name, detail: w.folders?.find((f) => f.listIds.includes(l.id))?.name }))
}

/** Search a kind by the words just typed; each hit is a key that finishes the request that was stuck. */
function searchReplies(port: Port, s: Session, words: string, replies: Reply[]): { session: Session; replies: Reply[] } {
  const lost = s.lost!
  const pool = poolOf(port, lost.noun)
  const needle = words.toLowerCase().replace(/["“”]/g, "").trim()
  // A plain substring finds most; the fuzzy ranking catches word order and stray punctuation.
  const sub = pool.filter((r) => r.name.toLowerCase().includes(needle))
  const hits = [...sub, ...closest(pool, words, 10).filter((r) => !sub.includes(r))].slice(0, 10)
  const again: Choice = { label: "Search again", text: `search ${lost.noun}s` }
  if (!hits.length) {
    replies.push({ kind: "say", text: `Nothing called like "${words}". Try other words.`, choices: [again, { label: "Never mind", text: "cancel", tone: "stop" }] })
    return { session: s, replies }
  }
  s.lost = { ...lost, searching: false }
  if (lost.line === null) {
    replies.push({
      kind: "answer",
      text: `${hits.length} ${hits.length === 1 ? "match" : "matches"} for "${words}". Click the one you mean:`,
      candidates: [
        ...hits.map((r) => ({ id: r.id, label: r.name, detail: r.detail, text: `what is the ${lost.noun} id for ${r.id}`, ...(lost.noun === "list" ? { peek: `peek list ${r.id}` } : {}) })),
        { id: "other", label: "Other…", detail: "search again", text: `search ${lost.noun}s`, other: true },
      ],
      choices: [CANCEL],
    })
    return { session: s, replies }
  }
  const choices = hits.flatMap((r) => {
    const text = swapName(lost.line!, lost.words ?? "", pool.filter((x) => x.name === r.name).length > 1 ? r.id : r.name)
    return text ? [{ label: r.detail ? `${r.name} · ${r.detail}` : r.name, text, ...(lost.noun === "list" ? { peek: `peek list ${r.id}` } : {}) }] : []
  })
  const reply: Extract<Reply, { kind: "say" }> = { kind: "say", text: `${hits.length} ${hits.length === 1 ? "match" : "matches"} for "${words}". Which one?`, choices: [...choices, { label: "Other…", text: `search ${lost.noun}s` }, CANCEL] }
  s.ask = choices.some((c) => c.peek) ? reply : undefined
  replies.push(reply)
  return { session: s, replies }
}

export const HELP_TOOLS = TOOLS
