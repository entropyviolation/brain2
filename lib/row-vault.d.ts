export type RowChange = { kind: string; id: string; deleted?: boolean; row?: Record<string, unknown> }
export type VaultShape = {
  counts: Record<string, number>
  hashes: Record<string, string>
  order: Record<string, string[]>
}
export const KIND_FIELDS: Record<string, string>
export function hashIds(ids: string[]): string
export function describeVault(state: Record<string, unknown>): VaultShape
export function applyRowChanges(
  baseBlob: string,
  rows: RowChange[],
  order?: Record<string, string[]>,
): (VaultShape & { blob: string }) | null
export function matchesHub(
  result: VaultShape | null,
  head: { counts?: Record<string, number> | null; hashes?: Record<string, string> | null } | null,
): boolean
