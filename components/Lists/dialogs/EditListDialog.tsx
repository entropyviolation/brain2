"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { LIST_DISPLAY_MODES, sanitizeEnabledDisplays, type AttributeDefinition, type List, type Folder, type ItemTypeDefinition, type ListDisplayMode } from "@/lib/types"
import type { ListDisplay } from "@/lib/lists-ui-store"
import { listIsNextActions } from "@/lib/item-utils"
import { removeTaskFromList } from "@/lib/item-selection"
import { isFolderAllItemsCategoryId, GLOBAL_ALL_ITEMS_LIST_ID } from "@/lib/folder-all-items"
import { isRemindersList } from "@/lib/reminders"
import { isPeopleIKnowList } from "@/lib/people-i-know"
import { isInstagramAnalysisList, isInstagramPeopleList } from "@/lib/instagram-lists"
import { PersonPipelinesEditor } from "@/components/People/person-pipelines"
import { InstagramListsSettings } from "@/components/Lists/dialogs/InstagramListsSettings"
import { isListHiddenFromGlobalAll } from "@/lib/module-lists"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import {
  assignTypeToList,
  listAllowedTypeIds,
  normalizeListTypeAssignment,
  setListDefaultItemType,
  toggleListAllowedType,
} from "@/lib/list-item-types"
import { iconFor } from "@/components/Lists/lib/icon-utils"
import { listDisplayCaption } from "@/components/Lists/lib/velvet-icon-grid"
import { AttributeSchemaEditor, AttributeValuesEditor, listAttributeSchema } from "@/components/Lists/attribute-editor"
import { ListRulesEditor } from "@/components/Lists/dialogs/ListRulesEditor"
import { ItemTypeEditor } from "@/components/ItemTypes/ItemTypeEditor"
import { Button } from "@/components/ui/button"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash, Settings, Shapes, Pencil, Copy } from "lucide-react"
import { ConnectedListsEditor } from "@/components/Lists/dialogs/ConnectedListsEditor"
import { ListHabitRoutes } from "@/components/Lists/dialogs/ListHabitRoutes"
import { InFoldersEditor } from "@/components/Lists/dialogs/InFoldersEditor"
import { ListChildrenEditor } from "@/components/Lists/dialogs/ListChildrenEditor"
import { AutoMark } from "@/components/Lists/dialogs/FolderRelationsEditor"
import { ChecklistVarsSettings } from "@/components/Lists/dialogs/ChecklistViewSettings"
import { DefaultViewSettings } from "@/components/Lists/dialogs/DefaultViewSettings"
import { HabitBarRocker } from "@/components/Home/Habits/habit-led-switch"
import {
  ColorSwatches,
  DetailPanelSwitches,
  ListMonitor,
  PlacesMap,
  SafetyCover,
  ViewModeCards,
  useListPlaces,
} from "@/components/Lists/dialogs/list-properties/ListPropertiesParts"
import { ListColumnsMatrix } from "@/components/Lists/dialogs/list-properties/ListColumnsMatrix"
import { MembershipRulesEditor } from "@/components/Lists/dialogs/list-properties/MembershipRulesEditor"
import { BulkEditPanel } from "@/components/Lists/dialogs/list-properties/BulkEditPanel"
import "@/components/Lists/dialogs/list-properties/list-properties.css"
import { isAutoCreatedList } from "@/lib/lists-duplicate"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"

export interface EditListDialogProps {
  editingCategory: List | null
  onEditingCategoryChange: (category: List | null) => void
  folders: Folder[]
  homePinned: string[]
  listDisplay: Record<string, ListDisplay>
  setListDisplay: (id: string, d: ListDisplay) => void
  toggleHomePin: (id: string) => void
  onOpenIconPicker: () => void
  onSave: (category: List) => void
  onDelete: () => void
  onDuplicate?: () => void
}

const ALL_DISPLAYS: ListDisplayMode[] = [...LIST_DISPLAY_MODES]

type SettingsTab = "general" | "places" | "items" | "rules" | "views" | "bulk" | "behavior"

