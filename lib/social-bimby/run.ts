/**
 * lib/social-bimby/run.ts — BIM chat's door to the Social BIMBY
 *
 * `trySocial` is called from the `social` lane (`lib/ingest/bim-lanes.ts`) and from "send this to social
 * bimby: …" (`lib/ingest/bimby-handoff.ts`, `forced`). A line about a person (a new friend, a DM, a
 * hang-out you want, a birthday) becomes a plan in `useReportStore`, drawn by the Report card. It writes
 * nothing: every change waits for an Accept. Null leaves the line to the rest of the chat.
 *
 * A line about wanting to do things with a few people later ("hang out with Masha … trip with Shelby; note texts
 * and dms from each") is read first by `future.ts`, and opens a follow-up session (`session.ts`): the asks for a
 * missing number or handle, then going over each person's texts and DMs. `liveSessionDeps` are its loaders.
 */
"use client"

import { airportInfo } from "@/lib/flight-bimby/airports"
import { draftFromItem } from "@/lib/flight-bimby/file"
import { FLIGHT_TYPE_ID } from "@/lib/flight-types"
import { personForInstagram } from "@/lib/instagram-person-links"
import { itemTitle } from "@/lib/item-utils"
import { personRecords } from "@/lib/people-i-know"
import { useReportStore } from "@/lib/report-bimby/store"
import { useTaskStore } from "@/lib/task-store"
import { snapshotFromStores } from "@/lib/bim-flow/store-snapshot"
import { loadTexts } from "@/lib/bim-flow/texts-client"
import { TEXTS_ASK_DAYS } from "@/lib/ingest/bim-texts"
import { isPhoneWebStorage } from "@/lib/phone-device"
import { buildFuturePlan, readFuture, type ContactInfo } from "./future"
import { buildGroupPlan, readGroup } from "./group"
import { mutualsFrom } from "./mutuals"
import { startSocialSession, type SessionDeps } from "./session"
import { readSocial, type KnownPerson } from "./parse"
import { buildSocialPlan, type SocialDeps } from "./plan"

export interface SocialReply {
  text: string
  reportId: string
  route: string
}

/** Everyone in People I Know, by name, nicknames and handle. */
export function knownPeople(): KnownPerson[] {
  const { tasks, lists } = useTaskStore.getState()
  return personRecords(tasks, lists)
    .filter((p) => !p.personProfile?.self)
    .map((p) => ({
      id: p.id,
      name: (itemTitle(p) || "").trim(),
      ...(p.personProfile?.instagram ? { instagram: p.personProfile.instagram } : {}),
      ...(p.personProfile?.nicknames?.length ? { nicknames: p.personProfile.nicknames } : {}),
    }))
    .filter((p) => p.name)
}

export function storeSocialDeps(): SocialDeps {
  const { tasks, lists } = useTaskStore.getState()
  return {
    // Past flights too: a trip that is over is dated from the flight in and the flight out.
    flights: tasks.filter((t) => t.type === FLIGHT_TYPE_ID).map(draftFromItem),
    cityOf: (code) => airportInfo(code)?.city,
    instagramOwner: (handle) => {
      const owner = personForInstagram(personRecords(tasks, lists), handle)
      return owner ? itemTitle(owner) : undefined
    },
  }
}

/** What a known person already has for reaching them. */
function contactOf(personId: string): ContactInfo {
  const p = useTaskStore.getState().tasks.find((t) => t.id === personId)
  return { phones: p?.personProfile?.phones ?? [], ...(p?.personProfile?.instagram ? { instagram: p.personProfile.instagram } : {}) }
}

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean)
/** "Masha" is "Masha Ivanova"; every word of the name is in the other. */
const sameName = (a: string, b: string) => {
  const x = words(a)
  const y = words(b)
  return !!x.length && x.every((w) => y.includes(w))
}

