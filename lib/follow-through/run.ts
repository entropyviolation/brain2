/**
 * lib/follow-through/run.ts — The doors: stream card, chat taps, chat commands, quiet capture, mining
 *
 * `startFollowRead` / `finishFollow` are the Stream BIMBY's two calls: the model reads plans and
 * feelings while the filings are read, then the records are saved as proposed, the linker runs,
 * and each proposed link or feeling comes back as a card effect to confirm. `tryFollowAnswer` reads
 * a one-tap answer. `tryFollowCommand` answers "day's end", "findings" and "mine follow-through".
 * `observeLine` reads a plain chat line by rules. `mineTexts` and `mineOvercome` read what the app
 * already holds. The only store written is the follow-through ledger.
 */
"use client"

import type { Effect, EffectField } from "@/lib/report-bimby/types"
import { fieldValue } from "@/lib/report-bimby/types"
import type { ResistanceEntry } from "@/lib/overcome-bimby/types"
import { readClock, segments, type Filing, type Piece } from "@/lib/stream-bimby/parse"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { nextQuestion, readAnswer, type Choice, type Question } from "./ask"
import { clock, LATE_AFTER_MIN, sameStep, span, unplanned, type LinkChange } from "./link"
import { readFollowWithModel, type FollowAsk, type FollowReading } from "./llm"
import { dayEnd, dreadLine, findings, realismLine, unconfirmed } from "./learn"
import { dayKey, displacementIn, readPieces, routeOf, type ModelHint, type ReadPiece, type Reading } from "./read"
import { followLedger, useFollowStore } from "./store"
import { AFTER_WORDS, allSteps, asScale, hashId, LEVEL_WORDS, VERDICT_LABEL, VERDICTS, type Action, type Feeling, type Ledger, type RecordSource, type Step, type Verdict } from "./types"

const pad = (n: number) => String(n).padStart(2, "0")
const hhmmOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** The thing a filing line is about: its command word and trailing clock removed. */
export function payloadOf(line: string): string {
  return line
    .replace(/^(?:log|intake food|intake drink|track|note|to do today|inbox|shopping):\s*/i, "")
    .replace(/^(?:planned|mood):\s*/i, "")
    .replace(/\s+at\s+\d{2}:\d{2}(?:\s+est)?$/i, "")
    .replace(/\s+\d{2}:\d{2}(?:-\d{2}:\d{2})?$/i, "")
    .trim()
}

/** Blocks already in Tracking for the day, as actions. An accepted stream block and its tracked block are one action. */
export function trackedActions(day: string): Action[] {
  const state = useTimeTrackingStore.getState()
  const scope = state.scopes.find((s) => s.id === "activity")
  if (!scope) return []
  const [y, m, d] = day.split("-").map(Number)
  const at = (min: number) => new Date(y!, m! - 1, d!, 0, min).toISOString()
  const out: Action[] = []
  for (const e of state.entries) {
    if (e.date !== day || e.scopeId !== "activity" || e.kind === "instant" || e.endMin <= e.startMin) continue
    const pen = scope.pens.find((p) => p.id === e.penId)
    const what = ((e as { title?: string }).title || pen?.name || "").trim()
    if (!what) continue
    const start = `${pad(Math.floor(e.startMin / 60))}:${pad(e.startMin % 60)}`
    out.push({ id: hashId("ac", day, start, what.toLowerCase()), day, at: at(e.startMin), end: at(e.endMin), what, kind: "activity", said: `${what} ${start}`, source: "tracking", asked: [] })
  }
  return out
}

function piecesToRead(ps: Piece[], filed: { piece: Piece; filing: Filing }[], hints?: Map<number, ModelHint>): ReadPiece[] {
  const out: ReadPiece[] = []
  for (const p of ps) {
    const mine = filed.filter((f) => f.piece.index === p.index)
    if (!mine.length) {
      out.push({ text: p.text, route: routeOf(p.text), hhmm: p.t.hhmm, hint: hints?.get(p.index) })
      continue
    }
    for (const f of mine) {
      const hasPayload = f.filing.route === "activity" || f.filing.route === "count" || f.filing.route === "food" || f.filing.route === "drink"
      out.push({ text: p.text, route: f.filing.route, hhmm: p.own?.hhmm ?? p.t.hhmm, ...(p.own?.end ? { end: p.own.end } : {}), ...(hasPayload ? { payload: payloadOf(f.filing.line) } : {}), hint: hints?.get(p.index) })
    }
  }
  return out
}

