/**
 * components/Home/Habits/stat-source-builder.tsx — Habits stats as a small pipeline
 *
 * One module is the simple path: a name, the variable it writes, then source,
 * period, and output. Specific habit opens the nested habit and value.
 * A second module is the combine path: a statement over those variable names.
 * Menus come from `HABIT_STAT_CATALOG` in `lib/habit-stat-pipeline.ts`.
 */
"use client"

import { useMemo } from "react"
import { Habit95Select } from "@/components/Home/Habits/habit-sources-field"
import {
  HABIT_STAT_CATALOG,
  LOGGED_AMOUNT_VALUE_ID,
  SPECIFIC_HABIT_OUTPUT_ID,
  duplicateHabitStatPipeline,
  evaluateHabitStatBinding,
  findHabitStatSource,
  formatStatDisplay,
  gradeScale,
  habitLogsAmount,
  migrateHabitStatsSource,
  outputHasGradeScale,
  specificHabitValueOptions,
  type HabitStatBinding,
  type HabitStatBindingContext,
  type HabitStatGradeScale,
  type HabitStatPipeline,
} from "@/lib/habit-stat-pipeline"

export type StatHabitOption = { id: string; name: string; unit?: string; type?: string }

const SIMPLE_ID = "habit-stat-simple"

function sourceFor(sourceId: string) {
  return findHabitStatSource(sourceId) ?? HABIT_STAT_CATALOG.sources[0]
}

function safeIdent(value: string, fallback: string): string {
  const trimmed = value.trim().replace(/[^A-Za-z0-9_]/g, "")
  const ident = /^[A-Za-z_]/.test(trimmed) ? trimmed : trimmed ? `v${trimmed}` : fallback
  return ident || fallback
}

function uniqueIdent(value: string, taken: ReadonlySet<string>, fallback: string): string {
  let next = safeIdent(value, fallback)
  if (!taken.has(next)) return next
  let n = 2
  while (taken.has(`${next}${n}`)) n += 1
  return `${next}${n}`
}

const GRADE_SCALES: { id: HabitStatGradeScale; label: string }[] = [
  { id: "curved", label: "Curved" },
  { id: "raw", label: "Raw" },
]

export function defaultSimpleBinding(): HabitStatBinding {
  const source = HABIT_STAT_CATALOG.sources[0]
  const output = source?.outputs.find((item) => !item.specificHabit) ?? source?.outputs[0]
  const pipeline: HabitStatPipeline = {
    id: SIMPLE_ID,
    name: output?.label || "Stats",
    outputName: output?.id || "value",
    sourceId: source?.id ?? "daily",
    periodId: source?.periods[0]?.id ?? "thisWeek",
    outputId: output?.id ?? "weekGrade",
  }
  return { mode: "simple", pipelineId: pipeline.id, pipelines: [pipeline] }
}

function writeBinding(pipelines: HabitStatPipeline[], expression: string | undefined): HabitStatBinding {
  if (pipelines.length <= 1) {
    return { mode: "simple", pipelines, pipelineId: pipelines[0]?.id, expression: undefined }
  }
  return {
    mode: "statement",
    pipelines,
    pipelineId: undefined,
    expression: expression ?? pipelines.map((row) => row.outputName).filter(Boolean).join(" and "),
  }
}

