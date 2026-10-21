/**
 * components/Home/ToDo/TodoSettingsDialog.tsx — Global To Do settings (the globe key by the header glass)
 *
 * Everything that holds for every view: title words, sun rites, the
 * in-progress cap, default estimate, your pace, and saved priority formulas. Writes `todo-prefs` only.
 */
"use client"

import { useState, type ReactNode } from "react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MAX_WIP_LIMIT, MIN_WIP_LIMIT, setTodoPrefs, useTodoPrefs, type TodoTitleView } from "./todo-prefs"
import { todoViewPhrase } from "./todo-ranges"
import { PriorityFormulaPanel } from "./PriorityFormulaPanel"

const VIEWS: { view: TodoTitleView; label: string }[] = [
  { view: "day", label: "Day" },
  { view: "week", label: "Week" },
  { view: "month", label: "Month" },
  { view: "quarter", label: "Season" },
  { view: "other", label: "Other" },
]

export function TodoSettingsDialog({ paceSlot }: { paceSlot?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const prefs = useTodoPrefs()
  const now = new Date()
  const setViewTitle = (view: TodoTitleView, value: string) =>
    setTodoPrefs({ titleByView: { ...prefs.titleByView, [view]: value } })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="todo-gear" data-no95 aria-label="To Do settings" title="To do settings (every view)">
          <img className="todo-gear-globe" src="/todo/settings-globe.jpg" alt="" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent
        className="todo95-dialog todo-settings"
        hideClose
        aria-describedby={undefined}
        data-ui-name="To Do settings"
        data-ui-help="Global settings for every To Do view."
        data-ui-docs="components/Home/ToDo/README.md"
      >
        <div className="todo-dialog-caption">
          <DialogTitle>To Do settings</DialogTitle>
        </div>
        <div className="todo-dialog-body">
          <fieldset className="todo-settings-group">
            <legend>Title</legend>
            <label htmlFor="todo-title-base">Title word</label>
            <input
              id="todo-title-base"
              defaultValue={prefs.titleBase}
              placeholder="To do"
              onBlur={(e) => setTodoPrefs({ titleBase: e.target.value })}
            />
            {VIEWS.map(({ view, label }) => (
              <div key={view} className="todo-settings-row">
                <label htmlFor={`todo-title-${view}`}>{label}</label>
                <input
                  id={`todo-title-${view}`}
                  defaultValue={prefs.titleByView[view] ?? ""}
                  placeholder={`${prefs.titleBase} ${todoViewPhrase(view, now, now, view === "other" ? "…" : undefined)}`}
                  onBlur={(e) => setViewTitle(view, e.target.value)}
                />
              </div>
            ))}
            <p className="todo-hint">Blank uses the title word plus the view, like “{prefs.titleBase} this week”.</p>
          </fieldset>

          <fieldset className="todo-settings-group">
            <legend>Sun rites</legend>
            <label className="todo-chip">
              <input
                type="checkbox"
                checked={prefs.ritesFollowSun}
                onChange={(e) => setTodoPrefs({ ritesFollowSun: e.target.checked })}
              />
              Rites follow the sun
            </label>
            <p className="todo-hint">Night ritual waits for sunset. An unstarted Morning ritual leaves at sunset. Today only.</p>
          </fieldset>

          <fieldset className="todo-settings-group">
            <legend>Pace</legend>
            <label className="todo-inline-field">
              <span className="todo-label" id="todo-wip-limit-label">In progress cap</span>
              <input
                id="todo-wip-limit"
                aria-labelledby="todo-wip-limit-label"
                type="number"
                min={MIN_WIP_LIMIT}
                max={MAX_WIP_LIMIT}
                value={prefs.wipLimit}
                onChange={(e) => setTodoPrefs({ wipLimit: Number(e.target.value) })}
              />
            </label>
            <label className="todo-inline-field" title="Minutes a task with no estimate counts as on Plan. Shown as ~30. 0 = none.">
              <span className="todo-label" id="todo-default-est-label">Default est</span>
              <input
                id="todo-default-est"
                aria-labelledby="todo-default-est-label"
                type="number"
                min={0}
                max={600}
                step={5}
                value={prefs.defaultEstimateMin}
                onChange={(e) => setTodoPrefs({ defaultEstimateMin: Number(e.target.value) })}
              />
            </label>
            {paceSlot}
          </fieldset>

          <fieldset className="todo-settings-group">
            <legend>Priority formula</legend>
            <label className="todo-chip" title="Open the formula with its plots: the simplex, score stacks, φ spreads, and rank agreement.">
              <input type="checkbox" checked={prefs.showMath} onChange={(e) => setTodoPrefs({ showMath: e.target.checked })} />
              Show the math by default
            </label>
            <PriorityFormulaPanel key={String(prefs.showMath)} />
          </fieldset>

          <div className="todo-dialog-actions">
            <button type="button" className="todo-btn" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
