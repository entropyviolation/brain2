/**
 * components/Home/home-widget-dialog.tsx — A widget's detail: the silver handheld
 *
 * The hide key stays outside the open button. × asks Are you sure? before
 * hiding the face. Clicking the rest of the face opens a silver handheld: a
 * caption, dark wells, and one scroll. On the Visual dashboard the caption
 * carries a gear: it swaps the detail for that installed copy's own settings
 * (`widgets/copy-settings.tsx`), and Done returns. A kind with a first-run
 * guide shows it the first time a copy's detail opens.
 */
"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { KeycapClose } from "@/components/keycap-close"
import { HOME_WIDGET_LABEL } from "@/lib/home-widgets"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { widgetKind } from "@/lib/widgets/kinds"
import { copyDisplayName } from "@/lib/widgets/dashboard"
import { useWidgetFrame } from "@/components/Home/widgets/copy-context"
import { CopySettingsPanel } from "@/components/Home/widgets/copy-settings"
import { WidgetGuide } from "@/components/Home/widgets/widget-guide"
import { cn } from "@/lib/utils"

type DetailView = "detail" | "settings" | "guide"

export function HomeWidgetDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
  modal = true,
  settings,
  onRemoveCopy,
  removeNote,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  className?: string
  /** False while an item detail popup is stacked on top, so it can take focus and clicks. */
  modal?: boolean
  /** The kind's own settings panel, drawn above the shared gear fields. */
  settings?: ReactNode
  /** Remove for kinds whose copy owns a record (Countdown's mark). */
  onRemoveCopy?: () => void
  removeNote?: string
}) {
  const frame = useWidgetFrame()
  const copyId = frame?.copy.id
  const copy = useDashboardStore((s) => (copyId ? s.copies.find((entry) => entry.id === copyId) : undefined))
  const markGuideSeen = useDashboardStore((s) => s.markGuideSeen)
  const kind = copy ? widgetKind(copy.kind) : undefined
  const [view, setView] = useState<DetailView>("detail")

  useEffect(() => {
    if (!open) {
      setView("detail")
      return
    }
    if (kind?.guide && copy && !copy.guideSeen) setView("guide")
    // Only on open: a guide finished mid-dialog must not reopen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Clicks in the stacked popup land outside this dialog; they must not close it.
  const holdOutside = (event: Event) => {
    if (!modal) event.preventDefault()
  }
  const caption = copy?.title.trim() ? copy.title.trim() : title
  const finishGuide = () => {
    if (copy) markGuideSeen(copy.id)
    setView("detail")
  }
  return (
    <Dialog open={open} modal={modal} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("home-widget-dialog home-widget-instrument", className)}
        data-style={frame?.style ?? "milled"}
        aria-describedby={undefined}
        hideClose
        onPointerDownOutside={holdOutside}
        onInteractOutside={holdOutside}
      >
        <KeycapClose className="home-widget-dismiss" label="Close" onClick={() => onOpenChange(false)} />
        <DialogHeader className="home-widget-caption">
          <span className="home-widget-power" aria-hidden="true" />
          <DialogTitle>{view === "settings" ? `${caption} · Settings` : caption}</DialogTitle>
          {copy ? (
            <button
              type="button"
              className={cn("vd-gear", view === "settings" && "is-on")}
              aria-label={view === "settings" ? `Back to ${caption}` : `Settings for ${copyDisplayName(copy)}`}
              aria-pressed={view === "settings"}
              title={view === "settings" ? "Done" : "Settings for this widget"}
              onClick={() => setView((current) => (current === "settings" ? "detail" : "settings"))}
            >
              <GearGlyph />
            </button>
          ) : null}
        </DialogHeader>
        <div className="home-widget-detail" data-view={view}>
          {copy && view === "guide" && kind?.guide ? (
            <WidgetGuide cards={kind.guide} onDone={finishGuide} />
          ) : copy && view === "settings" ? (
            <>
              <CopySettingsPanel
                copyId={copy.id}
                custom={settings}
                removeNote={removeNote}
                onShowGuide={kind?.guide ? () => setView("guide") : undefined}
                onRemoved={() => {
                  onOpenChange(false)
                  if (onRemoveCopy) onRemoveCopy()
                  else useDashboardStore.getState().removeCopy(copy.id)
                }}
              />
              <div className="home-widget-actions vd-settings-done">
                <button type="button" className="home-review-key is-on" onClick={() => setView("detail")}>
                  Done
                </button>
              </div>
            </>
          ) : (
            children
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GearGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M7 1h2l.4 1.9c.5.1 1 .3 1.4.6l1.6-1.1 1.4 1.4-1.1 1.6c.3.4.5.9.6 1.4L15 7v2l-1.9.4c-.1.5-.3 1-.6 1.4l1.1 1.6-1.4 1.4-1.6-1.1c-.4.3-.9.5-1.4.6L9 15H7l-.4-1.9c-.5-.1-1-.3-1.4-.6l-1.6 1.1-1.4-1.4 1.1-1.6c-.3-.4-.5-.9-.6-1.4L1 9V7l1.9-.4c.1-.5.3-1 .6-1.4L2.4 3.6 3.8 2.2l1.6 1.1c.4-.3.9-.5 1.4-.6zM8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z"
      />
    </svg>
  )
}

export function WidgetWells({ children }: { children: ReactNode }) {
  return <div className="home-widget-wells">{children}</div>
}

export function WidgetWell({
  label,
  children,
  tone = "glow",
}: {
  label: string
  children: ReactNode
  tone?: "glow" | "nixie"
}) {
  return (
    <div className="home-widget-well">
      <span className="home-widget-well-label">{label}</span>
      <span className={tone === "nixie" ? "home-widget-nixie" : "home-widget-glow"}>{children}</span>
    </div>
  )
}

export function HideWidgetConfirm({
  open,
  label,
  onCancel,
  onConfirm,
}: {
  open: boolean
  label: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="home-widget-dialog home-widget-instrument home-widget-hide-dialog" aria-describedby={undefined} hideClose>
        <KeycapClose className="home-widget-dismiss" label="Close" onClick={onCancel} />
        <DialogHeader className="home-widget-caption">
          <span className="home-widget-power is-amber" aria-hidden="true" />
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>Hide {label}? It stays installed; show it again from Widgets.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="home-widget-hide-actions">
          <button type="button" className="home-review-key" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="home-review-key" onClick={onConfirm}>
            Hide
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TileHide({
  id,
  onHide,
}: {
  /** Kind id (or a legacy per-mark id); the copy's own name wins on the dashboard. */
  id: string
  onHide: () => void
}) {
  const [ask, setAsk] = useState(false)
  const frame = useWidgetFrame()
  const label = frame
    ? copyDisplayName(frame.copy)
    : ((HOME_WIDGET_LABEL as Record<string, string>)[id] ?? id)
  return (
    <>
      <button
        type="button"
        className="home-tile-hide"
        aria-label={`Hide ${label}`}
        onClick={(event) => {
          event.stopPropagation()
          setAsk(true)
        }}
      >
        ×
      </button>
      <HideWidgetConfirm
        open={ask}
        label={label}
        onCancel={() => setAsk(false)}
        onConfirm={() => {
          setAsk(false)
          onHide()
        }}
      />
    </>
  )
}

export function TileOpen({
  label,
  onOpen,
  children,
  className,
}: {
  label: string
  onOpen: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn("home-tile-open", className)}
      aria-label={`Open ${label}`}
      onClick={onOpen}
    >
      {children}
    </button>
  )
}
