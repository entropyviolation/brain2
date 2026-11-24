/**
 * lib/affirmation-type.ts — The Affirmation item type and its built-in stats (pure)
 *
 * An Affirmation item carries four values read from what already happened, never typed by hand:
 * how many times the line came up (a morning ritual showed it), how many times it was said aloud
 * (`lib/affirmation-log-store.ts`), and the days of each. `affirmationStats` works them out from those
 * logs. The Lists BIMBY makes this type when asked for "item type Affirmation" and fills the values when
 * it applies the type (`lib/lists-helper/tools.ts`). Lines match by `affirmationKey`, so case and
 * punctuation do not matter.
 */

import { affirmationKey } from "@/lib/affirmation-lenses"
import type { AttributeDefinition, AttributeValue, ItemTypeDefinition } from "@/lib/types"

export const AFFIRMATION_TYPE_ID = "affirmation"

export const AFFIRMATION_STAT = {
  timesShown: "affirmation-times-shown",
  timesSaid: "affirmation-times-said",
  daysShown: "affirmation-days-shown",
  daysSaid: "affirmation-days-said",
  lastSaid: "affirmation-last-said",
} as const

/** Attribute ids the stats own. Only these may be filled by a BIMBY on an Affirmation item. */
export const AFFIRMATION_STAT_IDS: readonly string[] = Object.values(AFFIRMATION_STAT)

export const AFFIRMATION_ATTRIBUTES: AttributeDefinition[] = [
  { id: AFFIRMATION_STAT.timesShown, name: "Times came up", type: "number" },
  { id: AFFIRMATION_STAT.timesSaid, name: "Times said", type: "number" },
  { id: AFFIRMATION_STAT.daysShown, name: "Days came up", type: "multistring", allowMultiple: true },
  { id: AFFIRMATION_STAT.daysSaid, name: "Days said", type: "multistring", allowMultiple: true },
  { id: AFFIRMATION_STAT.lastSaid, name: "Last said", type: "datetime", datetimeMode: "date" },
]

/** The type as the Lists BIMBY makes it. Notes, links and history come with every item, as for any type. */
export function affirmationTypeDefinition(id: string = AFFIRMATION_TYPE_ID, name = "Affirmation"): ItemTypeDefinition {
  return {
    id,
    name,
    pluralName: "Affirmations",
    itemLabel: "affirmation",
    description: "A line to say aloud. Counts and days come from the morning ritual and the said-aloud log.",
    detailPanels: ["details"],
    attributes: AFFIRMATION_ATTRIBUTES.map((a) => ({ ...a })),
    displayedAttributes: [AFFIRMATION_STAT.timesShown, AFFIRMATION_STAT.timesSaid, AFFIRMATION_STAT.lastSaid],
    capabilities: {},
  }
}

/** True for a name that means this type ("Affirmation", "affirmations"). */
export function isAffirmationTypeName(name: string): boolean {
  return /^affirmations?$/i.test(name.trim())
}

/** What the logs hold: each said-aloud row, and the lines each day's morning ritual showed. */
export interface AffirmationLogs {
  said: { key: string; date: string }[]
  shown: { date: string; lines: string[] }[]
}

/** The stat values for one line. Days are sorted, oldest first. */
export function affirmationStats(text: string, logs: AffirmationLogs): Record<string, AttributeValue> {
  const key = affirmationKey(text)
  const said = logs.said.filter((r) => r.key === key)
  const shownDays = [...new Set(logs.shown.filter((d) => d.lines.some((l) => affirmationKey(l) === key)).map((d) => d.date))].sort()
  const saidDays = [...new Set(said.map((r) => r.date))].sort()
  return {
    [AFFIRMATION_STAT.timesShown]: shownDays.length,
    [AFFIRMATION_STAT.timesSaid]: said.length,
    [AFFIRMATION_STAT.daysShown]: shownDays,
    [AFFIRMATION_STAT.daysSaid]: saidDays,
    [AFFIRMATION_STAT.lastSaid]: saidDays.at(-1) ?? null,
  }
}
