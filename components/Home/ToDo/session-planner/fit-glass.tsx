/**
 * One fit bar. Bare minimum, Goal, and Exceptional fill the session length in turn.
 */
import { sessionFit } from "@/lib/session-plan"
import { fmtMinutes } from "./format"
import { TIER_LABEL, TIER_LETTER } from "./tiers"

/**
 * One container for the whole session: the bar is the length (less breaks),
 * and Bare minimum, Goal and Exceptional fill it in turn, padded by your pace.
 * Past the wall it hatches warm red. The Hofstadter tick is where it all
 * lands with estimates doubled.
 */
function FitGlass({
  fit,
  pace,
  padLabel,
  room,
  durationMin,
}: {
  fit: ReturnType<typeof sessionFit>
  pace: number
  padLabel: string | null
  room: number
  durationMin: number
}) {
  const used = fit.reduce((sum, f) => sum + f.minutes * pace, 0)
  const scale = Math.max(room, used, 1)
  const pct = (m: number) => (m / scale) * 100
  const last = fit[fit.length - 1]
  const band = used === 0 ? "empty" : last.band
  const hof = used > 0 ? Math.round(last.padded * 100) : 0
  const hofAt = Math.min(100, pct(used * 2))
  const left = room - used
  const longBy = Math.round((pace - 1) * 100)
  return (
    <div className="ses-fit" data-band={band} role="group" aria-label="Fit">
      <div className="ses-fit-row">
        <span className="ses-fit-leg">
          Fit · {fmtMinutes(durationMin)}
          {room !== durationMin ? ` · ${fmtMinutes(room)} to work` : ""}
        </span>
        <span className="ses-fit-leg is-right">
          {padLabel ? `${padLabel}${longBy > 0 ? ` · you run ~${longBy}% long` : ""}` : "raw estimates"}
        </span>
      </div>
      <div className="ses-fit-bar" aria-hidden>
        {fit.map((f) =>
          f.minutes > 0 ? <span key={f.tier} className={`ses-fit-seg is-${f.tier}`} style={{ width: `${pct(f.minutes * pace)}%` }} /> : null,
        )}
        {used > room && room > 0 ? (
          <>
            <span className="ses-fit-over" style={{ left: `${pct(room)}%`, width: `${pct(used - room)}%` }} />
            <span className="ses-fit-wall" style={{ left: `${pct(room)}%` }} />
          </>
        ) : null}
        {used > 0 ? <span className="ses-fit-hof" data-off={used * 2 > scale || undefined} style={{ left: `${hofAt}%` }} /> : null}
      </div>
      <div className="ses-fit-row is-foot">
        {fit.map((f) => (
          <span key={f.tier} className={`ses-fit-read is-${f.tier}`} title={TIER_LABEL[f.tier]}>
            {TIER_LETTER[f.tier]} <b>{fmtMinutes(f.minutes * pace)}</b>
          </span>
        ))}
        <span className={`ses-fit-read is-left${left < 0 ? " is-over" : ""}`}>
          {used === 0 ? "empty" : left >= 0 ? `${fmtMinutes(left)} free` : `${fmtMinutes(-left)} over`}
        </span>
        {used > 0 ? (
          <span
            className={`ses-fit-read is-hof${hof > 100 ? " is-over" : ""}`}
            title="Hofstadter's Law: it takes longer than you expect, even counting that. This is the session with estimates doubled."
          >
            Hofstadter <b>{hof}%</b>
          </span>
        ) : null}
      </div>
    </div>
  )
}

export { FitGlass }
