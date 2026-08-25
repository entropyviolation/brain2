"use client"

/** Shared select-mode checkbox for list display views. */
export function ItemSelectCheckbox({
  selectMode,
  selected,
  label,
  onToggle,
}: {
  selectMode?: boolean
  selected?: boolean
  label: string
  onToggle: () => void
}) {
  if (!selectMode) return null
  return (
    <input
      type="checkbox"
      checked={!!selected}
      aria-label={`Select ${label}`}
      onClick={(e) => e.stopPropagation()}
      onChange={onToggle}
    />
  )
}

export function activateListItem(
  selectMode: boolean | undefined,
  taskId: string,
  onToggleTaskSelect: ((taskId: string) => void) | undefined,
  onTaskSelect: (taskId: string) => void,
) {
  if (selectMode) onToggleTaskSelect?.(taskId)
  else onTaskSelect(taskId)
}
