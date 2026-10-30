/**
 * lib/module-slot-score.ts — Pure bind scorer for a module package slot
 *
 * `scoreSlot` ranks existing lists against one slot. Attribute-id overlap
 * ranks first. Name tokens break a tie. Auto-bind only when one list is a
 * unique high-confidence match. Anything else returns the best few
 * candidates and `"ask"` or `"none"`. A create-policy slot is refused:
 * those installs must not call this, and this function does not choose a list.
 *
 * No model. No store writes. The installer and the template cards do not
 * call this. The install dialog calls it for `policy: "bind"` and installs
 * nothing when the decision is `"ask"`, `"none"`, or a refusal.
 */
import type { List } from "@/lib/types"
import type { ModulePackageSlot } from "@/lib/module-package"

/** Auto-bind, ask the person, or bind nothing. */
export type SlotScoreDecision = "bind" | "ask" | "none"

/** One existing list scored against the slot. */
export interface SlotScoreCandidate {
  listId: string
  /**
   * Jaccard of attribute ids (`|shared| / |union|`). Primary rank.
   * 0 when the slot declares no attributes.
   */
  attributeOverlap: number
  /** Jaccard of name tokens. Breaks an attribute tie. Never outranks a higher attribute overlap. */
  nameOverlap: number
}

/**
 * Result of scoring one slot.
 *
 * `listId` is set only for `"bind"`. `"ask"` and `"none"` leave it unset
 * so a caller cannot treat a suggestion as a choice.
 */
export interface SlotScoreResult {
  decision: SlotScoreDecision
  /** The list to bind. Present only when `decision` is `"bind"`. */
  listId?: string
  /** Best few lists with any overlap, highest attribute overlap first. Empty when refused or nothing overlaps. */
  candidates: SlotScoreCandidate[]
  /**
   * `"create"` when the slot policy is create. No list is chosen.
   * Create-policy installs must not call this function.
   */
  refused?: "create"
}

/**
 * Minimum attribute-id Jaccard for an auto-bind.
 *
 * High confidence is this number and a full cover: every attribute id on
 * the slot is on that list. 0.75 sits under a four-id list with one extra
 * column (4/5 = 0.8) and above a four-id list with two (4/6 ≈ 0.67). A
 * three-id list with one extra column is 3/4 = 0.75 and still binds when
 * it is the only list on the line. A three-of-four partial is the same
 * Jaccard and fails the cover, so it stays a question. A second list that
 * also clears the line is a question too. Name tokens only split a tie
 * between lists with the same attribute overlap.
 */
export const SLOT_BIND_THRESHOLD = 0.75

/** How many overlapping lists to hand back when the person still has to choose. */
const BEST_FEW = 3

const NAME_STOPWORDS = new Set(["the", "a", "an", "of", "and", "or", "to", "for", "list", "lists"])

interface ScoredList extends SlotScoreCandidate {
  coversSlot: boolean
}

function attributeIds(list: { id: string }[] | undefined): Set<string> {
  const ids = new Set<string>()
  for (const attr of list ?? []) {
    if (typeof attr.id !== "string") continue
    const id = attr.id.trim()
    if (id) ids.add(id)
  }
  return ids
}

function nameTokens(name: string): Set<string> {
  const tokens = new Set<string>()
  for (const raw of name.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || NAME_STOPWORDS.has(raw)) continue
    tokens.add(raw)
  }
  return tokens
}

/** `|A ∩ B| / |A ∪ B|`. 0 when either side is empty — no evidence is not a match. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const id of a) if (b.has(id)) shared += 1
  const union = a.size + b.size - shared
  return union === 0 ? 0 : shared / union
}

function covers(slotIds: Set<string>, listIds: Set<string>): boolean {
  if (slotIds.size === 0) return false
  for (const id of slotIds) if (!listIds.has(id)) return false
  return true
}

function sameScore(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

function byRank(a: ScoredList, b: ScoredList): number {
  return b.attributeOverlap - a.attributeOverlap || b.nameOverlap - a.nameOverlap || a.listId.localeCompare(b.listId)
}

function refuseCreate(): SlotScoreResult {
  return { decision: "none", candidates: [], refused: "create" }
}

/**
 * The one list that may bind, or null when the high band is empty, shared,
 * or only split by a blank name.
 */
function uniqueHigh(scored: ScoredList[]): ScoredList | null {
  const high = scored.filter((row) => row.coversSlot && row.attributeOverlap + 1e-9 >= SLOT_BIND_THRESHOLD)
  if (high.length === 0) return null
  const best = high[0]
  if (high.length === 1) return best
  const sameAttribute = high.filter((row) => sameScore(row.attributeOverlap, best.attributeOverlap))
  if (sameAttribute.length !== high.length) return null
  const sameName = sameAttribute.filter((row) => sameScore(row.nameOverlap, best.nameOverlap))
  if (sameName.length === 1 && best.nameOverlap > 0) return best
  return null
}

/**
 * Rank `lists` against `slot`.
 *
 * Create policy returns `{ decision: "none", refused: "create" }` and does
 * not read the lists into a choice. Bind policy auto-binds only a unique
 * list at or above `SLOT_BIND_THRESHOLD` that contains every slot attribute
 * id. Other overlaps come back as `"ask"` (best few) or `"none"`.
 */
export function scoreSlot(lists: readonly List[], slot: ModulePackageSlot): SlotScoreResult {
  if (String(slot.policy) !== "bind") return refuseCreate()

  const slotIds = attributeIds(slot.attributes)
  const slotNames = nameTokens(slot.name)
  const scored: ScoredList[] = lists.map((list) => {
    const listIds = attributeIds(list.itemAttributes)
    return {
      listId: list.id,
      attributeOverlap: jaccard(slotIds, listIds),
      nameOverlap: jaccard(slotNames, nameTokens(list.name)),
      coversSlot: covers(slotIds, listIds),
    }
  })
  scored.sort(byRank)

  const candidates = scored
    .filter((row) => row.attributeOverlap > 0 || row.nameOverlap > 0)
    .slice(0, BEST_FEW)
    .map(({ listId, attributeOverlap, nameOverlap }) => ({ listId, attributeOverlap, nameOverlap }))

  const winner = uniqueHigh(scored)
  if (winner) {
    return { decision: "bind", listId: winner.listId, candidates }
  }
  if (candidates.length === 0) return { decision: "none", candidates: [] }
  return { decision: "ask", candidates }
}
