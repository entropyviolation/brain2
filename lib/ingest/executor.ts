/**
 * lib/ingest/executor.ts — Parse + apply one incoming message
 *
 * Pairing and allowlist live here so adapters only deliver payloads.
 * Simulate skips pairing. Unknown senders get no reply. Photos and PDFs
 * go through `ingestIncomingAsync`. Matching precedence: dedupe → help/pair
 * → explicit commands → habit/discrete triggers → everything else.
 * An open morning review skips that ladder until the message is exactly STOP.
 * Blank text waits. Live Location is dropped while any text ritual is open
 * and resumes on the next edit after that ritual ends.
 */
import { INGEST_HELP } from "./help"
import { BIM_PAIR_OK } from "./bim"
import { tryApplyGlossary } from "./apply-glossary"
import { holdMorningReview, isMorningVoiceAdvance, isTelegramLocationPin } from "./apply-morning-gm"
import { UNPAIRED_SUMMARY, pairingCodeValid } from "./pairing"
import { intakeClassFromMessage, looksLikeVerb, parseMessage } from "./parse-message"
import { applyCycle } from "./apply-cycle"
import { expandIngestText } from "./expand"
import { claimIngestDedupe, ingestDedupeKey } from "./dedupe"
import { applyCapture } from "./apply-capture"
import { applyBulk, isDuplicateFollowup, resolveDuplicateClarify } from "./apply-bulk"
import { applyHabit, writeHabit } from "./apply-habit"
import { tryApplyHabitTrigger } from "./apply-habit-trigger"
import {
  applyDiscreteLog,
  applyDiscreteTriggerLine,
  applyIntake,
  applyLogCategories,
  applyThoughtProcess,
  applyScopeSwitch,
  applySwitchObjective,
  applySwitchTask,
  applyTransit,
} from "./apply-discrete-event"
import { messageSentAt } from "./message-time"
import { applyCurrently, applyStoppedActivity, applySwitchedTo } from "./apply-activity-span"
import { applyNeeded } from "./apply-needed"
import {
  applyLocation,
  applyMood,
  applyTrack,
  applySleep,
  applyStart,
  applyStop,
  applyPenById,
  createAndApplyPen,
} from "./apply-tracking"
import { applyIphoneScreen } from "./apply-phone-screen"
import { applyIphoneCall, applyIphoneText } from "./apply-phone-life"
import {
  applyCount,
  applyFoldersCatalog,
  applyHabitsDump,
  applyInboxDump,
  applyInfo,
  applyListsCatalog,
  applyOps,
  applyPing,
  applyPlan,
  applyRead,
  applySearch,
  applyStatus,
  applyTags,
  applyToday,
  dumpReadCandidate,
} from "./apply-read"
import { applyBought, applyBoughtCandidate, applyGrocery, groceryDumpText } from "./apply-grocery"
import { applyNote } from "./apply-note"
import { applyIphoneNotes } from "./apply-iphone-notes"
import { applyPlanForNow, applyReadPlanToday } from "./apply-plan-text"
import { applyDoNext, applyReadTodoToday, applyTodoToday } from "./apply-todos"
import { applyGps } from "./apply-gps"
import { advanceRitual, startMorningReview, startNightRitual, startPeriodReview, startReviewsBoard } from "./apply-ritual"
import { applyPin } from "./apply-pin"
import { applyInventory } from "./apply-inventory"
import { applyReceiptAnswer, applyReceiptText } from "./apply-receipt"
import { applyJournalText, applyMedia } from "./apply-media"
import { isGpsTrackingLogEvent, useGpsIngestLog } from "./gps-log"
import { makeIngestEventId, useIngestStore } from "./ingest-store"
import { useHabitsStore } from "@/lib/habits-store"
import type { ApplyResult, IncomingMessage, IngestIntent, PendingClarify } from "./types"

const PRIORITY_EXPLICIT = new Set<IngestIntent["kind"]>([
  "help",
  "info",
  "pair",
  "grocery",
  "needed",
  "plan-now",
  "currently",
  "stopped-activity",
  "switched-to",
  "event-log",
  "thought-process",
  "log-categories",
  "habit-trigger",
  "intake",
  "cycle",
  "switch",
  "switch-task",
  "switch-objective",
  "transit",
])

/**
 * Drop a Live Location update while any text ritual is open. The Telegram
 * share stays on; the next edit after the ritual ends is recorded again.
 */