const FELT = /\b(proud|positive|happy|sad|anxious|tired|stressed|calm|grateful|glad|excited|confident|overwhelmed|frustrated|bored|feel|feeling|dread\w*|regret\w*|guilty|need to|have to|i guess|ugh)\b/i

/**
 * Start the model's read of the plans and feelings. Uses the rules' routes, so it can run beside
 * the filings read. Null with LLM off, with nothing to read, or when no model answers.
 */
export function startFollowRead(ps: Piece[], ruleFiled: { piece: Piece; filing: Filing }[], now: Date, llm: boolean): Promise<(FollowReading & { ask: FollowAsk }) | null> {
  if (!llm) return Promise.resolve(null)
  const day = dayKey(now)
  const first = readPieces(piecesToRead(ps, ruleFiled), now, "stream")
  const lines = ps.filter((p) => {
    const route = ruleFiled.find((f) => f.piece.index === p.index)?.filing.route
    return route === "plan" || route === "todo" || route === "mood" || !!displacementIn(p.text) || FELT.test(p.text)
  })
  const ledger = followLedger()
  const openSteps = [...allSteps(ledger).filter((s) => s.verdict === "open" && s.standing === "proposed" && ledger.intentions.find((i) => i.id === s.intentionId)?.day === day), ...first.intentions.flatMap((i) => i.steps)]
  const actions = [...ledger.actions.filter((a) => a.day === day), ...trackedActions(day), ...first.actions]
  const seen = new Set<string>()
  const ask: FollowAsk = {
    lines: lines.map((p) => ({ index: p.index, text: p.text })),
    openSteps: openSteps.filter((s) => !seen.has(s.id) && seen.add(s.id)).map((s) => ({ id: s.id, what: s.what })),
    actions: actions.filter((a) => !seen.has(a.id) && seen.add(a.id)).map((a) => ({ id: a.id, label: `${clock(a.at)} ${a.what}` })),
  }
  return readFollowWithModel(ask).then((r) => (r ? { ...r, ask } : null)).catch(() => null)
}

export interface FollowResult {
  effects: Effect[]
  trace: string[]
  /** Lines to add to the chat reply: a realistic estimate, how dreaded things went before. */
  extra: string[]
  question: Question | null
}

const levelOptions = ["not said", ...LEVEL_WORDS.map((w, i) => `${i} ${w}`)]
const afterOptions = ["not said", ...AFTER_WORDS.map((w, i) => `${i} ${w}`)]
const levelValue = (n: number | undefined, words: readonly string[]) => (n === undefined ? "not said" : `${n} ${words[n]}`)
const field = (key: string, label: string, value: string, options?: string[]): EffectField => ({ key, label, type: options ? "select" : "text", value, ...(options ? { options } : {}) })

function verdictEffect(id: string, step: Step, change: LinkChange, action?: Action): Effect {
  const tail = change.verdict === "displaced" && step.displacedBy ? ` by ${step.displacedBy}` : action ? ` at ${clock(action.at)}` : ""
  return {
    id,
    kind: "verdict",
    ref: step.id,
    title: `"${step.what}" → ${VERDICT_LABEL[change.verdict]}${tail}`,
    reasoning: [change.why, change.verdict === "late" ? `Late means it started more than ${LATE_AFTER_MIN} min per step in the plan's order after the plan was said.` : "A proposed link. It counts in your findings only once accepted."],
    evidence: action ? [`“${action.said}”`] : [],
    fields: [field("verdict", "What happened to this step", change.verdict, [...VERDICTS]), ...(change.verdict === "displaced" ? [field("by", "Done instead", step.displacedBy ?? "")] : [])],
    status: "pending",
  }
}

