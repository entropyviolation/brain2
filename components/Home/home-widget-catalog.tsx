/**
 * components/Home/home-widget-catalog.tsx — The Widget gallery dialog
 *
 * Opened from the Widgets menu. The gallery itself lives in
 * `widgets/gallery/`: a page per kind that explains what it does and how it
 * works, its sample faces, its settings, its installed copies, and Install
 * with setup. `initialKind` opens straight to one kind's page.
 */
"use client"

import { HomeWidgetDialog } from "@/components/Home/home-widget-dialog"
import { WidgetGallery } from "@/components/Home/widgets/gallery/widget-gallery"

export function HomeWidgetCatalog({
  open,
  onOpenChange,
  initialKind,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialKind?: string
}) {
  return (
    <HomeWidgetDialog open={open} onOpenChange={onOpenChange} title="Widget gallery" className="home-widget-catalog vdg-dialog">
      <WidgetGallery open={open} initialKind={initialKind} />
    </HomeWidgetDialog>
  )
}
