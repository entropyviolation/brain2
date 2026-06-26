/**
 * components/Modules/workspace/ModuleWorkspace.tsx — Full-screen module mini-app
 *
 * Renders a "workspace" `ModuleInstance` as its own screen: a header (back,
 * rename, add view, Settings, Workflows, Pop out, optional print + plan-sync) and
 * a tab per bound view. Views are user-composable (add/edit/remove) via
 * `ModuleViewEditor` and **drag-reorderable** in the tab bar, so a user can build
 * an Itinerary Creator, Cleaning system, or Budget without code. Authored
 * **workflows** (the Zapier-style automations) are edited via `WorkflowBuilder`,
 * and the whole workspace can be **popped out** into its own window.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Plus, Printer, CalendarCheck, Settings, X, Pencil, Zap, ExternalLink } from "lucide-react"
import { useModulesStore, type ModuleInstance, type ModuleView } from "@/lib/modules-store"
import type { ModuleDefinition } from "@/lib/types"
import { syncModuleToPlan } from "@/lib/module-plan-sync"
import { ModuleViewBody } from "./module-view-bodies"
import { ModuleViewEditor } from "./ModuleViewEditor"
import { ModuleSettingsDialog } from "./ModuleSettingsDialog"
import { WorkflowBuilder } from "./WorkflowBuilder"

// ---- Pop-out window convention --------------------------------------------
// A popped-out module is just the same app loaded at a hash route the root page
// recognizes: `#popout/module/<moduleId>`. In Electron this loads in a real
// BrowserWindow (via `window.desktop.openModulePopout`); in the browser it falls
// back to `window.open(...)`.
export const MODULE_POPOUT_PREFIX = "popout/module/"

export function modulePopoutHash(moduleId: string): string {
  return `#${MODULE_POPOUT_PREFIX}${encodeURIComponent(moduleId)}`
}

/** Extract a module id from a pop-out hash, or null if the hash isn't one. */
export function parseModulePopoutModuleId(hash: string | undefined | null): string | null {
  if (!hash) return null
  const h = hash.replace(/^#/, "")
  if (!h.startsWith(MODULE_POPOUT_PREFIX)) return null
  const id = decodeURIComponent(h.slice(MODULE_POPOUT_PREFIX.length))
  return id || null
}

interface DesktopPopoutBridge {
  openModulePopout?: (hash: string) => void
}

/** Open a module in its own window: Electron BrowserWindow, else `window.open`. */
export function openModulePopout(moduleId: string): void {
  if (typeof window === "undefined") return
  const hash = modulePopoutHash(moduleId)
  const desktop = (window as unknown as { desktop?: DesktopPopoutBridge }).desktop
  if (desktop?.openModulePopout) {
    desktop.openModulePopout(hash)
    return
  }
  const url = `${window.location.pathname}${window.location.search}${hash}`
  window.open(url, `cogs-module-${moduleId}`, "noopener,width=1200,height=820")
}

function instanceToDefinition(module: ModuleInstance): ModuleDefinition {
  return {
    id: module.id,
    name: module.title,
    description: module.description,
    icon: module.icon,
    lists: [],
    views: module.views ?? [],
    workflows: [],
    planSync: module.planSync,
    enablePrint: module.enablePrint,
  }
}

export function ModuleWorkspace({
  module,
  onBack,
  onOpenItem,
  popout = false,
}: {
  module: ModuleInstance
  onBack: () => void
  onOpenItem?: (id: string) => void
  /** Rendered inside a popped-out window — hides the Pop out button. */
  popout?: boolean
}) {
  const updateModule = useModulesStore((s) => s.updateModule)
  const views = module.views ?? []

  const [activeId, setActiveId] = useState<string>(views[0]?.id || "")
  const [editingView, setEditingView] = useState<ModuleView | null>(null)
  const [addingView, setAddingView] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState(module.title)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [workflowsOpen, setWorkflowsOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const saveView = (view: ModuleView) => {
    const exists = views.some((v) => v.id === view.id)
    const next = exists ? views.map((v) => (v.id === view.id ? view : v)) : [...views, view]
    updateModule(module.id, { views: next })
    setActiveId(view.id)
    setEditingView(null)
    setAddingView(false)
  }

  const removeView = (id: string) => {
    const next = views.filter((v) => v.id !== id)
    updateModule(module.id, { views: next })
    if (activeId === id) setActiveId(next[0]?.id || "")
  }

  const reorderViews = (from: number, to: number) => {
    if (from === to || to < 0 || to >= views.length) return
    const copy = [...views]
    const [moved] = copy.splice(from, 1)
    copy.splice(to, 0, moved)
    updateModule(module.id, { views: copy })
  }

  const doPrint = () => {
    if (typeof window !== "undefined") window.print()
  }

  const doSync = () => {
    const res = syncModuleToPlan(module)
    setSyncMsg(
      res.lines
        ? `Synced ${res.lines} item${res.lines === 1 ? "" : "s"} across ${res.days} day${res.days === 1 ? "" : "s"}.`
        : "Finalized, dated items are already in your Plan.",
    )
    setTimeout(() => setSyncMsg(null), 4000)
  }

  const saveSettings = (def: ModuleDefinition) => {
    updateModule(module.id, {
      title: def.name,
      description: def.description,
      icon: def.icon,
      views: def.views,
      planSync: def.planSync,
      enablePrint: def.enablePrint,
    })
    setSettingsOpen(false)
  }

  const activeView = views.find((v) => v.id === activeId) || views[0]

  return (
    <div className="space-y-4 print-area">
      <div className="flex items-center justify-between gap-2 flex-wrap no-print">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} title={popout ? "Close window" : "Back to Modules"}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {renaming ? (
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                updateModule(module.id, { title: titleDraft.trim() || module.title })
                setRenaming(false)
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="h-9 max-w-xs text-lg font-bold"
            />
          ) : (
            <button
              className="text-2xl font-bold truncate flex items-center gap-2 group"
              onClick={() => {
                setTitleDraft(module.title)
                setRenaming(true)
              }}
            >
              {module.title}
              <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-60" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {module.planSync && (
            <Button variant="outline" size="sm" onClick={doSync}>
              <CalendarCheck className="h-4 w-4 mr-2" />
              Sync to Plan
            </Button>
          )}
          {module.enablePrint && (
            <Button variant="outline" size="sm" onClick={doPrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Export
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setWorkflowsOpen(true)}>
            <Zap className="h-4 w-4 mr-2" />
            Workflows
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          {!popout && (
            <Button variant="outline" size="sm" onClick={() => openModulePopout(module.id)} title="Open in its own window">
              <ExternalLink className="h-4 w-4 mr-2" />
              Pop out
            </Button>
          )}
          <Button size="sm" onClick={() => setAddingView(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add view
          </Button>
        </div>
      </div>

      {module.description && <p className="text-sm text-muted-foreground no-print">{module.description}</p>}
      {syncMsg && (
        <div className="text-sm rounded border border-primary/30 bg-primary/10 px-3 py-2 no-print">{syncMsg}</div>
      )}

      {views.length === 0 ? (
        <div className="border rounded-lg py-16 text-center text-muted-foreground">
          <p>No views yet.</p>
          <Button className="mt-3" onClick={() => setAddingView(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add your first view
          </Button>
        </div>
      ) : (
        <Tabs value={activeView?.id} onValueChange={setActiveId}>
          <TabsList className="flex-wrap h-auto no-print">
            {views.map((v, i) => (
              <TabsTrigger
                key={v.id}
                value={v.id}
                className="data-[state=active]:font-semibold cursor-grab"
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) reorderViews(dragIndex, i)
                  setDragIndex(null)
                }}
                title="Drag to reorder"
              >
                {v.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {views.map((v) => (
            <TabsContent key={v.id} value={v.id} className="space-y-2">
              <div className="flex items-center justify-between no-print">
                <h3 className="text-lg font-semibold">{v.title}</h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingView(v)} title="Edit view">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeView(v.id)}
                    title="Remove view"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ModuleViewBody view={v} onOpenItem={onOpenItem} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <ModuleViewEditor open={addingView} onClose={() => setAddingView(false)} onSave={saveView} />
      <ModuleViewEditor
        open={!!editingView}
        initial={editingView || undefined}
        onClose={() => setEditingView(null)}
        onSave={saveView}
      />
      <ModuleSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        definition={instanceToDefinition(module)}
        onSave={saveSettings}
        showLists={false}
        onOpenWorkflows={() => {
          setSettingsOpen(false)
          setWorkflowsOpen(true)
        }}
        title="Module settings"
      />
      <WorkflowBuilder open={workflowsOpen} onClose={() => setWorkflowsOpen(false)} moduleId={module.id} />
    </div>
  )
}
