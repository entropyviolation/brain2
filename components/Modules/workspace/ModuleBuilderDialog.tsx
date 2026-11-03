/**
 * components/Modules/workspace/ModuleBuilderDialog.tsx — New module chooser
 *
 * The entry point for building a module. Five paths:
 *   1. **From scratch** — author a brand-new `ModuleDefinition` (name, bound
 *      lists, views, plan-sync) in `ModuleSettingsDialog`, then instantiate it
 *      into a runnable workspace.
 *   2. **Workspace template** — Itinerary, House Cleaning (Tidy), Budget, Book Tasting, Film DNA, GradSearch, or Blank — which
 *      scaffolds the supporting lists + views in one click.
 *   3. **Upload HTML file** — any `.html` page runs as a module in a sandboxed
 *      frame, optionally attached to lists (`html/HtmlUploadDialog.tsx`).
 *   4. **Install package** — a JSON module package (`ModulePackageInstallDialog.tsx`).
 *      Create-only and `nativeTemplate` files call `installModulePackage`.
 *      `policy: "bind"` is scored first and installs only on a unique match.
 *   5. **Dashboard widget** — a classic single card.
 *
 * Saved definitions can also be re-instantiated into a fresh workspace.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Home, LayoutGrid, Plane, Wallet, FilePlus2, BarChart3, Wrench, Rocket, Clapperboard, GraduationCap, FileCode, Package, Brush } from "lucide-react"
import { MODULE_TEMPLATES, instantiateModuleTemplate, type ModuleTemplateId } from "@/lib/module-templates"
import type { ModuleDefinition } from "@/lib/types"
import {
  createEmptyDefinition,
  instantiateDefinition,
  useModuleDefinitionsStore,
} from "@/lib/module-definitions"
import { ModuleSettingsDialog } from "./ModuleSettingsDialog"
import { itemTitle } from "@/lib/item-utils"
import { HtmlUploadDialog } from "./html/HtmlUploadDialog"
import { ModulePackageInstallDialog } from "./ModulePackageInstallDialog"

// Partial map (+ fallback) so templates added by sibling workstreams still render.
const TEMPLATE_ICONS: Partial<Record<ModuleTemplateId, React.ComponentType<{ className?: string }>>> = {
  itinerary: Plane,
  "house-cleaning": Home,
  budget: Wallet,
  "book-tasting": FilePlus2,
  filmrecs: Clapperboard,
  gradsearch: GraduationCap,
  sweep: Brush,
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
  const [uploadingHtml, setUploadingHtml] = useState(false)
  const [installingPackage, setInstallingPackage] = useState(false)

  const chooseTemplate = (id: ModuleTemplateId) => {
    const moduleId = instantiateModuleTemplate(id)
    onClose()
    onOpenWorkspace(moduleId)
  }

  const openInstalledPackage = (moduleId: string) => {
    setInstallingPackage(false)
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
        <DialogContent className="mod95-dialog sm:max-w-2xl max-h-[85vh] overflow-y-auto">
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

            {/* Upload HTML */}
            <button
              onClick={() => {
                setUploadingHtml(true)
                onClose()
              }}
              className="w-full text-left border rounded-lg p-3 hover:border-primary hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <FileCode className="h-4 w-4 shrink-0" />
                Upload HTML file
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Bring any HTML page (a data tool, a lesson, a game) and run it as a module. Optionally attach it to your lists.
              </p>
            </button>

            {/* Install a JSON package. Create-only; template cards stay on instantiateModuleTemplate. */}
            <button
              onClick={() => setInstallingPackage(true)}
              className="w-full text-left border rounded-lg p-3 hover:border-primary hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <Package className="h-4 w-4 shrink-0" />
                Install package
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a JSON module package. A create-only file makes new lists. A bind uses one clear list you already have.
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
                      <p className="text-xs text-muted-foreground mt-1">{itemTitle(t)}</p>
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

      <HtmlUploadDialog open={uploadingHtml} onClose={() => setUploadingHtml(false)} onOpenWorkspace={onOpenWorkspace} />

      <ModulePackageInstallDialog
        open={installingPackage}
        onClose={() => setInstallingPackage(false)}
        onInstalled={openInstalledPackage}
      />

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
