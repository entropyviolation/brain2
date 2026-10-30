/**
 * lib/person-relations.ts — Code-defined relations between people (5.2).
 *
 * Seeds live in code, like system item types, and are registered with
 * `lib/relation-registry.ts` on first use. Labels read as sentences from the
 * source: "Elijah is a member of Foxtide", "Foxtide has member Elijah".
 *
 * Many-to-one inverses are fine: `mother-of` reads back as `child-of`, while
 * `child-of` reads back as `parent-of`.
 *
 * `RELATION_WORDS` maps a word typed into a person's Relation field ("sister",
 * "boss") to a seed, read from Self's side (7.1 uses it).
 */
import type { RelationDef, RelationFamily } from "@/lib/links"
import { LOCATION_TYPE_ID } from "@/lib/location-types"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import { PHOTO_TYPE_ID } from "@/lib/photo-types"

const P = [PERSON_TYPE_ID]

function sym(id: string, label: string, family: RelationFamily): RelationDef {
  return { id, label, inverse: id, inverseLabel: label, fromTypes: P, toTypes: P, family }
}

function pair(
  id: string,
  label: string,
  inverse: string,
  inverseLabel: string,
  family: RelationFamily,
  scope: { fromTypes?: string[]; toTypes?: string[] } = { fromTypes: P, toTypes: P },
): RelationDef[] {
  const back = {
    ...(scope.toTypes ? { fromTypes: scope.toTypes } : {}),
    ...(scope.fromTypes ? { toTypes: scope.fromTypes } : {}),
  }
  return [
    { id, label, inverse, inverseLabel, family, ...scope },
    { id: inverse, label: inverseLabel, inverse: id, inverseLabel: label, family, ...back },
  ]
}

/** A one-way relation whose inverse is another seed (many-to-one). */
function into(id: string, label: string, inverse: string, inverseLabel: string, family: RelationFamily): RelationDef {
  return { id, label, inverse, inverseLabel, fromTypes: P, toTypes: P, family }
}

const fromPerson = { fromTypes: P }
const toLocation = { fromTypes: P, toTypes: [LOCATION_TYPE_ID] }

/**
 * Seed hierarchy (LINKS_REDESIGN L1.3): R ⊑ parent. This names what the
 * many-to-one inverses assumed (`mother-of` ⊑ `parent-of`). Seeds not listed
 * sit under `related`.
 */
const SEED_PARENTS: Record<string, string> = {
  knows: "related",
  "spends-time-with": "knows",
  "friends-with": "knows",
  "best-friends-with": "friends-with",
  "partner-of": "knows",
  "married-to": "partner-of",
  dating: "partner-of",
  "ex-of": "knows",
  "family-of": "knows",
  "parent-of": "family-of",
  "child-of": "family-of",
  "mother-of": "parent-of",
  "father-of": "parent-of",
  "sibling-of": "family-of",
  "cousin-of": "family-of",
  "grandparent-of": "family-of",
  "grandchild-of": "family-of",
  "aunt-uncle-of": "family-of",
  "niece-nephew-of": "family-of",
  "roommate-of": "knows",
  "neighbor-of": "knows",
  "works-with": "knows",
  "manager-of": "works-with",
  "reports-to": "works-with",
  "mentor-of": "knows",
  "mentee-of": "knows",
}

