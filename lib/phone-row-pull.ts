/**
 * lib/phone-row-pull.ts — Pull the task vault as changed rows, not as 21 MB
 *
 * The phone window used to download every vault on each reload. The task vault
 * is most of that. After one whole download this module remembers the vault and
 * a cursor (`/api/persist/rows`), and a later reload asks for the other vaults
 * (`/api/persist?canon=1&skip=…`) plus only the rows that changed. The rebuilt
 * vault must match the hub's row counts and order hash and the same database
 * epoch. Any doubt returns `null` and the caller downloads the whole vault as
 * before. Nothing here writes storage; the base lives in memory.
 */
import { applyRowChanges, matchesHub } from "@/lib/row-vault.js"

export const TASK_VAULT_KEY = "brain2-task-storage"

export type RowBase = { hub: string; epoch: string; cursor: number; blob: string }

type RowsPage = {
  ok?: boolean
  rows?: unknown[]
  cursor?: number
  more?: boolean
  head?: number
  epoch?: string
  counts?: Record<string, number> | null
  hashes?: Record<string, string> | null
  order?: Record<string, string[]> | null
}

type Fetcher = (path: string) => Promise<unknown | null>

async function getRows(get: Fetcher, since: number, extra = ""): Promise<RowsPage | null> {
  const page = (await get(`/api/persist/rows?since=${since}${extra}`)) as RowsPage | null
  return page && page.ok && Array.isArray(page.rows) && typeof page.epoch === "string" ? page : null
}

/**
 * The hub's cursor now, before a whole download. Rows after it are replayed on
 * the next pull, so a write that lands during the download is not missed.
 */
export async function readRowHead(get: Fetcher): Promise<{ epoch: string; cursor: number } | null> {
  const page = await getRows(get, Number.MAX_SAFE_INTEGER, "&limit=1")
  if (!page || typeof page.head !== "number") return null
  return { epoch: page.epoch as string, cursor: page.head }
}

/** Remember the vault the hub just sent whole. */
export function rowBaseFrom(hub: string, head: { epoch: string; cursor: number } | null, items: Record<string, unknown>): RowBase | null {
  const blob = items[TASK_VAULT_KEY]
  if (!head || typeof blob !== "string") return null
  return { hub, epoch: head.epoch, cursor: head.cursor, blob }
}

/**
 * Rebuild the task vault from `base` plus the hub's changed rows. Null on any
 * mismatch (new epoch, cursor ahead of the hub, count or order differs).
 */
export async function pullTaskVaultRows(get: Fetcher, base: RowBase): Promise<{ blob: string; base: RowBase } | null> {
  const changes: unknown[] = []
  let since = base.cursor
  let last: RowsPage | null = null
  for (let guard = 0; guard < 200; guard++) {
    const page = await getRows(get, since)
    if (!page) return null
    if (page.epoch !== base.epoch) return null
    if (typeof page.head === "number" && page.head < base.cursor) return null
    changes.push(...(page.rows ?? []))
    last = page
    if (!page.more) break
    since = page.cursor ?? since
  }
  if (!last || last.more) return null
  const cursor = typeof last.cursor === "number" ? last.cursor : base.cursor
  let result = applyRowChanges(base.blob, changes as never[])
  if (!result) return null
  if (!matchesHub(result, last)) {
    // Same rows, different order (an insert in the middle, a reorder): ask for the hub's order.
    const ordered = await getRows(get, cursor, "&limit=1&order=1")
    if (!ordered || ordered.epoch !== base.epoch || !ordered.order) return null
    result = applyRowChanges(base.blob, changes as never[], ordered.order)
    if (!result || !matchesHub(result, ordered)) return null
  }
  return { blob: result.blob, base: { ...base, cursor, blob: result.blob } }
}
