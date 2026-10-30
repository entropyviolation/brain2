/**
 * components/ItemDetail/dialogs/ItemSettingsPanel.tsx — Item settings
 *
 * The item-settings popup (fascia gear) for one item. The header is Settings.
 * Plates under it hold the item id, every attribute (show, shared name, type,
 * display name), and which tabs this item shows. Details stays. The plates
 * are the place later settings land.
 *
 * _Last mapped: 2026-10-24_
 */
"use client"

import { useMemo, useState } from "react"
import { DialogTitle } from "@/components/ui/dialog"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { mergeItemAttributes } from "@/components/Lists/attribute-editor"
import { effectiveDef } from "@/components/Lists/attributes/helpers"
import { ATTRIBUTE_TYPE_LABELS, normalizeAttributeType } from "@/lib/attribute-utils"
import { DETAIL_PANEL_ORDER, resolveDetailView } from "@/lib/item-types"
import { useItemTypeStore } from "@/lib/item-type-store"
import type { AttributeDefinition, ItemDetailPanel, List, Task } from "@/lib/types"

const PANEL_LABEL: Record<ItemDetailPanel, string> = {
  details: "Details",
  scheduling: "Scheduling",
  dependencies: "Dependencies",
  subtasks: "Subtasks",
  analysis: "Analysis",
  time: "Time",
  body: "Body",
  notes: "Notes",
  resources: "Resources",
}

function CopyId({ id, label }: { id: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="id-settings-id" data-testid="item-id-line">
      <code>{id}</code>
      <button
        type="button"
        className="id-btn"
        aria-label={label}
        onClick={() => {
          const flash = () => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 900)
          }
          if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(id).then(flash).catch(flash)
          else flash()
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

export function ItemSettingsPanel({
  task,
  lists,
  isTask,
  showLinks,
  onPatch,
  onOpenAttribute,
}: {
  task: Task
  lists: List[]
  isTask: boolean
  /** The popup has a Links tab. The page does not. */
  showLinks: boolean
  onPatch: (patch: Partial<Task>) => void
  /** Open the global settings popup for this attribute. */
  onOpenAttribute: (attributeId: string) => void
}) {
  const itemTypes = useItemTypeStore((s) => s.types)
  const base = useMemo(
    () => resolveDetailView({ type: task.type, lists: task.lists }, lists, itemTypes, { isTask }).panels,
    [task.type, task.lists, lists, itemTypes, isTask],
  )
  const defs = useMemo(() => {
    const schema = mergeItemAttributes({ type: task.type, lists: task.lists }, lists, itemTypes).map(effectiveDef)
    const seen = new Set(schema.map((def) => def.id))
    const own = (task.itemAttributeDefinitions ?? []).map(effectiveDef).filter((def) => !seen.has(def.id))
    return [...schema, ...own]
  }, [task.type, task.lists, task.itemAttributeDefinitions, lists, itemTypes])

  const catalog = DETAIL_PANEL_ORDER.filter(
    (panel) => base.includes(panel) || task.shownDetailPanels?.includes(panel),
  )

  const setPanel = (panel: ItemDetailPanel, on: boolean) => {
    const hidden = new Set(task.hiddenDetailPanels ?? [])
    const shown = new Set(task.shownDetailPanels ?? [])
    if (on) {
      hidden.delete(panel)
      if (!base.includes(panel)) shown.add(panel)
      else shown.delete(panel)
    } else {
      hidden.add(panel)
      shown.delete(panel)
    }
    onPatch({
      hiddenDetailPanels: hidden.size ? [...hidden] : undefined,
      shownDetailPanels: shown.size ? [...shown] : undefined,
    })
  }

  const setShell = (tab: "links" | "history", on: boolean) => {
    const hidden = new Set(task.hiddenShellTabs ?? [])
    if (on) hidden.delete(tab)
    else hidden.add(tab)
    onPatch({ hiddenShellTabs: hidden.size ? [...hidden] : undefined })
  }

  const setShown = (id: string, shown: boolean) => {
    const hidden = new Set(task.hiddenAttributeIds ?? [])
    if (shown) hidden.delete(id)
    else hidden.add(id)
    onPatch({ hiddenAttributeIds: hidden.size ? [...hidden] : undefined })
  }

  const setLabel = (def: AttributeDefinition, name: string) => {
    const next = { ...(task.attributeLabels ?? {}) }
    const trimmed = name.trim()
    if (!trimmed || trimmed === def.name) delete next[def.id]
    else next[def.id] = trimmed
    onPatch({ attributeLabels: Object.keys(next).length ? next : undefined })
  }

  return (
    <div className="id-settings-sheet">
      <header className="id-settings-head">
        <p className="id-settings-kicker">This item</p>
        <DialogTitle className="id-settings-title">Settings</DialogTitle>
        <p className="id-settings-lede">Attributes, tabs, and the item id.</p>
      </header>
      <div className="id-settings">
      <section className="id-settings-plate">
        <h2>Item id</h2>
        <CopyId id={task.id} label="Copy item id" />
      </section>
      <section className="id-settings-plate">
        <h2>Attributes</h2>
        <p className="id-settings-note">A checked attribute shows on Details. The name opens its own settings. The field is the name on this item.</p>
        {defs.length === 0 ? (
          <p>No attributes yet.</p>
        ) : (
          <ul className="id-settings-attrs">
            <li className="id-settings-attr id-settings-attr-head" aria-hidden>
              <span />
              <span>Name</span>
              <span>Type</span>
            </li>
            {defs.map((def) => {
              const type = normalizeAttributeType(def.type)
              return (
                <li key={def.id} className="id-settings-attr">
                  <label className="id-settings-show">
                    <input
                      type="checkbox"
                      checked={!(task.hiddenAttributeIds ?? []).includes(def.id)}
                      aria-label={`Show ${def.name} on Details`}
                      onChange={(e) => setShown(def.id, e.target.checked)}
                    />
                  </label>
                  <button type="button" className="id-settings-jump" data-no95 onClick={() => onOpenAttribute(def.id)}>
                    {task.attributeLabels?.[def.id]?.trim() || def.name}
                  </button>
                  <span className="id-settings-type">{ATTRIBUTE_TYPE_LABELS[type]}</span>
                  <IsolatedInput
                    className="id-settings-label"
                    value={task.attributeLabels?.[def.id] ?? ""}
                    placeholder={def.name}
                    aria-label={`Display name for ${def.name}`}
                    onCommit={(name) => setLabel(def, name)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <section className="id-settings-plate">
        <h2>Tabs on this item</h2>
        <ul className="id-settings-tabs">
          {catalog.map((panel) => {
            const locked = panel === "details"
            const on = locked || (!(task.hiddenDetailPanels ?? []).includes(panel) && (base.includes(panel) || (task.shownDetailPanels ?? []).includes(panel)))
            return (
              <li key={panel}>
                <label>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={locked}
                    onChange={(e) => setPanel(panel, e.target.checked)}
                  />{" "}
                  {PANEL_LABEL[panel]}
                </label>
              </li>
            )
          })}
          {showLinks && (
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={!(task.hiddenShellTabs ?? []).includes("links")}
                  onChange={(e) => setShell("links", e.target.checked)}
                />{" "}
                Links
              </label>
            </li>
          )}
          <li>
            <label>
              <input
                type="checkbox"
                checked={!(task.hiddenShellTabs ?? []).includes("history")}
                onChange={(e) => setShell("history", e.target.checked)}
              />{" "}
              History
            </label>
          </li>
        </ul>
      </section>
      </div>
    </div>
  )
}
