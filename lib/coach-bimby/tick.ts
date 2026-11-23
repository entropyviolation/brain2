/**
 * lib/coach-bimby/tick.ts — The coach texts you: the morning brief and the evening check-in on Telegram
 *
 * Run once a minute by the always-on hub (`scripts/phone-hub.ts`), which also delivers due Reminders. Each goes
 * out once a day, at or after its time, and not when the hub comes up more than two hours late (a brief at 4pm is
 * noise). The day it went out is kept on the prefs, so a restart does not send it twice.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import { eveningCheckIn, morningBrief } from "./brief"
import { useMeStore } from "./me-store"

export type CoachSend = (text: string) => Promise<boolean>

/** Two hours: past this the slot is skipped for the day. */
export const COACH_LATE_MS = 2 * 60 * 60 * 1000

function slotAt(hhmm: string, now: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2]), 0, 0)
}

/** What went out this tick: "morning", "evening", or nothing. */
export async function coachTick(now: Date, send: CoachSend, write: { morning?: (now: Date) => string; evening?: (now: Date) => string } = {}): Promise<("morning" | "evening")[]> {
  const prefs = useMeStore.getState().prefs
  if (!prefs.on) return []
  const today = formatLocalDateKey(now)
  const sent: ("morning" | "evening")[] = []
  const slots = [
    { id: "morning" as const, on: prefs.morningOn, at: prefs.morning, last: prefs.lastMorning, text: write.morning ?? morningBrief },
    { id: "evening" as const, on: prefs.eveningOn, at: prefs.evening, last: prefs.lastEvening, text: write.evening ?? eveningCheckIn },
  ]
  for (const slot of slots) {
    if (!slot.on || slot.last === today) continue
    const at = slotAt(slot.at, now)
    if (!at || now.getTime() < at.getTime()) continue
    // Mark first: a slow or failed send must not repeat every minute.
    useMeStore.getState().setPrefs(slot.id === "morning" ? { lastMorning: today } : { lastEvening: today })
    if (now.getTime() - at.getTime() > COACH_LATE_MS) continue
    if (await send(slot.text(now)).catch(() => false)) sent.push(slot.id)
  }
  return sent
}
