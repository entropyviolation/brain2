/**
 * components/Home/Habits/habit-sources-field.tsx — Completion sources pipeline
 *
 * The sources that are on, most trusted first. Each row is a broad type the
 * person added, with an optional name (the type label when the name is blank).
 * Add source asks for a type, then that row's config. Up and Down move trust.
 * Sources that are off are not listed. Short choices in this section use
 * `Habit95Select`, the same milled menu as the daily-habit picker.
 * Habits stats uses that menu twice: the set (daily, weekly, or monthly
 * habits), then a point. A set previews names and percents.
 */
"use client"

import type { ReactNode } from "react"
import { useEffect, useId, useRef, useState } from "react"
import type { HabitCompletionPipeline, HabitPipelineKind, HabitStatSet } from "@/lib/types"
import { HABIT_STAT_SET_LABELS } from "@/lib/habit-stat-points"
import {
  PIPELINE_KIND_LABELS,
  PIPELINE_KIND_ORDER,
  defaultSourcesForKind,
  makePipeline,
  movePipeline,
  pipelineRowLabel,
} from "@/lib/habit-completion-pipeline"

/** Milled Win95 menu. Searchable, like the daily-habit picker. Not a native select. */
export function Habit95Select({
  label,
  ariaLabel,
  valueLabel,
  options,
  onChange,
  hint,
}: {
  label: string
  ariaLabel: string
  valueLabel: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const buttonId = useId()
  const needle = query.trim().toLowerCase()
  const matches = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options

  const close = () => {
    setOpen(false)
    setQuery("")
  }

  useEffect(() => {
    if (!open) return
    const shut = () => {
      setOpen(false)
      setQuery("")
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) shut()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      shut()
    }
    window.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="habit95-field">
      <label htmlFor={buttonId}>{label}</label>
      <div className="habit95-pick" ref={rootRef}>
        <button
          id={buttonId}
          type="button"
          className="habit95-select"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={menuId}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className="habit95-select-label">{valueLabel}</span>
          <span className="habit95-select-arrow" aria-hidden />
        </button>
        {open ? (
          <div className="habit95-select-menu habit95-habit-menu" id={menuId} role="listbox" aria-label={ariaLabel}>
            <input
              className="habit95-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}`}
              aria-label={`Search ${label.toLowerCase()}`}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault()
              }}
            />
            <div className="habit95-habit-options">
              {matches.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.label === valueLabel}
                  data-active={option.label === valueLabel ? "true" : undefined}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange(option.id)
                    close()
                  }}
                >
                  {option.label}
                </button>
              ))}
              {matches.length === 0 ? <p className="habit95-hint">No matches for “{query.trim()}”.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
      {hint ? <span className="habit95-hint">{hint}</span> : null}
    </div>
  )
}

