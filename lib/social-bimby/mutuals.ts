/**
 * lib/social-bimby/mutuals.ts — Find a person's Instagram among your mutuals
 *
 * "Hang out with Masha" with no handle on Masha: look in the accounts you and Masha both follow. An account is
 * a mutual when it is on the **Instagram mutuals** list (from the analysis import), or on **People I follow on
 * Instagram** with "follows me back" ticked. A name matches the account's display name word for word ("Masha"
 * matches "Masha Ivanova"), or the handle when it holds the name ("mashaaa.v" for Masha).
 *
 * `mutualsFrom` reads tasks and lists; `mutualCandidates` is pure.
 */
import { INSTAGRAM_ACCOUNT_TYPE_ID } from "@/lib/instagram-account-type"
import { IG_FOLLOWS_ME_BACK, IG_USERNAME } from "@/lib/instagram-export"
import { INSTAGRAM_ANALYSIS_LIST_IDS, INSTAGRAM_FOLLOWING_LIST_ID } from "@/lib/instagram-lists"
import type { Task } from "@/lib/types"

export interface Mutual {
  /** The display name on the account, or the handle when it has none. */
  name: string
  username: string
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()

/** Every mutual account in the store. */
export function mutualsFrom(tasks: readonly Task[]): Mutual[] {
  const mutualsList = INSTAGRAM_ANALYSIS_LIST_IDS.mutuals
  const out = new Map<string, Mutual>()
  for (const t of tasks) {
    if (t.type !== INSTAGRAM_ACCOUNT_TYPE_ID) continue
    const username = t.attributes?.[IG_USERNAME]
    if (typeof username !== "string" || !username) continue
    const lists = t.lists ?? []
    const mutual = lists.includes(mutualsList) || (lists.includes(INSTAGRAM_FOLLOWING_LIST_ID) && t.attributes?.[IG_FOLLOWS_ME_BACK] === true)
    if (!mutual) continue
    const title = (typeof t.title === "string" ? t.title : "").trim()
    out.set(username.toLowerCase(), { name: title || username, username })
  }
  return [...out.values()]
}

/**
 * Mutuals that could be this person. A display name that holds every word of the name comes first; then a
 * handle that holds the first name (four letters or more, so "jo" does not match half of Instagram).
 */
export function mutualCandidates(name: string, mutuals: readonly Mutual[]): Mutual[] {
  const want = norm(name).split(" ").filter(Boolean)
  if (!want.length) return []
  const first = want[0]!
  const byName = mutuals.filter((m) => {
    const words = norm(m.name).split(" ")
    return want.every((w) => words.includes(w))
  })
  if (byName.length) return byName
  if (first.length < 4) return []
  return mutuals.filter((m) => norm(m.username).replace(/ /g, "").includes(first))
}
