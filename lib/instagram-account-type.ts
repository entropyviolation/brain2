/**
 * lib/instagram-account-type.ts — Catalog **Instagram Account** item type
 *
 * One Instagram account is one item, whatever lists it sits on. The seven
 * built-in Instagram lists (`lib/instagram-lists.ts`) take this type, and every
 * item they hold carries it. The columns are the `ig-*` attributes the
 * Instagram import already writes. The detail view adds Visit profile and
 * Attach to person (`components/ItemDetail/type-views/InstagramAccountDetail.tsx`);
 * the Default and Details list displays add Visit profile
 * (`components/Lists/list-content/InstagramProfileKey.tsx`). Both are keyed off
 * the type (`instagramProfileKeyHandle`), so a hand-made list of this type
 * behaves the same, and a plain item with a stray `ig-username` does not.
 *
 * An item id for a new account is `igAccountId(username)`, so two devices that
 * make the same account make the same id and a union by id keeps one.
 */
import {
  IG_ACTIVITY,
  IG_BLOCKED,
  IG_DISPLAY_NAME,
  IG_FLAGS,
  IG_FOLLOWED_ME,
  IG_I_FOLLOWED,
  IG_INTERACTIONS,
  IG_LAST_ENGAGED,
  IG_PROFILE,
  IG_REQUESTED,
} from "@/lib/instagram-analysis"
import { IG_FOLLOWER_COUNT, IG_FOLLOWS_ME_BACK, IG_I_FOLLOW_BACK, IG_USERNAME } from "@/lib/instagram-export"
import { instagramUsernameOf } from "@/lib/instagram-profile-link"
import type { AttributeDefinition, ItemTypeDefinition, List, Task } from "@/lib/types"

export const INSTAGRAM_ACCOUNT_TYPE_ID = "instagram-account"

const date = (id: string, name: string): AttributeDefinition => ({ id, name, type: "datetime", datetimeMode: "date" })

const INSTAGRAM_ACCOUNT_ATTRIBUTES: AttributeDefinition[] = [
  { id: IG_USERNAME, name: "Username", type: "string" },
  { id: IG_DISPLAY_NAME, name: "Display name", type: "string" },
  { id: IG_FLAGS, name: "Flags", type: "multistring" },
  { id: IG_FOLLOWER_COUNT, name: "Follower count", type: "number" },
  { id: IG_FOLLOWS_ME_BACK, name: "Follows me back", type: "boolean" },
  { id: IG_I_FOLLOW_BACK, name: "I follow them back", type: "boolean" },
  date(IG_I_FOLLOWED, "I followed"),
  date(IG_FOLLOWED_ME, "They followed me"),
  date(IG_REQUESTED, "Requested"),
  date(IG_BLOCKED, "Blocked"),
  { id: IG_INTERACTIONS, name: "All my interactions", type: "number" },
  ...IG_ACTIVITY.map((a): AttributeDefinition => ({ id: a.id, name: a.name, type: "number" })),
  date(IG_LAST_ENGAGED, "Last I engaged"),
  { id: IG_PROFILE, name: "Profile", type: "link" },
]

export function getInstagramAccountTypeDefinition(): ItemTypeDefinition {
  return {
    id: INSTAGRAM_ACCOUNT_TYPE_ID,
    name: "Instagram Account",
    pluralName: "Instagram Accounts",
    itemLabel: "account",
    description:
      "One Instagram account, once, however many lists it is on. Filled from the Instagram download. The detail view has Visit profile and Attach to person.",
    builtin: true,
    kind: "catalog",
    color: "#be185d",
    attributes: INSTAGRAM_ACCOUNT_ATTRIBUTES,
    displayedAttributes: [IG_USERNAME, IG_DISPLAY_NAME, IG_FOLLOWS_ME_BACK, IG_I_FOLLOW_BACK, IG_INTERACTIONS, IG_LAST_ENGAGED],
    detailPanels: ["details"],
    detailLayout: { featuredAttributeIds: [IG_USERNAME, IG_DISPLAY_NAME, IG_FOLLOWS_ME_BACK, IG_I_FOLLOW_BACK] },
    capabilities: {},
  }
}

export function withInstagramAccountType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === INSTAGRAM_ACCOUNT_TYPE_ID)) return existing
  return [...existing, getInstagramAccountTypeDefinition()]
}

/** The item id a new account gets: the same handle always makes the same id. */
export function igAccountId(username: string): string {
  return `ig-acct-${username.trim().toLowerCase().replace(/[^a-z0-9._]/g, "_")}`
}

/** True when the item is typed as an Instagram account. */
export function isInstagramAccountItem(task: Pick<Task, "type"> | null | undefined): boolean {
  return task?.type === INSTAGRAM_ACCOUNT_TYPE_ID
}

/**
 * The handle a Visit profile key shows for this row, or "". Hard-wired to the
 * type: the item is an Instagram Account, or the list holds that type.
 */
export function instagramProfileKeyHandle(
  task: Pick<Task, "type" | "attributes">,
  list?: Pick<List, "itemTypeId"> | null,
): string {
  if (!isInstagramAccountItem(task) && list?.itemTypeId !== INSTAGRAM_ACCOUNT_TYPE_ID) return ""
  return instagramUsernameOf(task)
}
