/**
 * components/Modules/workspace/ModuleSettingsDialog.tsx — Module definition editor
 *
 * Edits the design-time settings of a module: name, icon, description; bound
 * lists + roles (+ per-binding attribute extensions, via `ModuleListsPanel`); the
 * presentation **views** (add / edit / remove / reorder, reusing `ModuleViewEditor`);
 * the optional plan-sync binding and print toggle; and a shortcut to attach
 * workflows. Operates on a controlled `ModuleDefinition` and reports edits via
 * `onSave` — the caller decides where it lands (definitions store or a live
 * instance). See `lib/module-definitions.ts`.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Zap } from "lucide-react"
import type { ModuleDefinition } from "@/lib/types"
import type { ModuleView } from "@/lib/modules-store"
import { useTaskStore } from "@/lib/task-store"
import { iconFor } from "@/components/Icons"
import { OrbPickerDialog } from "@/components/Icons/OrbPicker"
import { ModuleViewEditor } from "./ModuleViewEditor"
import { ModuleListsPanel } from "./ModuleListsPanel"

const SELECT_CLS =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"

export function ModuleSettingsDialog({
  open,
  onClose,
  definition,
  onSave,
  showLists = true,
  onOpenWorkflows,
  title = "Module settings",
}: {
  open: boolean
  onClose: () => void
  definition: ModuleDefinition
  onSave: (def: ModuleDefinition) => void
  /** Show the bound-lists editor (definition builder). Hide for live instances. */
  showLists?: boolean
  /** When provided, shows an "Edit workflows" shortcut. */
  onOpenWorkflows?: () => void
  title?: string
}) {
  const categories = useTaskStore((s) => s.lists)
  const [draft, setDraft] = useState<ModuleDefinition>(definition)
  const [editingView, setEditingView] = useState<ModuleView | null>(null)
  const [addingView, setAddingView] = useState(false)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    if (open) setDraft(definition)
  }, [open, definition])

  const patch = (p: Partial<ModuleDefinition>) => setDraft((d) => ({ ...d, ...p }))

  const planSyncCat = useMemo(
    () => categories.find((c) => c.id === draft.planSync?.categoryId),
    [categories, draft.planSync?.categoryId],
  )
  const planSyncAttrs = planSyncCat?.itemAttributes ?? []

  const saveView = (view: ModuleView) => {
    const exists = draft.views.some((v) => v.id === view.id)
    patch({ views: exists ? draft.views.map((v) => (v.id === view.id ? view : v)) : [...draft.views, view] })
    setEditingView(null)
    setAddingView(false)
  }
  const removeView = (id: string) => patch({ views: draft.views.filter((v) => v.id !== id) })
  const moveView = (from: number, to: number) => {
    if (to < 0 || to >= draft.views.length) return
    const copy = [...draft.views]
    const [m] = copy.splice(from, 1)
    copy.splice(to, 0, m)
    patch({ views: copy })
  }

  const togglePlanSync = (on: boolean) => {
    if (on) {
      const firstList = draft.lists[0]?.categoryId || draft.views.find((v) => v.config.categoryId)?.config.categoryId || ""
      patch({ planSync: { categoryId: firstList, dateAttrId: "" } })
    } else {
      patch({ planSync: undefined })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Identity */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPickingIcon(true)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border hover:border-primary"
              title="Choose icon"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconFor(draft.id, draft.icon)} alt="" className="h-10 w-10 object-contain" />
            </button>
            <div className="flex-1 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Module name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  value={draft.description ?? ""}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="What is this module for?"
                />
              </div>
            </div>
          </div>

          {/* Bound lists */}
          {showLists && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Bound lists</h4>
              <ModuleListsPanel lists={draft.lists} onChange={(lists) => patch({ lists })} />
            </section>
          )}

          {/* Views */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Views (tabs)</h4>
              <Button variant="outline" size="sm" onClick={() => setAddingView(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add view
              </Button>
            </div>
            {draft.views.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No views yet — add a tab to display your lists.</p>
            ) : (
              <ul className="space-y-1.5">
                {draft.views.map((v, i) => (
                  <li
                    key={v.id}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) moveView(dragIndex, i)
                      setDragIndex(null)
                    }}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {v.title} <span className="text-[11px] text-muted-foreground">· {v.kind}</span>
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => moveView(i, i - 1)} title="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={i === draft.views.length - 1}
                      onClick={() => moveView(i, i + 1)}
                      title="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingView(v)} title="Edit view">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeView(v.id)} title="Remove view">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Plan sync + print */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Behavior</h4>
            <label className="flex items-center justify-between gap-2">
              <span className="text-sm">Show print / export action</span>
              <Switch checked={!!draft.enablePrint} onCheckedChange={(c) => patch({ enablePrint: c })} />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-sm">Sync finalized, dated items to Plan</span>
              <Switch checked={!!draft.planSync} onCheckedChange={togglePlanSync} />
            </label>
            {draft.planSync && (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Source list</Label>
                  <select
                    aria-label="Plan sync list"
                    className={SELECT_CLS}
                    value={draft.planSync.categoryId}
                    onChange={(e) => patch({ planSync: { ...draft.planSync!, categoryId: e.target.value } })}
                  >
                    <option value="">Choose…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Date attribute</Label>
                  <select
                    aria-label="Plan sync date attribute"
                    className={SELECT_CLS}
                    value={draft.planSync.dateAttrId}
                    onChange={(e) => patch({ planSync: { ...draft.planSync!, dateAttrId: e.target.value } })}
                  >
                    <option value="">Choose…</option>
                    {planSyncAttrs.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Status attribute (optional)</Label>
                  <select
                    aria-label="Plan sync status attribute"
                    className={SELECT_CLS}
                    value={draft.planSync.statusAttrId ?? ""}
                    onChange={(e) =>
                      patch({ planSync: { ...draft.planSync!, statusAttrId: e.target.value || undefined } })
                    }
                  >
                    <option value="">None</option>
                    {planSyncAttrs.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Status value (optional)</Label>
                  <Input
                    aria-label="Plan sync status value"
                    className="h-9"
                    value={draft.planSync.statusValue ?? ""}
                    onChange={(e) =>
                      patch({ planSync: { ...draft.planSync!, statusValue: e.target.value || undefined } })
                    }
                    placeholder="e.g. Finalized"
                  />
                </div>
              </div>
            )}
          </section>

          {onOpenWorkflows && (
            <Button variant="outline" size="sm" onClick={onOpenWorkflows}>
              <Zap className="mr-2 h-4 w-4" /> Edit workflows
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ ...draft, name: draft.name.trim() || "Untitled module" })}>Save</Button>
        </DialogFooter>

        <ModuleViewEditor open={addingView} onClose={() => setAddingView(false)} onSave={saveView} />
        <ModuleViewEditor
          open={!!editingView}
          initial={editingView || undefined}
          onClose={() => setEditingView(null)}
          onSave={saveView}
        />
        <OrbPickerDialog
          open={pickingIcon}
          current={draft.icon}
          onClose={() => setPickingIcon(false)}
          onSelect={(icon) => {
            patch({ icon })
            setPickingIcon(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