export function HabitPipelineEditor({
  pipelines,
  onChange,
  renderConfig,
}: {
  pipelines: HabitCompletionPipeline[]
  onChange: (rows: HabitCompletionPipeline[], reason: "rename" | "structure") => void
  renderConfig: (row: HabitCompletionPipeline) => ReactNode
}) {
  const [picking, setPicking] = useState(false)
  const used = new Set(pipelines.map((row) => row.kind))
  const available = PIPELINE_KIND_ORDER.filter((kind) => !used.has(kind))

  const add = (kind: HabitPipelineKind) => {
    onChange([...pipelines, makePipeline(kind, defaultSourcesForKind(kind))], "structure")
    setPicking(false)
  }

  return (
    <div className="habit95-pipeline">
      <ol className="habit95-pipeline-list">
        {pipelines.map((row, index) => {
          const label = pipelineRowLabel(row)
          return (
            <li key={row.id} className="habit95-pipeline-row" data-kind={row.kind}>
              <div className="habit95-pipeline-head">
                <label className="habit95-field">
                  <span className="sr-only">Name for {PIPELINE_KIND_LABELS[row.kind]}</span>
                  <input
                    className="habit95-input"
                    aria-label={`Name for ${PIPELINE_KIND_LABELS[row.kind]}`}
                    placeholder={PIPELINE_KIND_LABELS[row.kind]}
                    value={row.name ?? ""}
                    onChange={(event) =>
                      onChange(
                        pipelines.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)),
                        "rename",
                      )
                    }
                  />
                </label>
                <span className="habit95-source-rank">{index + 1}</span>
                <span className="habit95-pipeline-moves">
                  <button
                    type="button"
                    className="habit95-btn"
                    disabled={index === 0}
                    aria-label={`Move ${label} up`}
                    onClick={() => onChange(movePipeline(pipelines, index, -1), "structure")}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="habit95-btn"
                    disabled={index === pipelines.length - 1}
                    aria-label={`Move ${label} down`}
                    onClick={() => onChange(movePipeline(pipelines, index, 1), "structure")}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="habit95-btn"
                    aria-label={`Remove ${label}`}
                    onClick={() => onChange(pipelines.filter((item) => item.id !== row.id), "structure")}
                  >
                    Remove
                  </button>
                </span>
              </div>
              <div className="habit95-pipeline-config">{renderConfig(row)}</div>
            </li>
          )
        })}
      </ol>
      {picking ? (
        <div className="habit95-pipeline-types" role="group" aria-label="Source type">
          {available.map((kind) => (
            <button key={kind} type="button" className="habit95-btn" onClick={() => add(kind)}>
              {PIPELINE_KIND_LABELS[kind]}
            </button>
          ))}
          <button type="button" className="habit95-btn" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="habit95-btn" onClick={() => setPicking(true)} disabled={available.length === 0}>
          Add source
        </button>
      )}
    </div>
  )
}

export interface HabitStatPointRow {
  key: string
  label: string
  valueText: string
  members?: { id: string; name: string; pct: number }[]
}

/** Set menu, point menu, and the points already on a Habits stats row. */
export function HabitStatsPoints({
  set,
  onSet,
  pointOptions,
  onPick,
  selected,
  onRemove,
  comparePrevious,
  mustBeHigher,
  onMustBeHigher,
}: {
  set: HabitStatSet
  onSet: (set: HabitStatSet) => void
  pointOptions: { id: string; label: string }[]
  onPick: (id: string) => void
  selected: HabitStatPointRow[]
  onRemove: (key: string) => void
  comparePrevious: boolean
  mustBeHigher: number
  onMustBeHigher: (value: number) => void
}) {
  return (
    <>
      <Habit95Select
        label="Habits"
        ariaLabel="Habit stats set"
        valueLabel={HABIT_STAT_SET_LABELS[set]}
        options={(["daily", "weekly", "monthly"] as const).map((id) => ({ id, label: HABIT_STAT_SET_LABELS[id] }))}
        onChange={(id) => onSet(id as HabitStatSet)}
      />
      <Habit95Select
        label="Point"
        ariaLabel="Habit stats point"
        valueLabel="Add a point"
        options={pointOptions}
        onChange={onPick}
      />
      {selected.map((point) => (
        <div key={point.key}>
          <p className="habit95-hint">
            {point.label}
            {point.members?.length ? "" : ` · ${point.valueText}`}
            <button
              type="button"
              className="habit95-btn"
              aria-label={`Remove ${point.label}`}
              onClick={() => onRemove(point.key)}
            >
              Remove
            </button>
          </p>
          {point.members?.length ? (
            <ul className="habit95-stat-readout" aria-label={`${point.label} preview`}>
              {point.members.map((member) => (
                <li key={member.id}>
                  <span>{member.name}</span>
                  <span>{Math.round(member.pct)}%</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {comparePrevious ? (
        <label className="habit95-field">
          How many must be higher
          <input
            className="habit95-input"
            type="number"
            min={1}
            step={1}
            aria-label="How many must be higher"
            value={mustBeHigher}
            onChange={(event) => onMustBeHigher(Math.max(1, Math.round(Number.parseFloat(event.target.value) || 1)))}
          />
        </label>
      ) : null}
    </>
  )
}
