/**
 * lib/graph/machinery.ts — Where a derived value comes from (E4, KG-M2, KG-M3)
 *
 * A hand list of derivations the code actually performs. Each answer is
 * order `derived`. This is not a manifest of every store key.
 *
 * Skipped, because a one-line "where from" would be a guess: workflow runs,
 * formula `LOOKUP`, module views, points multipliers, habit grades.
 */
export interface DerivedInput {
  id: string
  label: string
  via: string
}

export interface DerivedValue {
  id: string
  label: string
  order: "derived"
  from: readonly DerivedInput[]
}

export const DERIVED_VALUES: readonly DerivedValue[] = [
  {
    id: "period-nest",
    label: "Day nested in week, month, season, and year",
    order: "derived",
    from: [
      { id: "lib/period-keys.ts", label: "period keys", via: "periodKeyFor" },
      { id: "lib/seasons.ts", label: "calendar quarter as season", via: "quarterKey" },
      { id: "lib/date-utils.ts", label: "Monday week string", via: "getWeekString" },
    ],
  },
  {
    id: "list-membership",
    label: "List members a membership rule added",
    order: "derived",
    from: [
      { id: "lib/list-membership-rules.ts", label: "enabled membership rules", via: "applyMembershipRulesToTask" },
      { id: "Task.listRuleAddedIds", label: "ids a rule added", via: "member-of order derived" },
    ],
  },
  {
    id: "implied-action",
    label: "Logged action from an implied-action rule",
    order: "derived",
    from: [
      { id: "lib/implied-actions.ts", label: "matched logAction effect", via: "buildLoggedActionItem" },
      { id: "Task.loggedAction", label: "the generated Done row", via: "derived-from value:implied-action" },
    ],
  },
  {
    id: "pen-link-fill",
    label: "Companion minutes a pen link paints into blank minutes",
    order: "derived",
    from: [
      { id: "TrackPen.links", label: "standing pen link", via: "applyPenLinks" },
      { id: "lib/entry-links.ts", label: "blank minutes only", via: "attachCompanion" },
    ],
  },
  {
    id: "belief-strength",
    label: "Belief strength",
    order: "derived",
    from: [
      { id: "Item.links", label: "supported-by and refuted-by", via: "linkStanceWeight" },
      { id: "Source.trust", label: "source trust, or observation trust 1", via: "computeBeliefStrength" },
    ],
  },
  {
    id: "pen-minute-rollup",
    label: "Pen minutes rolled up the counts-as parents",
    order: "derived",
    from: [
      { id: "lib/tracking-summary.ts", label: "one total for every tracking view", via: "penTotals" },
      { id: "TrackPen.parentIds", label: "counts-as parents", via: "display depth" },
    ],
  },
  {
    id: "structure-edges",
    label: "Part-of, pen, and list edges on the Links tab",
    order: "derived",
    from: [
      { id: "lib/structure-edges.ts", label: "parent, steps, pen links, lists", via: "structureEdges" },
    ],
  },
]

export function whereFrom(query: string): DerivedValue | null {
  const needle = query.trim().toLowerCase().replace(/^value:/, "")
  if (!needle) return null
  return (
    DERIVED_VALUES.find((value) => value.id === needle || value.label.toLowerCase() === needle) ??
    DERIVED_VALUES.find((value) => value.label.toLowerCase().includes(needle) || value.id.includes(needle)) ??
    null
  )
}

export interface ImpactItem {
  id: string
  title?: string
  lists?: readonly string[]
  links?: readonly { relation: string; targetId: string }[]
  penLinks?: readonly { penId: string }[]
  parentTaskId?: string
}

export interface ImpactList {
  id: string
  name?: string
  membershipRules?: readonly { conditions?: unknown }[]
}

export interface ImpactPen {
  id: string
  name?: string
  links?: readonly { penId: string }[]
}

export interface ImpactSnapshot {
  items?: readonly ImpactItem[]
  lists?: readonly ImpactList[]
  pens?: readonly ImpactPen[]
}

export interface ImpactHit {
  reader: string
  how: string
  order: "derived"
}

function mentions(value: unknown, id: string): boolean {
  return JSON.stringify(value ?? "").includes(id)
}

/** What reads this item, pen, or list. Facts from the snapshot, order derived. */
export function whatReadsThis(subject: { kind: "item" | "pen" | "list"; id: string }, snapshot: ImpactSnapshot): ImpactHit[] {
  const hits: ImpactHit[] = []
  const items = snapshot.items ?? []
  const lists = snapshot.lists ?? []
  const pens = snapshot.pens ?? []
  const id = subject.id.replace(/^(item|pen|list):/, "")

  if (subject.kind === "item") {
    for (const item of items) {
      if (item.id === id) continue
      for (const link of item.links ?? []) {
        const target = link.targetId.replace(/^item:/, "")
        if (target === id) hits.push({ reader: `item:${item.id}`, how: `${item.title || item.id} links ${link.relation}`, order: "derived" })
      }
      if (item.parentTaskId === id) hits.push({ reader: `item:${item.id}`, how: `${item.title || item.id} is filed under this item`, order: "derived" })
    }
    for (const list of lists) {
      if ((list.membershipRules ?? []).some((rule) => mentions(rule.conditions, id))) {
        hits.push({ reader: `list:${list.id}`, how: `${list.name || list.id} has a membership rule that names this item`, order: "derived" })
      }
    }
  }

  if (subject.kind === "pen") {
    for (const item of items) {
      if ((item.penLinks ?? []).some((link) => link.penId === id)) {
        hits.push({ reader: `item:${item.id}`, how: `${item.title || item.id} has a pen link to this pen`, order: "derived" })
      }
    }
    for (const pen of pens) {
      if (pen.id === id) continue
      if ((pen.links ?? []).some((link) => link.penId === id)) {
        hits.push({ reader: `pen:${pen.id}`, how: `${pen.name || pen.id} fills blank minutes from this pen`, order: "derived" })
      }
    }
    const self = pens.find((pen) => pen.id === id)
    if ((self?.links?.length ?? 0) > 0) {
      hits.push({ reader: "value:pen-link-fill", how: "standing links on this pen paint companion minutes", order: "derived" })
    }
  }

  if (subject.kind === "list") {
    for (const item of items) {
      if ((item.lists ?? []).includes(id)) {
        hits.push({ reader: `item:${item.id}`, how: `${item.title || item.id} is a member`, order: "derived" })
      }
    }
    const list = lists.find((row) => row.id === id)
    if ((list?.membershipRules?.length ?? 0) > 0) {
      hits.push({ reader: "value:list-membership", how: `${list?.name || id} fills itself from membership rules`, order: "derived" })
    }
  }

  hits.sort((a, b) => a.reader.localeCompare(b.reader) || a.how.localeCompare(b.how))
  return hits
}
