/**
 * components/Lists/dialogs/GravitySettingsDialog.tsx — Gravity field knobs
 *
 * Small fm98 dialog for global G and per-source connection gains. Prefs live
 * in lists-ui-store (`listIconsGravityField`); does not toggle Gravity on/off.
 * Live apply while the field is running (Desktop reads paramsRef).
 */
"use client"

import { useId } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DEFAULT_GRAVITY_FIELD_PARAMS,
  type GravitySourceGains,
} from "@/components/Lists/lib/list-icon-gravity"
import { useListsUiStore } from "@/lib/lists-ui-store"

export type GravitySettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SOURCE_ROWS: { key: keyof GravitySourceGains; label: string; hint: string }[] = [
  { key: "link", label: "Explicit links", hint: "ItemLink edges both ways" },
  { key: "dependency", label: "Dependencies", hint: "depends-on / blocking" },
  { key: "parent", label: "Parent / child", hint: "parentTaskId structure" },
  { key: "tag", label: "Shared tags", hint: "topical clustering" },
  { key: "sharedList", label: "Shared lists", hint: "common list membership" },
]

function formatGain(n: number): string {
  return Number(n.toFixed(2)).toString()
}

export function GravitySettingsDialog({ open, onOpenChange }: GravitySettingsDialogProps) {
  const field = useListsUiStore((s) => s.listIconsGravityField)
  const setField = useListsUiStore((s) => s.setListIconsGravityField)
  const resetField = useListsUiStore((s) => s.resetListIconsGravityField)
  const gId = useId()

  const sources = field?.sources ?? DEFAULT_GRAVITY_FIELD_PARAMS.sources
  const globalG = field?.globalG ?? DEFAULT_GRAVITY_FIELD_PARAMS.globalG

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fm98-dialog sm:max-w-md max-h-[85vh] overflow-y-auto"
        data-ui-name="Gravity settings"
        data-ui-docs="components/Lists/README.md"
      >
        <DialogHeader>
          <DialogTitle>Gravity settings</DialogTitle>
          <DialogDescription>
            Tune how strongly linked icons pull together. Changes apply live while
            Gravity is on. Does not turn the field on or off.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="fm-groupbox space-y-3 p-3">
          <legend className="fm-legend px-1">Strength</legend>
          <div className="fm-gravity-settings-row">
            <label htmlFor={gId} className="text-sm font-medium">
              Global gravity (G)
            </label>
            <span className="fm-gravity-settings-value" aria-hidden="true">
              {formatGain(globalG)}
            </span>
            <input
              id={gId}
              type="range"
              min={0}
              max={2.5}
              step={0.05}
              value={globalG}
              aria-valuetext={`${formatGain(globalG)}`}
              onChange={(e) => setField({ globalG: Number(e.target.value) })}
            />
            <p className="fm-gravity-settings-hint">Softer clusters ← → tighter pull</p>
          </div>
        </fieldset>

        <fieldset className="fm-groupbox space-y-3 p-3 mt-3">
          <legend className="fm-legend px-1">Connection sources</legend>
          {SOURCE_ROWS.map((row) => {
            const id = `${gId}-${row.key}`
            const value = sources[row.key]
            return (
              <div key={row.key} className="fm-gravity-settings-row">
                <label htmlFor={id} className="text-sm font-medium">
                  {row.label}
                </label>
                <span className="fm-gravity-settings-value" aria-hidden="true">
                  {formatGain(value)}
                </span>
                <input
                  id={id}
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={value}
                  aria-valuetext={`${formatGain(value)}`}
                  title={row.hint}
                  onChange={(e) =>
                    setField({ sources: { ...sources, [row.key]: Number(e.target.value) } })
                  }
                />
                <p className="fm-gravity-settings-hint">{row.hint}</p>
              </div>
            )
          })}
        </fieldset>

        <div className="flex flex-wrap justify-between gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => resetField()}
            title="Restore default G and source gains (keeps Gravity on/off)"
          >
            Reset to defaults
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
