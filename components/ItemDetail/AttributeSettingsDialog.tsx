/**
 * components/ItemDetail/AttributeSettingsDialog.tsx — Attribute settings
 *
 * A popup over item detail for the attribute itself: the name every item
 * shares, a copyable id, the type, when it was created, where it is defined,
 * and the values items currently hold. Delete removes that definition from
 * every list, type, and item.
 *
 * The display name on one item stays in item settings.
 * _Last mapped: 2026-10-24_
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { ATTRIBUTE_TYPE_LABELS, normalizeAttributeType } from "@/lib/attribute-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import { itemTitle } from "@/lib/item-utils"
import type { AttributeDefinition, AttributeValue, Task } from "@/lib/types"

function previewValue(value: AttributeValue | undefined): string {
  if (value == null || value === "") return "—"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    const parts = value.map((entry) => (typeof entry === "string" ? entry : "file")).filter(Boolean)
    return parts.length ? parts.join(", ") : "—"
  }
  if (typeof value === "object") {
    if ("current" in value || "target" in value) {
      const goal = value as { current?: number; target?: number }
      return `${goal.current ?? "—"} / ${goal.target ?? "—"}`
    }
    if ("name" in value && typeof value.name === "string") return value.name
  }
  return "—"
}

function formatCreated(iso?: string): string {
  if (!iso) return "Not recorded"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Not recorded"
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function AttributeSettingsDialog({
  attributeId,
  open,
  onOpenChange,
  draftTask,
  onPatchDraft,
}: {
  attributeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The item whose detail is open, so a rename or delete lands on its draft too. */
  draftTask?: Task | null
  onPatchDraft?: (patch: Partial<Task>) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const updateTask = useTaskStore((s) => s.updateTask)
  const updateList = useTaskStore((s) => s.updateList)
  const types = useItemTypeStore((s) => s.types)
  const updateType = useItemTypeStore((s) => s.updateType)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const found = useMemo(() => {
    if (!attributeId) return null
    const fromItem = (draftTask?.itemAttributeDefinitions ?? []).find((def) => def.id === attributeId)
    const fromList = lists.flatMap((list) => list.itemAttributes ?? []).find((def) => def.id === attributeId)
    const fromType = types.flatMap((type) => type.attributes ?? []).find((def) => def.id === attributeId)
    const def = fromItem ?? fromList ?? fromType
    return def ?? null
  }, [attributeId, draftTask?.itemAttributeDefinitions, lists, types])

  const definingLists = useMemo(
    () => (attributeId ? lists.filter((list) => list.itemAttributes?.some((def) => def.id === attributeId)) : []),
    [attributeId, lists],
  )
  const definingTypes = useMemo(
    () => (attributeId ? types.filter((type) => type.attributes?.some((def) => def.id === attributeId)) : []),
    [attributeId, types],
  )
  const holders = useMemo(() => {
    if (!attributeId) return []
    return tasks.filter(
      (row) =>
        (row.attributes && attributeId in row.attributes) ||
        row.itemAttributeDefinitions?.some((def) => def.id === attributeId),
    )
  }, [attributeId, tasks])

  if (!attributeId || !found) return null
  const def: AttributeDefinition = found
  const type = normalizeAttributeType(def.type)

  const rename = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === def.name) return
    for (const list of definingLists) {
      updateList({
        ...list,
        itemAttributes: (list.itemAttributes ?? []).map((row) => (row.id === def.id ? { ...row, name: trimmed } : row)),
      })
    }
    for (const itemType of definingTypes) {
      updateType({
        ...itemType,
        attributes: (itemType.attributes ?? []).map((row) => (row.id === def.id ? { ...row, name: trimmed } : row)),
      })
    }
    for (const row of tasks) {
      if (!row.itemAttributeDefinitions?.some((entry) => entry.id === def.id)) continue
      if (draftTask?.id === row.id) continue
      updateTask({
        ...row,
        itemAttributeDefinitions: row.itemAttributeDefinitions.map((entry) =>
          entry.id === def.id ? { ...entry, name: trimmed } : entry,
        ),
      })
    }
    if (draftTask?.itemAttributeDefinitions?.some((entry) => entry.id === def.id)) {
      onPatchDraft?.({
        itemAttributeDefinitions: draftTask.itemAttributeDefinitions.map((entry) =>
          entry.id === def.id ? { ...entry, name: trimmed } : entry,
        ),
      })
    }
  }

  const remove = () => {
    for (const list of definingLists) {
      updateList({
        ...list,
        itemAttributes: (list.itemAttributes ?? []).filter((row) => row.id !== def.id),
      })
    }
    for (const itemType of definingTypes) {
      updateType({
        ...itemType,
        attributes: (itemType.attributes ?? []).filter((row) => row.id !== def.id),
      })
    }
    for (const row of tasks) {
      const owns = row.itemAttributeDefinitions?.some((entry) => entry.id === def.id)
      const valued = row.attributes && def.id in row.attributes
      if (!owns && !valued) continue
      if (draftTask?.id === row.id) continue
      const attributes = { ...(row.attributes ?? {}) }
      delete attributes[def.id]
      updateTask({
        ...row,
        attributes,
        itemAttributeDefinitions: (row.itemAttributeDefinitions ?? []).filter((entry) => entry.id !== def.id),
      })
    }
    if (draftTask) {
      const attributes = { ...(draftTask.attributes ?? {}) }
      delete attributes[def.id]
      onPatchDraft?.({
        attributes,
        itemAttributeDefinitions: (draftTask.itemAttributeDefinitions ?? []).filter((entry) => entry.id !== def.id),
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="id95-dialog id95 id-attr-settings z-[100] sm:max-w-lg max-h-[85vh] overflow-hidden !flex flex-col"
        overlayClassName="z-[100]"
        data-ui-name="Attribute settings"
      >
        <DialogTitle className="sr-only">Attribute settings</DialogTitle>
        <div className="id-settings id-attr-settings-body">
          <header className="id-attr-settings-head">
            <p className="id-settings-type">{ATTRIBUTE_TYPE_LABELS[type]}</p>
            <h2>{def.name}</h2>
          </header>
          <section>
            <h2>Name</h2>
            <IsolatedInput value={def.name} aria-label="Attribute name" onCommit={rename} />
            <p className="id-settings-note">This name is the attribute’s own. One item can still show a different display name.</p>
          </section>
          <section>
            <h2>Id</h2>
            <div className="id-settings-id">
              <code>{def.id}</code>
              <button
                type="button"
                className="id-btn"
                aria-label="Copy attribute id"
                onClick={() => {
                  const flash = () => {
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 900)
                  }
                  if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(def.id).then(flash).catch(flash)
                  else flash()
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>
          <section className="id-attr-settings-facts">
            <div>
              <h2>Created</h2>
              <p>{formatCreated(def.createdAt)}</p>
            </div>
            <div>
              <h2>Defined on</h2>
              <p>
                {definingLists.length || definingTypes.length
                  ? [...definingTypes.map((row) => row.name), ...definingLists.map((row) => row.name)].join(", ")
                  : "This item only"}
              </p>
            </div>
          </section>
          <section>
            <h2>Items ({holders.length})</h2>
            {holders.length === 0 ? (
              <p className="id-settings-note">No item holds this attribute yet.</p>
            ) : (
              <ul className="id-attr-settings-values">
                {holders.slice(0, 12).map((row) => (
                  <li key={row.id}>
                    <span>{itemTitle(row)}</span>
                    <span>{previewValue(row.id === draftTask?.id ? draftTask.attributes?.[def.id] : row.attributes?.[def.id])}</span>
                  </li>
                ))}
              </ul>
            )}
            {holders.length > 12 ? <p className="id-settings-note">{holders.length - 12} more items.</p> : null}
          </section>
          <section>
            {confirming ? (
              <div className="id-attr-settings-delete">
                <p>Remove “{def.name}” from every list, type, and item that has it. Values on those items go with it.</p>
                <div>
                  <button type="button" className="id-btn" onClick={() => setConfirming(false)}>
                    Keep
                  </button>
                  <button type="button" className="id-btn id-btn-danger" onClick={remove}>
                    Delete attribute
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="id-btn id-btn-danger id-btn-quiet" onClick={() => setConfirming(true)}>
                Delete attribute
              </button>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
