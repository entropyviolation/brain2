/**
 * Min / Goal / Exc latch keys on a draft pick row.
 */
import { SESSION_TIERS, type SessionTier } from "@/lib/session-plan"
import { TIER_LABEL, TIER_SHORT } from "./tiers"

function TierKeys({
  inTier,
  onPick,
  label,
}: {
  inTier?: SessionTier
  onPick: (tier: SessionTier) => void
  label: string
}) {
  return (
    <span className="todo-session-tierkeys" role="group" aria-label={`Add ${label} to`}>
      {SESSION_TIERS.map(({ id }) => (
        <button
          key={id}
          type="button"
          data-no95
          className={`todo-session-tierkey is-${id}${inTier === id ? " is-on" : ""}`}
          aria-pressed={inTier === id}
          title={inTier === id ? `Take ${label} out of ${TIER_LABEL[id]}` : `${TIER_LABEL[id]}: ${label}`}
          onClick={() => onPick(id)}
        >
          {TIER_SHORT[id]}
        </button>
      ))}
    </span>
  )
}

export { TierKeys }