function feelingEffect(id: string, f: Feeling, ledger: Ledger): Effect {
  const step = allSteps(ledger).find((s) => s.id === f.stepId)
  const action = ledger.actions.find((a) => a.id === f.actionId)
  const about = step?.what ?? action?.what ?? f.aboutWords ?? "the day"
  const marks = f.phase === "before"
    ? [f.excitement !== undefined ? `pull ${LEVEL_WORDS[f.excitement]}` : "", f.resistance !== undefined ? `resistance ${LEVEL_WORDS[f.resistance]}` : "", f.importance !== undefined ? `importance ${LEVEL_WORDS[f.importance]}` : ""].filter(Boolean).join(", ")
    : f.satisfaction !== undefined ? AFTER_WORDS[f.satisfaction] : ""
  return {
    id,
    kind: "feeling",
    ref: f.id,
    title: `${f.phase === "before" ? "Before" : "After"} "${about}": ${marks || "not said"}`,
    reasoning: [
      f.by === "model" ? "Read from your words by the model. No number was typed, so check the marks." : "Read from your words by rules. No number was typed, so check the marks.",
      f.phase === "before" ? "Pull and resistance are separate scales: both can be high at once." : action ? `Tied to "${action.what}" at ${clock(action.at)}.` : f.aboutWords ? `No tracked action matches "${f.aboutWords}", so it is kept with those words.` : "Not about one action; kept as the day's feeling.",
    ],
    evidence: [`“${f.words.slice(0, 160)}”`],
    fields: f.phase === "before"
      ? [field("excitement", "Pull toward it", levelValue(f.excitement, LEVEL_WORDS), levelOptions), field("resistance", "Resistance", levelValue(f.resistance, LEVEL_WORDS), levelOptions), field("importance", "Importance", levelValue(f.importance, LEVEL_WORDS), levelOptions)]
      : [field("satisfaction", "How it sits now", levelValue(f.satisfaction, AFTER_WORDS), afterOptions), field("about", "About", about)],
    status: "pending",
  }
}

/** Save the reading as proposed, run the linker, and return what the card should ask the person to confirm. */
export function finishFollow(planId: string, ps: Piece[], filed: { piece: Piece; filing: Filing }[], now: Date, model: (FollowReading & { ask: FollowAsk }) | null): FollowResult {
  const store = useFollowStore.getState()
  const day = dayKey(now)
  const reading = readPieces(piecesToRead(ps, filed, model?.hints), now, "stream")
  const tracked = trackedActions(day)
  const changes = store.take({ ...reading, actions: [...reading.actions, ...tracked] }, now)

  // The model's pairs fill in only what the rules left open. Code works out the delay and so done or late.
  for (const pair of model?.pairings ?? []) {
    const ledger = followLedger()
    const asked = model!.ask.openSteps.find((s) => s.id === pair.stepId)
    const step = allSteps(ledger).find((s) => s.verdict === "open" && s.standing === "proposed" && (s.id === pair.stepId || (asked && sameStep(s.what, asked.what))))
    const wanted = model!.ask.actions.find((a) => a.id === pair.actionId)
    const action = ledger.actions.find((a) => a.id === pair.actionId) ?? ledger.actions.find((a) => a.day === day && wanted && `${clock(a.at)} ${a.what}` === wanted.label)
    const intention = step && ledger.intentions.find((i) => i.id === step.intentionId)
    if (!step || !action || !intention || step.refused?.includes(action.id)) continue
    if (pair.verdict === "displaced") {
      store.setStep(step.id, { verdict: "displaced", displacedBy: action.what })
      changes.push({ stepId: step.id, verdict: "displaced", displacedBy: action.what, why: `The model read "${action.what}" as done in place of "${step.what}".` })
      continue
    }
    if (action.stepId || action.at < intention.at) continue
    const delayMin = Math.max(0, Math.round((new Date(action.at).getTime() - new Date(intention.at).getTime()) / 60_000))
    const verdict: Verdict = delayMin > LATE_AFTER_MIN * (step.order + 1) ? "late" : "done"
    store.setStep(step.id, { verdict, actionId: action.id, delayMin })
    store.setAction(action.id, { stepId: step.id })
    changes.push({ stepId: step.id, verdict, actionId: action.id, delayMin, why: `The model paired "${action.what}" at ${clock(action.at)} with "${step.what}", ${span(delayMin)} after the plan.` })
  }

  const ledger = followLedger()
  const effects: Effect[] = []
  const latest = new Map<string, LinkChange>()
  for (const c of changes) latest.set(c.stepId, c)
  for (const c of latest.values()) {
    const step = allSteps(ledger).find((s) => s.id === c.stepId)
    if (step && step.standing === "proposed") effects.push(verdictEffect(`${planId}-ft-${effects.length}`, step, c, ledger.actions.find((a) => a.id === step.actionId)))
  }
  for (const f of reading.feelings) {
    const kept = ledger.feelings.find((x) => x.id === f.id)
    if (kept && kept.standing === "proposed") effects.push(feelingEffect(`${planId}-ft-${effects.length}`, kept, ledger))
  }

  const steps = reading.intentions.flatMap((i) => i.steps)
  const trace = [`Follow-through: ${reading.intentions.length} plan${reading.intentions.length === 1 ? "" : "s"} (${steps.length} step${steps.length === 1 ? "" : "s"}), ${reading.actions.length} action${reading.actions.length === 1 ? "" : "s"}, ${reading.feelings.length} feeling${reading.feelings.length === 1 ? "" : "s"}. ${latest.size} link${latest.size === 1 ? "" : "s"} proposed.`]
  if (model) trace.push(...model.trace)
  const extraActions = unplanned(ledger, day)
  if (extraActions.length) trace.push(`No plan predicted: ${extraActions.map((a) => `${a.what} at ${clock(a.at)}`).join(", ")}.`)

  const extra: string[] = []
  const biggest = [...reading.intentions].sort((a, b) => b.steps.length - a.steps.length)[0]
  const real = biggest ? realismLine(ledger, biggest.steps.length) : null
  if (real) extra.push(real)
  const dread = dreadLine(ledger, Math.max(0, ...reading.feelings.filter((f) => f.phase === "before").map((f) => f.resistance ?? 0)))
  if (dread) extra.push(dread)
  return { effects, trace, extra, question: nextQuestion(ledger, now) }
}

