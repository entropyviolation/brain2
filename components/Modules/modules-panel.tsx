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
 *   - modules-chrome.css           catalog Win95 skin (`.mod95`)
 *   - module-helpers.ts             constants + pure helpers
 *   - module-bodies.tsx            ModuleCard + per-widget bodies
 *   - ModuleConfigDialog.tsx       add/configure a widget
 *   - workspace/ModuleWorkspace    full-screen workspace renderer
 *   - workspace/ModuleBuilderDialog template chooser (workspace vs widget)
 */
"use client"

import { useState, useEffect, type ComponentType } from "react"
import { Button } from "@/components/ui/button"
import {
  Plus,
  LayoutGrid,
  ExternalLink,
  Gauge,
  Plane,
  Home,
  Wallet,
  BookOpen,
  Clapperboard,
  FilePlus2,
  GraduationCap,
} from "lucide-react"
import { useModulesStore, type ModuleInstance } from "@/lib/modules-store"
import type { ModuleTemplateId } from "@/lib/module-templates"
import { MODULE_VIEW_KIND_META } from "./module-helpers"
import { ModuleCard } from "./module-bodies"
import { ModuleConfigDialog } from "./ModuleConfigDialog"
import { ModuleWorkspace, openModulePopout } from "./workspace/ModuleWorkspace"
import { ModuleBuilderDialog } from "./workspace/ModuleBuilderDialog"
import { APP_NAV_KEYS, readStoredId, writeStoredId } from "@/lib/app-navigation"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"

const WORKSPACE_GLYPHS: Partial<Record<ModuleTemplateId, ComponentType<{ className?: string }>>> = {
  itinerary: Plane,
  "house-cleaning": Home,
  budget: Wallet,
  "book-tasting": BookOpen,
  filmrecs: Clapperboard,
  gradsearch: GraduationCap,
  blank: FilePlus2,
}

function isJewelSrc(icon?: string) {
  if (!icon) return false
  return /^(data:|blob:|\/|https?:)/.test(icon) || /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(icon)
}

function WorkspaceGlyph({ module }: { module: ModuleInstance }) {
  if (isJewelSrc(module.icon)) {
    return <img src={module.icon} alt="" className="mod-ws-jewel" />
  }
  const Icon = (module.templateId && WORKSPACE_GLYPHS[module.templateId as ModuleTemplateId]) || LayoutGrid
  return <Icon className="mod-ws-glyph" aria-hidden />
}

interface ModulesPanelProps {
  onTaskSelect?: (taskId: string) => void
}

export function ModulesPanel({ onTaskSelect }: ModulesPanelProps) {
  const modules = useModulesStore((s) => s.modules)
  const hydrated = usePersistHydrated(useModulesStore.persist)
  const addModule = useModulesStore((s) => s.addModule)
  const removeModule = useModulesStore((s) => s.removeModule)
  const updateModule = useModulesStore((s) => s.updateModule)

  const [editing, setEditing] = useState<ModuleInstance | null>(null)
  const [addingWidget, setAddingWidget] = useState(false)
  const [building, setBuilding] = useState(false)
  const [openWorkspaceId, setOpenWorkspaceId] = useState<string | null>(() => readStoredId(APP_NAV_KEYS.modulesWorkspaceId))

  const workspaces = modules.filter((m) => m.kind === "workspace" && !m.config?.operationId)
  const widgets = modules.filter((m) => m.kind !== "workspace")

  useEffect(() => {
    writeStoredId(APP_NAV_KEYS.modulesWorkspaceId, openWorkspaceId)
  }, [openWorkspaceId])

  useEffect(() => {
    if (!hydrated) return
    if (!openWorkspaceId) return
    if (modules.some((m) => m.id === openWorkspaceId)) return
    setOpenWorkspaceId(null)
  }, [hydrated, modules, openWorkspaceId])

  const openWorkspace = openWorkspaceId ? modules.find((m) => m.id === openWorkspaceId) : null
  if (openWorkspace) {
    return (
      <div className="pt-4">
        <ModuleWorkspace module={openWorkspace} onBack={() => setOpenWorkspaceId(null)} onOpenItem={onTaskSelect} />
      </div>
    )
  }

  return (
    <div className="mod95">
      <div className="mod-desk-head">
        <div>
          <h2>Modules</h2>
          <p className="mod-desk-lede">
            Build mini-apps and widgets from your lists, items, and stats.
          </p>
        </div>
        <Button className="mod-build" onClick={() => setBuilding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Build module
        </Button>
      </div>

      <section className="mod-group">
        <h3 className="mod-legend">
          <LayoutGrid className="h-3.5 w-3.5" /> Workspaces
          <span className="mod-legend-count">{workspaces.length}</span>
        </h3>
        {workspaces.length === 0 ? (
          <div className="mod-empty">
            No workspaces yet. Build one (Itinerary, Cleaning, Budget, or blank) to get started.
          </div>
        ) : (
          <div className="mod-grid">
            {workspaces.map((m) => {
              const viewCount = m.views?.length ?? 0
              const kinds = Array.from(new Set((m.views ?? []).map((v) => v.kind)))
              return (
                <div
                  key={m.id}
                  className="mod-ws-window"
                  onClick={() => setOpenWorkspaceId(m.id)}
                >
                  <div className="mod-ws-caption">
                    <WorkspaceGlyph module={m} />
                    <span className="mod-ws-title">{m.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mod-caption-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        openModulePopout(m.id)
                      }}
                      title="Pop out into its own window"
                    >
                      <ExternalLink />
                    </Button>
                  </div>
                  <div className="mod-ws-body">
                    {m.description ? <p className="mod-ws-desc">{m.description}</p> : null}
                    <div className="mod-ws-status">
                      <span className="mod-ws-kinds">
                        {kinds.slice(0, 8).map((kind) => {
                          const meta = MODULE_VIEW_KIND_META[kind]
                          if (!meta) return null
                          const KindIcon = meta.icon
                          return (
                            <span key={kind} className="mod-ws-kind" title={meta.label}>
                              <KindIcon aria-hidden />
                            </span>
                          )
                        })}
                      </span>
                      <span className="mod-ws-count">
                        {viewCount} view{viewCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="mod-group">
        <h3 className="mod-legend">
          <Gauge className="h-3.5 w-3.5" /> Dashboard widgets
          <span className="mod-legend-count">{widgets.length}</span>
        </h3>
        {widgets.length === 0 ? (
          <div className="mod-empty">No widgets yet.</div>
        ) : (
          <div className="mod-grid">
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
