/**
 * lib/social-bimby/run.ts — BIM chat's door to the Social BIMBY
 *
 * `trySocial` is called from the `social` lane (`lib/ingest/bim-lanes.ts`) and from "send this to social
 * bimby: …" (`lib/ingest/bimby-handoff.ts`, `forced`). A line about a person (a new friend, a DM, a
 * hang-out you want, a birthday) becomes a plan in `useReportStore`, drawn by the Report card. It writes
 * nothing: every change waits for an Accept. Null leaves the line to the rest of the chat.
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
    flights: tasks.filter((t) => t.type === FLIGHT_TYPE_ID && !t.completed).map(draftFromItem),
    cityOf: (code) => airportInfo(code)?.city,
    instagramOwner: (handle) => {
      const owner = personForInstagram(personRecords(tasks, lists), handle)
      return owner ? itemTitle(owner) : undefined
    },
  }
}

export function trySocial(text: string, now = new Date(), opts: { forced?: boolean } = {}): SocialReply | null {
  const started = Date.now()
  const read = readSocial(text, knownPeople(), opts)
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