// ── The card ───────────────────────────────────────────────────────────

const scaleOf = (effect: Effect, key: string) => asScale(fieldValue(effect, key).trim().slice(0, 1))

/** Accept on a `verdict` or `feeling` effect: the record becomes confirmed, with the fields as edited. */
export function applyFollowEffect(effect: Effect): { ok: boolean; message: string } {
  const store = useFollowStore.getState()
  if (!effect.ref) return { ok: false, message: "This card no longer points at a record." }
  if (effect.kind === "verdict") {
    const verdict = fieldValue(effect, "verdict") as Verdict
    if (!VERDICTS.includes(verdict)) return { ok: false, message: `Pick one of: ${VERDICTS.join(", ")}.` }
    const step = allSteps(followLedger()).find((s) => s.id === effect.ref)
    if (!step) return { ok: false, message: "That step is no longer in the ledger." }
    const by = fieldValue(effect, "by").trim()
    const keepsAction = verdict === "done" || verdict === "late"
    store.setStep(step.id, { verdict, standing: "confirmed", ...(verdict === "displaced" && by ? { displacedBy: by } : {}), ...(keepsAction ? {} : { actionId: undefined, delayMin: undefined }) })
    if (!keepsAction && step.actionId) store.setAction(step.actionId, { stepId: undefined })
    return { ok: true, message: `"${step.what}" is ${VERDICT_LABEL[verdict]}. It now counts in your findings.` }
  }
  const feeling = followLedger().feelings.find((f) => f.id === effect.ref)
  if (!feeling) return { ok: false, message: "That feeling is no longer in the ledger." }
  if (feeling.phase === "before") {
    store.setFeeling(feeling.id, { excitement: scaleOf(effect, "excitement"), resistance: scaleOf(effect, "resistance"), importance: scaleOf(effect, "importance"), standing: "confirmed" })
  } else {
    const satisfaction = scaleOf(effect, "satisfaction")
    if (satisfaction === undefined) return { ok: false, message: "Pick how it sits now, or reject this." }
    const about = fieldValue(effect, "about").trim()
    store.setFeeling(feeling.id, { satisfaction, standing: "confirmed", ...(about && !feeling.actionId ? { aboutWords: about } : {}) })
  }
  return { ok: true, message: "Feeling kept. It now counts in your findings." }
}

/** Reject: a wrong link is undone and never proposed again; a wrong feeling is kept out of every count. */
export function rejectFollowEffect(effect: Effect): void {
  const store = useFollowStore.getState()
  if (!effect.ref) return
  if (effect.kind === "verdict") {
    const step = allSteps(followLedger()).find((s) => s.id === effect.ref)
    if (!step) return
    if (step.actionId) store.setAction(step.actionId, { stepId: undefined })
    store.setStep(step.id, { verdict: "open", actionId: undefined, delayMin: undefined, displacedBy: undefined, refused: [...(step.refused ?? []), ...(step.actionId ? [step.actionId] : [])] })
  } else if (effect.kind === "feeling") store.setFeeling(effect.ref, { standing: "rejected" })
}

// ── Chat ───────────────────────────────────────────────────────────────

export interface FollowReply {
  text: string
  route: string
  choices: Choice[]
}

