/**
 * Shared tier copy: Bare minimum / Goal / Exceptional, Min / Goal / Exc, B / G / E.
 */
import type { SessionTier } from "@/lib/session-plan"

const TIER_LABEL: Record<SessionTier, string> = { min: "Bare minimum", goal: "Goal", exceptional: "Exceptional" }
const TIER_SHORT: Record<SessionTier, string> = { min: "Min", goal: "Goal", exceptional: "Exc" }
const TIER_LETTER: Record<SessionTier, string> = { min: "B", goal: "G", exceptional: "E" }

export { TIER_LABEL, TIER_SHORT, TIER_LETTER }