export function dropLocationDuringRitual(input: {
  channel: IncomingMessage["source"]["channel"]
  chatId: string
  text?: string
  locationUpdate?: boolean
}): boolean {
  const pin = Boolean(input.locationUpdate) || isTelegramLocationPin(String(input.text ?? ""))
  if (!pin) return false
  const pending = useIngestStore.getState().getPending(input.channel, input.chatId)
  return pending?.kind === "ritual"
}

/**
 * Live Location edits and empty text are not answers. Pending stays put,
 * and nothing is sent back.
 */
function holdMorningNoise(message: IncomingMessage, _now: Date): ApplyResult | null {
  const pending = useIngestStore.getState().getPending(message.source.channel, message.source.chatId)
  if (pending?.kind !== "ritual" || pending.ritual?.flow !== "morning") return null
  if (isMorningVoiceAdvance(message.attachments)) return null
  const raw = String(message.text ?? "").replace(/^\uFEFF/, "").trim()
  if (
    dropLocationDuringRitual({
      channel: message.source.channel,
      chatId: message.source.chatId,
      text: raw,
    })
  ) {
    return { status: "ignored", kind: "morning", summary: "Live location paused during review" }
  }
  if (!raw && !message.attachments?.length) {
    return { status: "ignored", kind: "morning", summary: "Waiting for a morning-review reply" }
  }
  return null
}

export function ingestIncoming(message: IncomingMessage, now = new Date()): ApplyResult {
  const when = messageSentAt(message, now)
  const blocked = authorizeIncoming(message, when)
  if (blocked) return blocked
  const waiting = holdMorningNoise(message, when)
  if (waiting) return waiting
  return finishIngest(message, applyTextIntent(message, when))
}

export async function ingestIncomingAsync(message: IncomingMessage, now = new Date()): Promise<ApplyResult> {
  const when = messageSentAt(message, now)
  const blocked = authorizeIncoming(message, when)
  if (blocked) return blocked

  // Morning review swallows every message until STOP. Photos wait; voice counts as a reply.
  const waiting = holdMorningNoise(message, when)
  if (waiting) return waiting
  const store = useIngestStore.getState()
  const pending = store.getPending(message.source.channel, message.source.chatId)
  if (pending?.kind === "ritual" && pending.ritual?.flow === "morning") {
    const raw = String(message.text ?? "").replace(/^\uFEFF/, "").trim()
    if (isMorningVoiceAdvance(message.attachments)) {
      return finishIngest(message, advanceRitual(pending, raw || "skip", when))
    }
    if (message.attachments?.length && raw !== "STOP") {
      return finishIngest(message, holdMorningReview(pending, when))
    }
    return finishIngest(message, advanceRitual(pending, raw, when))
  }

  if (message.attachments?.length) {
    const onlyVoice = message.attachments.every((a) => a.kind === "voice" || a.kind === "audio")
    if (onlyVoice) {
      // No ritual open — acknowledge so the user isn't stuck.
      return finishIngest(message, {
        status: "ok",
        kind: "morning",
        reply: "Got your voice note. Start gm for morning review — voice advances affirmations there.",
        summary: "Voice note (no ritual)",
      })
    }
    const result = await applyMedia(message, when)
    return finishIngest(message, result)
  }
  return finishIngest(message, applyTextIntent(message, when))
}

function authorizeIncoming(message: IncomingMessage, now: Date): ApplyResult | null {
  const store = useIngestStore.getState()
  const { source } = message
  const text = expandIngestText(message.text)

  const dedupeKey = ingestDedupeKey(message)
  if (
    !claimIngestDedupe(
      dedupeKey,
      (k) => store.hasSeenIngestKey(k),
      (k) => store.rememberIngestKey(k),
    )
  ) {
    return {
      status: "ignored",
      kind: "unknown",
      summary: "Duplicate Telegram update",
    }
  }

  if (!store.enabled && source.channel !== "simulate") {
    return ignore("Ingest is disabled in Settings.", "unknown")
  }

  if (source.isGroup && !store.allowGroups) {
    return logAndReturn(message, { status: "ignored", kind: "unknown", summary: "Ignored group" })
  }

  const intent = parseMessage(text, now)
  const isPair = intent.kind === "pair"

  if (source.channel !== "simulate") {
    const allowed =
      store.isAllowed(source.chatId) ||
      (source.userId != null && source.userId !== "" && store.isAllowed(source.userId))
    if (!allowed && !isPair) {
      return logAndReturn(message, { status: "ignored", kind: intent.kind, summary: UNPAIRED_SUMMARY })
    }
    if (isPair) {
      return handlePair(message, intent, now)
    }
  } else if (isPair) {
    return handlePair(message, intent, now)
  }

  return null
}

