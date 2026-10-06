"use client"

import { useEffect, useRef } from "react"

export type FolderContextMenuState = {
  folderId: string
  x: number
  y: number
}

export interface FolderContextMenuProps {
  menu: FolderContextMenuState
  canRename: boolean
  onOpen: () => void
  onRename: () => void
  onFolderSettings: () => void
  onClose: () => void
}

/** Small file-manager context menu for a folder icon or list row. */
export function FolderContextMenu({
  menu,
  canRename,
  onOpen,
  onRename,
  onFolderSettings,
  onClose,
}: FolderContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onPointer)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onPointer)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="fm-ctx-menu"
      style={{ left: menu.x, top: menu.y }}
      data-ui-name="Folder context menu"
    >
      <button type="button" role="menuitem" className="fm-ctx-item" onClick={onOpen}>
        Open
      </button>
      {canRename ? (
        <button type="button" role="menuitem" className="fm-ctx-item" onClick={onRename}>
          Rename
        </button>
      ) : null}
      {canRename ? (
        <button type="button" role="menuitem" className="fm-ctx-item" onClick={onFolderSettings}>
          Folder settings
        </button>
      ) : null}
    </div>
  )
}

export interface FolderRenameInputProps {
  name: string
  onCommit: (next: string) => void
  onCancel: () => void
  className?: string
  "aria-label"?: string
}

/** In-place folder name field — Enter / blur commit; Escape / empty cancel. */
export function FolderRenameInput({
  name,
  onCommit,
  onCancel,
  className,
  "aria-label": ariaLabel = "Rename folder",
}: FolderRenameInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  const commit = () => {
    const next = (ref.current?.value ?? "").trim()
    if (!next) {
      onCancel()
      return
    }
    if (next === name.trim()) {
      onCancel()
      return
    }
    onCommit(next)
  }

  return (
    <input
      ref={ref}
      className={className ?? "fm-input fm-rename-input"}
      type="text"
      defaultValue={name}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Enter") {
          e.preventDefault()
          commit()
        } else if (e.key === "Escape") {
          e.preventDefault()
          onCancel()
        }
      }}
      onBlur={commit}
    />
  )
}
