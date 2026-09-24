"use client"

import { Label } from "@/components/ui/label"
import type { List } from "@/lib/types"
import {
  CHECKLIST_CHECKBOX_LABELS,
  OPTIONAL_CHECKLIST_CHECKBOX_VARS,
  checklistHasVar,
  sanitizeChecklistCheckboxVars,
  toggleChecklistCheckboxVar,
} from "@/lib/checklist-checkbox-vars"
import { DetailsViewSettings } from "./DetailsViewSettings"
import { DefaultViewSettings } from "./DefaultViewSettings"
import { SpreadsheetViewSettings } from "./SpreadsheetViewSettings"

export function ChecklistViewSettings({
  list,
  onChange,
}: {
  list: List
  onChange: (list: List) => void
}) {
  const vars = sanitizeChecklistCheckboxVars(list.checklistCheckboxVars)

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label>View mode settings</Label>
      <p className="text-xs text-muted-foreground">
        Per-display options for this list. Default checklist is one labeled{" "}
        <strong>Completed</strong> tick.
      </p>
      <DefaultViewSettings list={list} onChange={onChange} />
      <div className="space-y-2 rounded-md border p-2">
        <p className="text-sm font-medium">Checklist view mode settings</p>
        <p className="text-xs text-muted-foreground">
          Extra checkbox variables appear as additional columns. They stay off until you add them.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked disabled aria-label="Completed" />
          {CHECKLIST_CHECKBOX_LABELS.completed}
        </label>
        {OPTIONAL_CHECKLIST_CHECKBOX_VARS.map((id) => {
          const on = checklistHasVar(vars, id)
          return (
            <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  onChange({
                    ...list,
                    checklistCheckboxVars: toggleChecklistCheckboxVar(list.checklistCheckboxVars, id, !on),
                  })
                }
              />
              {CHECKLIST_CHECKBOX_LABELS[id]}
            </label>
          )
        })}
      </div>
      <DetailsViewSettings list={list} onChange={onChange} />
      <SpreadsheetViewSettings list={list} onChange={onChange} />
    </div>
  )
}