function applyTextIntent(message: IncomingMessage, now: Date): ApplyResult {
  const store = useIngestStore.getState()
  const { source } = message
  const pending = store.getPending(source.channel, source.chatId)
  // An open walkthrough owns the reply. Commands (including log:) wait until it ends.
  // `gm` still starts or continues the morning ritual the way it does outside one.
  if (pending?.kind === "ritual" && !message.attachments?.length) {
    const raw = String(message.text ?? "").replace(/^\uFEFF/, "").trim()
    if (pending.ritual?.flow === "morning") return advanceRitual(pending, raw, now)
    if (/^(gm|good morning|goodmorning)$/i.test(raw)) return startMorningReview(now)
    if (/^(cancel|nevermind|never mind|quit)$/i.test(raw)) {
      return { status: "ok", kind: "cancel", reply: "Stopped.", summary: "Cancelled" }
    }
    return advanceRitual(pending, raw, now)
  }
  const text = expandIngestText(message.text)
  if (pending && !message.attachments?.length) {
    if (pending.kind === "duplicate" && isDuplicateFollowup(text)) {
      return resolveDuplicateClarify(pending, text, now)
    }
    const intent = parseMessage(text, now)
    const receiptFollowup =
      pending.kind === "receipt" && intent.kind === "inventory" && !intent.payload.trim()
    if (!looksLikeVerb(text, now) || receiptFollowup) {
      return resolveClarify(pending, receiptFollowup ? "inv" : text, now)
    }
  }

  const intent = parseMessage(text, now)

  const glossary = tryApplyGlossary(text)
  if (glossary) return glossary

  // Precedence: help/info already in PRIORITY; then other explicit commands;
  // then whole-message habit / discrete triggers; then remaining verbs + capture.
  if (PRIORITY_EXPLICIT.has(intent.kind)) {
    return dispatchIntent(message, intent, now)
  }

  const discreteHit = applyDiscreteTriggerLine(text, store.discreteEventTriggers, now)
  if (discreteHit) return discreteHit

  return dispatchIntent(message, intent, now)
}

/** `now` is the send time (`message.date`), so a backlog is not stamped when the poller woke up. */
function dispatchIntent(_message: IncomingMessage, intent: IngestIntent, now: Date): ApplyResult {
  return dispatch(intent, now)
}

function finishIngest(message: IncomingMessage, result: ApplyResult): ApplyResult {
  const store = useIngestStore.getState()
  if (result.status === "needs_clarify") {
    store.setPending(message.source.channel, message.source.chatId, result.pending)
  } else {
    store.setPending(message.source.channel, message.source.chatId, null)
  }
  return logAndReturn(message, result)
}

function handlePair(message: IncomingMessage, intent: IngestIntent, now: Date): ApplyResult {
  const store = useIngestStore.getState()
  const ok = pairingCodeValid(store.pairing, intent.payload, now.getTime())
  if (!ok) {
    return logAndReturn(message, { status: "ignored", kind: "pair", summary: "Bad or expired pairing code" })
  }
  store.allowChat({
    chatId: message.source.chatId,
    userId: message.source.userId,
    username: message.source.username,
    pairedAt: now.toISOString(),
  })
  const pinText = groceryDumpText() ?? undefined
  return logAndReturn(message, {
    status: "ok",
    kind: "pair",
    reply: BIM_PAIR_OK,
    summary: `Paired ${message.source.chatId}`,
    pinText,
  })
}