const withNext = (said: string, now: Date, route: string): FollowReply => {
  const q = nextQuestion(followLedger(), now)
  return { text: q ? `${said}\n\n${q.text}` : said, route, choices: q?.choices ?? [] }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** A one-tap answer ("push 3: call shelby", "after 4: walk", "away: phone | tidy", "skip: …"). Null when the line is not one. */
export function tryFollowAnswer(text: string, now = new Date()): FollowReply | null {
  const answer = readAnswer(text)
  if (!answer) return null
  const store = useFollowStore.getState()
  const ledger = followLedger()
  const steps = allSteps(ledger).reverse()
  const mark = (s: Step, kind: string) => store.setStep(s.id, { asked: [...new Set([...s.asked, kind])] })
  if (answer.kind === "skip-all") {
    const today = dayKey(now)
    for (const i of ledger.intentions.filter((x) => x.day === today)) for (const s of i.steps) store.setStep(s.id, { asked: [...new Set([...s.asked, "pull", "push"])] })
    return withNext("Skipped. I will not ask about these steps again.", now, "FOLLOW · skip")
  }
  if (answer.kind === "pull" || answer.kind === "push") {
    const key = answer.kind === "pull" ? "excitement" : "resistance"
    const step = steps.find((s) => same(s.what, answer.what) && !s.asked.includes(answer.kind)) ?? steps.find((s) => same(s.what, answer.what))
    if (!step) return null
    store.answer({ stepId: step.id }, "before", key, answer.value, now)
    mark(step, answer.kind)
    const dread = answer.kind === "push" ? dreadLine(followLedger(), answer.value) : null
    return withNext(`Noted: ${answer.kind === "pull" ? "pull" : "resistance"} ${LEVEL_WORDS[answer.value]} for "${step.what}".${dread ? ` ${dread}` : ""}`, now, `FOLLOW · ${answer.kind}`)
  }
  if (answer.kind === "after") {
    const action = [...ledger.actions].reverse().find((a) => same(a.what, answer.what))
    if (!action) return null
    store.answer({ actionId: action.id, ...(action.stepId ? { stepId: action.stepId } : {}) }, "after", "satisfaction", answer.value, now)
    store.setAction(action.id, { asked: [...new Set([...action.asked, "after"])] })
    return withNext(`Noted: ${action.what} was ${AFTER_WORDS[answer.value]}.`, now, "FOLLOW · after")
  }
  if (answer.kind === "away" || answer.kind === "blocker") {
    const step = steps.find((s) => same(s.what, answer.what))
    if (!step) return null
    store.setStep(step.id, { ...(answer.kind === "away" ? { awayReason: answer.reason, standing: "confirmed" as const } : { blocker: answer.reason }), asked: [...new Set([...step.asked, answer.kind])] })
    return withNext(answer.kind === "away" ? `Noted: ${answer.reason} pulled you away from "${step.what}".` : `Noted: ${answer.reason} is in the way of "${step.what}".`, now, `FOLLOW · ${answer.kind}`)
  }
  const q = nextQuestion(ledger, now)
  const step = steps.find((s) => same(s.what, answer.what))
  const action = [...ledger.actions].reverse().find((a) => same(a.what, answer.what))
  if (q?.kind === "after" && action) store.setAction(action.id, { asked: [...new Set([...action.asked, "after"])] })
  else if (step && q) mark(step, q.kind)
  else if (!step && !action) return null
  return withNext("Skipped.", now, "FOLLOW · skip")
}

export interface MineSources {
  /** Things already said: chat lines, stream and report messages. */
  texts: { text: string; at: string }[]
  overcome: ResistanceEntry[]
}

/** "day's end", "findings", "mine follow-through". Null for any other line. */
export function tryFollowCommand(text: string, now: Date, sources: () => MineSources): FollowReply | null {
  const t = text.trim().toLowerCase().replace(/[?.!]+$/, "")
  if (/^(day'?s end|plan vs (?:day|reality|what happened)|how did (?:my|the|today'?s) plan go|follow[- ]through(?: today)?)$/.test(t)) {
    const day = dayKey(now)
    useFollowStore.getState().take({ intentions: [], actions: trackedActions(day), feelings: [] }, now)
    return withNext(dayEnd(followLedger(), day), now, "FOLLOW · day's end")
  }
  if (/^(findings|follow[- ]through findings|what have (?:i|you) learned)$/.test(t)) {
    const l = followLedger()
    const waiting = unconfirmed(l)
    const body = findings(l).map((f) => `${f.title}: ${f.text}${f.ready && f.days.length ? ` Days: ${f.days.slice(-6).join(", ")}.` : ""}`).join("\n")
    return { text: `${body}${waiting ? `\n\n${waiting} proposed link${waiting === 1 ? "" : "s"} or feeling${waiting === 1 ? "" : "s"} not confirmed yet, so not counted.` : ""}`, route: "FOLLOW · findings · counted by code", choices: [] }
  }
  if (/^mine follow[- ]through$/.test(t)) {
    const got = mine(sources(), now)
    return { text: `Read ${got.texts} earlier messages and ${got.overcome} resistance entries: ${got.intentions} plans, ${got.actions} actions, ${got.feelings} feelings added. All are proposed, none confirmed.`, route: "FOLLOW · mine · rules", choices: [] }
  }
  return null
}

