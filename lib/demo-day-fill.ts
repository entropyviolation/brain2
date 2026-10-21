/**
 * lib/demo-day-fill.ts — "Fill around this day" for the Demo profile
 *
 * Writes invented past, present and future rows around any anchor day through
 * the app's own writers (tracking log, task store, event store). Demo only.
 * Deterministic per day and idempotent: a day already filled is skipped, and
 * ids are stable, so pressing it twice never doubles a row.
 */
import { addDays } from "date-fns"
import { demoCycleMark } from "@/lib/demo-corpus/cycle"
import { useCycleMarksStore } from "@/lib/cycle-marks"
import { ensureLocationPen } from "@/lib/ingest/apply-discrete-event"
import { submitTrackingLog } from "@/components/Home/Tracking/tracking-log-model"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useBudgetStore } from "@/lib/budget-store"
import { useEventStore } from "@/lib/event-store"
import { isDemoProfile } from "@/lib/storage-keys"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"

const FILLED_KEY = "brain2-demo-filled-days"
const RESTAURANTS = ["Juniper Table", "Corner Noodle Bar", "Salt & Fig", "The Copper Kettle", "Harbor Taqueria", "Lantern Dumplings", "Birch Street Bakery"]
const PLACES = ["Cedar Stacks Library", "Kiln Studio", "Ferry Landing", "Market Square", "Harbor Park", "Home", "Oak Hill Trail"]
const FOODS = ["oatmeal with pears", "lentil soup", "noodle bowl", "fig toast", "veggie tacos", "dumplings", "scone and jam", "rice and greens"]
const DRINKS = ["oat latte", "green tea", "sparkling water", "orange juice", "chai"]
// Demo money is aspirational on purpose: abundance, generosity, a mansion with a view.
const SPENDS: [string, number, string][] = [["oceanview mansion payment", 18500000, "estate account"], ["private chef dinner", 480000, "black card"], ["gift: dream trip for mom", 1250000, "black card"], ["studio build-out", 3200000, "estate account"], ["gallery art purchase", 2750000, "estate account"], ["donation: community garden", 500000, "giving fund"], ["sailboat tune-up", 640000, "black card"], ["flowers for everyone", 18500, "cash"], ["scholarship gift", 2500000, "giving fund"], ["first-class flights", 920000, "black card"]]
const EARNINGS: [string, number, string][] = [["book royalties", 48500000, "royalties"], ["studio licensing deal", 125000000, "business"], ["dividends: index + real estate", 31200000, "investments"], ["sold the app", 850000000, "business"], ["speaking fee", 9500000, "business"], ["rental income: the lake house", 2800000, "investments"], ["surprise bonus", 15000000, "paycheck"], ["course sales", 6400000, "business"]]
const THOUGHTS = ["Choosing the quiet route home\nThen soup, relieved the day was small and kind.", "Why 3pm slips\nEnergy dips after lunch, so heavy tasks go before noon.", "Two drafts, one reader\nLead with the short one, link the long one."]
const TASKS = ["Return library books", "Glaze test tiles", "Renew ferry pass", "Plan coast weekend", "Draft studio newsletter", "Book dentist", "Water the herbs", "Pack tote for market", "Reply to the print shop", "Sketch poster layout"]
const EVENTS: [string, string, string, string][] = [["Pottery class", "18:00", "20:00", "Kiln Studio"], ["Book club", "19:00", "20:30", "Cedar Stacks Library"], ["Farmers market", "09:00", "10:30", "Market Square"], ["Dinner out", "19:30", "21:00", "Juniper Table"], ["Ferry to the coast", "08:30", "10:00", "Ferry Landing"]]

function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x6d2b79f5), ((h ^ (h >>> 13)) >>> 0) / 4294967296)
}

function readFilled(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FILLED_KEY) ?? "[]") as string[])
  } catch {
    return new Set()
  }
}

export interface DemoFillResult {
  days: number
  logs: number
  tasks: number
  events: number
}

