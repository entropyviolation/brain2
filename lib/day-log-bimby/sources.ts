/**
 * lib/day-log-bimby/sources.ts — Read every store into one day's `DaySources`
 *
 * Read only. What each source is and how it reaches Brain2:
 * - Tracking rows of every view: Activity, Location (the iPhone app's visits and
 *   moves), Company, Mood, Mac and iPhone Screen Time, iPhone Calls and Texts
 *   (the hub's phone sync), Food and intake (with the Food book's plate kcal).
 * - Sleep log mornings, the iPhone's Apple Health day totals.
 * - BIM chat (every kept conversation), Telegram messages BIM received, log items.
 * - The Tracking day note, docs started or edited that day, items finished,
 *   calendar events, day plans made in BIM chat, photos filed on the day.
 * - Amendments the person gave the Day Log BIMBY.
 * Secret rows stay out unless secrets are shown in chat (`lib/secrets-store.ts`).
 */
"use client"

import { formatLocalDateKey, toLocalCalendarDate } from "@/lib/date-utils"
import { useDayPhotosStore } from "@/lib/day-photos-store"
import { useEventStore } from "@/lib/event-store"
import { allBimLines } from "@/lib/ingest/bim-chat"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import { useKitchenStore } from "@/lib/kitchen-store"
import { NOTE_ATTR, NOTE_TYPE_ID } from "@/lib/note-types"
import { useHealthImportStore } from "@/lib/phone-sync/health-store"
import { useDayPlanStore } from "@/lib/plan-bimby/day/store"
import { isSecret } from "@/lib/secrets"
import { secretsShown } from "@/lib/secrets-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { itemTitle } from "@/lib/item-utils"
import { dayLogDateOf } from "./file"
import { localDateOf } from "./gather"
import { amendmentsFor } from "./store"
import type { DaySources, SourceEntry, SourceScope } from "./types"

function nextDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return formatLocalDateKey(new Date(y!, m! - 1, d! + 1))
}

const isoOf = (v: unknown): string => {
  if (!v) return ""
  const d = v instanceof Date ? v : new Date(v as string)
  return Number.isNaN(+d) ? "" : d.toISOString()
}

const plain = (html: string | undefined): string => (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()

export function readDaySources(date: string, includeSecrets: boolean = secretsShown("chat")): DaySources {
  const tt = useTimeTrackingStore.getState()
  const entries = (tt.entries as unknown as SourceEntry[]).filter((e) => e.date === date && (includeSecrets || !e.secret))
  const scopes = tt.scopes as unknown as SourceScope[]
  const dayNote = includeSecrets || !tt.secretDayNotes?.[date] ? tt.dayNotes?.[date] : undefined

  const ids = new Set(entries.map((e) => e.id))
  const plateKcal: Record<string, number> = {}
  for (const p of useKitchenStore.getState().plates) {
    if (p.accepted && ids.has(p.entryId) && p.nutrientSnapshot?.kcal) plateKcal[p.entryId] = p.nutrientSnapshot.kcal
  }

  const nights = useSleepStore.getState().nights
  const woke = nights[date]
  const tonight = nights[nextDate(date)]

  const tasks = useTaskStore.getState().tasks.filter((t) => includeSecrets || !isSecret(t))
  const onDate = (v: unknown) => {
    const iso = isoOf(v)
    return iso && localDateOf(iso) === date ? iso : ""
  }

  const docs: DaySources["docs"] = []
  for (const t of tasks) {
    if (t.type !== NOTE_TYPE_ID || dayLogDateOf(t)) continue
    const created = onDate(t.createdAt)
    const updated = onDate(t.attributes?.[NOTE_ATTR.updatedAt])
    if (!created && !updated) continue
    docs.push({ id: t.id, title: itemTitle(t) || "Untitled document", at: updated || created, created: !!created, text: plain(t.body) })
  }

  const photos = useDayPhotosStore.getState().byDay[date]?.length ?? 0

  return {
    date,
    scopes,
    entries,
    plateKcal,
    ...(dayNote ? { dayNote } : {}),
    sleep: {
      ...(woke ? { woke: { sleptMin: woke.sleptMin, wokeMin: woke.wokeMin, note: woke.note, allNighter: woke.allNighter } } : {}),
      ...(tonight ? { tonight: { sleptMin: tonight.sleptMin, note: tonight.note } } : {}),
    },
    ...(useHealthImportStore.getState().days[date] ? { health: useHealthImportStore.getState().days[date] } : {}),
    bim: allBimLines()
      .filter((l) => !l.waiting && l.at && localDateOf(l.at) === date)
      .map((l) => ({ at: l.at, who: l.who, text: l.text })),
    telegram: useTelegramFeedStore
      .getState()
      .rows.filter((r) => r.at && localDateOf(r.at) === date)
      .map((r) => ({ at: r.at, text: r.text })),
    logs: tasks.filter((t) => t.type === "log" && onDate(t.createdAt)).map((t) => ({ at: isoOf(t.createdAt), text: itemTitle(t) })),
    docs,
    done: tasks.filter((t) => t.completed && onDate(t.completedDate)).map((t) => ({ at: isoOf(t.completedDate), title: itemTitle(t) })),
    events: useEventStore
      .getState()
      .events.filter((e) => {
        try {
          return !!e.date && formatLocalDateKey(toLocalCalendarDate(e.date)) === date
        } catch {
          return false
        }
      })
      .map((e) => ({ title: e.title, ...(e.isAllDay ? { allDay: true } : e.startTime ? { time: e.startTime } : {}) })),
    plans: Object.values(useDayPlanStore.getState().plans)
      .filter((p) => p.at && localDateOf(p.at) === date)
      .map((p) => ({ at: p.at, text: p.text, items: p.items.map((i) => i.title) })),
    photos,
    amendments: amendmentsFor(date),
  }
}