function dispatch(intent: IngestIntent, now: Date): ApplyResult {
  switch (intent.kind) {
    case "help":
      return { status: "ok", kind: "help", reply: INGEST_HELP, summary: "Help" }
    case "capture":
      return applyCapture(intent.payload || intent.raw, { sendToInbox: true, now })
    case "bulk":
      return applyBulk(intent.payload, { sendToInbox: false, now })
    case "habit":
      return applyHabit(intent.payload, now)
    case "habit-trigger":
      return (
        tryApplyHabitTrigger(intent.payload, now) ?? {
          status: "error",
          kind: "habit-trigger",
          reply: "No habit matched that keyword. Send dh: and the phrase from the habit.",
        }
      )
    case "intake":
      return applyIntake(intent.payload, now, intakeClassFromMessage(intent.raw))
    case "cycle":
      return applyCycle(intent.payload, now)
    case "log-categories":
      return applyLogCategories()
    case "switch":
      return applyScopeSwitch(intent.payload, intent.scope, now)
    case "switch-task":
      return applySwitchTask(intent.payload, now)
    case "switch-objective":
      return applySwitchObjective(intent.payload, now)
    case "transit":
      return applyTransit(intent.payload, now)
    case "location":
      return applyLocation(intent.payload, now)
    case "track":
      return applyTrack(intent.payload, now)
    case "iphone-screen":
      return applyIphoneScreen(intent.payload, now)
    case "iphone-call":
      return applyIphoneCall(intent.payload, now)
    case "iphone-text":
      return applyIphoneText(intent.payload, now)
    case "mood":
      return applyMood(intent.payload, now)
    case "sleep":
      return applySleep(intent.payload, now)
    case "start":
      return applyStart(intent.payload, now)
    case "stop":
      return applyStop(now)
    case "currently":
      return applyCurrently(intent.payload, now)
    case "stopped-activity":
      return applyStoppedActivity(intent.payload, now)
    case "switched-to":
      return applySwitchedTo(intent.payload, now)
    case "event-log":
      return applyDiscreteLog(intent.payload, now)
    case "thought-process":
      return applyThoughtProcess(intent.payload, now)
    case "info":
      return applyInfo()
    case "read":
      return applyRead(intent.payload, now)
    case "lists":
      return intent.payload.trim() ? applyRead(intent.payload, now) : applyListsCatalog()
    case "folders":
      return intent.payload.trim() ? applyRead(`folder: ${intent.payload}`, now) : applyFoldersCatalog()
    case "inbox":
      return applyInboxDump()
    case "search":
      return applySearch(intent.payload)
    case "today":
      return applyToday(now)
    case "habits":
      return applyHabitsDump(now)
    case "status":
      return applyStatus(now)
    case "ops":
      return applyOps()
    case "count":
      return applyCount(intent.payload)
    case "tags":
      return applyTags()
    case "plan":
      return applyPlan(now)
    case "plan-now":
      return applyPlanForNow(intent.payload, now)
    case "read-plan":
      return applyReadPlanToday(now, "latest")
    case "read-plans":
      return applyReadPlanToday(now, "all")
    case "do":
      return applyDoNext(intent.payload, now)
    case "todo-today":
      return applyTodoToday(intent.payload, now)
    case "read-todo-today":
      return applyReadTodoToday(now)
    case "gps":
      return applyGps(intent.payload, now)
    case "morning":
    case "night":
    case "reviews":
    case "review":
    case "cancel":
      return dispatchRitual(intent, now)
    case "ping":
      return applyPing()
    case "grocery":
      return applyGrocery(intent.payload, now)
    case "needed":
      return applyNeeded(intent.payload, now)
    case "bought":
      return applyBought(intent.payload, now)
    case "note":
      return applyNote(notePayload(intent), now)
    case "iphone-notes":
      return applyIphoneNotes(intent.payload, now)
    case "pin":
      return applyPin(now)
    case "receipt":
      return applyReceiptText(intent.payload, now)
    case "journal":
      return applyJournalText(intent.payload, now)
    case "pdf":
      return {
        status: "error",
        kind: "pdf",
        reply: "Forward a PDF (or caption it pdf). Typed pdf: needs the file.",
      }
    case "inventory":
      return applyInventory(intent.payload, now)
    case "pair":
      return { status: "ignored", kind: "pair", summary: "Pair requires a code" }
    default:
      return { status: "error", kind: "unknown", reply: "Unrecognized. Send info for commands." }
  }
}

function dispatchRitual(intent: IngestIntent, now: Date): ApplyResult {
  if (intent.kind === "cancel") {
    return { status: "ok", kind: "cancel", reply: "Stopped.", summary: "Cancelled" }
  }
  if (intent.kind === "morning") return startMorningReview(now)
  if (intent.kind === "night") return startNightRitual(now)
  if (intent.kind === "reviews") {
    return intent.payload.trim() ? startPeriodReview(intent.payload, now) : startReviewsBoard(now)
  }
  return startPeriodReview(intent.payload, now)
}

