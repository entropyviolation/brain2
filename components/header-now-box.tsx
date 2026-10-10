/**
 * components/header-now-box.tsx — Header "now" well for live work timers
 *
 * Lives in the Capture cluster of the mill title bar, as a peer of the
 * Capture keys. Absent when idle; when either (or both) work sessions are
 * live, one Win95 groupbox shows each running clock: color swatch when the
 * clock is a pen, the name, elapsed time, then Pause and Stop as icon buttons.
 * Same stores as the Tracking strips — pause freezes elapsed and paint via
 * pausedAt / pausedAccumMs.
 */
"use client"

import type { ReactNode } from "react"
import { Pause, Play, Square } from "lucide-react"
import { useWorkSessionClock } from "@/components/Operations/WorkingNowControl"
import { usePenColorSessionClock } from "@/components/Home/Tracking/pen-color-now-strip"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  formatElapsedClock,
  isSessionPaused,
  pauseWorkingOnOperation,
  resumeWorkingOnOperation,
  sessionElapsedMs,
  stopWorkingOnOperation,
} from "@/lib/operation-work-session"
import {
  pausePenColorSession,
  resumePenColorSession,
  stopPenColorSession,
} from "@/lib/pen-color-session"

function NowIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="b2-shell-now-icon" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

function NowRow({
  name,
  elapsed,
  paused,
  onStop,
  onPauseToggle,
  stopLabel,
  color,
}: {
  name: string
  elapsed: string
  paused: boolean
  onStop: () => void
  onPauseToggle: () => void
  stopLabel: string
  color?: string
}) {
  const pauseLabel = paused ? `Resume ${name}` : `Pause ${name}`
  return (
    <div className="b2-shell-now-row">
      {color ? <span className="b2-shell-now-swatch" style={{ background: color }} aria-hidden /> : null}
      <span className="b2-shell-now-name" title={name}>
        {name}
      </span>
      <span className="b2-shell-now-elapsed" aria-live="polite">
        {elapsed}
      </span>
      <NowIconButton label={pauseLabel} onClick={onPauseToggle}>
        {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
      </NowIconButton>
      <NowIconButton label={stopLabel} onClick={onStop}>
        <Square aria-hidden />
      </NowIconButton>
    </div>
  )
}

export function HeaderNowBox() {
  const { session: opSession, now: opNow } = useWorkSessionClock()
  const { session: penSession, now: penNow } = usePenColorSessionClock()
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const penScope = penSession ? scopes.find((scope) => scope.id === penSession.scopeId) : undefined
  const penColor = penScope?.pens.find((pen) => pen.id === penSession?.penId)?.color
  const penName = penSession
    ? penScope
      ? `${penSession.title} · ${penScope.name}`
      : penSession.title
    : ""

  if (!opSession && !penSession) return null

  return (
    <fieldset
      className="b2-shell-group b2-shell-now"
      data-testid="header-now-box"
      data-ui-name="Now"
      aria-label="now"
    >
      <legend>now</legend>
      <div className="b2-shell-now-body">
        {opSession && (
          <NowRow
            name={opSession.title}
            elapsed={formatElapsedClock(sessionElapsedMs(opSession, opNow))}
            paused={isSessionPaused(opSession)}
            stopLabel={`Stop ${opSession.title}`}
            onStop={() => stopWorkingOnOperation()}
            onPauseToggle={() =>
              isSessionPaused(opSession) ? resumeWorkingOnOperation() : pauseWorkingOnOperation()
            }
          />
        )}
        {penSession && (
          <NowRow
            name={penName}
            color={penColor}
            elapsed={formatElapsedClock(sessionElapsedMs(penSession, penNow))}
            paused={isSessionPaused(penSession)}
            stopLabel={`Stop ${penName}`}
            onStop={() => stopPenColorSession()}
            onPauseToggle={() =>
              isSessionPaused(penSession) ? resumePenColorSession() : pausePenColorSession()
            }
          />
        )}
      </div>
    </fieldset>
  )
}

export default HeaderNowBox