/** The hub's address on the iPhone; "" when there is none; undefined on the Mac (same origin). */
async function hubBase(): Promise<string | undefined> {
  return isPhoneWebStorage() ? (await import("@/lib/phone-window").then((m) => m.phoneHubRoute())).url : undefined
}

/** The loaders the review reads: one-to-one texts from the hub, DMs from the Instagram archive. */
export function liveSessionDeps(): SessionDeps {
  return {
    loadTexts: async (name) => {
      const base = await hubBase()
      if (base === "") return null
      const rows = await loadTexts({ days: TEXTS_ASK_DAYS, people: snapshotFromStores().people, ...(base ? { base } : {}) })
      if (!rows) return null
      return rows.filter((r) => !r.group && sameName(name, r.who)).map((r) => ({ at: Date.parse(r.at), dir: r.dir, text: r.text, via: "text" as const }))
    },
    loadDms: async (name) => {
      try {
        const res = await fetch(`/api/instagram/dms?${new URLSearchParams({ name })}`)
        if (!res.ok) return null
        const body = (await res.json()) as { rows?: { ts: number; dir: "in" | "out"; text: string }[] }
        return (body.rows ?? []).map((r) => ({ at: r.ts, dir: r.dir, text: r.text, via: "dm" as const }))
      } catch {
        return null
      }
    },
    putPlan: (plan) => useReportStore.getState().put(plan),
  }
}

/** A line about wanting to do things with a few people later: the card, then the asks and the texts review. */
function tryFuture(text: string, now: Date, people: KnownPerson[], started: number): SocialReply | null {
  const read = readFuture(text, people)
  if (!read) return null
  const { tasks } = useTaskStore.getState()
  const { plan, asks, review } = buildFuturePlan(read, text, now, { mutuals: mutualsFrom(tasks), contactOf })
  if (!plan.effects.length) return null
  useReportStore.getState().put(plan)
  const names = read.people.map((p) => p.name)
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]
  const follow = startSocialSession(asks, review, now.getTime())
  return {
    text: `That's about ${who}, so the Social BIMBY read it: ${plan.effects.length} changes below. Nothing is saved yet: edit what is off, then accept or reject each one.${follow ? `\n\n${follow}` : ""}`,
    reportId: plan.id,
    route: `SOCIAL · future · rules · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  }
}

export function trySocial(text: string, now = new Date(), opts: { forced?: boolean } = {}): SocialReply | null {
  const started = Date.now()
  const people = knownPeople()
  const future = tryFuture(text, now, people, started)
  if (future) return future
  // Three people or more in one line: a change per person, the birthday, the hang-out, and questions back.
  const group = readGroup(text, people)
  if (group) {
    const { plan, questions } = buildGroupPlan(group, text, now, storeSocialDeps())
    useReportStore.getState().put(plan)
    const fresh = group.people.filter((p) => !p.known).length
    const ask = questions.length ? `\n\nA few questions, so I can file the rest:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : ""
    return {
      text: `That's ${group.people.length} people${fresh ? `, ${fresh} new to People I Know` : ""}, so the Social BIMBY read it: ${plan.effects.length} changes below, one per person plus the hang-out. Nothing is saved yet: edit what is off, then accept or reject each one.${ask}`,
      reportId: plan.id,
      route: `SOCIAL · group · rules · ${((Date.now() - started) / 1000).toFixed(1)}s`,
    }
  }
  const read = readSocial(text, people, opts)
  if (!read) return null
  const plan = buildSocialPlan(read, text, now, storeSocialDeps())
  if (!plan.effects.length) return null
  useReportStore.getState().put(plan)
  const n = plan.effects.length
  const who = read.known ? read.known.name : read.name
  return {
    text: `That's about ${who}, so the Social BIMBY read it: ${n} change${n === 1 ? "" : "s"} below. Nothing is saved yet: edit what is off, then accept or reject each one.`,
    reportId: plan.id,
    route: `SOCIAL · rules · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  }
}
