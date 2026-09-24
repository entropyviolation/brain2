/**
 * components/Home/home-widget-dialog.tsx — Click-open instrument for overview tiles
 *
 * The hide key stays outside the open button. × asks Are you sure? before
 * removing the square. Clicking the rest of the tile opens a silver handheld:
 * a caption, dark wells, and one scroll. Settings appear only when the widget
 * has any.
 */
"use client"

import { useState, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HOME_WIDGET_LABEL, type HomeWidgetId } from "@/lib/home-widgets"
import { cn } from "@/lib/utils"

export function HomeWidgetDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="home-widget-dialog home-widget-instrument" aria-describedby={undefined} hideClose>
        <button type="button" className="home-widget-dismiss" aria-label="Close" onClick={() => onOpenChange(false)}>
          ×
        </button>
        <DialogHeader className="home-widget-caption">
          <span className="home-widget-power" aria-hidden="true" />
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="home-widget-detail">{children}</div>
      </DialogContent>
    </Dialog>
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
        <button type="button" className="home-widget-dismiss" aria-label="Close" onClick={onCancel}>
          ×
        </button>
        <DialogHeader className="home-widget-caption">
          <span className="home-widget-power is-amber" aria-hidden="true" />
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>Hide {label}? You can add it again from Widgets.</DialogDescription>
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
  id: HomeWidgetId
  onHide: () => void
}) {
  const [ask, setAsk] = useState(false)
  const label = HOME_WIDGET_LABEL[id]
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
