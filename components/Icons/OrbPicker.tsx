"use client"

import type React from "react"
import { useMemo, useRef, useState } from "react"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { removeBackground } from "@/lib/remove-background"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ORB_PATHS } from "./icon-registry"

export interface OrbPickerDialogProps {
  open: boolean
  current?: string
  onClose: () => void
  onSelect: (icon: string | undefined) => void
}

export function OrbPickerDialog({ open, current, onClose, onSelect }: OrbPickerDialogProps) {
  const iconLibrary = useListsUiStore((s) => s.iconLibrary)
  const addLibraryIcon = useListsUiStore((s) => s.addLibraryIcon)
  const removeLibraryIcon = useListsUiStore((s) => s.removeLibraryIcon)
  const hiddenGalleryOrbs = useListsUiStore((s) => s.hiddenGalleryOrbs)
  const hideGalleryOrb = useListsUiStore((s) => s.hideGalleryOrb)
  const restoreGalleryOrb = useListsUiStore((s) => s.restoreGalleryOrb)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [search, setSearch] = useState("")

  const visibleGalleryOrbs = useMemo(() => {
    const base = ORB_PATHS.filter((url) => !hiddenGalleryOrbs.includes(url))
    if (!search.trim()) return base
    const q = search.trim().toLowerCase()
    return base.filter((url) => url.toLowerCase().includes(q))
  }, [hiddenGalleryOrbs, search])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await removeBackground(file, { threshold: 60, size: 256 })
      addLibraryIcon(dataUrl)
      onSelect(dataUrl)
    } catch (err) {
      console.error("Background removal failed", err)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="fm98-dialog sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose an Icon</DialogTitle>
          <DialogDescription>
            Pick an orb, use one you uploaded, or upload your own (its background is removed automatically).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => onSelect(undefined)}>
            Use random orb
          </Button>
          <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Processing…" : "Upload orb"}
          </Button>
          <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode((v) => !v)}>
            {editMode ? "Done editing" : "Edit gallery"}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
        </div>

        <input
          className="fm-input mb-2"
          placeholder="Search orbs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search orbs"
        />

        <div className="flex-1 overflow-y-auto space-y-3">
          {iconLibrary.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1">Your library</p>
              <div className="grid grid-cols-6 gap-2">
                {iconLibrary.map((url) => (
                  <div key={url} className="relative group">
                    <button
                      className={`w-full aspect-square border rounded-md p-1 flex items-center justify-center ${
                        current === url ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => onSelect(url)}
                    >
                      <img src={url} alt="" className="max-w-full max-h-full object-contain" role="img" />
                    </button>
                    <button
                      className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 text-[10px] hidden group-hover:flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeLibraryIcon(url)
                      }}
                      title="Remove from library"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold mb-1">
              Orb gallery ({visibleGalleryOrbs.length})
              {editMode && <span className="font-normal text-muted-foreground"> — click an orb to remove it</span>}
            </p>
            <div className="grid grid-cols-6 gap-2">
              {visibleGalleryOrbs.map((url) => (
                <div key={url} className="relative group">
                  <button
                    className={`w-full aspect-square border rounded-md p-1 flex items-center justify-center ${
                      current === url ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => (editMode ? hideGalleryOrb(url) : onSelect(url))}
                  >
                    <img src={url} alt="" className="max-w-full max-h-full object-contain" role="img" />
                  </button>
                  {editMode && (
                    <button
                      className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation()
                        hideGalleryOrb(url)
                      }}
                      title="Remove from gallery"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {hiddenGalleryOrbs.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold mb-1">Hidden ({hiddenGalleryOrbs.length})</p>
                <div className="flex flex-wrap gap-2">
                  {hiddenGalleryOrbs.map((url) => (
                    <button
                      key={url}
                      className="text-xs underline text-muted-foreground"
                      onClick={() => restoreGalleryOrb(url)}
                    >
                      Restore {url.split("/").pop()?.slice(0, 8)}…
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
