/**
 * components/Home/Habits/gem-picker.tsx — Gem gallery like the orb picker
 *
 * Slot overrides live in Settings (furniture marks). Per-habit gems use the
 * full folder catalog plus an upload, persisted on `WeeklyTask.gem`. New habits
 * start with a random catalog stone, not a type default.
 */
"use client"

import { useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GEM_PATHS } from "@/lib/gems-manifest"
import { HABIT_GEM_SLOT_LABELS, defaultHabitGem, type HabitGemSlot } from "@/lib/habit-gems"
import { useHabitsStore } from "@/lib/habits-store"
import { resolveHabitGem } from "@/lib/habit-gems"
import { removeBackground } from "@/lib/remove-background"
import { HabitGemImg } from "@/components/Home/Habits/habit-gems"

function GemGallery({
  current,
  onPick,
}: {
  current: string | null
  onPick: (url: string) => void
}) {
  return (
    <div className="hab-gem-picker-grid" role="listbox" aria-label="Gem gallery">
      {GEM_PATHS.map((url) => (
        <button
          key={url}
          type="button"
          role="option"
          aria-selected={current === url}
          className={`hab-gem-picker-hit${current === url ? " is-on" : ""}`}
          onClick={() => onPick(url)}
        >
          <HabitGemImg src={url} width={40} height={40} />
        </button>
      ))}
    </div>
  )
}

export function HabitGemChooser({
  value,
  fallback,
  onChange,
  label = "Habit gem",
}: {
  value?: string | null
  fallback: string
  onChange: (next: string | null) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const current = value || fallback

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      onChange(await removeBackground(file, { threshold: 60, size: 256 }))
      setOpen(false)
    } catch (error) {
      console.error("Habit gem upload failed", error)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="hab-gem-chooser">
      <div className="hab-gem-chooser-row">
        <HabitGemImg src={current} className="hab-gem-slot-swatch" width={28} height={28} />
        <button type="button" className="habit-chrome-btn" onClick={() => setOpen(true)}>
          Change gem
        </button>
        {value ? (
          <button type="button" className="habit-chrome-btn" onClick={() => onChange(null)}>
            Random gem
          </button>
        ) : null}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">
            Pick a catalog stone or upload a cutout, same as the WILLPOWER orb.
          </p>
          <div className="hab-gem-chooser-row mb-2">
            <button
              type="button"
              className="habit-chrome-btn"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Processing…" : "Upload gem"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
          <GemGallery
            current={current}
            onPick={(url) => {
              onChange(url)
              setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function HabitGemSettingsField() {
  const habitGems = useHabitsStore((s) => s.habitGems)
  const setHabitGem = useHabitsStore((s) => s.setHabitGem)
  const [open, setOpen] = useState<HabitGemSlot | null>(null)
  const current = open ? resolveHabitGem(open, habitGems[open]) : null

  return (
    <div className="hab-gem-settings space-y-3">
      <p className="text-xs text-muted-foreground">
        Photographed gems from the catalog (same cutout pipeline as orbs). Pick one per mark.
      </p>
      <div className="hab-gem-slots">
        {(Object.keys(HABIT_GEM_SLOT_LABELS) as HabitGemSlot[]).map((slot) => (
          <div key={slot} className="hab-gem-slot">
            <HabitGemImg src={resolveHabitGem(slot, habitGems[slot])} className="hab-gem-slot-swatch" width={28} height={28} />
            <div>
              <div className="text-xs font-semibold">{HABIT_GEM_SLOT_LABELS[slot]}</div>
              <button type="button" className="habit-chrome-btn" onClick={() => setOpen(slot)}>
                Change gem
              </button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{open ? `Choose ${HABIT_GEM_SLOT_LABELS[open]} gem` : "Choose gem"}</DialogTitle>
          </DialogHeader>
          {open ? (
            <button
              type="button"
              className="habit-chrome-btn mb-2"
              onClick={() => {
                setHabitGem(open, null)
                setOpen(null)
              }}
            >
              Use default
            </button>
          ) : null}
          <GemGallery
            current={current}
            onPick={(url) => {
              if (!open) return
              setHabitGem(open, url)
              setOpen(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function habitGemDefaultForTests(slot: HabitGemSlot): string {
  return defaultHabitGem(slot)
}
