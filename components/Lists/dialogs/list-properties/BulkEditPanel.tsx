/**
 * components/Lists/dialogs/list-properties/BulkEditPanel.tsx — List Settings → Bulk edit
 *
 * Apply one change to every item on this list, or to a picked selection:
 * an attribute value, tags, item type, due date, another list, or done.
 * Unlike the rest of the sheet this acts now (not on Save), as one undo step
 * (`runAsAction`), so Undo here or Cmd-Z puts every item back.
 */
"use client"

import { useMemo, useState } from "react"
import type { AttributeDefinition, AttributeValue, ItemTypeDefinition, List, Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { peekUndoLabel, runAsAction, undoLastAction } from "@/lib/action-history"
import { completeTask, uncompleteTask } from "@/lib/services/completion-service"
import { AttributeValuesEditor } from "@/components/Lists/attribute-editor"
import { NativeSelect } from "@/components/ui/native-select"

type Action =
  | "attribute"
  | "addTags"
  | "removeTags"
  | "type"
  | "deadline"
  | "clearDeadline"
  | "addToList"
  | "removeFromList"
  | "done"
  | "notDone"

const ACTIONS: { id: Action; label: string }[] = [
  { id: "attribute", label: "Set an attribute" },
  { id: "addTags", label: "Add tags" },
  { id: "removeTags", label: "Remove tags" },
  { id: "type", label: "Set item type" },
  { id: "deadline", label: "Set due date" },
  { id: "clearDeadline", label: "Clear due date" },
  { id: "addToList", label: "Also add to a list" },
  { id: "removeFromList", label: "Take off this list" },
  { id: "done", label: "Mark done" },
  { id: "notDone", label: "Mark not done" },
]

const splitTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean)
const taskName = (t: Task) => itemTitleOrUntitled(t)

