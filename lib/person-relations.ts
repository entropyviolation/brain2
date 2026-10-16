/**
 * lib/person-relations.ts — Relations a person can have (seeded from code)
 *
 * Read as sentences from the source: "Elijah is a member of Foxtide".
 * Symmetric relations are their own inverse. Many-to-one inverses are fine
 * (`mother-of` → `child-of` while `child-of` → `parent-of`). These are
 * re-seeded on every load like system types; people add their own in the
 * Links tab (stored on the item-type store, `lib/relation-registry.ts`).
 *
 * `RELATION_WORDS` maps a person's free-text Relation field ("sister",
 * "mom") to a relation read from **self's** side, for `lib/self-relations.ts`.
 */
import type { RelationDef } from "@/lib/links"

const P = ["person"]

/** `null` = any type. */
type Types = string[] | null

function sym(id: string, label: string, family: RelationDef["family"]): RelationDef {
  return { id, label, inverse: id, inverseLabel: label, fromTypes: P, toTypes: P, family }
}

function pair(
  id: string,
  label: string,
  inverse: string,
  inverseLabel: string,
  family: RelationDef["family"],
  toTypes: Types = P,
): RelationDef[] {
  const to = toTypes ?? undefined
  return [
    { id, label, inverse, inverseLabel, fromTypes: P, toTypes: to, family },
    { id: inverse, label: inverseLabel, inverse: id, inverseLabel: label, fromTypes: to, toTypes: P, family },
  ]
}

export const PERSON_RELATIONS: RelationDef[] = [
  sym("friends-with", "is friends with", "friend"),
  sym("best-friends-with", "is best friends with", "friend"),
  sym("knows", "knows", "friend"),
  sym("partner-of", "is the partner of", "romance"),
  sym("married-to", "is married to", "romance"),
  sym("dating", "is dating", "romance"),
  sym("ex-of", "is the ex of", "romance"),
  ...pair("parent-of", "is the parent of", "child-of", "is the child of", "family"),
  { id: "mother-of", label: "is the mother of", inverse: "child-of", inverseLabel: "is the child of", fromTypes: P, toTypes: P, family: "family" },
  { id: "father-of", label: "is the father of", inverse: "child-of", inverseLabel: "is the child of", fromTypes: P, toTypes: P, family: "family" },
  sym("sibling-of", "is the sibling of", "family"),
  sym("cousin-of", "is the cousin of", "family"),
  ...pair("grandparent-of", "is the grandparent of", "grandchild-of", "is the grandchild of", "family"),
  ...pair("aunt-uncle-of", "is the aunt or uncle of", "niece-nephew-of", "is the niece or nephew of", "family"),
  sym("roommate-of", "is the roommate of", "place"),
  sym("neighbor-of", "is the neighbor of", "place"),
  ...pair("lives-in", "lives in", "home-of", "is home to", "place", null),
  sym("works-with", "works with", "work"),
  ...pair("manager-of", "is the manager of", "reports-to", "reports to", "work"),
  ...pair("mentor-of", "is the mentor of", "mentee-of", "is the mentee of", "work"),
  ...pair("works-at", "works at", "employs", "employs", "work", null),
  ...pair("member-of", "is a member of", "has-member", "has member", "group", null),
  ...pair("fan-of", "is a fan of", "has-fan", "has fan", "group", null),
  ...pair("met-through", "met through", "introduced", "introduced", "friend"),
]

/**
 * A Relation word → how self relates to that person. `selfRelation` reads
 * "self {label} {person}". Unknown words fall back to `knows` with the word
 * as the label (`lib/self-relations.ts`).
 */
export const RELATION_WORDS: Record<string, string> = {
  friend: "friends-with",
  "best friend": "best-friends-with",
  bestie: "best-friends-with",
  sister: "sibling-of",
  brother: "sibling-of",
  sibling: "sibling-of",
  mom: "child-of",
  mother: "child-of",
  mum: "child-of",
  dad: "child-of",
  father: "child-of",
  parent: "child-of",
  son: "parent-of",
  daughter: "parent-of",
  child: "parent-of",
  kid: "parent-of",
  grandma: "grandchild-of",
  grandpa: "grandchild-of",
  grandmother: "grandchild-of",
  grandfather: "grandchild-of",
  aunt: "niece-nephew-of",
  uncle: "niece-nephew-of",
  niece: "aunt-uncle-of",
  nephew: "aunt-uncle-of",
  cousin: "cousin-of",
  boyfriend: "partner-of",
  girlfriend: "partner-of",
  partner: "partner-of",
  husband: "married-to",
  wife: "married-to",
  spouse: "married-to",
  ex: "ex-of",
  coworker: "works-with",
  "co-worker": "works-with",
  colleague: "works-with",
  boss: "reports-to",
  manager: "reports-to",
  mentor: "mentee-of",
  mentee: "mentor-of",
  roommate: "roommate-of",
  neighbor: "neighbor-of",
  neighbour: "neighbor-of",
}

/** Lowercase, trimmed, a trailing plural "s" tolerated. Undefined when unknown. */
export function relationForWord(word: string | undefined): string | undefined {
  const key = (word ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  if (!key) return undefined
  return RELATION_WORDS[key] ?? (key.endsWith("s") ? RELATION_WORDS[key.slice(0, -1)] : undefined)
}
