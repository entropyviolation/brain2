/**
 * lib/flight-bimby/ask.ts — Answer "when am I flying to New York?" from the Flight items
 *
 * No model and no search: the Flight items already hold the answer. A line that asks when/what about
 * flying is matched to upcoming flights, narrowed by a destination named in it (city or airport
 * code), and answered in one plain sentence per flight. With no flight to match it returns null, so
 * the question goes on to the normal router instead of getting a false "none".
 */
import { FLIGHT_TYPE_ID } from "@/lib/flight-types"
import type { Task } from "@/lib/types"
import { airportInfo } from "./airports"
import { clock12, draftFromItem, flightMinutes, flightTitle } from "./file"
import type { FlightDraft } from "./types"

const ASKING = /\b(when|what\s+(?:time|day|date)|how\s+(?:many\s+days|long)|which\s+day|what\s+flights?|do\s+i\s+have\s+(?:a\s+)?flights?)\b/i
const FLYING = /\b(fly|flying|flight|flights|plane|land|landing|leave|leaving|depart|departing|fly\s+back)\b/i

/** True for a question about the person's own flights. */
export function isFlightQuestion(text: string): boolean {
  return text.length < 200 && ASKING.test(text) && FLYING.test(text) && /\b(i|my|me|we|our)\b/i.test(text)
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayWord(iso: string, now: Date): string {
  const days = Math.round((new Date(`${iso}T00:00:00`).getTime() - startOfDay(now).getTime()) / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  return `in ${days} days`
}

function mentions(q: string, d: FlightDraft, which: "to" | "from"): boolean {
  const code = which === "to" ? d.to : d.from
  if (!code) return false
  const city = airportInfo(code)?.city
  return new RegExp(`\\b${code.toLowerCase()}\\b`).test(q) || Boolean(city && q.includes(norm(city)))
}

function sentence(d: FlightDraft, now: Date): string {
  const date = new Date(`${d.departDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const mins = flightMinutes(d)
  const parts = [
    `${date}${d.departTime ? ` at ${clock12(d.departTime)}` : ""} (${dayWord(d.departDate!, now)})`,
    flightTitle(d),
    d.arriveTime ? `lands ${clock12(d.arriveTime)} local${mins ? `, ${Math.floor(mins / 60)}h ${mins % 60}m in the air` : ""}` : "",
    d.confirmation ? `confirmation ${d.confirmation}` : "",
  ].filter(Boolean)
  return `• ${parts.join(" · ")}`
}

/** The reply, or null when the line is not about flights or no upcoming flight fits. */
export function answerFlightQuestion(text: string, now: Date, tasks: readonly Task[]): string | null {
  if (!isFlightQuestion(text)) return null
  const today = startOfDay(now).getTime()
  const upcoming = tasks
    .filter((t) => t.type === FLIGHT_TYPE_ID && !t.completed)
    .map(draftFromItem)
    .filter((d) => d.departDate && new Date(`${d.departDate}T00:00:00`).getTime() >= today)
    .sort((a, b) => `${a.departDate}${a.departTime ?? ""}`.localeCompare(`${b.departDate}${b.departTime ?? ""}`))
  if (!upcoming.length) return null

  const q = norm(text)
  const toward = upcoming.filter((d) => mentions(q, d, "to"))
  const fromThere = upcoming.filter((d) => mentions(q, d, "from") && /\bfrom\b/.test(q))
  const back = /\b(back|return|home)\b/.test(q) && !toward.length
  let picked = toward.length ? toward : fromThere.length ? fromThere : back ? upcoming.slice(1).length ? upcoming.slice(1) : upcoming : upcoming
  if (!toward.length && !fromThere.length && !back && /\b(next|first)\b/.test(q)) picked = upcoming.slice(0, 1)
  // A destination was named but nothing goes there: let the normal router try.
  if (/\bto\s+[a-z]/.test(q) && !toward.length && !back && !/\bto\s+(book|get|do|be|see|go)\b/.test(q)) return null
  const lead = picked.length === 1 ? "Your flight:" : "Your upcoming flights:"
  return [lead, ...picked.map((d) => sentence(d, now))].join("\n")
}
