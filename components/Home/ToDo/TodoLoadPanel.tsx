/**
 * components/Home/ToDo/TodoLoadPanel.tsx — Period load instrument
 *
 * The ▾ under the header glass opens this: one milled bezel with three
 * equal-height wells (redesign 2026-10-21).
 *   - Time: an engraved scale (day: the hours to 11pm with a now tick; longer
 *     lenses: working days left) with hours left and the estimate laid on it,
 *     then an LCD row (working hours left, estimate, spent) and days left.
 *   - Comfort: a small black CRT dial in a chrome bezel. A ring of pixel LED
 *     segments, a glowing pearl at the ratio (Hofstadter ×2 ÷ working hours),
 *     the ratio in phosphor at the center, a fits / over LCD and a band legend.
 *   - Scope: three pearl toggles (what counts toward load), pixel pips for in
 *     progress against the soft cap, and Required / Assigned hours.
 * LEDs stay green, blue or violet. Warm red only marks an estimate overrun.
 */
"use client"

import { formatMinutesAsHours, ESTIMATE_SCOPE_LABELS, type ComfortBand, type EstimateScope } from "@/lib/todo-commitment"

const SCOPES: EstimateScope[] = ["all", "required", "required-prioritized"]

const BAND_LABEL: Record<ComfortBand, string> = {
  manageable: "manageable",
  overfilled: "overfilled",
  behind: "more than fits",
}

/** LED color per band: green, ice blue, violet (never orange). */
const BAND_COLOR: Record<ComfortBand, string> = {
  manageable: "#5dff9a",
  overfilled: "#9ad7ff",
  behind: "#b48cff",
}

const BANDS: ComfortBand[] = ["manageable", "overfilled", "behind"]

/** One word for the header glass: `fits`, `overfilled`, `more than fits`. */
export function comfortWord(band: ComfortBand): string {
  return band === "manageable" ? "fits" : BAND_LABEL[band]
}

/** Ratio onto 0…1 of the dial: 0 at the left stop, 1.0 a little past the middle, 10 and over at the right stop. */
export function comfortDialT(ratio: number): number {
  if (!Number.isFinite(ratio)) return 1
  if (ratio <= 0) return 0
  return Math.min(1, Math.log10(1 + ratio * 9) / Math.log10(91))
}

const DIAL_SEGMENTS = 40
const DIAL_SWEEP = 131.6

/** Day lens scale: 8am to 11pm, the same end of day as working hours. */
const DAY_START = 8
const DAY_END = 23

