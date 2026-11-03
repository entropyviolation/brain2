/**
 * lib/list-sets.ts — Set algebra over lists (pure; no stores, no UI)
 *
 * An item is "on" a list when its id is in `task.lists`. These helpers combine any number of lists: `union`
 * (on any), `intersection` (on all), `difference` (on the first, on none of the rest). `combineLists` takes a
 * small expression, so a screen, a tool, or the Lists BIMBY can ask "on A and B but not C" the same way.
 * Order of the input is kept. Used by `lib/lists-helper/tools.ts` (collect-items).
 */

export type SetOp = "union" | "intersection" | "difference"

/** "all of `all`, any of `any` (when given), none of `none`". Empty parts are ignored. */
export interface ListSetExpr {
  all?: string[]
  any?: string[]
  none?: string[]
}

type Membership = { lists?: string[] }

const onList = (t: Membership, id: string) => (t.lists ?? []).includes(id)

/** Items on at least one of the lists. With no lists: nothing. */
export function union<T extends Membership>(items: T[], listIds: string[]): T[] {
  return listIds.length ? items.filter((t) => listIds.some((id) => onList(t, id))) : []
}

/** Items on every one of the lists. With no lists: nothing. */
export function intersection<T extends Membership>(items: T[], listIds: string[]): T[] {
  return listIds.length ? items.filter((t) => listIds.every((id) => onList(t, id))) : []
}

/** Items on the first list and on none of the others. */
export function difference<T extends Membership>(items: T[], listIds: string[]): T[] {
  const [first, ...rest] = listIds
  return first === undefined ? [] : items.filter((t) => onList(t, first) && !rest.some((id) => onList(t, id)))
}

export function combine<T extends Membership>(op: SetOp, items: T[], listIds: string[]): T[] {
  return op === "union" ? union(items, listIds) : op === "intersection" ? intersection(items, listIds) : difference(items, listIds)
}

/** Narrow `items` by an expression. Each part that is given must hold; an expression with no parts keeps everything. */
export function combineLists<T extends Membership>(items: T[], expr: ListSetExpr): T[] {
  let rows = items
  if (expr.all?.length) rows = intersection(rows, expr.all)
  if (expr.any?.length) rows = union(rows, expr.any)
  if (expr.none?.length) rows = rows.filter((t) => !expr.none!.some((id) => onList(t, id)))
  return rows
}

/** Counts after each step, for showing the work: [label, how many remain]. */
export function combineSteps<T extends Membership>(items: T[], expr: ListSetExpr, nameOf: (id: string) => string): { label: string; count: number }[] {
  const steps: { label: string; count: number }[] = [{ label: "start", count: items.length }]
  let rows = items
  if (expr.all?.length) {
    rows = intersection(rows, expr.all)
    steps.push({ label: `on ${expr.all.map(nameOf).map((n) => `"${n}"`).join(" and ")}`, count: rows.length })
  }
  if (expr.any?.length) {
    rows = union(rows, expr.any)
    steps.push({ label: `on ${expr.any.map(nameOf).map((n) => `"${n}"`).join(" or ")}`, count: rows.length })
  }
  for (const id of expr.none ?? []) {
    rows = rows.filter((t) => !onList(t, id))
    steps.push({ label: `not on "${nameOf(id)}"`, count: rows.length })
  }
  return steps
}
