/**
 * components/Home/Habits/habit-form/sources.tsx — Completion sources fieldset.
 *
 * Legend, trust-order hint, tag-role note, the pipeline editor, the short
 * row kinds, and the Counts Done / Fills minutes line. Lists and Habits stats
 * rows render the sibling components. Lock setters and `commitPipelines`
 * stay in `TaskForm`.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { HabitTagCatalog } from "@/components/Home/Habits/habit-tag-catalog"
import { HabitPipelineEditor } from "@/components/Home/Habits/habit-sources-field"
import type { CatalogTagEdit } from "@/lib/catalog-tag"
import {
  clampCoverageThreshold,
  DEFAULT_COVERAGE_THRESHOLD,
  effectiveCoverageLink,
} from "@/lib/habit-completion-source"
import { togglePipelineSource } from "@/lib/habit-completion-pipeline"
import { COMPLETION_SOURCE_HINTS, COMPLETION_SOURCE_LABELS } from "@/lib/habit-completion-trust"
import type { HabitStatContext, HabitStatSet } from "@/lib/habit-stat-points"
import { normalizeTag } from "@/lib/links"
import type { TrackTag } from "@/lib/time-tracking-store"
import type { Task, WeeklyData, WeeklyTask } from "@/lib/types"
import type { HabitCompletionPipeline, HabitCompletionSourceId } from "@/lib/types"
import { KeywordSourceFields } from "./keywords"
import { HabitFormListSource } from "./list-source"
import { HabitFormStatsSource } from "./stats-source"

type SetFlag = Dispatch<SetStateAction<boolean>>
type SetTask = Dispatch<SetStateAction<WeeklyTask>>

export function HabitFormSources({
  displayPipelines,
  commitPipelines,
  showTagRolesLegend,
  showBothTagRoles,
  doneCountName,
  minuteTagNames,
  trackingTags,
  task,
  setTask,
  createCountTag,
  noteCatalogEdit,
  setRowSources,
  setCoverageLocked,
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
  listChoices,
  vaultItems,
  setListLocked,
  onOpenList,
}: {
  displayPipelines: HabitCompletionPipeline[]
  commitPipelines: (rows: HabitCompletionPipeline[], reason: "rename" | "structure") => void
  showTagRolesLegend: boolean
  showBothTagRoles: boolean
  doneCountName: string
  minuteTagNames: string[]
  trackingTags: readonly TrackTag[]
  task: WeeklyTask
  setTask: SetTask
  createCountTag: (name: string) => void
  noteCatalogEdit: (result: CatalogTagEdit) => void
  setRowSources: (row: HabitCompletionPipeline, sources: HabitCompletionSourceId[]) => void
  setCoverageLocked: SetFlag
  weeklyHabits: WeeklyTask[]
  monthlyHabits: WeeklyTask[]
  dailyHabits: WeeklyTask[]
  statContext: (set: HabitStatSet) => HabitStatContext
  accomplishmentThreshold: number
  patchStatsRow: (row: HabitCompletionPipeline, next: HabitCompletionPipeline) => void
  averageRows: { id: string; name: string; pct: number }[]
  averageMean: number | null
  dailyValueSources: { id: string; name: string }[]
  setSourcesLocked: SetFlag
  weeklyData: WeeklyData
  sumKeys: string[]
  dailyPercents: { id: string; name: string; pct: number }[]
  setFloorLocked: SetFlag
  listChoices: { id: string; name: string }[]
  vaultItems: readonly Task[]
  setListLocked: SetFlag
  onOpenList: (listId: string, host: HTMLElement | null) => void
}) {
  return (
      <fieldset id="habit95-sec-sources" tabIndex={-1} className="habit95-group habit95-sec-sources">
        <legend>Completion sources</legend>
        <p className="habit95-hint">
          A habit can listen to more than one place. The list is trust order: the first source that has something to
          say wins when they disagree. A source with no observation is skipped. A number or tick you type still wins.
        </p>
        {showTagRolesLegend ? (
          <div role="note" aria-label="Tag source roles">
            <p className="habit95-hint">
              Counts Done = Tags / one tag name / each Done is 1 / goal is Target → Amount.
            </p>
            <p className="habit95-hint">
              Fills minutes = Tracking tags / Auto-fill / many catalog tags.
            </p>
            <p className="habit95-hint">Same catalog, separate picks.</p>
          </div>
        ) : null}
        <HabitPipelineEditor
          pipelines={displayPipelines}
          onChange={commitPipelines}
          renderConfig={(row) => {
            if (row.kind === "tags") {
              return (
                <>
                  <p className="habit95-hint">
                    Done tasks and tracked activities with this tag each count as 1. The goal is how many complete the
                    period. The habit’s Done line carries the tag. A tracking block that already has it still files one
                    Done line.
                  </p>
                  <p className="habit95-hint">
                    These chips are the Tracking tags. A new tag, a new name, or a new color here is the same tag on
                    Auto-fill from Tracking.
                  </p>
                  <HabitTagCatalog
                    tags={trackingTags}
                    groupLabel="Tags, shared with Auto-fill from Tracking"
                    newTagAriaLabel="New tag"
                    pressedMark="counts"
                    pressed={(tag) => normalizeTag(tag.name) === normalizeTag(task.taggedTaskTag ?? "")}
                    onToggle={(tag) => {
                      const on = normalizeTag(tag.name) === normalizeTag(task.taggedTaskTag ?? "")
                      setTask((current) => ({
                        ...current,
                        taggedTaskTag: on ? "" : normalizeTag(tag.name),
                      }))
                    }}
                    onCreate={createCountTag}
                    onEdited={noteCatalogEdit}
                  />
                  <p className="habit95-hint">One tag name. Goal amount is Target → Amount.</p>
                  <div className="habit95-field">
                    <label htmlFor="tagged-task-tag">Tag</label>
                    <input
                      id="tagged-task-tag"
                      className="habit95-input"
                      aria-label="Tagged task tag"
                      value={task.taggedTaskTag ?? ""}
                      placeholder="cooking"
                      onChange={(e) => setTask((current) => ({ ...current, taggedTaskTag: e.target.value }))}
                    />
                    <p className="habit95-hint">
                      May be a name not in the catalog; chips pick from the catalog. Same string either way.
                    </p>
                  </div>
                </>
              )
            }
            if (row.kind === "trackingStats") {
              return (
                <>
                  {(["coverage", "sleep"] as const).map((id) => (
                    <label key={id} className="habit95-check">
                      <input
                        type="checkbox"
                        checked={row.sources.includes(id)}
                        onChange={() => setRowSources(row, togglePipelineSource(row, id))}
                      />
                      {COMPLETION_SOURCE_LABELS[id]}
                    </label>
                  ))}
                  {row.sources.includes("coverage") ? (
                    <label className="habit95-field">
                      Complete at or above
                      <input
                        className="habit95-input"
                        type="number"
                        min={1}
                        max={100}
                        aria-label="Coverage threshold percent"
                        value={effectiveCoverageLink(task)?.threshold ?? DEFAULT_COVERAGE_THRESHOLD}
                        onChange={(e) => {
                          setCoverageLocked(true)
                          const threshold = clampCoverageThreshold(Number.parseFloat(e.target.value))
                          setTask((current) => ({
                            ...current,
                            goal: threshold,
                            unit: "%",
                            coverageLink: { threshold, enabled: true },
                          }))
                        }}
                      />
                    </label>
                  ) : null}
                </>
              )
            }
            if (row.kind === "habitsStats") {
              return (
                <HabitFormStatsSource
                  row={row}
                  task={task}
                  setTask={setTask}
                  weeklyHabits={weeklyHabits}
                  monthlyHabits={monthlyHabits}
                  dailyHabits={dailyHabits}
                  statContext={statContext}
                  accomplishmentThreshold={accomplishmentThreshold}
                  patchStatsRow={patchStatsRow}
                  averageRows={averageRows}
                  averageMean={averageMean}
                  dailyValueSources={dailyValueSources}
                  setSourcesLocked={setSourcesLocked}
                  weeklyData={weeklyData}
                  sumKeys={sumKeys}
                  dailyPercents={dailyPercents}
                  setFloorLocked={setFloorLocked}
                />
              )
            }
            if (row.kind === "lists") {
              return (
                <HabitFormListSource
                  row={row}
                  task={task}
                  setTask={setTask}
                  displayPipelines={displayPipelines}
                  listChoices={listChoices}
                  vaultItems={vaultItems}
                  setSourcesLocked={setSourcesLocked}
                  setListLocked={setListLocked}
                  onOpenList={onOpenList}
                />
              )
            }
            if (row.kind === "keywords") {
              return (
                <KeywordSourceFields
                  row={row}
                  onChange={(keyword) =>
                    commitPipelines(
                      displayPipelines.map((item) => (item.id === row.id ? { ...item, keyword } : item)),
                      "structure",
                    )
                  }
                />
              )
            }
            if (row.kind === "trackingTags") {
              return (
                <>
                  <p className="habit95-hint">{COMPLETION_SOURCE_HINTS.tags}</p>
                  <p className="habit95-hint">Tags and options are in Auto-fill from Tracking below.</p>
                </>
              )
            }
            return <p className="habit95-hint">{COMPLETION_SOURCE_HINTS.manual}</p>
          }}
        />
        {showBothTagRoles ? (
          <p className="habit95-hint" role="status">
            Counts Done: {doneCountName || "none"} · Fills minutes:{" "}
            {minuteTagNames.length > 0 ? minuteTagNames.join(", ") : "none"}
          </p>
        ) : null}
      </fieldset>
  )
}