/** Items on this list — the list's key number, beside places and views. */
function ItemCount({ listId }: { listId: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const { total, open } = useMemo(() => {
    let total = 0
    let open = 0
    for (const t of tasks) {
      if (!t.lists?.includes(listId)) continue
      total++
      if (!t.completed) open++
    }
    return { total, open }
  }, [tasks, listId])
  return (
    <span className="lp-status-item lp-count" data-testid="list-item-count">
      <span className={`lp-lamp${total ? " is-green" : ""}`} aria-hidden />
      <b>{total}</b> item{total === 1 ? "" : "s"}
      {total ? <span className="lp-count-open">· {open} open</span> : null}
    </span>
  )
}

/** "In 2 folders · 1 nested · 0 connected" — live from the store. */
function PlacesCount({ listId }: { listId: string }) {
  const { inFolders, children, links } = useListPlaces(listId)
  const any = inFolders.length + children.length + links.length > 0
  return (
    <span className="lp-status-item">
      <span className={`lp-lamp${any ? " is-green" : ""}`} aria-hidden />
      In {inFolders.length} folder{inFolders.length === 1 ? "" : "s"} · {children.length} nested · {links.length} connected
    </span>
  )
}

export function EditListDialog({
  editingCategory,
  onEditingCategoryChange,
  folders,
  homePinned,
  toggleHomePin,
  onOpenIconPicker,
  onSave,
  onDelete,
  onDuplicate,
}: EditListDialogProps) {
  const types = useItemTypeStore((s) => s.types)
  const allLists = useTaskStore((s) => s.lists)
  const addType = useItemTypeStore((s) => s.addType)
  const updateType = useItemTypeStore((s) => s.updateType)

  const [typeEditorOpen, setTypeEditorOpen] = useState(false)
  // null = create new; a definition = edit that type.
  const [typeToEdit, setTypeToEdit] = useState<ItemTypeDefinition | null>(null)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const textRef = useRef({ name: "", description: "", itemLabel: "" })
  const glassNameRef = useRef<HTMLSpanElement | null>(null)
  const nounRef = useRef<HTMLSpanElement | null>(null)
  const [tab, setTab] = useState<SettingsTab>("general")
  const [viewFocus, setViewFocus] = useState<ListDisplayMode>("default")
  // Typing lives in refs (IsolatedInput); flip this once so the foot lamp can say so.
  const [textTouched, setTextTouched] = useState(false)
  const touchText = () => {
    if (!textTouched) setTextTouched(true)
  }

  useEffect(() => {
    if (!editingCategory) return
    textRef.current = {
      name: editingCategory.name,
      description: editingCategory.description || "",
      itemLabel: editingCategory.itemLabel || "",
    }
    setTab(isFolderAllItemsCategoryId(editingCategory.id) ? "views" : "general")
    setViewFocus("default")
    setTextTouched(false)
  }, [editingCategory?.id])

  const allowedTypeIds = useMemo(
    () => (editingCategory ? listAllowedTypeIds(editingCategory) : []),
    [editingCategory],
  )
  const selectedType = useMemo(
    () => (editingCategory?.itemTypeId ? types.find((t) => t.id === editingCategory.itemTypeId) ?? null : null),
    [types, editingCategory?.itemTypeId],
  )
  /** Orphan default id — still rendered as a SelectItem so Radix never crashes. */
  const orphanDefaultTypeId =
    editingCategory?.itemTypeId && !types.some((t) => t.id === editingCategory.itemTypeId)
      ? (editingCategory.itemTypeId as string)
      : null
  const defaultTypeSelectValue = editingCategory?.itemTypeId
    ? (editingCategory.itemTypeId as string)
    : "none"

  // The list's *composed* schema: its item type's attributes plus list-specific
  // extras. Drives the default-values editor and the table-column picker.
  const composedDefs = useMemo(
    () => (editingCategory ? listAttributeSchema(editingCategory, types) : []),
    [editingCategory, types],
  )

  const baselineRef = useRef<List | null>(null)
  if (editingCategory && baselineRef.current?.id !== editingCategory.id) {
    baselineRef.current = structuredClone(editingCategory)
  }
  if (!editingCategory) baselineRef.current = null
  const isDirty = Boolean(
    editingCategory &&
      baselineRef.current &&
      !snapshotsEqual(
        {
          ...editingCategory,
          name: textRef.current.name || editingCategory.name,
          description: textRef.current.description || editingCategory.description,
        },
        baselineRef.current,
      ),
  )
  const guard = useUnsavedGuard({
    open: !!editingCategory,
    onOpenChange: (next) => {
      if (!next && !clearConfirmOpen) onEditingCategoryChange(null)
    },
    isDirty,
    onSave: () => {
      if (!editingCategory) return false
      onSave({
        ...editingCategory,
        name: textRef.current.name,
        description: textRef.current.description,
        itemLabel: textRef.current.itemLabel || undefined,
      })
    },
  })

  if (!editingCategory) return null

  const isFolderAll = isFolderAllItemsCategoryId(editingCategory.id)
  const isReminders = isRemindersList(editingCategory)
  const isPeople = isPeopleIKnowList(editingCategory)
  const isInstagram = isInstagramPeopleList(editingCategory)
  const nounFallback = listIsNextActions(editingCategory.id, folders) ? "task" : "item"
  const enabledDisplays = sanitizeEnabledDisplays(editingCategory.enabledDisplays) ?? ALL_DISPLAYS

  const toggleDisplay = (d: ListDisplayMode) => {
    const on = enabledDisplays.includes(d)
    const nextSet = on ? enabledDisplays.filter((x) => x !== d) : [...enabledDisplays, d]
    if (nextSet.length === 0) return // a list must offer at least one display
    const ordered = ALL_DISPLAYS.filter((x) => nextSet.includes(x))
    onEditingCategoryChange({
      ...editingCategory,
      // Store undefined when every mode is offered (the default) to keep data tidy.
      enabledDisplays: ordered.length === ALL_DISPLAYS.length ? undefined : ordered,
    })
  }

  const handleSaveType = (def: ItemTypeDefinition) => {
    if (types.some((t) => t.id === def.id)) updateType(def)
    else addType(def)
    // Add to allowlist and make it the default for new items.
    onEditingCategoryChange(assignTypeToList(editingCategory, def.id, true))
  }

  // Every attribute the vault knows: this list's schema first, then other lists and types.
  const vaultAttributes = (() => {
    const seen = new Set<string>()
    const out: AttributeDefinition[] = []
    const push = (d: AttributeDefinition) => {
      if (!d?.id || seen.has(d.id)) return
      seen.add(d.id)
      out.push(d)
    }
    composedDefs.forEach(push)
    for (const l of allLists) (l.itemAttributes ?? []).forEach(push)
    for (const t of types) (t.attributes ?? []).forEach(push)
    return out
  })()

  const displayIds =
    editingCategory.displayedAttributes && editingCategory.displayedAttributes.length > 0
      ? editingCategory.displayedAttributes
      : composedDefs.map((d) => d.id)

  const places = !isFolderAll
  const tabs: { id: SettingsTab; label: string; count?: number }[] = isFolderAll
    ? [{ id: "views", label: "Views", count: enabledDisplays.length }]
    : [
        { id: "general", label: "General" },
        { id: "places", label: "Places" },
        { id: "items", label: "Items", count: allowedTypeIds.length || undefined },
        { id: "rules", label: "Rules", count: (editingCategory.membershipRules?.length ?? 0) + (editingCategory.rules?.length ?? 0) || undefined },
        { id: "views", label: "Views", count: enabledDisplays.length },
        { id: "bulk", label: "Bulk edit" },
        { id: "behavior", label: "Behavior" },
      ]
  const openTab: SettingsTab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id
  const moveTab = (dir: -1 | 1) => {
    const i = tabs.findIndex((t) => t.id === openTab)
    const next = tabs[(i + dir + tabs.length) % tabs.length]
    setTab(next.id)
    window.requestAnimationFrame(() => document.getElementById(`lp-tab-${next.id}`)?.focus())
  }
  const pane = (id: SettingsTab) => ({
    id: `lp-pane-${id}`,
    role: "tabpanel" as const,
    "aria-labelledby": `lp-tab-${id}`,
    className: "lp-pane",
    "data-open": openTab === id ? "true" : "false",
  })
  const dirtyNow = isDirty || textTouched

  return (
    <>
    <Dialog open={!!editingCategory} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="fm98-dialog lp-dialog w-[calc(100vw-1.5rem)] max-w-[58rem] sm:max-w-[58rem] max-h-[92vh] overflow-hidden flex flex-col" data-ui-name="List settings" data-ui-docs="components/Lists/README.md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader className="lp-ident">
          <ListMonitor
            list={editingCategory}
            nameRef={glassNameRef}
            onOpenIconPicker={onOpenIconPicker}
            interactive={!isFolderAll}
          />
          <div className="lp-ident-main">
            <div className="lp-ident-title">
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" aria-hidden />
                List Settings
                <AutoMark show={isAutoCreatedList(editingCategory)} />
              </DialogTitle>
            </div>
            <DialogDescription className={isFolderAll ? "lp-caption" : "sr-only"}>
              {isFolderAll
                ? editingCategory.id === GLOBAL_ALL_ITEMS_LIST_ID
                  ? "View settings for Home All. They persist on the All Items record and do not own every item."
                  : "View settings for this folder’s All Items aggregate. They persist on the All Items record and do not turn it into a separate child list."
                : "Update the settings for this list."}
            </DialogDescription>
            {isFolderAll ? (
              <p className="lp-static-name">{editingCategory.name}</p>
            ) : (
              <div className="lp-namefield">
                <Label htmlFor="edit-category-name" className="lp-label">List Name</Label>
                <IsolatedInput
                  id="edit-category-name"
                  value={editingCategory.name}
                  onLiveChange={(name) => {
                    textRef.current.name = name
                    if (glassNameRef.current) glassNameRef.current.textContent = name
                    touchText()
                  }}
                />
              </div>
            )}
            <div className="lp-status">
              <div className="lp-status-item" data-testid="list-id-line">
                <span className="lp-status-key">ID</span>
                <code className="lp-id">{editingCategory.id}</code>
                <button
                  type="button"
                  className="lp-mini-key"
                  aria-label="Copy list id"
                  onClick={(e) => {
                    const id = editingCategory.id
                    const button = e.currentTarget
                    const flash = () => {
                      const previous = button.textContent
                      button.textContent = "Copied"
                      window.setTimeout(() => {
                        button.textContent = previous
                      }, 900)
                    }
                    if (navigator.clipboard?.writeText) {
                      void navigator.clipboard.writeText(id).then(flash).catch(flash)
                    }
                  }}
                >
                  Copy
                </button>
              </div>
              <div className="lp-status-item lp-habits">
                <ListHabitRoutes listId={editingCategory.id} listName={editingCategory.name} />
              </div>
              {places ? <ItemCount listId={editingCategory.id} /> : null}
              {places ? <PlacesCount listId={editingCategory.id} /> : null}
              <span className="lp-status-item">
                <span className={`lp-lamp${enabledDisplays.length ? " is-green" : ""}`} aria-hidden />
                {enabledDisplays.length} view{enabledDisplays.length === 1 ? "" : "s"} offered
              </span>
            </div>
          </div>
        </DialogHeader>

        {tabs.length > 1 ? (
          <div
            className="lp-tabs"
            role="tablist"
            aria-label="List settings sections"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); moveTab(1) }
              if (e.key === "ArrowLeft") { e.preventDefault(); moveTab(-1) }
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                id={`lp-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={openTab === t.id}
                aria-controls={`lp-pane-${t.id}`}
                tabIndex={openTab === t.id ? 0 : -1}
                className={`lp-tab${openTab === t.id ? " is-open" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className={`lp-lamp${openTab === t.id ? " is-green" : ""}`} aria-hidden />
                {t.label}
                {t.count != null ? <span className="lp-tab-count">{t.count}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="lp-body">
          {!isFolderAll && (
          <>
          {/* GENERAL */}
          <section {...pane("general")}>
            <div className="lp-row2">
              <div className="lp-col">
                <div className="lp-sect">
                  <div className="lp-label">Icon</div>
                  <div className="lp-icon-row">
                    <img
                      src={iconFor(editingCategory.id, editingCategory.icon)}
                      alt=""
                      className="lp-icon-preview"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={onOpenIconPicker}>
                        Change Icon
                      </Button>
                      {editingCategory.icon && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditingCategoryChange({ ...editingCategory, icon: undefined })}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="lp-caption">Pick an orb or upload a picture. The monitor above shows it on velvet.</p>
                </div>
                <div className="lp-sect">
                  <Label htmlFor="edit-category-color" className="lp-label">Color</Label>
                  <ColorSwatches
                    value={editingCategory.color}
                    onChange={(color) => onEditingCategoryChange({ ...editingCategory, color })}
                  />
                  <p className="lp-caption">The ring on the list’s orb and its pip in rows.</p>
                </div>
              </div>
              <div className="lp-col">
                <div className="lp-sect">
                  <Label htmlFor="edit-category-description" className="lp-label">Description</Label>
                  <IsolatedInput
                    id="edit-category-description"
                    value={editingCategory.description || ""}
                    onLiveChange={(description) => {
                      textRef.current.description = description
                      touchText()
                    }}
                  />
                </div>
                <div className="lp-sect">
                  <Label htmlFor="edit-item-label" className="lp-label">Item name (singular)</Label>
                  <IsolatedInput
                    id="edit-item-label"
                    value={editingCategory.itemLabel || ""}
                    onLiveChange={(itemLabel) => {
                      textRef.current.itemLabel = itemLabel
                      if (nounRef.current) nounRef.current.textContent = itemLabel.trim() || nounFallback
                      touchText()
                    }}
                    placeholder={nounFallback}
                  />
                  <div className="lp-noun-preview" aria-hidden>
                    <span className="lp-caption">Shows as</span>
                    <span className="lp-mini-key is-static">
                      + Add <span ref={nounRef}>{editingCategory.itemLabel || nounFallback}</span>
                    </span>
                  </div>
                  <p className="lp-caption">
                    Used in “Add …” buttons and labels. Next Actions lists default to “task”.
                  </p>
                </div>
              </div>
            </div>
            {isPeople ? <div className="lp-sect"><PersonPipelinesEditor mode="list" /></div> : null}
            {isInstagram || isInstagramAnalysisList(editingCategory) ? <div className="lp-sect"><InstagramListsSettings /></div> : null}
          </section>

          {/* PLACES */}
          <section {...pane("places")}>
            <PlacesMap list={editingCategory} />
            <div className="lp-places">
              <InFoldersEditor listId={editingCategory.id} />
              <ListChildrenEditor listId={editingCategory.id} />
              <ConnectedListsEditor listId={editingCategory.id} />
            </div>
          </section>

          {/* ITEMS */}
          <section {...pane("items")}>
          <div className="lp-sect">
            <Label className="lp-label">
              <Shapes className="h-4 w-4" aria-hidden />
              Item types
            </Label>
            <p className="lp-caption">
              Choose which types this list may hold. New items use the default type and inherit its attributes,
              defaults, and rules. List-specific fields below still apply.
            </p>
            <div className="lp-types">
              {types.map((t) => {
                const id = t.id as string
                const on = allowedTypeIds.includes(id)
                const isDefault = editingCategory.itemTypeId === id
                return (
                  <label key={id} className={`lp-type${on ? " is-on" : ""}`}>
                    <input
                      type="checkbox"
                      className="lp-type-box"
                      checked={on}
                      onChange={() =>
                        onEditingCategoryChange(toggleListAllowedType(editingCategory, id, !on))
                      }
                    />
                    <span
                      className="lp-type-dot"
                      style={{ backgroundColor: t.color ?? "#94a3b8" }}
                      aria-hidden
                    />
                    <span className="lp-type-name">{t.name}</span>
                    <span className={`lp-lamp${on ? " is-green" : ""}`} aria-hidden />
                    {isDefault ? <span className="lp-type-default">Default</span> : null}
                  </label>
                )
              })}
              {allowedTypeIds
                .filter((id) => !types.some((t) => t.id === id))
                .map((id) => (
                  <label key={id} className="lp-type is-on">
                    <input
                      type="checkbox"
                      className="lp-type-box"
                      checked
                      onChange={() =>
                        onEditingCategoryChange(toggleListAllowedType(editingCategory, id, false))
                      }
                    />
                    <span className="lp-type-name">Unknown ({id})</span>
                    <span className="lp-lamp is-green" aria-hidden />
                  </label>
                ))}
            </div>
            <div className="lp-default-type">
              <Label className="lp-caption shrink-0">Default for new items</Label>
              <Select
                value={defaultTypeSelectValue}
                onValueChange={(v) =>
                  onEditingCategoryChange(
                    v === "none"
                      ? normalizeListTypeAssignment({ ...editingCategory, itemTypeId: undefined })
                      : setListDefaultItemType(editingCategory, v),
                  )
                }
              >
                <SelectTrigger className="h-8 flex-1 min-w-[160px] max-w-[260px]">
                  <SelectValue placeholder="No type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No type (generic items)</SelectItem>
                  {orphanDefaultTypeId && (
                    <SelectItem value={orphanDefaultTypeId}>Unknown ({orphanDefaultTypeId})</SelectItem>
                  )}
                  {(allowedTypeIds.length > 0
                    ? types.filter(
                        (t) =>
                          allowedTypeIds.includes(t.id as string) ||
                          t.id === editingCategory.itemTypeId,
                      )
                    : types
                  ).map((t) => (
                    <SelectItem key={t.id} value={t.id as string}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTypeToEdit(selectedType)
                    setTypeEditorOpen(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {selectedType.builtin ? "View" : "Edit"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTypeToEdit(null)
                  setTypeEditorOpen(true)
                }}
              >
                New type…
              </Button>
            </div>
            {selectedType && (selectedType.attributes?.length ?? 0) > 0 && (
              <p className="lp-caption">
                Inherited from {selectedType.name}: {selectedType.attributes!.map((a) => a.name).join(", ")}
              </p>
            )}
          </div>

          <div className="lp-row2">
            <div className="lp-sect">
              <Label className="lp-label">Item-detail panels</Label>
              <div className="lp-well-white">
                <DetailPanelSwitches list={editingCategory} onChange={onEditingCategoryChange} />
              </div>
              <p className="lp-caption">
                <b>Type</b> follows the item type. <b>Show</b> adds the tab. <b>Hide</b> removes it even if the
                type would show it (e.g. Scheduling on a wishlist).
              </p>
            </div>

            <div className="lp-sect">
              <Label className="lp-label">{selectedType ? "List-specific attributes" : "Item attributes"}</Label>
              <p className="lp-caption">
                {selectedType
                  ? `Extra fields for items on this list only (added on top of the ${selectedType.name} type).`
                  : "Fields every item in this list can fill in (shown in the item's detail view)."}
              </p>
              <AttributeSchemaEditor
                value={editingCategory.itemAttributes || []}
                onChange={(defs) => onEditingCategoryChange({ ...editingCategory, itemAttributes: defs })}
              />
            </div>
          </div>

          {composedDefs.length > 0 && (
            <>
              <div className="lp-sect">
                <Label className="lp-label">Default values for new items</Label>
                <AttributeValuesEditor
                  definitions={composedDefs}
                  values={editingCategory.defaultAttributeValues || {}}
                  onChange={(vals) => onEditingCategoryChange({ ...editingCategory, defaultAttributeValues: vals })}
                />
              </div>
              <div className="lp-sect">
                <Label className="lp-label">Shown attributes</Label>
                <p className="lp-caption">
                  Which attributes are offered in this list&apos;s views (uncheck to hide
                  without deleting). Details table columns are chosen separately under
                  Views.
                </p>
                <div className="lp-chip-toggles">
                  {composedDefs.map((def) => {
                    const on = displayIds.includes(def.id)
                    return (
                      <label key={def.id} className={`lp-chip-toggle${on ? " is-on" : ""}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            const current = displayIds
                            const next = on ? current.filter((id) => id !== def.id) : [...current, def.id]
                            onEditingCategoryChange({ ...editingCategory, displayedAttributes: next })
                          }}
                        />
                        {def.name}
                      </label>
                    )
                  })}
                </div>
              </div>
            </>
          )}
          </section>

          {/* RULES — auto-add membership, then the attribute automation that was under Items */}
          <section {...pane("rules")}>
            <div className="lp-sect">
              <Label className="lp-label">Auto-add</Label>
              <p className="lp-caption">
                Items that match a rule join this list by themselves — every Book, everything due within a week,
                everything on another list. Saved with Save Changes.
              </p>
              <MembershipRulesEditor
                list={editingCategory}
                onChange={onEditingCategoryChange}
                types={types}
                attributes={vaultAttributes}
              />
            </div>
            <div className="lp-sect">
              <Label className="lp-label">Rules</Label>
              <p className="lp-caption">
                Automation that runs for items on this list (and follows the item into its other lists).
              </p>
              {composedDefs.length > 0 ? (
                <ListRulesEditor
                  rules={editingCategory.rules || []}
                  defs={composedDefs}
                  onChange={(rules) =>
                    onEditingCategoryChange({ ...editingCategory, rules: rules.length ? rules : undefined })
                  }
                />
              ) : (
                <p className="lp-caption">Add an item attribute (Items tab) to automate on its changes.</p>
              )}
            </div>
          </section>

          {/* BULK EDIT — acts now, one undo step */}
          <section {...pane("bulk")}>
            <BulkEditPanel list={editingCategory} types={types} attributes={vaultAttributes} />
          </section>
          </>
          )}

          {/* VIEWS — the only tab on folder / global All Items */}
          <section {...pane("views")}>
            <div className="lp-sect">
              <Label className="lp-label">Display options offered</Label>
              <p className="lp-caption">
                Choose which views are available from the toolbar for this list. The lamp is on when a view is
                offered; click a view to set it up below.
              </p>
              <ViewModeCards
                modes={ALL_DISPLAYS}
                enabled={enabledDisplays}
                active={viewFocus}
                onSelect={setViewFocus}
                onToggleOffered={toggleDisplay}
              />
            </div>
            <div className="lp-sect lp-vset">
              <Label className="lp-label">View mode settings</Label>
              <p className="lp-caption">
                Per-display options for this list. Default checklist is one labeled <strong>Completed</strong> tick.
              </p>
              <div className="lp-vpanel" data-open={viewFocus === "default" ? "true" : "false"}>
                <DefaultViewSettings list={editingCategory} onChange={onEditingCategoryChange} />
              </div>
              <div className="lp-vpanel" data-open={viewFocus === "checklist" ? "true" : "false"}>
                <ChecklistVarsSettings list={editingCategory} onChange={onEditingCategoryChange} />
              </div>
              <div className="lp-vpanel" data-open={viewFocus === "icons" ? "true" : "false"}>
                <p className="text-sm font-medium">Icons view mode settings</p>
                <p className="lp-caption">
                  Orbs on velvet. Desktop, Pile up, and Gravity live on the list’s own Display toolbar.
                </p>
              </div>
              <div className="lp-vpanel" data-open={viewFocus === "table" ? "true" : "false"}>
                <p className="text-sm font-medium">Details view mode settings</p>
                <p className="lp-caption">
                  Columns for this list&apos;s Details table only — the same table sets Spreadsheet in the next column.
                </p>
                {viewFocus === "table" ? (
                  <ListColumnsMatrix list={editingCategory} onChange={onEditingCategoryChange} focus="table" />
                ) : null}
              </div>
              <div className="lp-vpanel" data-open={viewFocus === "spreadsheet" ? "true" : "false"}>
                <p className="text-sm font-medium">Spreadsheet view mode settings</p>
                <p className="lp-caption">Columns for this list only. Uncheck to hide — the attribute stays in the vault.</p>
                {viewFocus === "spreadsheet" ? (
                  <ListColumnsMatrix list={editingCategory} onChange={onEditingCategoryChange} focus="spreadsheet" />
                ) : null}
              </div>
            </div>
          </section>

          {!isFolderAll && (
          <section {...pane("behavior")}>
            <div className="lp-beh">
              <div className="lp-beh-row">
                <HabitBarRocker
                  checked={editingCategory.scheduleable === true}
                  onCheckedChange={(checked) => onEditingCategoryChange({ ...editingCategory, scheduleable: checked })}
                  label="Send to Scheduler"
                />
                <p className="lp-caption">
                  Off unless you turn it on. Puts this list in the Scheduler, the tool that sorts to-do lists
                  into year, month, week, and day. A list can be scheduled — a trip itinerary with dates —
                  without being sent there.
                </p>
              </div>
              <div className="lp-beh-row">
                <HabitBarRocker
                  checked={editingCategory.sentThisWeek === true}
                  onCheckedChange={(checked) =>
                    onEditingCategoryChange({ ...editingCategory, sentThisWeek: checked ? true : undefined })
                  }
                  label="Sent this week"
                />
                <p className="lp-caption">
                  Off unless you turn it on. Each item gets a Sent control on its detail. Sent items hide in this list
                  until Show sent. When a new week starts, last week’s sent items leave this list. They are not deleted.
                  Unsent items stay.
                </p>
              </div>
              <div className="lp-beh-row">
                <HabitBarRocker
                  checked={homePinned.includes(editingCategory.id)}
                  onCheckedChange={() => toggleHomePin(editingCategory.id)}
                  label="Show in Home"
                />
                <p className="lp-caption">Pin this list to your Home directory.</p>
              </div>
              <div className="lp-beh-row">
                <HabitBarRocker
                  checked={!isListHiddenFromGlobalAll(editingCategory, folders)}
                  onCheckedChange={(checked) =>
                    onEditingCategoryChange({ ...editingCategory, hiddenFromGlobalAll: !checked })
                  }
                  label="Show in All"
                />
                <p className="lp-caption">
                  Include this list in the global All directory. Module-created lists are hidden by default.
                </p>
              </div>
            </div>

            <div className="fm-list-danger lp-danger" data-testid="list-danger-actions">
              <Label className="lp-label lp-danger-plate">
                <span className="lp-lamp is-red" aria-hidden />
                Dangerous actions
              </Label>
              <p className="lp-caption">
                Clear removes items from this list only. They stay in the universe and on any other lists. Delete
                removes the list itself. Lift a cover, then press.
              </p>
              <div className="lp-guards">
                <SafetyCover label="Clear list">
                  {(armed) => (
                    <Button type="button" variant="outline" className="lp-danger-key" tabIndex={armed ? 0 : -1} onClick={() => setClearConfirmOpen(true)}>
                      Clear list
                    </Button>
                  )}
                </SafetyCover>
                {isReminders || isPeople || isInstagram ? null : (
                  <SafetyCover label="Delete">
                    {(armed) => (
                      <Button type="button" variant="destructive" className="lp-danger-key" tabIndex={armed ? 0 : -1} onClick={onDelete}>
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </SafetyCover>
                )}
              </div>
            </div>
          </section>
          )}
        </div>

        <div className="lp-foot">
          <div className="lp-foot-left">
            <span className="lp-dirty" aria-live="polite">
              <span className={`lp-lamp${dirtyNow ? " is-blue" : ""}`} aria-hidden />
              {dirtyNow ? "Unsaved changes" : "No changes"}
            </span>
            {onDuplicate && !isFolderAll && !isReminders && (
              <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate list
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                onSave({
                  ...editingCategory,
                  name: textRef.current.name,
                  description: textRef.current.description,
                  itemLabel: textRef.current.itemLabel || undefined,
                })
              }
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>

      <ItemTypeEditor
        open={typeEditorOpen}
        onOpenChange={setTypeEditorOpen}
        type={typeToEdit}
        existingIds={types.map((t) => t.id as string)}
        allTypes={types}
        onSave={handleSaveType}
      />

      <ClearListConfirmDialog
        open={clearConfirmOpen}
        listName={editingCategory.name}
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          const listId = editingCategory.id
          const { tasks, updateTask } = useTaskStore.getState()
          for (const task of tasks) {
            const next = removeTaskFromList(task, listId)
            if (next !== task) updateTask(next)
          }
          setClearConfirmOpen(false)
        }}
      />
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}

function ClearListConfirmDialog({
  open,
  listName,
  onCancel,
  onConfirm,
}: {
  open: boolean
  listName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="fm98-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            Every item will be removed from “{listName}”. They will not be deleted — they stay in the universe and on
            any other lists they belong to. This list will be empty.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Clear list
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
