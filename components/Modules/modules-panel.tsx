/**
 * components/Modules/modules-panel.tsx — The "Modules" tab (orchestrator)
 *
 * Hosts two kinds of user-composed modules:
 *   - **Workspaces** — full-screen mini-apps the user builds from their own lists
 *     and views (spreadsheet / agenda / summary / randomizer / timer / …). Opened
 *     full-screen via `ModuleWorkspace`. Templates: Itinerary, Cleaning, Budget.
 *   - **Widgets** — single dashboard cards (list explorer, writing prompt, random
 *     task, stat, rules) rendered in a grid (`ModuleCard`).
 *
 * Composition:
 *   - module-helpers.ts             constants + pure helpers
 *   - module-bodies.tsx            ModuleCard + per-widget bodies
 *   - ModuleConfigDialog.tsx       add/configure a widget
 *   - workspace/ModuleWorkspace    full-screen workspace renderer
 *   - workspace/ModuleBuilderDialog template chooser (workspace vs widget)
 */
"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, LayoutGrid, Trash2, ExternalLink } from "lucide-react"
import { useModulesStore, type ModuleInstance } from "@/lib/modules-store"
import { ModuleCard } from "./module-bodies"
import { ModuleConfigDialog } from "./ModuleConfigDialog"
import { ModuleWorkspace, openModulePopout } from "./workspace/ModuleWorkspace"
import { ModuleBuilderDialog } from "./workspace/ModuleBuilderDialog"

interface ModulesPanelProps {
  onTaskSelect?: (taskId: string) => void
}

export function ModulesPanel({ onTaskSelect }: ModulesPanelProps) {
  const modules = useModulesStore((s) => s.modules)
  const addModule = useModulesStore((s) => s.addModule)
  const removeModule = useModulesStore((s) => s.removeModule)
  const updateModule = useModulesStore((s) => s.updateModule)

  const [editing, setEditing] = useState<ModuleInstance | null>(null)
  const [addingWidget, setAddingWidget] = useState(false)
  const [building, setBuilding] = useState(false)
  const [openWorkspaceId, setOpenWorkspaceId] = useState<string | null>(null)

  const workspaces = modules.filter((m) => m.kind === "workspace")
  const widgets = modules.filter((m) => m.kind !== "workspace")

  const openWorkspace = openWorkspaceId ? modules.find((m) => m.id === openWorkspaceId) : null
  if (openWorkspace) {
    return (
      <div className="pt-4">
        <ModuleWorkspace module={openWorkspace} onBack={() => setOpenWorkspaceId(null)} onOpenItem={onTaskSelect} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Modules</h2>
          <p className="text-sm text-muted-foreground">
            Build mini-apps and widgets from your lists, items, and stats.
          </p>
        </div>
        <Button onClick={() => setBuilding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Build module
        </Button>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
          <LayoutGrid className="h-4 w-4" /> Workspaces
        </h3>
        {workspaces.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No workspaces yet. Build one (Itinerary, Cleaning, Budget, or blank) to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((m) => (
              <Card
                key={m.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setOpenWorkspaceId(m.id)}
              >
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{m.title}</span>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          openModulePopout(m.id)
                        }}
                        title="Pop out into its own window"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeModule(m.id)
                        }}
                        title="Remove module"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                  <p className="text-[11px] text-muted-foreground pt-1">
                    {(m.views?.length ?? 0)} view{(m.views?.length ?? 0) === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Dashboard widgets</h3>
        {widgets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">No widgets yet.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {widgets.map((m) => (
              <ModuleCard
                key={m.id}
                module={m}
                onConfigure={() => setEditing(m)}
                onRemove={() => removeModule(m.id)}
                onTaskSelect={onTaskSelect}
              />
            ))}
          </div>
        )}
      </section>

      <ModuleBuilderDialog
        open={building}
        onClose={() => setBuilding(false)}
        onOpenWorkspace={(id) => setOpenWorkspaceId(id)}
        onChooseWidget={() => setAddingWidget(true)}
      />
      <ModuleConfigDialog
        open={addingWidget}
        onClose={() => setAddingWidget(false)}
        onSave={(draft) => {
          addModule(draft)
          setAddingWidget(false)
        }}
      />
      <ModuleConfigDialog
        open={!!editing}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSave={(draft) => {
          if (editing) updateModule(editing.id, draft)
          setEditing(null)
        }}
      />
    </div>
  )
}