function resolveClarify(pending: PendingClarify, text: string, now: Date): ApplyResult {
  if (pending.kind === "ritual") return advanceRitual(pending, text, now)
  if (pending.kind === "duplicate") return resolveDuplicateClarify(pending, text, now)
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  if (pending.kind === "bought") {
    const picked =
      pickIndex(trimmed, pending.candidates) ??
      pending.candidates.find((c) => c.name.toLowerCase() === lower)
    if (picked) return applyBoughtCandidate(picked.id)
    return applyBought(trimmed, now)
  }

  if (pending.kind === "receipt") {
    return applyReceiptAnswer(pending, trimmed, now)
  }

  if (pending.kind === "read") {
    const picked =
      pickIndex(trimmed, pending.candidates) ??
      pending.candidates.find((c) => c.name.toLowerCase() === lower) ??
      pending.candidates.find((c) => stripClarifyLabel(c.name).toLowerCase() === lower)
    if (picked) return dumpReadCandidate(picked.id)
    return applyRead(trimmed, now)
  }

  if (pending.kind === "habit") {
    const habits = useHabitsStore.getState().tasks
    const byIndex = pickIndex(trimmed, pending.candidates)
    const habit = habits.find(
      (h) => h.id === (byIndex?.id ?? pending.candidates.find((c) => c.name.toLowerCase() === lower)?.id),
    )
    if (habit) return writeHabit(habit, pending.remainder ?? "", now)
    return applyHabit(`${trimmed} ${pending.remainder ?? ""}`.trim(), now)
  }

  if (lower === "new" || lower === "create") {
    if (!pending.createName || !pending.scopeId) {
      return { status: "error", kind: pending.kind, reply: "Nothing to create." }
    }
    return createAndApplyPen(pending.kind, pending.scopeId, pending.createName, pending.remainder ?? "", now)
  }

  const picked = pickIndex(trimmed, pending.candidates)
  if (picked && pending.scopeId) {
    return applyPenById(pending.kind, pending.scopeId, picked.id, pending.remainder ?? "", now)
  }

  const named = pending.candidates.find((c) => c.name.toLowerCase() === lower)
  if (named && pending.scopeId) {
    return applyPenById(pending.kind, pending.scopeId, named.id, pending.remainder ?? "", now)
  }

  if (pending.kind === "habit") return applyHabit(trimmed, now)
  if (pending.kind === "location") return applyLocation(trimmed, now)
  if (pending.kind === "mood") return applyMood(trimmed, now)
  if (pending.kind === "track") return applyTrack(`${trimmed} ${pending.remainder ?? ""}`.trim(), now)
  return applyStart(trimmed, now)
}

function notePayload(intent: IngestIntent): string {
  const raw = intent.raw.trim().toLowerCase()
  if (raw === "daynote" || raw.startsWith("daynote:") || raw.startsWith("day note") || raw.startsWith("dnote")) {
    return `day: ${intent.payload}`.trim()
  }
  return intent.payload
}

function pickIndex(text: string, candidates: { id: string }[]) {
  const n = Number(text.trim())
  if (!Number.isInteger(n) || n < 1 || n > candidates.length) return null
  return candidates[n - 1]
}

function stripClarifyLabel(name: string): string {
  return name.replace(/\s*\((list|folder)\)\s*$/i, "").trim()
}

function ignore(summary: string, kind: ApplyResult["kind"]): ApplyResult {
  return { status: "ignored", kind, summary }
}

function logAndReturn(message: IncomingMessage, result: ApplyResult): ApplyResult {
  const status =
    result.status === "ok"
      ? "applied"
      : result.status === "needs_clarify"
        ? "clarify"
        : result.status === "ignored"
          ? "ignored"
          : "error"
  const summary =
    result.status === "ok"
      ? result.summary
      : result.status === "needs_clarify"
        ? "Needs clarification"
        : result.status === "ignored"
          ? result.summary || "Ignored"
          : result.reply

  const event = {
    id: makeIngestEventId(),
    at: message.receivedAt || new Date().toISOString(),
    channel: message.source.channel,
    chatId: message.source.chatId,
    userId: message.source.userId,
    username: message.source.username,
    raw: message.text || (message.attachments?.length ? `(${message.attachments.length} scan)` : ""),
    kind: result.kind,
    status,
    summary,
    itemIds: result.status === "ok" ? result.itemIds : undefined,
  }
  // Location still paints. Tracking points must not fill the 200-line log
  // or rewrite the persist hub on every Live Location tick.
  if (isGpsTrackingLogEvent(event)) useGpsIngestLog.getState().push(event)
  else useIngestStore.getState().appendEvent(event)
  return result
}