/** Read text by rules alone, at the time it was said. Returns the reading, or null when it holds nothing. */
export function readText(text: string, at: Date, source: RecordSource): Reading | null {
  const fallback = hhmmOf(at)
  let current: string | null = null
  const pieces: ReadPiece[] = []
  for (const seg of segments(text)) {
    const own = readClock(seg)
    if (own) current = own.end ?? own.hhmm
    const route = own?.end ? "activity" : routeOf(seg)
    pieces.push({ text: seg, route, hhmm: own?.hhmm ?? current ?? fallback, ...(own?.end ? { end: own.end, payload: seg.replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi, " ").replace(/[-–—]/g, " ").replace(/\b(doing|went for a|went for)\b/gi, " ").replace(/\s+/g, " ").trim() } : {}) })
  }
  const r = readPieces(pieces, at, source)
  return r.intentions.length || r.actions.length || r.feelings.length || r.displacements.length ? r : null
}

/** A plain chat line the Stream BIMBY never saw: read by rules, saved as proposed. True when it held a record. */
export function observeLine(text: string, now: Date, source: RecordSource = "chat"): boolean {
  const t = text.trim()
  // A command, a question, or a tap answer is not a line of the stream.
  if (t.length < 8 || t.endsWith("?") || /^[a-z][a-z ]{0,24}:/i.test(t) || readAnswer(t)) return false
  const r = readText(t, now, source)
  if (!r) return false
  useFollowStore.getState().take(r, now)
  return true
}

function overcomeReading(log: ResistanceEntry[]): Reading {
  const out: Reading = { intentions: [], actions: [], feelings: [], displacements: [] }
  for (const e of log) {
    const what = e.reading.task.trim()
    if (!what) continue
    const at = new Date(e.at)
    const day = dayKey(at)
    const id = hashId("in", day, e.said)
    const blocker = e.reading.barrier !== "unknown" ? e.reading.barrier : undefined
    const step: Step = { id: `${id}_0`, intentionId: id, order: 0, what, hedge: "must", verdict: "open", standing: "proposed", repeats: [], asked: [], ...(blocker ? { blocker } : {}) }
    out.intentions.push({ id, at: at.toISOString(), day, said: e.said, steps: [step], source: "mined" })
    // "I can't make myself start" is resistance by its own words; dread is the top of the scale.
    out.feelings.push({ id: hashId("fb", step.id), at: at.toISOString(), day, phase: "before", stepId: step.id, resistance: e.reading.barrier === "dread" ? 4 : 3, words: e.reading.resistance || e.said, by: "said", standing: "proposed" })
  }
  return out
}

/** Read what the app already holds into the ledger. Safe to run again: the same text lands on the same records. */
export function mine(sources: MineSources, now = new Date()): { texts: number; overcome: number; intentions: number; actions: number; feelings: number } {
  const store = useFollowStore.getState()
  const before = followLedger()
  let texts = 0
  for (const item of sources.texts) {
    const at = new Date(item.at)
    if (Number.isNaN(at.getTime())) continue
    const t = item.text.trim()
    if (t.length < 8 || readAnswer(t)) continue
    const r = readText(t, at, "mined")
    if (!r) continue
    texts++
    store.take(r, now)
  }
  store.take(overcomeReading(sources.overcome), now)
  const after = followLedger()
  return { texts, overcome: sources.overcome.length, intentions: after.intentions.length - before.intentions.length, actions: after.actions.length - before.actions.length, feelings: after.feelings.length - before.feelings.length }
}
