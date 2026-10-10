/**
 * lib/temporal-polarity.ts — Prospective / Retrospective overlay
 *
 * Conceptual labels only. Do not rename persist keys or Task fields.
 * Catalog: docs/TEMPORAL_POLARITY.md. Definition: docs/CANONICAL_FIELDS.md.
 */

export type TemporalPolarity = "prospective" | "retrospective" | "bridge"

/** Short Names / help phrases — not fascia lectures. */
export const TEMPORAL_POLARITY_LABEL: Record<TemporalPolarity, string> = {
  prospective: "Prospective",
  retrospective: "Retrospective",
  bridge: "Bridge",
}

/** One-line help for data-ui-help / aria. */
export const TEMPORAL_POLARITY_HELP: Record<TemporalPolarity, string> = {
  prospective: "Intention written before or toward the period — not what was lived.",
  retrospective: "What the record says happened — paint, actuals, or day-summary prose.",
  bridge: "Confirms or compares plan with lived time — does not merge them.",
}

export const TEMPORAL_POLARITIES: readonly TemporalPolarity[] = [
  "prospective",
  "retrospective",
  "bridge",
] as const

/** DOM attribute value for data-temporal. */
export function temporalAttr(polarity: TemporalPolarity): TemporalPolarity {
  return polarity
}
