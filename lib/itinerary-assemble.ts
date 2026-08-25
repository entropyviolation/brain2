/**
 * lib/itinerary-assemble.ts — Pure day-block assembly for the printable itinerary
 *
 * Merges Trip Plan days, Flights, and Entries (activities/stays) into ordered
 * day blocks matching the printable layout: left meta (date/city/weather),
 * right schedule (flights + timed plans), sleep row (stay name + address).
 */
import type { Task } from "@/lib/types"

export interface ItineraryScheduleItem {
  id: string
  kind: "flight" | "plan"
  timeLabel: string
  title: string
  detail?: string
  accent?: boolean
}

export interface ItineraryDayBlock {
  /** ISO date key YYYY-MM-DD (or "Unscheduled"). */
  dateKey: string
  dateLabel: string
  city: string
  weather: string
  dayNotes?: string
  schedule: ItineraryScheduleItem[]
  sleep?: { name: string; address: string; id: string }
}

function dateKeyFromValue(raw: unknown): string {
  if (raw == null || raw === "") return ""
  const s = String(raw)
  // datetime → date portion
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

function formatOrdinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}TH`
  switch (n % 10) {
    case 1:
      return `${n}ST`
    case 2:
      return `${n}ND`
    case 3:
      return `${n}RD`
    default:
      return `${n}TH`
  }
}

/** e.g. "SUN JAN 1ST" */
export function formatItineraryDateLabel(dateKey: string): string {
  if (!dateKey || dateKey === "Unscheduled") return "UNSCHEDULED"
  const d = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateKey.toUpperCase()
  const days = ["SUN", "MON", "TUES", "WED", "THURS", "FRI", "SAT"]
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${formatOrdinal(d.getDate())}`
}

function formatTimeLabel(raw: unknown): string {
  if (raw == null || raw === "") return ""
  const s = String(raw)
  // "14:00" or "2026-07-10T14:00"
  const m = s.match(/T?(\d{1,2}):(\d{2})/)
  if (!m) return s
  let h = Number(m[1])
  const min = m[2]
  const ampm = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${min} ${ampm}`
}

export function flightDurationLabel(departure?: unknown, arrival?: unknown): string {
  const dep = departure ? new Date(String(departure)) : null
  const arr = arrival ? new Date(String(arrival)) : null
  if (!dep || !arr || Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) return ""
  const mins = Math.round((arr.getTime() - dep.getTime()) / 60000)
  if (mins <= 0) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m flight`
  if (m === 0) return `${h}h flight`
  return `${h}h ${m}m flight`
}

function cityFromDestination(dest: unknown): string {
  const s = String(dest ?? "").trim()
  if (!s) return ""
  // "Lisbon, Portugal" → "Lisbon"
  return s.split(",")[0]!.trim()
}

export interface AssembleItineraryInput {
  days: Task[]
  flights: Task[]
  entries: Task[]
}

/**
 * Build printable day blocks. Days come from the Trip Plan list; flights and
 * non-stay entries fill the schedule; stays become the Sleep row for that night.
 */
export function assembleItineraryDays(input: AssembleItineraryInput): ItineraryDayBlock[] {
  const { days, flights, entries } = input

  type Mutable = ItineraryDayBlock & { _sort: string }
  const byDate = new Map<string, Mutable>()

  const ensure = (key: string, partial?: Partial<ItineraryDayBlock>): Mutable => {
    const k = key || "Unscheduled"
    let block = byDate.get(k)
    if (!block) {
      block = {
        dateKey: k,
        dateLabel: formatItineraryDateLabel(k),
        city: "",
        weather: "",
        schedule: [],
        _sort: k === "Unscheduled" ? "9999-99-99" : k,
      }
      byDate.set(k, block)
    }
    if (partial) Object.assign(block, partial)
    return block
  }

  for (const t of days) {
    const key = dateKeyFromValue(t.attributes?.day) || "Unscheduled"
    ensure(key, {
      city: cityFromDestination(t.attributes?.destination) || t.description || "",
      weather: String(t.attributes?.weather ?? ""),
      dayNotes: String(t.attributes?.notes ?? "") || undefined,
    })
    // Prefer destination city; fall back to description as day title already used above
    if (!byDate.get(key)!.city) {
      byDate.get(key)!.city = String(t.attributes?.destination ?? t.description ?? "")
    }
  }

  for (const f of flights) {
    const depKey = dateKeyFromValue(f.attributes?.departureTime)
    const arrKey = dateKeyFromValue(f.attributes?.arrivalTime)
    // Show on departure day; if overnight, also note arrival day via schedule on dep day only
    const key = depKey || arrKey || "Unscheduled"
    const airline = String(f.attributes?.airline ?? "")
    const num = String(f.attributes?.flightNumber ?? "")
    const from = String(f.attributes?.departureAirport ?? "")
    const to = String(f.attributes?.arrivalAirport ?? "")
    const route = from && to ? `${from}-${to}` : ""
    const title = [airline, num, route].filter(Boolean).join(" ") || f.description
    const duration = flightDurationLabel(f.attributes?.departureTime, f.attributes?.arrivalTime)
    const conf = f.attributes?.bookingNumber ? `Confirmation: ${f.attributes.bookingNumber}` : ""
    const detail = [duration, conf].filter(Boolean).join(" · ")
    ensure(key).schedule.push({
      id: f.id,
      kind: "flight",
      timeLabel: formatTimeLabel(f.attributes?.departureTime),
      title,
      detail: detail || undefined,
    })
  }

  for (const e of entries) {
    const key = dateKeyFromValue(e.attributes?.day) || "Unscheduled"
    const kind = String(e.attributes?.akind ?? "Activity")
    if (kind === "Stay") {
      const block = ensure(key)
      block.sleep = {
        id: e.id,
        name: e.description,
        address: String(e.attributes?.address ?? e.attributes?.location ?? ""),
      }
      continue
    }
    const loc = String(e.attributes?.location ?? "")
    const notes = String(e.attributes?.notes ?? "")
    const detailParts = [loc, notes].filter(Boolean)
    ensure(key).schedule.push({
      id: e.id,
      kind: "plan",
      timeLabel: formatTimeLabel(e.attributes?.time),
      title: e.description,
      detail: detailParts.length ? detailParts.join(" — ") : undefined,
      accent: kind === "Food" || String(e.attributes?.status) === "Theoretical",
    })
  }

  // Sort schedule within each day by time label presence then lexical time
  for (const block of byDate.values()) {
    block.schedule.sort((a, b) => {
      if (!a.timeLabel && b.timeLabel) return 1
      if (a.timeLabel && !b.timeLabel) return -1
      return a.timeLabel.localeCompare(b.timeLabel)
    })
  }

  return [...byDate.values()]
    .sort((a, b) => a._sort.localeCompare(b._sort))
    .map(({ _sort: _, ...rest }) => rest)
}

/** Unique city names from day destinations + stay locations. */
export function citiesFromTrip(days: Task[], entries: Task[]): string[] {
  const set = new Set<string>()
  for (const t of days) {
    const c = cityFromDestination(t.attributes?.destination)
    if (c) set.add(c)
  }
  for (const e of entries) {
    if (String(e.attributes?.akind) !== "Stay") continue
    const c = cityFromDestination(e.attributes?.location) || cityFromDestination(e.attributes?.city)
    if (c) set.add(c)
  }
  return [...set]
}
