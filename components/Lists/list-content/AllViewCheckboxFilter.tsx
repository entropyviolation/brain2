"use client"

export function AllViewCheckboxFilter({
  items,
  hiddenIds,
  onHiddenChange,
  onSetHiddenIds,
  ariaLabel,
  uncategorizedChecked = true,
  onUncategorizedChange,
}: {
  items: { id: string; name: string }[]
  hiddenIds: string[]
  onHiddenChange: (id: string, hidden: boolean) => void
  /** Replace the whole hidden-id set (Select all / Deselect all). */
  onSetHiddenIds?: (hiddenIds: string[]) => void
  ariaLabel: string
  uncategorizedChecked?: boolean
  onUncategorizedChange?: (checked: boolean) => void
}) {
  if (items.length === 0 && !onUncategorizedChange) return null
  const hidden = new Set(hiddenIds)
  const allListsSelected = items.every((item) => !hidden.has(item.id))
  const noneSelected =
    items.every((item) => hidden.has(item.id)) &&
    (!onUncategorizedChange || !uncategorizedChecked)
  const allSelected = allListsSelected && (!onUncategorizedChange || uncategorizedChecked)

  const selectAll = () => {
    if (onSetHiddenIds) onSetHiddenIds([])
    else items.forEach((item) => onHiddenChange(item.id, false))
    onUncategorizedChange?.(true)
  }

  const deselectAll = () => {
    if (onSetHiddenIds) onSetHiddenIds(items.map((item) => item.id))
    else items.forEach((item) => onHiddenChange(item.id, true))
    onUncategorizedChange?.(false)
  }

  return (
    <div className="fm-list-filter" role="group" aria-label={ariaLabel}>
      <div className="fm-list-filter-actions">
        <button type="button" className="fm-btn fm-btn-sm" onClick={selectAll} disabled={allSelected}>
          Select all
        </button>
        <button type="button" className="fm-btn fm-btn-sm" onClick={deselectAll} disabled={noneSelected}>
          Deselect all
        </button>
      </div>
      {items.map((item) => (
        <label key={item.id} className="fm-list-filter-item">
          <input
            type="checkbox"
            checked={!hidden.has(item.id)}
            onChange={(e) => onHiddenChange(item.id, !e.target.checked)}
          />
          {item.name}
        </label>
      ))}
      {onUncategorizedChange && (
        <label className="fm-list-filter-item">
          <input
            type="checkbox"
            checked={uncategorizedChecked}
            onChange={(e) => onUncategorizedChange(e.target.checked)}
          />
          Uncategorized
        </label>
      )}
    </div>
  )
}