/** Fill `radius` days either side of `anchor`. Returns counts; zeros outside Demo. */
export function fillDemoAround(anchor: Date, radius = 10): DemoFillResult {
  const out: DemoFillResult = { days: 0, logs: 0, tasks: 0, events: 0 }
  if (!isDemoProfile()) return out
  const filled = readFilled()
  const store = useTaskStore.getState()
  const now = new Date()
  const todayKey = formatLocalDateKey(now)
  const have = new Set(store.tasks.map((t) => t.id))

  const ensureList = (id: string, name: string, color: string): string => {
    if (!useTaskStore.getState().lists.some((l) => l.id === id)) {
      useTaskStore.getState().addList({ id, name, color, createdAt: now } as List)
    }
    return id
  }
  const restaurantsList = ensureList("demofill-restaurants", "Restaurants", "#f97316")
  const placesList = ensureList("demofill-places", "Places to go", "#0ea5e9")
  const mkItem = (id: string, title: string, list: string, extra: Partial<Task> = {}) => {
    if (have.has(id)) return
    have.add(id)
    useTaskStore.getState().addTask({
      id, title, description: title, stage: "list", createdAt: now, completed: false, lists: [list], type: "item", ...extra,
    } as Task)
    out.tasks++
  }
  RESTAURANTS.forEach((n, i) => mkItem(`demofill-rest-${i}`, n, restaurantsList, { links: i ? [{ id: `demofill-lnk-r${i}`, relation: "supported-by", targetId: `demofill-rest-${i - 1}` }] : undefined }))
  PLACES.forEach((n, i) => mkItem(`demofill-place-${i}`, n, placesList))

  for (let d = -radius; d <= radius; d++) {
    const date = addDays(anchor, d)
    const key = formatLocalDateKey(date)
    if (filled.has(key)) continue
    filled.add(key)
    out.days++
    const r = rng(key)
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
    const minute = (lo: number, hi: number) => Math.floor(lo + r() * (hi - lo))
    const past = key < todayKey
    const log = (input: Parameters<typeof submitTrackingLog>[0]) => {
      if (submitTrackingLog(input)) out.logs++
    }
    // Tracking log of every kind (past and present days only; the future has plans, not logs).
    if (key <= todayKey) {
      const spots = [pick(RESTAURANTS), pick(PLACES)]
      for (const [what, cents, src] of [pick(SPENDS), pick(SPENDS)]) {
        log({ date: key, title: what, mode: "spend", clock: r() < 0.15 ? "estimated" : "exact", minute: minute(450, 1200), spendAmount: cents, spendOn: what, spendSource: src })
      }
      const [earnName, earnCents, earnSource] = pick(EARNINGS)
      useBudgetStore.getState().addLines([{ date: key, name: earnName, cents: earnCents, kind: "earning", source: earnSource }])
      log({ date: key, title: pick(FOODS), mode: "intake", intakeClass: "food", clock: "exact", minute: minute(420, 1260) })
      log({ date: key, title: pick(FOODS), mode: "intake", intakeClass: "food", clock: "exact", minute: minute(720, 1260) })
      log({ date: key, title: pick(DRINKS), mode: "intake", intakeClass: "drink", clock: "exact", minute: minute(400, 900) })
      log({ date: key, title: `ate at ${spots[0]}`, mode: "event", clock: "exact", minute: minute(690, 810), locationPenId: ensureLocationPen(spots[0]) })
      log({ date: key, title: `walked to ${spots[1]}`, mode: "event", clock: "exact", minute: minute(480, 1000), locationPenId: ensureLocationPen(spots[1]) })
      log({ date: key, title: pick(THOUGHTS), mode: "thought", clock: r() < 0.2 ? "estimated" : "exact", minute: minute(540, 1300) })
      if (d % 2 === 0) log({ date: key, title: "Bring the tote bag\nCloses at 6.", mode: "note", clock: "exact", minute: minute(480, 1200) })
      if (d % 3 === 0) log({ date: key, title: "email", mode: "switch", switchFrom: "reading", switchTo: "email", clock: "exact", minute: minute(540, 1100) })
    }
    if (key <= todayKey && !useCycleMarksStore.getState().marks[key]) {
      const mark = demoCycleMark(key)
      if (mark) useCycleMarksStore.setState((s) => ({ marks: { ...s.marks, [key]: mark } }))
    }
    // Scheduled items: done in the past, open today and ahead.
    for (let t = 0; t < 2; t++) {
      const title = TASKS[(Math.abs(d) * 2 + t) % TASKS.length]
      const id = `demofill-task-${key}-${t}`
      if (have.has(id)) continue
      have.add(id)
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9 + t * 4)
      useTaskStore.getState().addTask({
        id, title, description: title, stage: past ? "completed" : "scheduled", createdAt: addDays(date, -3), completed: past,
        completedAt: past ? at : undefined, lists: [], type: "task", scheduledDate: at, estimatedDuration: pick([20, 30, 45, 60]),
        deadline: t ? addDays(date, 2) : undefined,
        links: [{ id: `demofill-lnk-${id}`, relation: "needed-for", targetId: `demofill-place-${Math.floor(r() * PLACES.length)}` }],
      } as Task)
      out.tasks++
    }
    // Calendar event with a place.
    const [title, startTime, endTime, location] = EVENTS[Math.abs(d) % EVENTS.length]
    useEventStore.getState().addEvent({
      id: `demofill-ev-${key}`, title, startTime, endTime, date, type: "event", color: "#6366f1", isScheduled: true, isAllDay: false, location, description: "",
    })
    out.events++
  }
  try {
    localStorage.setItem(FILLED_KEY, JSON.stringify([...filled]))
  } catch {
    /* best-effort */
  }
  return out
}