export function StatSourceBuilder({
  binding,
  onChange,
  habitsForSource,
  context,
}: {
  binding: HabitStatBinding
  onChange: (binding: HabitStatBinding) => void
  habitsForSource: (sourceId: string) => readonly StatHabitOption[]
  context?: HabitStatBindingContext
}) {
  const pipelines = binding.pipelines ?? []
  const evaluation = useMemo(() => {
    if (!pipelines.length || !context) return null
    try {
      return evaluateHabitStatBinding(binding, context)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read this pipeline"
      return { variables: {}, value: null, label: "", error: message }
    }
  }, [binding, context, pipelines.length])

  const commit = (next: HabitStatPipeline[], expression?: string) => {
    onChange(writeBinding(next, expression ?? binding.expression))
  }

  const patchModule = (index: number, patch: Partial<HabitStatPipeline>) => {
    const next = pipelines.map((row, i) => (i === index ? { ...row, ...patch } : row))
    if (patch.sourceId) {
      const source = sourceFor(patch.sourceId)
      const periodOk = source.periods.some((period) => period.id === next[index].periodId)
      const outputOk = source.outputs.some((output) => output.id === next[index].outputId)
      if (!periodOk) next[index] = { ...next[index], periodId: source.periods[0]?.id ?? "" }
      if (!outputOk) {
        const output = source.outputs.find((item) => !item.specificHabit) ?? source.outputs[0]
        next[index] = { ...next[index], outputId: output?.id ?? "", habitId: undefined, valueId: undefined }
      }
    }
    if (!outputHasGradeScale(next[index].outputId) && next[index].scale) {
      const { scale: _scale, ...rest } = next[index]
      next[index] = rest
    }
    if (patch.outputName !== undefined) {
      const taken = new Set(next.filter((_, i) => i !== index).map((row) => row.outputName))
      next[index] = { ...next[index], outputName: uniqueIdent(patch.outputName, taken, `value${index + 1}`) }
    }
    if (patch.name !== undefined) {
      const taken = new Set(next.filter((_, i) => i !== index).map((row) => row.name.trim()))
      const name = patch.name.trim()
      next[index] = { ...next[index], name: name && taken.has(name) ? `${name} 2` : patch.name }
    }
    commit(next)
  }

  const addModule = () => {
    const taken = new Set(pipelines.map((row) => row.outputName))
    const seeded = defaultSimpleBinding().pipelines[0]
    const outputName = uniqueIdent(seeded.outputName, taken, "value")
    commit([
      ...pipelines,
      {
        ...seeded,
        id: `habit-stat-${pipelines.length + 1}-${outputName}`,
        name: pipelines.length === 0 ? seeded.name : `${seeded.name} ${pipelines.length + 1}`,
        outputName,
      },
    ])
  }

  const duplicateModule = (index: number) => {
    const copy = duplicateHabitStatPipeline(pipelines[index])
    const takenNames = new Set(pipelines.map((row) => row.outputName))
    const takenTitles = new Set(pipelines.map((row) => row.name.trim()))
    if (takenNames.has(copy.outputName)) copy.outputName = uniqueIdent(copy.outputName, takenNames, `${copy.outputName}2`)
    if (takenTitles.has(copy.name.trim())) copy.name = `${copy.name} 2`
    const next = pipelines.slice()
    next.splice(index + 1, 0, copy)
    commit(next)
  }

  const removeModule = (index: number) => {
    commit(pipelines.filter((_, i) => i !== index))
  }

  return (
    <div className="habit95-stat-builder">
      {pipelines.length === 0 ? (
        <p className="habit95-hint">No stats module yet.</p>
      ) : (
        <ol className="habit95-stat-modules">
          {pipelines.map((row, index) => {
            const source = sourceFor(row.sourceId)
            const output = source.outputs.find((item) => item.id === row.outputId)
            const specific = !!output?.specificHabit || row.outputId === SPECIFIC_HABIT_OUTPUT_ID
            const habits = habitsForSource(row.sourceId)
            const live = evaluation?.variables?.[row.outputName]
            const liveNumber = typeof live === "number" ? live : null
            const labelFor = (noun: string) => (pipelines.length > 1 ? `${noun} for ${row.outputName || index + 1}` : noun)
            return (
              <li key={row.id} className="habit95-stat-module">
                <div className="habit95-stat-name-row">
                  <label className="habit95-field">
                    Name
                    <input
                      className="habit95-input"
                      aria-label={labelFor("Pipeline name")}
                      value={row.name}
                      onChange={(event) => patchModule(index, { name: event.target.value })}
                    />
                  </label>
                  <p
                    className="habit95-stat-live"
                    data-empty={liveNumber === null ? "true" : "false"}
                    aria-label={labelFor("Live output")}
                  >
                    <span className="habit95-stat-var">{row.outputName || "value"}</span>
                    <span>{formatStatDisplay(liveNumber)}</span>
                  </p>
                </div>
                <label className="habit95-field">
                  Output variable
                  <input
                    className="habit95-input"
                    aria-label={labelFor("Output variable")}
                    value={row.outputName}
                    spellCheck={false}
                    onChange={(event) => patchModule(index, { outputName: event.target.value })}
                  />
                </label>
                <Habit95Select
                  label="Source"
                  ariaLabel={labelFor("Source")}
                  valueLabel={source.label}
                  options={HABIT_STAT_CATALOG.sources.map((item) => ({ id: item.id, label: item.label }))}
                  onChange={(sourceId) => patchModule(index, { sourceId, habitId: undefined, valueId: undefined })}
                />
                <Habit95Select
                  label="Period"
                  ariaLabel={labelFor("Period")}
                  valueLabel={source.periods.find((item) => item.id === row.periodId)?.label || "Choose a period"}
                  options={source.periods.map((item) => ({ id: item.id, label: item.label }))}
                  onChange={(periodId) => patchModule(index, { periodId })}
                />
                <Habit95Select
                  label="Output"
                  ariaLabel={labelFor("Output")}
                  valueLabel={output?.label || "Choose an output"}
                  options={source.outputs.map((item) => ({ id: item.id, label: item.label }))}
                  onChange={(outputId) => {
                    const next = source.outputs.find((item) => item.id === outputId)
                    patchModule(index, {
                      outputId,
                      ...(next?.specificHabit ? {} : { habitId: undefined, valueId: undefined }),
                    })
                  }}
                />
                {outputHasGradeScale(row.outputId) ? (
                  <Habit95Select
                    label="Number"
                    ariaLabel={labelFor("Raw or curved")}
                    valueLabel={gradeScale(row) === "raw" ? "Raw" : "Curved"}
                    options={GRADE_SCALES}
                    hint="Curved is the control panel tube. Raw is that grade before the curve."
                    onChange={(scale) => patchModule(index, { scale: scale === "raw" ? "raw" : "curved" })}
                  />
                ) : null}
                {specific ? (
                  <div className="habit95-stat-nested">
                    <Habit95Select
                      label="Habit"
                      ariaLabel={labelFor("Habit")}
                      valueLabel={habits.find((habit) => habit.id === row.habitId)?.name || "Choose a habit"}
                      options={habits.map((habit) => ({ id: habit.id, label: habit.name || "Untitled" }))}
                      onChange={(habitId) => {
                        const next = habits.find((habit) => habit.id === habitId)
                        const drop = row.valueId === LOGGED_AMOUNT_VALUE_ID && next && !habitLogsAmount(next)
                        patchModule(index, { habitId, ...(drop ? { valueId: undefined } : {}) })
                      }}
                    />
                    <Habit95Select
                      label="Value"
                      ariaLabel={labelFor("Habit value")}
                      valueLabel={
                        specificHabitValueOptions(source, habits.find((habit) => habit.id === row.habitId)).find(
                          (item) => item.id === row.valueId,
                        )?.label || "Choose a value"
                      }
                      options={specificHabitValueOptions(source, habits.find((habit) => habit.id === row.habitId))}
                      onChange={(valueId) => patchModule(index, { valueId })}
                    />
                  </div>
                ) : null}
                <div className="habit95-stat-module-actions">
                  <button type="button" className="habit95-stat-text" onClick={() => duplicateModule(index)}>
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="habit95-stat-text"
                    aria-label={labelFor("Remove module")}
                    onClick={() => removeModule(index)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {pipelines.length > 1 ? (
        <label className="habit95-field">
          Statement
          <input
            className="habit95-input"
            aria-label="Statement"
            value={binding.expression ?? ""}
            spellCheck={false}
            onChange={(event) => commit(pipelines, event.target.value)}
          />
        </label>
      ) : null}
      {pipelines.length > 1 ? (
        <p className="habit95-hint" aria-label="Statement result" data-error={evaluation?.error ? "true" : "false"}>
          {evaluation?.error
            ? evaluation.error
            : evaluation?.value === null || evaluation?.value === undefined
              ? "—"
              : formatStatDisplay(evaluation.value)}
        </p>
      ) : null}
      <button type="button" className="habit95-stat-text" onClick={addModule}>
        Add module
      </button>
    </div>
  )
}

export function openedStatBinding(row: { stats?: unknown; statBinding?: unknown }): HabitStatBinding {
  if (row.statBinding != null) {
    return migrateHabitStatsSource(row.statBinding) ?? { mode: "simple", pipelines: [] }
  }
  return migrateHabitStatsSource(row.stats) ?? defaultSimpleBinding()
}