function TimeScale({ isDay, hoursLeft, estimateMinutes, now }: { isDay: boolean; hoursLeft: number; estimateMinutes: number; now: Date }) {
  const W = 300
  const x0 = 12
  const x1 = 288
  const span = x1 - x0
  const estHours = estimateMinutes / 60
  let nowT = 0
  let units: { t: number; label?: string; major: boolean }[] = []
  let estT = 0
  if (isDay) {
    const hour = now.getHours() + now.getMinutes() / 60
    nowT = Math.min(1, Math.max(0, (hour - DAY_START) / (DAY_END - DAY_START)))
    for (let h = DAY_START; h <= DAY_END; h++) {
      const major = (h - DAY_START) % 3 === 0 || h === DAY_END
      units.push({ t: (h - DAY_START) / (DAY_END - DAY_START), label: major ? String(h) : undefined, major })
    }
    estT = estHours / (DAY_END - DAY_START)
  } else {
    // Working days left, each 10 working hours wide.
    const days = Math.max(1, Math.ceil(hoursLeft / 10))
    const step = days > 16 ? Math.ceil(days / 8) : 1
    units = Array.from({ length: days + 1 }, (_, i) => ({
      t: i / days,
      label: i % step === 0 ? (i === 0 ? "now" : `+${i}d`) : undefined,
      major: i % step === 0,
    }))
    estT = hoursLeft > 0 ? estHours / hoursLeft : estHours > 0 ? 1 : 0
  }
  const leftEnd = isDay ? 1 : 1
  const estFit = Math.min(estT, 1 - nowT)
  const over = estT > 1 - nowT
  const X = (t: number) => x0 + t * span
  return (
    <svg className="todo-ldi-scale" viewBox={`0 0 ${W} 50`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="todo-ldi-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#8e9296" strokeWidth="1.2" />
        </pattern>
      </defs>
      {nowT > 0 ? <rect x={X(0)} y="9" width={X(nowT) - X(0)} height="12" fill="url(#todo-ldi-hatch)" stroke="#8e9296" strokeWidth=".6" /> : null}
      <rect x={X(nowT)} y="7" width={Math.max(0, X(leftEnd) - X(nowT))} height="16" fill="rgba(61,255,138,.28)" stroke="#2c9e5a" strokeWidth=".8" />
      {estFit > 0 ? <rect x={X(nowT)} y="11" width={X(nowT + estFit) - X(nowT)} height="8" fill="#9ad7ff" stroke="#3d7fa8" strokeWidth=".8" /> : null}
      {over ? <rect x={X(1) - 4} y="10" width="6" height="10" fill="#d2493a" /> : null}
      <line x1={x0} y1="24" x2={x1} y2="24" stroke="#2a2c2e" strokeWidth=".9" />
      <g stroke="#2a2c2e" strokeWidth=".7">
        {units.map((u, i) => (
          <line key={i} x1={X(u.t)} y1="24" x2={X(u.t)} y2={u.major ? 33 : 28} />
        ))}
      </g>
      <g fontFamily="w95fa, monospace" fontSize="7" fill="#55595d" textAnchor="middle">
        {units.map((u, i) =>
          u.label ? (
            <text key={i} x={X(u.t)} y="44">
              {u.label}
            </text>
          ) : null,
        )}
      </g>
      {isDay ? (
        <>
          <path d={`M${X(nowT)} 2 L${X(nowT)} 34`} stroke="#a35cff" strokeWidth="1.4" />
          <path d={`M${X(nowT) - 3} 1 L${X(nowT) + 3} 1 L${X(nowT)} 5 Z`} fill="#a35cff" />
        </>
      ) : null}
    </svg>
  )
}

function ComfortDial({ ratio, ratioText, band }: { ratio: number; ratioText: string; band: ComfortBand }) {
  const t = comfortDialT(ratio)
  const lit = Math.round(t * DIAL_SEGMENTS)
  // Band edges on the dial: 1.0 and 10.
  const edge1 = comfortDialT(1)
  const segs = Array.from({ length: DIAL_SEGMENTS }, (_, i) => {
    const st = (i + 0.5) / DIAL_SEGMENTS
    const angle = -DIAL_SWEEP + st * DIAL_SWEEP * 2
    const segBand: ComfortBand = st < edge1 ? "manageable" : st < 1 ? "overfilled" : "behind"
    const on = i < lit
    return { angle, color: on ? BAND_COLOR[segBand] : segBand === "manageable" ? "#173a26" : "#1a3343", on }
  })
  const pearlAngle = ((-DIAL_SWEEP + t * DIAL_SWEEP * 2) * Math.PI) / 180
  const px = 60 + Math.sin(pearlAngle) * 43
  const py = 60 - Math.cos(pearlAngle) * 43
  return (
    <svg className="todo-ldi-dial" viewBox="0 0 120 120" role="img" aria-label={`Comfort dial ${ratioText}, ${BAND_LABEL[band]}`}>
      <defs>
        <linearGradient id="todo-dial-mil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef1f3" />
          <stop offset=".35" stopColor="#8e9399" />
          <stop offset=".55" stopColor="#d4d8dc" />
          <stop offset="1" stopColor="#3c4044" />
        </linearGradient>
        <radialGradient id="todo-dial-glass" cx="42%" cy="36%" r="70%">
          <stop offset="0" stopColor="#0d1614" />
          <stop offset=".7" stopColor="#030605" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <radialGradient id="todo-dial-pearl" cx="36%" cy="32%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".3" stopColor="#eef0f6" />
          <stop offset=".65" stopColor="#c3c6d4" />
          <stop offset=".88" stopColor="#9ea6bd" />
          <stop offset="1" stopColor="#d9e6f2" />
        </radialGradient>
        <filter id="todo-dial-bloom" x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <circle cx="60" cy="60" r="58.5" fill="url(#todo-dial-mil)" stroke="#2a2c2e" strokeWidth="1" />
      <circle cx="60" cy="60" r="55" fill="none" stroke="#5c6064" strokeWidth="2.4" strokeDasharray=".8 1.1" opacity=".55" />
      <circle cx="60" cy="60" r="52.5" fill="url(#todo-dial-glass)" stroke="#1a1c1e" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="50.6" fill="none" stroke="#9ad7ff" strokeWidth=".5" opacity=".35" />
      <g className="todo-dial-sweep" fill="none" stroke="#9ad7ff" strokeWidth=".35" opacity=".22">
        <circle cx="66" cy="60" r="30" />
        <circle cx="54" cy="60" r="30" />
        <circle cx="60" cy="60" r="34" strokeDasharray="1 5" />
      </g>
      <g shapeRendering="crispEdges">
        {segs.map((s, i) => (
          <rect
            key={i}
            x="57.8"
            y="14.4"
            width="4.4"
            height="5.2"
            transform={`rotate(${s.angle.toFixed(1)} 60 60)`}
            fill={s.color}
            className={s.on ? "is-lit" : undefined}
          />
        ))}
      </g>
      <g className="todo-dial-halo">
        <circle cx={px} cy={py} r="8" fill="#cfe9ff" opacity=".45" filter="url(#todo-dial-bloom)" />
      </g>
      <circle cx={px} cy={py} r="5.4" fill="url(#todo-dial-pearl)" stroke="#5c6470" strokeWidth=".4" />
      <circle cx={px - 1.8} cy={py - 1.9} r="1.2" fill="#fff" opacity=".9" />
      <text x="60" y="66" textAnchor="middle" fontFamily="w95fa, monospace" fontSize="17" letterSpacing=".5" fill="#5dff9a" filter="url(#todo-dial-bloom)" opacity=".7">
        {ratioText}×
      </text>
      <text x="60" y="66" textAnchor="middle" fontFamily="w95fa, monospace" fontSize="17" letterSpacing=".5" fill="#b9ffd6">
        {ratioText}×
      </text>
      <text x="60" y="77" textAnchor="middle" fontFamily="w95fa, monospace" fontSize="7" letterSpacing=".3" fill="#3f9c74">
        est×2 ÷ left
      </text>
    </svg>
  )
}

export function TodoLoadPanel({
  showDaysLeft = true,
  daysLeft,
  estimate,
  estimateMinutes,
  unestimated,
  included,
  scope,
  onScopeChange,
  hoursLeft,
  workingHours,
  workingHoursValue,
  comfortRatioText,
  comfortRatioValue,
  band,
  inProgress,
  wipLimit,
  onUnestimatedClick,
  isDay = false,
  spentMinutes,
  requiredMinutes,
  allMinutes,
  now = new Date(),
}: {
  /** Day lens hides this line. Week, month, and season still show it. */
  showDaysLeft?: boolean
  daysLeft: string
  estimate: string
  estimateMinutes: number
  unestimated: number
  included: number
  scope: EstimateScope
  onScopeChange: (scope: EstimateScope) => void
  hoursLeft: string
  workingHours: string
  workingHoursValue: number
  comfortRatioText: string
  comfortRatioValue: number
  band: ComfortBand
  inProgress: number
  wipLimit: number
  onUnestimatedClick?: () => void
  /** Day lens: the scale reads hours of today with a now tick. */
  isDay?: boolean
  /** Time already spent on the open tasks (all sittings). */
  spentMinutes?: number
  /** Required and all-assigned estimates, whatever the scope. */
  requiredMinutes?: number
  allMinutes?: number
  now?: Date
}) {
  const overCap = inProgress > wipLimit
  const comfortTitle = `Estimated hours × 2 (Hofstadter's Law) ÷ working hours left. Under 1 is manageable. From 1 through 10 is overfilled. Above 10 is more than fits. Clock hours left: ${hoursLeft}.`
  const spareMinutes = Math.round(workingHoursValue * 60 - estimateMinutes * 2)
  const fitsLine =
    spareMinutes >= 0
      ? `fits · ${formatMinutesAsHours(spareMinutes)} spare`
      : `needs ${formatMinutesAsHours(-spareMinutes)} more`
  const pipCount = Math.max(wipLimit, inProgress)

  return (
    <div
      className="todo-load todo-ldi"
      aria-label="Period load"
      data-ui-name="Period load"
      data-ui-help="Time (working hours, estimate, spent, days left), comfort, and scope with in progress."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="period-load"
    >
      <div className="todo-ldi-well is-time">
        <div className="todo-ldi-lab">
          <span>{isDay ? "Time · working day" : "Time · working days"}</span>
          {isDay ? <span>now {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span> : null}
        </div>
        <TimeScale isDay={isDay} hoursLeft={workingHoursValue} estimateMinutes={estimateMinutes} now={now} />
        <div className="todo-ldi-lcd">
          <span
            className="todo-ldi-figure"
            title={`Working hours: future days × 10 plus hours left today before 11pm. Clock hours left (not used by comfort): ${hoursLeft}.`}
          >
            {workingHours}
            <small>Working hours left</small>
          </span>
          <span className="todo-ldi-figure todo-load-estimate">
            {estimate}
            <small>Est hours of work remaining</small>
            <small className="todo-casio-sub">
              {included} {included === 1 ? "task" : "tasks"}
            </small>
          </span>
          {spentMinutes !== undefined ? (
            <span className="todo-ldi-figure" title="Time already given to these open tasks, across every sitting">
              {formatMinutesAsHours(spentMinutes)}
              <small>Spent on these</small>
            </span>
          ) : null}
          {showDaysLeft ? (
            <span className="todo-ldi-ghost">
              <span className="todo-load-label">Days left</span>
              <span className="todo-casio" aria-live="polite">
                {daysLeft}
              </span>
            </span>
          ) : null}
        </div>
        <div className="todo-ldi-legend">
          <span className="todo-ldi-lamp is-green" aria-hidden />
          left
          <span className="todo-ldi-lamp is-blue" aria-hidden />
          est
          {isDay ? (
            <>
              <span className="todo-ldi-lamp is-violet" aria-hidden />
              now
            </>
          ) : null}
          <span className="todo-ldi-grow" />
          {unestimated > 0 ? (
            <button type="button" className="todo-unest-link" onClick={onUnestimatedClick} title="Open tasks with no estimate">
              {unestimated} without an estimate
            </button>
          ) : null}
        </div>
      </div>

      <div className="todo-ldi-well is-comfort todo-load-comfort" title={comfortTitle}>
        <div className="todo-ldi-lab">
          <span>Comfort</span>
          <span>{BAND_LABEL[band]}</span>
        </div>
        <div className="todo-ldi-crt">
          <ComfortDial ratio={comfortRatioValue} ratioText={comfortRatioText} band={band} />
          <div className="todo-ldi-crt-side">
            <span className="todo-ldi-crt-lcd">{fitsLine}</span>
            <ul className="todo-ldi-crt-legend" aria-label={`Comfort ${comfortRatioText} · ${BAND_LABEL[band]}`}>
              {BANDS.map((b) => (
                <li key={b} className={b === band ? "is-on" : undefined}>
                  <i style={{ ["--c" as string]: BAND_COLOR[b] }} aria-hidden />
                  {BAND_LABEL[b]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="todo-ldi-well is-scope todo-load-scope">
        <div className="todo-ldi-lab">
          <span>Scope</span>
          <span>counts toward load</span>
        </div>
        <div className="todo-ldi-pearls" role="group" aria-label="Estimated time filter">
          {SCOPES.map((value) => (
            <button
              key={value}
              type="button"
              data-no95
              className={`todo-ldi-pearl${scope === value ? " is-lit" : ""}`}
              aria-pressed={scope === value}
              aria-label={ESTIMATE_SCOPE_LABELS[value]}
              onClick={() => onScopeChange(value)}
              title={ESTIMATE_SCOPE_LABELS[value]}
            >
              <i className="todo-ldi-pearl-bead" aria-hidden />
              <span>{ESTIMATE_SCOPE_LABELS[value]}</span>
            </button>
          ))}
        </div>
        <div className={`todo-ldi-pips${overCap ? " is-hot" : ""}`} title={overCap ? "Over the soft cap" : "Under the soft cap"}>
          <span className="todo-ldi-pips-lab">In progress</span>
          {Array.from({ length: pipCount }, (_, i) => (
            <i key={i} className={`todo-ldi-pip${i < inProgress ? (i >= wipLimit ? " is-over" : " is-on") : ""}`} aria-hidden />
          ))}
          <span className="todo-ldi-pips-num">
            {inProgress} of cap {wipLimit}
          </span>
        </div>
        {requiredMinutes !== undefined && allMinutes !== undefined ? (
          <div className="todo-ldi-lcds">
            <div>
              <small>Required</small>
              <b className="todo-ldi-mini-lcd">{formatMinutesAsHours(requiredMinutes)}</b>
            </div>
            <div>
              <small>Assigned</small>
              <b className="todo-ldi-mini-lcd">{formatMinutesAsHours(Math.max(0, allMinutes - requiredMinutes))}</b>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
