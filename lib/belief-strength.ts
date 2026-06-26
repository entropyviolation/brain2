/**
 * lib/belief-strength.ts — Derived belief strength (Brain2 feature #10)
 *
 * Pure computation of how strongly the evidence supports a belief, on a 0-1
 * scale where 0.5 = "no net evidence / perfectly balanced". A belief links to
 * Source items through the typed `supported-by` / `refuted-by` relations; each
 * link carries a `stance` (strong-support … strong-refute) and each linked
 * source carries a `trust` attribute (0-1). Strength reflects BOTH the stance
 * and the amount of (trust-weighted) evidence.
 *
 * ── Formula ────────────────────────────────────────────────────────────────
 * For every evidence link i pointing at a known source:
 *   sign_i  = stance weight of the link in [-1, +1]
 *             (explicit stance, else the stance implied by the relation)
 *   trust_i = source trust in [0, 1] (defaults to 0.5 when unset)
 *   signed_i = sign_i * trust_i        // can be negative (refuting)
 *   mass_i   = |sign_i| * trust_i      // "weight of evidence" this link adds
 *
 * Aggregate:
 *   net  = Σ signed_i                  // net lean of the evidence
 *   mass = Σ mass_i                    // total trust-weighted evidence
 *
 * When mass == 0 (no links, all neutral, or all zero-trust) → strength = 0.5.
 * Otherwise:
 *   direction  = net / mass            // ∈ [-1, +1]: support↔refute balance
 *   confidence = mass / (mass + K)     // ∈ [0, 1): grows with evidence amount
 *   strength   = clamp01(0.5 + 0.5 * direction * confidence)
 *
 * `confidence` makes the NUMBER (and trust) of sources matter, not just their
 * balance: one weak/low-trust source nudges strength only slightly off 0.5,
 * while many strong, high-trust sources push it toward 0 or 1. `K` is the
 * evidence mass at which confidence reaches 0.5 (one fully-trusted, strong
 * source). Tunable via `options.evidenceHalfMass`.
 */
import type { ItemLink, AttributeValue } from "@/lib/types"
import { isEvidenceRelation, linkStanceWeight } from "@/lib/links"
import { SOURCE_ATTR, DEFAULT_SOURCE_TRUST } from "@/lib/second-brain-types"

/** Minimal source shape: an id and attributes carrying `trust`. */
export interface SourceLike {
  id: string
  attributes?: Record<string, AttributeValue>
}

/** Minimal belief shape: optionally carries its own evidence links. */
export interface BeliefLike {
  id?: string
  links?: ItemLink[]
}

export interface BeliefStrengthOptions {
  /** Evidence mass at which `confidence` = 0.5. Default 1 (one strong, trusted source). */
  evidenceHalfMass?: number
}

export interface BeliefStrengthResult {
  /** Final strength in [0, 1] (0.5 = no net evidence). */
  strength: number
  /** Net trust-weighted lean (Σ signed). Positive supports, negative refutes. */
  net: number
  /** Total trust-weighted evidence mass (Σ |signed|). */
  mass: number
  /** Number of evidence links that resolved to a known source. */
  contributingLinks: number
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Read a source's trust attribute, clamped to [0, 1] (defaults to 0.5). */
export function getSourceTrust(source: SourceLike | undefined): number {
  const raw = source?.attributes?.[SOURCE_ATTR.trust]
  if (raw === undefined || raw === null || raw === "") return DEFAULT_SOURCE_TRUST
  const n = typeof raw === "number" ? raw : Number(raw)
  if (Number.isNaN(n)) return DEFAULT_SOURCE_TRUST
  return clamp01(n)
}

/**
 * Detailed belief-strength computation. `links` are the evidence links from the
 * belief to its sources (defaults to `belief.links`); `linkedSources` supplies
 * the trust for each linked source by id. Only evidence relations
 * (`supports`/`supported-by`/`refutes`/`refuted-by`) pointing at a known source
 * contribute; unknown targets and non-evidence relations are ignored.
 */
export function computeBeliefStrengthDetailed(
  belief: BeliefLike,
  linkedSources: SourceLike[],
  links: ItemLink[] = belief?.links ?? [],
  options: BeliefStrengthOptions = {},
): BeliefStrengthResult {
  const K = options.evidenceHalfMass ?? 1
  const trustById = new Map(linkedSources.map((s) => [s.id, getSourceTrust(s)]))

  let net = 0
  let mass = 0
  let contributingLinks = 0

  for (const link of links ?? []) {
    if (!isEvidenceRelation(link.relation)) continue
    if (!trustById.has(link.targetId)) continue
    const trust = trustById.get(link.targetId) as number
    const sign = linkStanceWeight(link) // ∈ [-1, +1]
    const signed = sign * trust
    net += signed
    mass += Math.abs(signed)
    contributingLinks += 1
  }

  if (mass <= 0) {
    return { strength: 0.5, net, mass, contributingLinks }
  }

  const direction = net / mass // ∈ [-1, +1]
  const confidence = mass / (mass + K) // ∈ [0, 1)
  const strength = clamp01(0.5 + 0.5 * direction * confidence)

  return { strength, net, mass, contributingLinks }
}

/**
 * Belief strength in [0, 1] derived from supporting vs refuting linked sources,
 * each weighted by stance and the source's `trust`. 0.5 means no net evidence.
 * See the module header for the full formula.
 */
export function computeBeliefStrength(
  belief: BeliefLike,
  linkedSources: SourceLike[],
  links: ItemLink[] = belief?.links ?? [],
  options: BeliefStrengthOptions = {},
): number {
  return computeBeliefStrengthDetailed(belief, linkedSources, links, options).strength
}
