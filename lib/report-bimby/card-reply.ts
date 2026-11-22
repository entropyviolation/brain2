/**
 * lib/report-bimby/card-reply.ts — The Card Reply BIMBY: a chat line that answers one change on a card
 *
 * Tap a change on a Report, Stream or Social card and type: the line comes here with that change
 * (`reply-target.ts`, `sendToBim({ about })`). The BIMBY reads it against that change and answers with a new card;
 * the old change is set aside (rejected, "Reconsider" brings it back). Nothing is saved until Accept.
 *
 * Today it knows one kind:
 *   - `birthday`: "the same day as the foxtide show at brooklyn steel last weekend. and 22 years ago so 2004".
 *     A day said outright is used as is. A day tied to an event is looked up on the web (only the query leaves
 *     the Mac) and read in code (`lib/social-bimby/birthday-reply.ts`); the year is said or counted back.
 *
 * Any other kind returns null and the line goes through the chat as usual.
 */

import { hubSearch, type WebFound, type WebSearch } from "@/lib/bim-flow/web-lane"
import { pickEventDate, readBirthdayReply } from "@/lib/social-bimby/birthday-reply"
import { useReportStore } from "./store"
import { fieldValue, type Effect, type ReportPlan } from "./types"

export interface CardReply {
  text: string
  route: string
  reportId?: string
  evidence?: string[]
}

export interface CardReplyDeps {
  /** Tests pass their own; default the hub (or the phone's hub). */
  search?: WebSearch
}

const pad = (n: number) => String(n).padStart(2, "0")
const nice = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
let seq = 0

async function defaultSearch(): Promise<WebSearch> {
  try {
    const { phoneSearch } = await import("@/lib/bim-flow/web-ask")
    return await phoneSearch()
  } catch {
    return hubSearch
  }
}

const sourcesOf = (found: WebFound) => [`searched the web: ${found.query}`, ...found.results.slice(0, 6).map((r) => `${r.title} · ${r.url}`)]

/** Answer a line about one change on a card. Null when this kind has no reader yet. */
export async function replyToCard(text: string, ref: { planId: string; effectId: string }, now: Date, deps: CardReplyDeps = {}): Promise<CardReply | null> {
  const t0 = Date.now()
  const secs = () => ((Date.now() - t0) / 1000).toFixed(1)
  const plan = useReportStore.getState().plans[ref.planId]
  const effect = plan?.effects.find((e) => e.id === ref.effectId)
  if (!plan || !effect) return { text: "That card is no longer kept on this device, so I can't change it. Say it again as a new line.", route: "REPLY · gone · code" }
  if (effect.kind !== "birthday") return null

  const person = fieldValue(effect, "person") || effect.title.replace(/['’]s birthday$/i, "")
  const first = person.split(/\s+/)[0] || person
  const read = readBirthdayReply(text, now)
  const trace = [`Read as a reply to the card "${effect.title}".`]
  const why: string[] = []
  let evidence: string[] = []
  let month: number
  let day: number
  let eventYear = now.getFullYear()
  let route = "REPLY · birthday · code"

  if (read.monthDay) {
    ;({ month, day } = read.monthDay)
    trace.push(`You said the day: ${month}/${day}.`)
    why.push(`You said the day is ${new Date(2000, month - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`)
  } else if (read.event && read.query) {
    trace.push(`The day is the day of: ${read.event}.`, read.window ? `That was ${read.window.said}: ${read.window.from} to ${read.window.to}.` : "No time was said; looking in the past year.")
    const search = deps.search ?? (await defaultSearch())
    const found = await search(read.query)
    if (!found || !found.results.length) {
      return {
        text: `I couldn't look up "${read.query}" just now${found ? " (no results)" : " (the search failed or the Mac hub did not answer)"}. Type ${first}'s birthday as a date (${read.year ?? "YYYY"}-MM-DD), or tap the card and try again.`,
        route: `REPLY · birthday · WEB none · ${secs()}s`,
        evidence: [`searched the web: ${read.query}`],
      }
    }
    evidence = sourcesOf(found)
    route = `REPLY · birthday · WEB · code · ${secs()}s`
    const hit = pickEventDate(found, read, now)
    if (!hit) {
      return {
        text: `I searched "${found.query}" but no page put a date next to ${read.event}${read.window ? ` around ${read.window.said}` : ""}. Type the day (11/14), or say where it was listed.`,
        route,
        evidence,
      }
    }
    const d = new Date(`${hit.iso}T12:00:00`)
    month = d.getMonth() + 1
    day = d.getDate()
    eventYear = d.getFullYear()
    trace.push(`Searched the web: "${found.query}". ${hit.source.title} (${host(hit.source.url)}) has it on ${nice(hit.iso)}.`)
    why.push(`${read.event} was on ${nice(hit.iso)}, per ${host(hit.source.url)}.`)
    if (!hit.inWindow) why.push(`That is near ${read.window?.said ?? "the time you said"}, not inside it. Check the day before Accept.`)
    if (hit.others.length) why.push(`Other days the pages gave: ${hit.others.map(nice).join(", ")}.`)
    evidence = [`${host(hit.source.url)}: "${hit.source.said}"`, ...evidence]
  } else {
    return {
      text: `I read that as a reply to "${effect.title}" but found no day in it. Say the date (march 14), or the event it fell on ("same day as the show at Brooklyn Steel last weekend").`,
      route: "REPLY · birthday · code",
    }
  }

  // The year: said, counted back, or kept from the card.
  const counted = read.yearsAgo !== undefined ? eventYear - read.yearsAgo : undefined
  const oldYear = /^(\d{4})-/.exec(fieldValue(effect, "date"))?.[1]
  let year: number
  if (read.year) {
    year = read.year
    why.push(`You said the year: ${year}.`)
    if (counted !== undefined && counted !== year) why.push(`${read.yearsAgo} years before ${eventYear} is ${counted}, not ${year}. ${year} is kept, as said.`)
    else if (counted !== undefined) why.push(`${read.yearsAgo} years before ${eventYear} agrees.`)
  } else if (counted !== undefined) {
    year = counted
    why.push(`${read.yearsAgo} years before ${eventYear} is ${year}.`)
  } else if (oldYear && Number(oldYear) < now.getFullYear()) {
    year = Number(oldYear)
    why.push(`No year said; kept ${year} from the card.`)
  } else {
    year = eventYear
    why.push(`No year said, so ${year} stands in. Change it if you know it.`)
  }
  const date = `${year}-${pad(month)}-${pad(day)}`
  trace.push(`So ${first}'s birthday is ${date}.`)

  const newPlan: ReportPlan = {
    id: `reply-${Date.now().toString(36)}-${++seq}`,
    text,
    at: now.toISOString(),
    trace,
    effects: [
      {
        id: `soc-birthday-${Date.now().toString(36)}-${++seq}`,
        kind: "birthday",
        title: `${first}'s birthday`,
        reasoning: why,
        evidence,
        fields: [
          { key: "person", label: "Person", type: "text", value: person },
          { key: "date", label: "Birthday", type: "text", value: date },
        ],
        status: "pending",
      } satisfies Effect,
    ],
  }
  const store = useReportStore.getState()
  store.put(newPlan)
  // The old change is set aside, so the two can't both be accepted. Reconsider brings it back.
  if (effect.status === "pending" || effect.status === "failed") store.setStatus(plan.id, effect.id, "rejected", "Replaced by the card in BIM's reply below.")

  return {
    text: `${first}'s birthday: ${nice(date).replace(/^\w+, /, "")}. ${why[0]} Accept the card to save it.`,
    route,
    reportId: newPlan.id,
    evidence,
  }
}
