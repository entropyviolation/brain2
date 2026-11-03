/**
 * components/Reviews/morning/NightStep.tsx — Last night.
 *
 * Carry from the night ritual, the all-nighter checkbox, fell-asleep and wake
 * clocks (`morning-bedtime`, `morning-waketime`), and the dream journal.
 */
import { Moon } from "lucide-react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { NightCarry } from "@/lib/ritual-carry"
import { sleepClockEstimateBasis, type SleepClockSource } from "@/lib/estimated-values"
import type { Goal } from "@/lib/types"

export function NightStep({
  carry,
  goals,
  allNighter,
  setAllNighterLocal,
  allNighterLifts,
  bedTime,
  bedEstSource,
  setBedTime,
  setBedEstSource,
  wakeTime,
  wakeEstSource,
  setWakeTime,
  setWakeEstSource,
  dream,
  setDream,
  nightSummary,
}: {
  carry: NightCarry
  goals: Goal[]
  allNighter: boolean
  setAllNighterLocal: (next: boolean) => void
  allNighterLifts: { name: string; day: string }[]
  bedTime: string
  bedEstSource: SleepClockSource | null
  setBedTime: (value: string) => void
  setBedEstSource: (source: SleepClockSource | null) => void
  wakeTime: string
  wakeEstSource: SleepClockSource | null
  setWakeTime: (value: string) => void
  setWakeEstSource: (source: SleepClockSource | null) => void
  dream: string
  setDream: (value: string) => void
  nightSummary: string
}) {
  return (
    <>
      {(carry.wakeReminder || carry.tomorrowMatters || carry.focusGoalIds.length > 0) && (
        <section className="mr-carry" data-testid="morning-carry">
          {carry.wakeReminder ? (
            <div>
              <p className="mr-carry-label">From last night</p>
              <p className="text-sm whitespace-pre-wrap">{carry.wakeReminder}</p>
            </div>
          ) : null}
          {carry.tomorrowMatters ? (
            <div>
              <p className="mr-carry-label">What matters most today</p>
              <p className="text-sm whitespace-pre-wrap">{carry.tomorrowMatters}</p>
            </div>
          ) : null}
          {carry.focusGoalIds.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Focus:{" "}
              {carry.focusGoalIds
                .map((id) => goals.find((goal) => goal.id === id)?.title)
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : null}
        </section>
      )}
      <label className="flex items-start gap-2 rounded-md border bg-white/70 p-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={allNighter}
          onChange={(e) => setAllNighterLocal(e.target.checked)}
        />
        <span>
          <span className="font-semibold">All nighter</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            I did not sleep. Habits with an all-nighter block are exempt: the evening before for the night you stayed up, and this morning for the ones set to the morning of. Edit each block on the habit.
          </span>
          {allNighterLifts.length === 0 ? (
            <span className="block text-xs text-muted-foreground mt-1">
              No habit has an all-nighter block yet. Add one in that habit’s settings.
            </span>
          ) : (
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {allNighterLifts.map((row) => (
                <li key={`${row.name}-${row.day}`}>
                  {row.name} — {row.day === "evening-before" ? "the evening before this night" : "this morning"}
                </li>
              ))}
            </ul>
          )}
        </span>
      </label>

      {!allNighter && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["morning-bedtime", "Fell asleep", bedTime, bedEstSource, "asleep", setBedTime, setBedEstSource],
                ["morning-waketime", "Wake time", wakeTime, wakeEstSource, "awake", setWakeTime, setWakeEstSource],
              ] as const
            ).map(([id, label, value, est, kind, set, setEst]) => (
              <div key={id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="font-semibold text-sm" htmlFor={id}>
                    {label}
                  </Label>
                  {est ? (
                    <span
                      className="trk-est inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wide"
                      title={sleepClockEstimateBasis(est, kind)}
                    >
                      est.
                    </span>
                  ) : null}
                </div>
                <div className={est ? "flex items-center gap-1.5" : undefined}>
                  {est ? <span className="text-sm font-bold text-slate-600" aria-hidden>~</span> : null}
                  <ClockPicker
                    id={id}
                    value={value}
                    onChange={(v) => {
                      setEst(null)
                      set(v)
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="col-span-2 -mt-1 text-xs text-muted-foreground">{nightSummary}</p>
          </div>

          <section className="space-y-2">
            <Label className="font-semibold text-sm flex items-center gap-1">
              <Moon className="h-4 w-4" />
              Dream journal
            </Label>
            <Textarea
              value={dream}
              onChange={(e) => setDream(e.target.value)}
              rows={3}
              placeholder="Anything you remember…"
            />
          </section>
        </>
      )}
      {allNighter && <p className="text-xs text-muted-foreground">{nightSummary}</p>}
    </>
  )
}
