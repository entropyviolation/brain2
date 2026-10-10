/**
 * components/ItemDetail/HabitLinkedDetail.tsx — Notes and habit standing
 *
 * Shown in the Details main pane when the item's `sourceHabitId` attribute
 * points at a habit. Notes are the item's existing `notes` field. The
 * completion read is display-only. Tag wiring (Counts / Minutes) is the same
 * summary as source detail — names only, no second editor.
 */
"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { summarizeHabitCompletions } from "@/lib/habit-completion-summary"
import { habitTagWiringSummary } from "@/lib/habit-source-square"
import { useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

interface HabitLinkedDetailProps {
  habitId: string
  notes: string
  onNotesLive: (notes: string) => void
  onNotesCommit: (notes: string) => void
  onHabitSettings: () => void
}

export function HabitLinkedDetail({
  habitId,
  notes,
  onNotesLive,
  onNotesCommit,
  onHabitSettings,
}: HabitLinkedDetailProps) {
  const habit = useHabitsStore((state) => state.tasks.find((row) => row.id === habitId) ?? null)
  const weeklyData = useHabitsStore((state) => state.weeklyData)
  const weeklyHabitData = useHabitsStore((state) => state.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((state) => state.monthlyHabitData)
  const quarterlyHabitData = useHabitsStore((state) => state.quarterlyHabitData)
  const trackingTags = useTimeTrackingStore((state) => state.tags)
  const summary = habit
    ? summarizeHabitCompletions(habit, { weeklyData, weeklyHabitData, monthlyHabitData, quarterlyHabitData })
    : null
  const wiring = habit ? habitTagWiringSummary(habit, trackingTags) : null

  return (
    <div className="id-habit-body">
      <Card>
        <CardHeader className="id-habit-head flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Habit</CardTitle>
          <Button type="button" className="id-btn" onClick={onHabitSettings}>
            Habit settings
          </Button>
        </CardHeader>
        <CardContent>
          {summary ? (
            <div role="region" aria-label="Habit completion" className="id-habit-read">
              <p className="id-habit-name">{summary.habitName}</p>
              <p>Frequency: {summary.frequencyLabel}</p>
              <p>Goal: {summary.goalLabel}</p>
              <p>
                {summary.periodLabel}: {summary.standing}
              </p>
              {wiring?.counts ? <p>Counts: {wiring.counts}</p> : null}
              {wiring?.minutes ? <p>Minutes: {wiring.minutes}</p> : null}
              <p className="id-habit-recent-label">Recent completions</p>
              {summary.recent.length === 0 ? (
                <p>No completions yet</p>
              ) : (
                <ul className="id-habit-recent">
                  {summary.recent.map((row) => (
                    <li key={row.key}>
                      {row.label} — {row.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p>This habit is not in Habits.</p>
          )}
        </CardContent>
      </Card>

      <Card className="id-habit-notes">
        <CardHeader>
          <CardTitle>
            <Label htmlFor="notes">Notes</Label>
          </CardTitle>
        </CardHeader>
        <CardContent className="id-habit-notes-well">
          <IsolatedTextarea
            id="notes"
            className="id-habit-notes-field"
            value={notes}
            onLiveChange={onNotesLive}
            onCommit={onNotesCommit}
            placeholder="Write a note…"
            rows={10}
          />
        </CardContent>
      </Card>
    </div>
  )
}
