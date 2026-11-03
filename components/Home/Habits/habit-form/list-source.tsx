/**
 * components/Home/Habits/habit-form/list-source.tsx — Lists pipeline row.
 *
 * Measure, target, grace, and the list preview. `applyRouting` and
 * `keepRouting` moved with this branch. Open list reports the dialog host
 * back to `TaskForm`, which still owns the popup.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Habit95Select } from "@/components/Home/Habits/habit-sources-field"
import {
  describeListRoutingPreview,
  flattenPipelines,
  legacyModeForRouting,
  listRoutingFromLink,
  storedListSentFields,
} from "@/lib/habit-completion-pipeline"
import { clampListSentGrace } from "@/lib/list-sent"
import type { Task } from "@/lib/types"
import type {
  HabitCompletionPipeline,
  HabitListMeasure,
  HabitListPipelineMode,
  HabitListTarget,
  WeeklyTask,
} from "@/lib/types"
import { GRACE_SENTENCE, LIST_MEASURES, LIST_TARGETS, sourcesForListRouting, withSourceOrder } from "./model"
import { ListSentPicker } from "./pickers"

export function HabitFormListSource({
  row,
  task,
  setTask,
  displayPipelines,
  listChoices,
  vaultItems,
  setSourcesLocked,
  setListLocked,
  onOpenList,
}: {
  row: HabitCompletionPipeline
  task: WeeklyTask
  setTask: Dispatch<SetStateAction<WeeklyTask>>
  displayPipelines: HabitCompletionPipeline[]
  listChoices: { id: string; name: string }[]
  vaultItems: readonly Task[]
  setSourcesLocked: Dispatch<SetStateAction<boolean>>
  setListLocked: Dispatch<SetStateAction<boolean>>
  onOpenList: (listId: string, host: HTMLElement | null) => void
}) {
              const fallback: HabitListPipelineMode = row.sources.includes("listSent")
                ? "sentThisWeek"
                : row.sources.includes("list")
                  ? "oneComplete"
                  : "sentThisWeek"
              const routing = listRoutingFromLink(task.listSentLink, fallback)
              const listId = task.listSentLink?.listId || ""
              const known = listChoices.find((list) => list.id === listId)
              const listName = known?.name || (listId ? `List ${listId}` : "")
              const pickerLists = listId && !known ? [...listChoices, { id: listId, name: listName }] : listChoices
              const preview = describeListRoutingPreview(vaultItems, listId, routing, task.frequency, new Date())
              const measureHint = LIST_MEASURES.find((option) => option.id === routing.measure)?.hint
              const targetHint = LIST_TARGETS.find((option) => option.id === routing.target)?.hint
              const applyRouting = (nextRouting: { measure: HabitListMeasure; target: HabitListTarget }) => {
                const sources = sourcesForListRouting(nextRouting)
                const rows = displayPipelines.map((item) => (item.id === row.id ? { ...item, sources } : item))
                setSourcesLocked(true)
                setListLocked(true)
                setTask((current) => {
                  const picked = pickerLists.find((list) => list.id === (current.listSentLink?.listId || ""))
                  let next: WeeklyTask = {
                    ...current,
                    listSentLink: {
                      listId: current.listSentLink?.listId ?? "",
                      grace: clampListSentGrace(current.listSentLink?.grace),
                      ...storedListSentFields(nextRouting),
                    },
                  }
                  if (legacyModeForRouting(nextRouting) === "oneComplete") {
                    next = {
                      ...next,
                      listLink: { listName: picked?.name || current.listLink?.listName || "to do", count: 1 },
                    }
                  }
                  return { ...withSourceOrder(next, flattenPipelines(rows)), completionPipelines: rows }
                })
              }
              const keepRouting = (patch: { listId?: string; grace?: number | null }) => {
                setSourcesLocked(true)
                setTask((current) => ({
                  ...current,
                  listSentLink: {
                    listId: patch.listId ?? current.listSentLink?.listId ?? "",
                    grace:
                      patch.grace === null
                        ? undefined
                        : typeof patch.grace === "number"
                          ? patch.grace
                          : clampListSentGrace(current.listSentLink?.grace),
                    ...storedListSentFields(current.listSentLink),
                  },
                }))
              }
              return (
                <>
                  <div className="habit95-list-row">
                    <ListSentPicker
                      lists={pickerLists}
                      listId={listId}
                      onChange={(nextId) => keepRouting({ listId: nextId })}
                    />
                    <button
                      type="button"
                      className="habit95-btn habit95-list-open"
                      disabled={!listId}
                      aria-label="Open list"
                      onClick={(event) => {
                        onOpenList(
                          listId,
                          (event.currentTarget as HTMLElement).closest("[data-ui-name='Habit form']"),
                        )
                      }}
                    >
                      Open list
                    </button>
                  </div>
                  <Habit95Select
                    label="What is counted"
                    ariaLabel="What is counted"
                    valueLabel={LIST_MEASURES.find((option) => option.id === routing.measure)?.label || "Sent"}
                    options={LIST_MEASURES.map((option) => ({ id: option.id, label: option.label }))}
                    hint={measureHint}
                    onChange={(id) => applyRouting({ measure: id as HabitListMeasure, target: routing.target })}
                  />
                  <Habit95Select
                    label="What the target is"
                    ariaLabel="What the target is"
                    valueLabel={LIST_TARGETS.find((option) => option.id === routing.target)?.label || "This period's set"}
                    options={LIST_TARGETS.map((option) => ({ id: option.id, label: option.label }))}
                    hint={targetHint}
                    onChange={(id) => applyRouting({ measure: routing.measure, target: id as HabitListTarget })}
                  />
                  <label className="habit95-field">
                    Grace
                    <input
                      className="habit95-input"
                      type="number"
                      min={1}
                      max={100}
                      aria-label="Grace"
                      value={task.listSentLink?.grace ?? ""}
                      onChange={(e) => {
                        if (e.target.value === "") {
                          keepRouting({ grace: null })
                          return
                        }
                        const grace = Number.parseFloat(e.target.value)
                        if (!Number.isFinite(grace)) return
                        keepRouting({ grace: clampListSentGrace(grace) })
                      }}
                    />
                  </label>
                  <p className="habit95-hint">{GRACE_SENTENCE}</p>
                  <p className="habit95-hint" data-testid="list-pipeline-preview">
                    {listId ? `${preview.summary}${preview.names.length ? ` — ${preview.names.slice(0, 8).join(", ")}` : ""}` : "Choose a list to see what counts."}
                  </p>
                </>
              )
}