const SEEDS: RelationDef[] = [
  // friend
  sym("friends-with", "is friends with", "friend"),
  sym("knows", "knows", "friend"),
  sym("spends-time-with", "spends time with", "friend"),
  sym("best-friends-with", "is best friends with", "friend"),
  // romance
  sym("partner-of", "is the partner of", "romance"),
  sym("married-to", "is married to", "romance"),
  sym("dating", "is dating", "romance"),
  sym("ex-of", "is the ex of", "romance"),
  // family
  sym("family-of", "is family of", "family"),
  ...pair("parent-of", "is the parent of", "child-of", "is the child of", "family"),
  into("mother-of", "is the mother of", "child-of", "is the child of", "family"),
  into("father-of", "is the father of", "child-of", "is the child of", "family"),
  sym("sibling-of", "is the sibling of", "family"),
  sym("cousin-of", "is the cousin of", "family"),
  ...pair("grandparent-of", "is the grandparent of", "grandchild-of", "is the grandchild of", "family"),
  ...pair("aunt-uncle-of", "is the aunt or uncle of", "niece-nephew-of", "is the niece or nephew of", "family"),
  // place
  sym("roommate-of", "is the roommate of", "place"),
  sym("neighbor-of", "is the neighbor of", "place"),
  ...pair("lives-in", "lives in", "home-of", "is home to", "place", fromPerson),
  ...pair("born-in", "was born in", "birthplace-of", "is the birthplace of", "place", toLocation),
  ...pair("grew-up-in", "grew up in", "where-grew-up", "is where they grew up", "place", toLocation),
  ...pair("located-in", "is located in", "location-of", "contains", "place", { fromTypes: [LOCATION_TYPE_ID], toTypes: [LOCATION_TYPE_ID] }),
  // photos
  ...pair("depicts", "shows", "appears-in", "appears in", "other", { fromTypes: [PHOTO_TYPE_ID], toTypes: P }),
  ...pair("taken-at", "was taken at", "place-of-photo", "is where this was taken", "place", {
    fromTypes: [PHOTO_TYPE_ID],
    toTypes: [LOCATION_TYPE_ID],
  }),
  // work
  sym("works-with", "works with", "work"),
  ...pair("manager-of", "is the manager of", "reports-to", "reports to", "work"),
  ...pair("mentor-of", "is the mentor of", "mentee-of", "is the mentee of", "work"),
  ...pair("works-at", "works at", "employs", "employs", "work", fromPerson),
  // group
  ...pair("member-of", "is a member of", "has-member", "has member", "group", fromPerson),
  ...pair("fan-of", "is a fan of", "has-fan", "has fan", "group", fromPerson),
  // how they met
  ...pair("met-through", "met through", "introduced", "introduced", "friend"),
]

export const PERSON_RELATIONS: RelationDef[] = SEEDS.map((def) => ({
  ...def,
  parent: SEED_PARENTS[def.id] ?? "related",
  origin: "seed" as const,
}))

/**
 * A Relation-field word read from Self's side. `relation` is the link Self
 * holds toward the person; for `mom`, Self `child-of` the person (the person
 * is the mother of Self). `personRelation` is the same edge read from the
 * person's side.
 */
export interface RelationWord {
  relation: string
  personRelation: string
}

function word(relation: string, personRelation = relation): RelationWord {
  return { relation, personRelation }
}

export const RELATION_WORDS: Record<string, RelationWord> = {
  friend: word("friends-with"),
  "best friend": word("best-friends-with"),
  bestie: word("best-friends-with"),
  sister: word("sibling-of"),
  brother: word("sibling-of"),
  sibling: word("sibling-of"),
  mom: word("child-of", "mother-of"),
  mother: word("child-of", "mother-of"),
  dad: word("child-of", "father-of"),
  father: word("child-of", "father-of"),
  parent: word("child-of", "parent-of"),
  son: word("parent-of", "child-of"),
  daughter: word("parent-of", "child-of"),
  child: word("parent-of", "child-of"),
  boyfriend: word("partner-of"),
  girlfriend: word("partner-of"),
  partner: word("partner-of"),
  husband: word("married-to"),
  wife: word("married-to"),
  spouse: word("married-to"),
  coworker: word("works-with"),
  colleague: word("works-with"),
  roommate: word("roommate-of"),
  cousin: word("cousin-of"),
  neighbor: word("neighbor-of"),
  boss: word("reports-to", "manager-of"),
  manager: word("reports-to", "manager-of"),
  mentor: word("mentee-of", "mentor-of"),
  grandma: word("grandchild-of", "grandparent-of"),
  grandpa: word("grandchild-of", "grandparent-of"),
  grandparent: word("grandchild-of", "grandparent-of"),
  aunt: word("niece-nephew-of", "aunt-uncle-of"),
  uncle: word("niece-nephew-of", "aunt-uncle-of"),
  ex: word("ex-of"),
}

function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/[^a-z ]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Map a Relation field word to a seed. Lowercase, trims, plural-tolerant. */
export function relationWord(raw: string | undefined | null): RelationWord | undefined {
  if (!raw) return undefined
  const w = normalizeWord(raw)
  if (!w) return undefined
  if (RELATION_WORDS[w]) return RELATION_WORDS[w]
  const candidates = [w.endsWith("ies") ? `${w.slice(0, -3)}y` : "", w.endsWith("es") ? w.slice(0, -2) : "", w.endsWith("s") ? w.slice(0, -1) : ""]
  for (const c of candidates) if (c && RELATION_WORDS[c]) return RELATION_WORDS[c]
  const singular = candidates.find(Boolean) ?? w
  // "co-worker" → "co worker" → "coworker"
  const joined = singular.replace(/ /g, "")
  return RELATION_WORDS[joined]
}

/** Keys for the Relation field datalist. */
export const RELATION_WORD_KEYS: string[] = Object.keys(RELATION_WORDS)
