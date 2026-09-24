/**
 * components/header-now-box.tsx — Header "now" well for live work timers
 *
 * Sits between System and Capture in the mill title bar. Absent when idle;
 * when either (or both) work sessions are live, one Win95 groupbox shows each
 * running clock with Stop / Pause (Resume while paused). Same stores as the
 * Tracking strips — pause freezes elapsed and paint via pausedAt / pausedAccumMs.
 */
"use client"

import { Button } from "@/components/ui/button"
import { useWorkSessionClock } from "@/components/Operations/WorkingNowControl"
import { usePenColorSessionClock } from "@/components/Home/Tracking/pen-color-now-strip"
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

function NowRow({
  name,
  elapsed,
  paused,
  onStop,
  onPauseToggle,
  stopLabel,
}: {
  name: string
  elapsed: string
  paused: boolean
  onStop: () => void
  onPauseToggle: () => void
  stopLabel: string
}) {
  return (
    <div className="b2-shell-now-row">
      <span className="b2-shell-now-name" title={name}>
        {name}
      </span>
      <span className="b2-shell-now-elapsed" aria-live="polite">
        {elapsed}
      </span>
      <Button type="button" variant="outline" size="sm" aria-label={stopLabel} onClick={onStop}>
        Stop
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={paused ? `Resume ${name}` : `Pause ${name}`}
        onClick={onPauseToggle}
      >
        {paused ? "Resume" : "Pause"}
      </Button>
    </div>
  )
}

export function HeaderNowBox() {
  const { session: opSession, now: opNow } = useWorkSessionClock()
  const { session: penSession, now: penNow } = usePenColorSessionClock()

  if (!opSession && !penSession) return null

  return (
    <>
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
              name={penSession.title}
              elapsed={formatElapsedClock(sessionElapsedMs(penSession, penNow))}
              paused={isSessionPaused(penSession)}
              stopLabel={`Stop ${penSession.title}`}
              onStop={() => stopPenColorSession()}
              onPauseToggle={() =>
                isSessionPaused(penSession) ? resumePenColorSession() : pausePenColorSession()
              }
            />
          )}
        </div>
      </fieldset>
      <div className="b2-shell-sep" role="separator" />
    </>
  )
}

export default HeaderNowBox
