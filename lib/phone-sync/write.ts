/**
 * lib/phone-sync/write.ts — Put phone records into the vault
 *
 * The one door every reader uses. Matches each party to People I Know, makes
 * the person's pen on iPhone Texts / iPhone Calls (same ids as the BIM
 * `text:` / `call:` verbs, so a hand-sent text and a synced one share a pen),
 * and adds the rows. Re-applying the same records adds nothing.
 */
import { personRecords } from "@/lib/people-i-know"
import { useTaskStore } from "@/lib/task-store"
import {
  PEN_PALETTE,
  defaultIphoneCallsScope,
  defaultIphoneTextsScope,
  findIphoneCallsScope,
  findIphoneTextsScope,
  useTimeTrackingStore,
  type TrackPen,
  type TrackScope,
} from "@/lib/time-tracking-store"
import { phonePenId } from "./ids"
import { matchPerson, type PhonePerson } from "./people"
import { mergePhoneEntries, recordToEntries } from "./to-entries"
import type { PhoneRecord } from "./types"

export interface ApplyPhoneResult {
  read: number
  written: number
  skipped: number
}

/** People I Know as the matcher wants them. */
export function phonePeople(): PhonePerson[] {
  const { tasks, lists } = useTaskStore.getState()
  return personRecords(tasks, lists).map((task) => ({
    id: task.id,
    name: task.title || task.description || task.id,
    nicknames: task.personProfile?.nicknames,
    phones: task.personProfile?.phones,
    emails: task.personProfile?.emails,
  }))
}

function hashPenColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PEN_PALETTE[hash % PEN_PALETTE.length]
}

function ensureScope(scopes: TrackScope[], find: (s: TrackScope[]) => TrackScope | undefined, make: () => TrackScope) {
  const hit = find(scopes)
  if (hit) return { scope: hit, scopes }
  const scope = make()
  return { scope, scopes: [...scopes, scope] }
}

/** Apply records to the tracking store. `people` defaults to People I Know. */
export function applyPhoneRecords(records: readonly PhoneRecord[], people: readonly PhonePerson[] = phonePeople()): ApplyPhoneResult {
  if (records.length === 0) return { read: 0, written: 0, skipped: 0 }
  const state = useTimeTrackingStore.getState()
  let scopes = state.scopes
  const texts = ensureScope(scopes, findIphoneTextsScope, defaultIphoneTextsScope)
  scopes = texts.scopes
  const calls = ensureScope(scopes, findIphoneCallsScope, defaultIphoneCallsScope)
  scopes = calls.scopes

  const newPens = new Map<string, TrackPen[]>()
  const penFor = (record: PhoneRecord, scopeId: string): string => {
    const match = matchPerson(record.party, people)
    const id = phonePenId(scopeId === calls.scope.id ? "call" : "text", match.name)
    const scope = scopes.find((s) => s.id === scopeId)
    const pending = newPens.get(scopeId) ?? []
    if (!scope?.pens.some((p) => p.id === id) && !pending.some((p) => p.id === id)) {
      pending.push({ id, name: match.name, color: hashPenColor(id), lastUsedAt: Date.now() })
      newPens.set(scopeId, pending)
    }
    return id
  }

  const targets = { textsScopeId: texts.scope.id, callsScopeId: calls.scope.id, penFor }
  const incoming = records.flatMap((record) => recordToEntries(record, targets))
  const merged = mergePhoneEntries(state.entries, state.removedEntryIds ?? [], incoming)
  if (merged.added === 0 && newPens.size === 0 && scopes === state.scopes) {
    return { read: records.length, written: 0, skipped: merged.skipped }
  }
  const nextScopes = scopes.map((scope) => {
    const add = newPens.get(scope.id)
    return add?.length ? { ...scope, pens: [...scope.pens, ...add] } : scope
  })
  useTimeTrackingStore.setState({ entries: merged.entries, scopes: nextScopes })
  return { read: records.length, written: merged.added, skipped: merged.skipped }
}
