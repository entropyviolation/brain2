/**
 * lib/self-relations.ts — Self's links from each person's Relation word
 *
 * A person's Relation field ("sister", "friend", "mom") already says how
 * they relate to self. These edges are derived live, never stored, so a
 * changed word changes the edge. On self they read from self's side
 * ("is the sibling of Oey"); on the person, the mirror. A word with no
 * known relation reads "knows" with the word as its label. Pin in the
 * Links tab stores a real link, and the derived twin drops out.
 */
import { inverseRelation, relationLabel } from "@/lib/links"
import { edgeKey, type EgoEdge } from "@/lib/link-graph"
import { findSelfPerson, isSelfPerson } from "@/lib/people-self"
import { relationForWord } from "@/lib/person-relations"
import { relationFamily } from "@/lib/relation-registry"
import type { Task } from "@/lib/types"

function edgeFor(otherId: string, relation: string, word: string, known: boolean): EgoEdge {
  return {
    key: edgeKey(otherId, relation),
    otherId,
    relation,
    label: known ? relationLabel(relation) : `knows · ${word}`,
    direction: "derived",
    family: known ? relationFamily(relation) : "friend",
    derivedFrom: "relation-field",
  }
}

/** Derived edges for the open item: self sees everyone with a Relation word; a person sees self. */
export function derivedSelfEdges(
  item: Pick<Task, "id" | "personProfile">,
  all: Task[],
  dismissed: readonly string[] = [],
): EgoEdge[] {
  const self = isSelfPerson(item) ? item : findSelfPerson(all)
  if (!self) return []
  const out: EgoEdge[] = []
  const hidden = new Set(dismissed)
  if (self.id === item.id) {
    for (const person of all) {
      if (person.id === self.id) continue
      const word = person.personProfile?.relation?.trim()
      if (!word) continue
      const known = relationForWord(word)
      const edge = edgeFor(person.id, known ?? "knows", word, !!known)
      if (!hidden.has(edge.key)) out.push(edge)
    }
    return out
  }
  const word = item.personProfile?.relation?.trim()
  if (!word) return []
  const known = relationForWord(word)
  const fromPerson = known ? inverseRelation(known) : "knows"
  const edge = edgeFor(self.id, fromPerson, word, !!known)
  return hidden.has(edge.key) ? [] : [edge]
}
