/**
 * components/Lists/list-content/SheetFullscreen.tsx — In-app maximized spreadsheet
 *
 * Hosts the live `SheetGrid` in a near-viewport Win95 child window (title bar +
 * min/restore/close). Default is in-pane; fullscreen is opt-in. Esc / Restore
 * down / Close / Minimize all exit. In-progress cell and formula-bar edits
 * commit on close via blur. One grid at a time — never an in-pane copy plus a
 * popup copy. This is not OS fullscreen.
 */
"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { commitFocusedSheetEdit, isEditingField } from "./sheet-fullscreen"
import "./sheet-fullscreen.css"

function FullscreenToggle({
  fullscreen,
  onEnter,
  onExit,
}: {
  fullscreen: boolean
  onEnter: () => void
  onExit: () => void
}) {
  return (
    <div className="fm-list-add-row" style={{ marginTop: 0, marginBottom: 4 }}>
      {fullscreen ? (
        <button type="button" className="fm-btn fm-btn-sm" aria-label="Exit fullscreen" title="Exit fullscreen (Esc)" onClick={onExit}>
          ❐ Exit fullscreen
        </button>
      ) : (
        <button type="button" className="fm-btn fm-btn-sm" aria-label="Fullscreen spreadsheet" title="Fullscreen spreadsheet" onClick={onEnter}>
          □ Fullscreen
        </button>
      )}
    </div>
  )
}

function SheetFullscreenWindow({
  open,
  title,
  onExit,
  children,
}: {
  open: boolean
  title: string
  onExit: () => void
  children: ReactNode
}) {
  return (
    <div
      className={open ? "sheet-fs-layer fm98" : "sheet-fs-layer sheet-fs-layer-idle fm98"}
      data-ui-name="Sheet fullscreen"
      data-ui-docs="components/Lists/README.md"
      hidden={!open}
      role={open ? "dialog" : undefined}
      aria-modal={open ? true : undefined}
      aria-labelledby={open ? "sheet-fs-title" : undefined}
      aria-hidden={open ? undefined : true}
    >
      <div className="fm-window sheet-fs-window">
        <div className="fm-title-bar">
          <div className="fm-title-bar-text" id="sheet-fs-title">
            {title}
          </div>
          <div className="fm-title-bar-controls">
            <button type="button" className="fm-title-btn" aria-label="Minimize" title="Restore to list" onClick={onExit}>
              _
            </button>
            <button type="button" className="fm-title-btn" aria-label="Restore down" title="Exit fullscreen" onClick={onExit}>
              ❐
            </button>
            <button type="button" className="fm-title-btn" aria-label="Close" title="Exit fullscreen" onClick={onExit}>
              ×
            </button>
          </div>
        </div>
        <div className="fm-window-body sheet-fs-body">{children}</div>
      </div>
    </div>
  )
}

export function SheetFullscreenShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [fullscreen, setFullscreen] = useState(false)
  const [canPortal, setCanPortal] = useState(false)

  useEffect(() => {
    setCanPortal(true)
  }, [])

  const exit = useCallback(() => {
    commitFocusedSheetEdit()
    setFullscreen(false)
  }, [])

  const enter = useCallback(() => {
    commitFocusedSheetEdit()
    setFullscreen(true)
  }, [])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (isEditingField(document.activeElement)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      exit()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [fullscreen, exit])

  const sheet = (
    <>
      <FullscreenToggle fullscreen={fullscreen} onEnter={enter} onExit={exit} />
      {children}
    </>
  )

  return (
    <>
      <div className="sheet-fs-pane" hidden={fullscreen}>
        {fullscreen ? null : sheet}
      </div>
      {canPortal
        ? createPortal(
            <SheetFullscreenWindow open={fullscreen} title={title} onExit={exit}>
              {fullscreen ? (
                <div className="sheet-instance sheet-grid--fill" data-sheet-instance="1">
                  {sheet}
                </div>
              ) : null}
            </SheetFullscreenWindow>,
            document.body,
          )
        : null}
    </>
  )
}
