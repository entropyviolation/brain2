/**
 * components/Home/Habits/habit-form/stats-source.tsx — Habits stats pipeline row.
 *
 * Stat builder, the daily-habit picker, the average and total readouts, and
 * the floor fields. The parent still computes the percents, the mean, and
 * `statContext` (including `new Date()`).
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { StatSourceBuilder, openedStatBinding } from "@/components/Home/Habits/stat-source-builder"
import { effectiveDailyFloorLink } from "@/lib/habit-completion-source"
import type { HabitStatContext, HabitStatSet } from "@/lib/habit-stat-points"
import { sumHabitValuesOverDays } from "@/lib/habit-value-sync"
import type { WeeklyData, WeeklyTask, HabitCompletionPipeline } from "@/lib/types"
import { DailyHabitPicker } from "./pickers"

export function HabitFormStatsSource({
  row,
  task,
  setTask,
  weeklyHabits,
  monthlyHabits,
  dailyHabits,
  statContext,
  accomplishmentThreshold,
  patchStatsRow,
  averageRows,
  averageMean,
  dailyValueSources,
  setSourcesLocked,
  weeklyData,
  sumKeys,
  dailyPercents,
  setFloorLocked,
}: {
  row: HabitCompletionPipeline
  task: WeeklyTask
  setTask: Dispatch<SetStateAction<WeeklyTask>>
  weeklyHabits: WeeklyTask[]
  monthlyHabits: WeeklyTask[]
  dailyHabits: WeeklyTask[]
  statContext: (set: HabitStatSet) => HabitStatContext
  accomplishmentThreshold: number
  patchStatsRow: (row: HabitCompletionPipeline, next: HabitCompletionPipeline) => void
  averageRows: { id: string; name: string; pct: number }[]
  averageMean: number | null
  dailyValueSources: { id: string; name: string }[]
  setSourcesLocked: Dispatch<SetStateAction<boolean>>
  weeklyData: WeeklyData
  sumKeys: string[]
  dailyPercents: { id: string; name: string; pct: number }[]
  setFloorLocked: Dispatch<SetStateAction<boolean>>
}) {
              const statSet = row.stats?.set ?? "daily"
              const statBinding = openedStatBinding(row)
              return (
                <>
                  <StatSourceBuilder
                    binding={statBinding}
                    habitsForSource={(sourceId) =>
                      sourceId === "weekly" ? weeklyHabits : sourceId === "monthly" ? monthlyHabits : dailyHabits
                    }
                    context={{ ...statContext(statSet), accomplishmentThreshold }}
                    onChange={(next) => {
                      const engines = ["dailyFloor", "habitValue", "dailyCompletionAverage"] as const
                      const wanted = new Set(
                        next.pipelines
                          .map((pipeline) => pipeline.outputId)
                          .filter((id): id is (typeof engines)[number] => engines.includes(id as (typeof engines)[number])),
                      )
                      const sources = [
                        ...row.sources.filter((id) => !engines.includes(id as (typeof engines)[number])),
                        ...engines.filter((id) => wanted.has(id) && !row.sources.includes(id)),
                      ]
                      patchStatsRow(row, { ...row, sources, statBinding: next })
                    }}
                  />
                  {row.stats?.comparePrevious ? (
                    <label className="habit95-field">
                      How many must be higher
                      <input
                        className="habit95-input"
                        type="number"
                        min={1}
                        step={1}
                        aria-label="How many must be higher"
                        value={row.stats?.mustBeHigher ?? 2}
                        onChange={(event) =>
                          patchStatsRow(row, {
                            ...row,
                            stats: {
                              set: statSet,
                              points: row.stats?.points ?? [],
                              comparePrevious: true,
                              mustBeHigher: Math.max(1, Math.round(Number.parseFloat(event.target.value) || 1)),
                            },
                          })
                        }
                      />
                    </label>
                  ) : null}
                  {row.sources.includes("dailyCompletionAverage") ? (
                    <>
                      <p className="habit95-hint">
                        The uncurved mean of each active daily habit’s row percent for this period.
                      </p>
                      <ul className="habit95-stat-readout" aria-label="Daily completion average inputs">
                        {averageRows.map((rowPercent) => (
                          <li key={rowPercent.id}>
                            <span>{rowPercent.name}</span>
                            <span>{Math.round(rowPercent.pct)}%</span>
                          </li>
                        ))}
                        <li>
                          <span>Mean</span>
                          <span>{averageMean === null ? "—" : `${Math.round(averageMean)}%`}</span>
                        </li>
                      </ul>
                    </>
                  ) : null}
                  {row.sources.includes("habitValue") ? (
                    <>
                      <p className="habit95-hint">
                        Adds one daily habit’s logged numbers across the days of this week, month, or season.
                      </p>
                      <DailyHabitPicker
                        habits={dailyValueSources}
                        habitId={task.habitValueLink?.habitId || ""}
                        onChange={(habitId) => {
                          setSourcesLocked(true)
                          setTask((current) => ({
                            ...current,
                            habitValueLink: habitId ? { habitId, enabled: true } : null,
                          }))
                        }}
                      />
                      <ul className="habit95-stat-readout" aria-label="Daily habit total">
                        <li>
                          <span>
                            {dailyValueSources.find((habit) => habit.id === task.habitValueLink?.habitId)?.name ||
                              "Choose a daily habit"}
                          </span>
                          <span>
                            {task.habitValueLink?.habitId
                              ? sumHabitValuesOverDays(weeklyData, task.habitValueLink.habitId, sumKeys)
                              : "—"}
                          </span>
                        </li>
                      </ul>
                    </>
                  ) : null}
                  {row.sources.includes("dailyFloor") ? (
                    <>
                      <p className="habit95-hint">
                        Every daily habit’s completion for this period is above 0. The habit is met only when that is true.
                      </p>
                      <ul className="habit95-stat-readout" aria-label="Daily habit percents">
                        {dailyPercents.map((rowPercent) => (
                          <li key={rowPercent.id}>
                            <span>{rowPercent.name}</span>
                            <span>{Math.round(rowPercent.pct)}%</span>
                          </li>
                        ))}
                      </ul>
                      <label className="habit95-field">
                        Allow this many at 0
                        <input
                          className="habit95-input"
                          type="number"
                          min={0}
                          step={1}
                          aria-label="Allow this many at 0"
                          value={effectiveDailyFloorLink(task)?.allowAtZero ?? 0}
                          onChange={(e) => {
                            setFloorLocked(true)
                            const allowAtZero = Math.max(0, Math.round(Number.parseFloat(e.target.value) || 0))
                            const floorPercent = effectiveDailyFloorLink(task)?.floorPercent ?? 0
                            setTask((current) => ({
                              ...current,
                              dailyFloorLink: {
                                floorPercent,
                                enabled: true,
                                ...(allowAtZero > 0 ? { allowAtZero } : {}),
                              },
                            }))
                          }}
                        />
                      </label>
                      <label className="habit95-field">
                        Each daily habit above
                        <input
                          className="habit95-input"
                          type="number"
                          min={0}
                          max={100}
                          aria-label="Daily habit floor percent"
                          value={effectiveDailyFloorLink(task)?.floorPercent ?? 0}
                          onChange={(e) => {
                            setFloorLocked(true)
                            const floorPercent = Math.min(100, Math.max(0, Math.round(Number.parseFloat(e.target.value) || 0)))
                            const allowAtZero = effectiveDailyFloorLink(task)?.allowAtZero ?? 0
                            setTask((current) => ({
                              ...current,
                              dailyFloorLink: {
                                floorPercent,
                                enabled: true,
                                ...(allowAtZero > 0 ? { allowAtZero } : {}),
                              },
                            }))
                          }}
                        />
                      </label>
                    </>
                  ) : null}
                </>
              )
}
