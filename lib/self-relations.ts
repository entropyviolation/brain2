/**
 * lib/self-relations.ts — Self knows everyone (PD 7.1).
 *
 * Derived link edges from the person Relation field. Computed live, never
 * stored, so editing Relation updates them. Pin on the ledger stores a real
 * link, and `egoEdges` then drops the derived twin (same key).
 *
 * - On **Self** (`isSelfPerson`): for every other person P with a Relation
 *   word, one edge Self → P read from Self's side through `RELATION_WORDS`
 *   (sister → "is the sibling of"; mom → "is the child of"). An unknown word
 *   becomes `knows` with the word as its label ("your coach").
 * - On **P**: the mirror toward Self (`personRelation`: "is the mother of"),
 *   or `knows` labeled "is your coach".
 * - No Self item → no derived edges.
 *
 * The item passed in is the draft, so a Relation typed on P shows on P's
 * Links tab before Save. Self's view reads everyone else from `all` (saved).
 */
import { edgeKey, relationFamily, type EgoEdge } from "@/lib/link-graph"
import { isSelfPerson } from "@/lib/people-self"
import { relationWord } from "@/lib/person-relations"
import type { ItemRecord } from "@/lib/types"

type PersonLike = Pick<ItemRecord, "id" | "personProfile">

export const SELF_RELATION_SOURCE = "relation-field"

function derivedEdge(otherId: string, relation: string, label?: string): EgoEdge {
  return {
    key: edgeKey(otherId, relation),
    otherId,
    relation,
    direction: "derived",
    family: relationFamily(relation),
    derivedFrom: SELF_RELATION_SOURCE,
    ...(label ? { label } : {}),
  }
}

function cleanWord(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ")
}

export function derivedSelfEdges(item: PersonLike, all: readonly PersonLike[]): EgoEdge[] {
  if (isSelfPerson(item)) {
    const out: EgoEdge[] = []
    for (const person of all) {
      if (person.id === item.id || isSelfPerson(person)) continue
      const raw = cleanWord(person.personProfile?.relation)
      if (!raw) continue
      const word = relationWord(raw)
      out.push(word ? derivedEdge(person.id, word.relation) : derivedEdge(person.id, "knows", `your ${raw.toLowerCase()}`))
    }
    return out
  }
  const self = all.find((task) => isSelfPerson(task) && task.id !== item.id)
  if (!self) return []
  const raw = cleanWord(item.personProfile?.relation)
  if (!raw) return []
  const word = relationWord(raw)
  return [word ? derivedEdge(self.id, word.personRelation) : derivedEdge(self.id, "knows", `is your ${raw.toLowerCase()}`)]
}
