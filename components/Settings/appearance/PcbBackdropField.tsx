/**
 * components/Settings/PcbBackdropField.tsx — App-desktop field picker
 *
 * Default is plain Win95 teal. Photographed PCB plates remain opt-in.
 * Choice lives on `theme-store.pcbMode` (persist v4) and paints via
 * `data-pcb-mode` on html. Saved plates are never migrated onto teal.
 */
"use client"

import { CircuitBoard } from "lucide-react"
import { useThemeStore } from "@/lib/theme-store"
import { PCB_MODES, PCB_MODE_META, type PcbMode } from "@/lib/pcb-backdrop"

export function PcbBackdropField() {
  const pcbMode = useThemeStore((s) => s.pcbMode)
  const setPcbMode = useThemeStore((s) => s.setPcbMode)
  const meta = PCB_MODE_META[pcbMode]

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <CircuitBoard className="h-4 w-4" />
        <h3 className="font-semibold">Desktop</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        The field behind the windows. Teal is the classic desktop; the other chips are photographs.
        {` `}
        {meta.hint}.
      </p>

      <div className="pcb-mode-grid" role="group" aria-label="Desktop field">
        {PCB_MODES.map((id) => {
          const option = PCB_MODE_META[id]
          const plate = option.plate ? `url("${option.plate}")` : "none"
          return (
            <button
              key={id}
              type="button"
              className="pcb-mode-chip"
              data-ink={option.ink}
              data-plain={option.plate ? undefined : "true"}
              style={{
                ["--pcb-chip-plate" as string]: plate,
                backgroundColor: option.desk,
              }}
              aria-pressed={pcbMode === id}
              aria-label={option.label}
              title={option.hint}
              onClick={() => setPcbMode(id as PcbMode)}
            >
              <span className="pcb-mode-chip-label">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
