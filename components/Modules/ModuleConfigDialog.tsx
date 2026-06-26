/**
 * components/Modules/ModuleConfigDialog.tsx — Add/configure a module
 *
 * The form for creating or editing a `ModuleInstance`: type, title, source list,
 * and per-type options (stat, framing/pick-count for explorer, cause→effect
 * rules). Emits a complete draft via `onSave`.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import type { ModuleInstance, ModuleType, AttrRule, RuleOperator } from "@/lib/modules-store"
import { mergeListAttributes } from "@/components/Lists/attribute-editor"
import { MODULE_META, RULE_OPERATORS, STAT_OPTIONS, WIDGET_MODULE_TYPES, rid } from "./module-helpers"

export function ModuleConfigDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial?: ModuleInstance
  onClose: () => void
  onSave: (draft: Omit<ModuleInstance, "id">) => void
}) {
  const categories = useTaskStore((s) => s.lists)
  const [type, setType] = useState<ModuleType>(initial?.type || "list-explorer")
  const [title, setTitle] = useState(initial?.title || "")
  const [categoryId, setCategoryId] = useState<string | undefined>(initial?.config.categoryId)
  const [stat, setStat] = useState<string>(initial?.config.stat || "points-week")
  const [framing, setFraming] = useState<string>(initial?.config.framing || "")
  const [pickCount, setPickCount] = useState<number>(initial?.config.pickCount ?? 1)
  const [rules, setRules] = useState<AttrRule[]>(initial?.config.rules || [])

  useEffect(() => {
    if (open) {
      setType(initial?.type || "list-explorer")
      setTitle(initial?.title || "")
      setCategoryId(initial?.config.categoryId)
      setStat(initial?.config.stat || "points-week")
      setFraming(initial?.config.framing || "")
      setPickCount(initial?.config.pickCount ?? 1)
      setRules(initial?.config.rules || [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const needsList = type === "list-explorer" || type === "list-summary" || type === "random-task" || type === "rules"
  const optionalList = type === "writing-prompt"

  const attrDefs = useMemo(
    () => mergeListAttributes(categories, categoryId ? [categoryId] : []),
    [categories, categoryId],
  )

  const handleSave = () => {
    const finalTitle = title.trim() || MODULE_META[type].label
    onSave({
      type,
      title: finalTitle,
      config: {
        categoryId: needsList || optionalList ? categoryId : undefined,
        stat: type === "analytics-stat" ? stat : undefined,
        framing: type === "list-explorer" ? framing.trim() || undefined : undefined,
        pickCount: type === "list-explorer" ? Math.max(1, pickCount) : undefined,
        rules: type === "rules" ? rules : undefined,
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Configure Module" : "Add Module"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ModuleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIDGET_MODULE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MODULE_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={MODULE_META[type].label} />
          </div>

          {(needsList || optionalList) && (
            <div className="space-y-2">
              <Label>{optionalList ? "Topic source list (optional)" : "List"}</Label>
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? undefined : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{optionalList ? "Built-in topics" : "Choose a list"}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "list-explorer" && (
            <>
              <div className="space-y-2">
                <Label>Framing verb (optional)</Label>
                <Input value={framing} onChange={(e) => setFraming(e.target.value)} placeholder="e.g. Read, Clean, Cook" />
              </div>
              <div className="space-y-2">
                <Label>Number of random items</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={pickCount}
                  onChange={(e) => setPickCount(Math.max(1, Number.parseInt(e.target.value) || 1))}
                />
              </div>
            </>
          )}

          {type === "analytics-stat" && (
            <div className="space-y-2">
              <Label>Stat</Label>
              <Select value={stat} onValueChange={setStat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "rules" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Rules (cause → effect)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!categoryId || attrDefs.length === 0}
                  onClick={() =>
                    setRules((rs) => [
                      ...rs,
                      { id: rid(), attrId: attrDefs[0]?.id || "", op: ">", value: "", label: "Flag", color: "#ef4444" },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Rule
                </Button>
              </div>
              {!categoryId && <p className="text-xs text-muted-foreground">Pick a list first.</p>}
              {categoryId && attrDefs.length === 0 && (
                <p className="text-xs text-muted-foreground">This list has no attributes to build rules from.</p>
              )}
              <div className="space-y-2 max-h-64 overflow-auto">
                {rules.map((r, i) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-1 border rounded p-2">
                    <span className="text-xs text-muted-foreground">If</span>
                    <select
                      className="border rounded h-8 px-1 text-xs bg-background"
                      value={r.attrId}
                      onChange={(e) => setRules((rs) => rs.map((x, xi) => (xi === i ? { ...x, attrId: e.target.value } : x)))}
                    >
                      {attrDefs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="border rounded h-8 px-1 text-xs bg-background"
                      value={r.op}
                      onChange={(e) =>
                        setRules((rs) => rs.map((x, xi) => (xi === i ? { ...x, op: e.target.value as RuleOperator } : x)))
                      }
                    >
                      {RULE_OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    {r.op !== "is set" && r.op !== "is empty" && (
                      <Input
                        value={r.value || ""}
                        onChange={(e) => setRules((rs) => rs.map((x, xi) => (xi === i ? { ...x, value: e.target.value } : x)))}
                        className="h-8 w-20"
                        placeholder="value"
                      />
                    )}
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      value={r.label}
                      onChange={(e) => setRules((rs) => rs.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))}
                      className="h-8 w-24"
                      placeholder="label"
                    />
                    <input
                      type="color"
                      value={r.color}
                      onChange={(e) => setRules((rs) => rs.map((x, xi) => (xi === i ? { ...x, color: e.target.value } : x)))}
                      className="h-8 w-9"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setRules((rs) => rs.filter((_, xi) => xi !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Rules are checked top-to-bottom; the first match decides the item's badge.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{initial ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
