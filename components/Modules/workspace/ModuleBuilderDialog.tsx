/**
 * components/Modules/workspace/ModuleBuilderDialog.tsx — New module chooser
 *
 * The entry point for building a module. Three paths:
 *   1. **From scratch** — author a brand-new `ModuleDefinition` (name, bound
 *      lists, views, plan-sync) in `ModuleSettingsDialog`, then instantiate it
 *      into a runnable workspace.
 *   2. **Workspace template** — Itinerary, Cleaning, Budget, or Blank — which
 *      scaffolds the supporting lists + views in one click.
 *   3. **Dashboard widget** — a classic single card.
 *
 * Saved definitions can also be re-instantiated into a fresh workspace.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LayoutGrid, Plane, Sparkles, Wallet, FilePlus2, BarChart3, Wrench, Rocket } from "lucide-react"
import { MODULE_TEMPLATES, instantiateModuleTemplate, type ModuleTemplateId } from "@/lib/module-templates"
import type { ModuleDefinition } from "@/lib/types"
import {
  createEmptyDefinition,
  instantiateDefinition,
  useModuleDefinitionsStore,
} from "@/lib/module-definitions"
import { ModuleSettingsDialog } from "./ModuleSettingsDialog"

// Partial map (+ fallback) so templates added by sibling workstreams still render.
const TEMPLATE_ICONS: Partial<Record<ModuleTemplateId, React.ComponentType<{ className?: string }>>> = {
  itinerary: Plane,
  cleaning: Sparkles,
  budget: Wallet,
  blank: FilePlus2,
}

export function ModuleBuilderDialog({
  open,
  onClose,
  onOpenWorkspace,
  onChooseWidget,
}: {
  open: boolean
  onClose: () => void
  onOpenWorkspace: (moduleId: string) => void
  onChooseWidget: () => void
}) {
  const definitions = useModuleDefinitionsStore((s) => s.definitions)
  const addModuleDefinition = useModuleDefinitionsStore((s) => s.addModuleDefinition)
  const [draftDef, setDraftDef] = useState<ModuleDefinition | null>(null)

  const chooseTemplate = (id: ModuleTemplateId) => {
    const moduleId = instantiateModuleTemplate(id)
    onClose()
    onOpenWorkspace(moduleId)
  }

  const startFromScratch = () => {
    setDraftDef(createEmptyDefinition("New module"))
    onClose()
  }

  const saveScratch = (def: ModuleDefinition) => {
    addModuleDefinition(def)
    const instanceId = instantiateDefinition(def.id)
    setDraftDef(null)
    if (instanceId) onOpenWorkspace(instanceId)
  }

  const useDefinition = (def: ModuleDefinition) => {
    const instanceId = instantiateDefinition(def.id)
    onClose()
    if (instanceId) onOpenWorkspace(instanceId)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Build a module</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* From scratch */}
            <button
              onClick={startFromScratch}
              className="w-full text-left border rounded-lg p-3 hover:border-primary hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <Wrench className="h-4 w-4 shrink-0" />
                Build from scratch
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Define your own module: bind lists, add views, set plan-sync, and attach workflows.
              </p>
            </button>

            {/* Saved definitions */}
            {definitions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Rocket className="h-4 w-4" /> Your module definitions
                </h3>
                <div className="space-y-2">
                  {definitions.map((def) => (
                    <div key={def.id} className="flex items-center gap-2 border rounded-lg p-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{def.name}</div>
                        {def.description && (
                          <p className="truncate text-xs text-muted-foreground">{def.description}</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => useDefinition(def)}>
                        Create workspace
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Templates */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" /> Workspace templates
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MODULE_TEMPLATES.map((t) => {
                  const Icon = TEMPLATE_ICONS[t.id] ?? FilePlus2
                  return (
                    <button
                      key={t.id}
                      onClick={() => chooseTemplate(t.id)}
                      className="text-left border rounded-lg p-3 hover:border-primary hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <Icon className="h-4 w-4 shrink-0" />
                        {t.name}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Widget */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Dashboard widget
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                A single card (list explorer, writing prompt, random task, stat, rules…) pinned to the Modules dashboard.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose()
                  onChooseWidget()
                }}
              >
                New widget
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {draftDef && (
        <ModuleSettingsDialog
          open={!!draftDef}
          onClose={() => setDraftDef(null)}
          definition={draftDef}
          onSave={saveScratch}
          showLists
          title="Build a new module"
        />
      )}
    </>
  )
}