export function BulkEditPanel({
  list,
  types,
  attributes,
}: {
  list: List
  types: ItemTypeDefinition[]
  /** List schema first, then the rest of the vault. */
  attributes: AttributeDefinition[]
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const updateTask = useTaskStore((s) => s.updateTask)
  const items = useMemo(() => tasks.filter((t) => t.lists?.includes(list.id)), [tasks, list.id])

  const [scope, setScope] = useState<"all" | "selected">("all")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [action, setAction] = useState<Action>("attribute")
  const [attrId, setAttrId] = useState("")
  const [attrValues, setAttrValues] = useState<Record<string, AttributeValue>>({})
  const [tagText, setTagText] = useState("")
  const [typeId, setTypeId] = useState("")
  const [due, setDue] = useState("")
  const [targetListId, setTargetListId] = useState("")
  const [armed, setArmed] = useState(false)
  const [last, setLast] = useState<{ label: string; count: number } | null>(null)

  const targets = scope === "all" ? items : items.filter((t) => picked.has(t.id))
  const shown = query.trim() ? items.filter((t) => taskName(t).toLowerCase().includes(query.trim().toLowerCase())) : items
  const def = attributes.find((a) => a.id === attrId)
  const otherLists = lists.filter((l) => l.id !== list.id && !isFolderAllItemsCategoryId(l.id)).sort((a, b) => a.name.localeCompare(b.name))

  const ready = (() => {
    if (!targets.length) return false
    switch (action) {
      case "attribute":
        return Boolean(def) && attrValues[attrId] !== undefined
      case "addTags":
      case "removeTags":
        return splitTags(tagText).length > 0
      case "type":
        return Boolean(typeId)
      case "deadline":
        return Boolean(due)
      case "addToList":
        return Boolean(targetListId)
      default:
        return true
    }
  })()

  const describe = () => {
    const a = ACTIONS.find((x) => x.id === action)!.label
    if (action === "attribute" && def) return `Set ${def.name}`
    if (action === "type") return `Set type to ${types.find((t) => t.id === typeId)?.name ?? typeId}`
    if (action === "addToList") return `Add to ${lists.find((l) => l.id === targetListId)?.name ?? ""}`
    if (action === "addTags" || action === "removeTags") return `${a}: ${splitTags(tagText).join(", ")}`
    return a
  }

  const apply = () => {
    if (!ready) return
    if (!armed) {
      setArmed(true)
      window.setTimeout(() => setArmed(false), 4000)
      return
    }
    setArmed(false)
    const label = `Bulk edit: ${describe()} (${targets.length})`
    const ids = targets.map((t) => t.id)
    runAsAction(label, () => {
      for (const id of ids) {
        const t = useTaskStore.getState().tasks.find((x) => x.id === id)
        if (!t) continue
        switch (action) {
          case "done":
            completeTask(id)
            break
          case "notDone":
            uncompleteTask(id)
            break
          case "attribute":
            updateTask({ ...t, attributes: { ...(t.attributes ?? {}), [attrId]: attrValues[attrId] } })
            break
          case "addTags": {
            const have = t.tags ?? []
            const add = splitTags(tagText).filter((tag) => !have.some((h) => h.toLowerCase() === tag.toLowerCase()))
            if (add.length) updateTask({ ...t, tags: [...have, ...add] })
            break
          }
          case "removeTags": {
            const drop = new Set(splitTags(tagText).map((x) => x.toLowerCase()))
            const kept = (t.tags ?? []).filter((h) => !drop.has(h.toLowerCase()))
            if (kept.length !== (t.tags ?? []).length) updateTask({ ...t, tags: kept })
            break
          }
          case "type":
            updateTask({ ...t, type: typeId as Task["type"] })
            break
          case "deadline":
            updateTask({ ...t, deadline: new Date(`${due}T00:00:00`) })
            break
          case "clearDeadline":
            if (t.deadline) updateTask({ ...t, deadline: undefined })
            break
          case "addToList":
            if (!t.lists?.includes(targetListId)) updateTask({ ...t, lists: [...(t.lists ?? []), targetListId] })
            break
          case "removeFromList":
            updateTask({ ...t, lists: (t.lists ?? []).filter((x) => x !== list.id) })
            break
        }
      }
    })
    setLast({ label, count: ids.length })
    setPicked(new Set())
  }

  const undo = () => {
    if (last && peekUndoLabel() === last.label) undoLastAction()
    setLast(null)
  }

  return (
    <div className="lp-bulk" data-testid="bulk-edit">
      <p className="lp-caption" style={{ margin: 0 }}>
        Changes here apply <b>now</b>, not on Save, as one step you can undo.
      </p>

      <div className="lp-bulk-grid">
        <div className="lp-sect">
          <div className="lp-label">1 · Which items</div>
          <div className="lp-seg" role="radiogroup" aria-label="Which items">
            <button type="button" role="radio" aria-checked={scope === "all"} className={`lp-seg-key${scope === "all" ? " is-on" : ""}`} onClick={() => setScope("all")}>
              All {items.length}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scope === "selected"}
              className={`lp-seg-key${scope === "selected" ? " is-on" : ""}`}
              onClick={() => setScope("selected")}
            >
              Selected {picked.size}
            </button>
          </div>
          {scope === "selected" ? (
            <>
              <div className="lp-bulk-pickbar">
                <input className="lp-field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${items.length} items…`} aria-label="Search items" />
                <button type="button" className="lp-mini-key" onClick={() => setPicked(new Set([...picked, ...shown.map((t) => t.id)]))}>
                  All shown
                </button>
                <button type="button" className="lp-mini-key" onClick={() => setPicked(new Set())}>
                  None
                </button>
              </div>
              <div className="lp-bulk-items">
                {shown.length === 0 ? <p className="lp-caption">No items.</p> : null}
                {shown.map((t) => (
                  <label key={t.id} className="lp-bulk-item">
                    <input
                      type="checkbox"
                      checked={picked.has(t.id)}
                      onChange={() => {
                        const next = new Set(picked)
                        if (next.has(t.id)) next.delete(t.id)
                        else next.add(t.id)
                        setPicked(next)
                      }}
                    />
                    <span className={t.completed ? "is-done" : ""}>{taskName(t)}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p className="lp-caption">Every item on this list right now ({items.length}).</p>
          )}
        </div>

        <div className="lp-sect">
          <div className="lp-label">2 · What to change</div>
          <NativeSelect className="lp-field lp-sel" value={action} onChange={(e) => setAction(e.target.value as Action)} aria-label="Change">
            {ACTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </NativeSelect>

          <div className="lp-bulk-params">
            {action === "attribute" ? (
              <>
                <NativeSelect
                  className="lp-field lp-sel"
                  value={attrId}
                  onChange={(e) => {
                    setAttrId(e.target.value)
                    setAttrValues({})
                  }}
                  aria-label="Attribute"
                >
                  <option value="">Choose attribute…</option>
                  {attributes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.type}
                    </option>
                  ))}
                </NativeSelect>
                {def ? <AttributeValuesEditor definitions={[def]} values={attrValues} onChange={setAttrValues} /> : null}
              </>
            ) : null}
            {action === "addTags" || action === "removeTags" ? (
              <input className="lp-field" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="tag, another tag" aria-label="Tags" />
            ) : null}
            {action === "type" ? (
              <NativeSelect className="lp-field lp-sel" value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label="Item type">
                <option value="">Choose type…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id as string}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            {action === "deadline" ? (
              <input className="lp-field" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
            ) : null}
            {action === "addToList" ? (
              <NativeSelect className="lp-field lp-sel" value={targetListId} onChange={(e) => setTargetListId(e.target.value)} aria-label="Target list">
                <option value="">Choose list…</option>
                {otherLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            {action === "removeFromList" ? (
              <p className="lp-caption">The items stay in the vault and on their other lists.</p>
            ) : null}
            {action === "done" ? <p className="lp-caption">Marks each item done without the completion popup or points.</p> : null}
          </div>
        </div>
      </div>

      <div className="lp-bulk-foot">
        <button type="button" className={`lp-bulk-apply${armed ? " is-armed" : ""}`} disabled={!ready} onClick={apply}>
          {armed ? `Confirm: ${describe()} on ${targets.length}` : `Apply to ${targets.length} item${targets.length === 1 ? "" : "s"}`}
        </button>
        {last ? (
          <span className="lp-bulk-done" aria-live="polite">
            <span className="lp-lamp is-green" aria-hidden />
            {last.label.replace("Bulk edit: ", "")} — done.
            <button type="button" className="lp-mini-key" onClick={undo}>
              Undo
            </button>
          </span>
        ) : null}
      </div>
    </div>
  )
}
