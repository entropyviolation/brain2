/**
 * components/Home/Habits/helper/habit-helper-key.tsx — The Chat key in the Habits header
 *
 * Opens the Daily Habit Helper. The dialog chunk loads on the first press, like the Tracking Helper's key.
 */
"use client"

import { useEffect, useState, type ComponentType } from "react"
import "./habit-helper.css"

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

export function HabitHelperKey() {
  const [open, setOpen] = useState(false)
  const [Dialog, setDialog] = useState<ComponentType<DialogProps> | null>(null)

  useEffect(() => {
    if (!open || Dialog) return
    let live = true
    void import("./habit-helper-dialog").then((mod) => {
      if (live) setDialog(() => mod.HabitHelperDialog)
    })
    return () => {
      live = false
    }
  }, [open, Dialog])

  return (
    <>
      <button type="button" className="habit-chrome-btn hh-key" data-ui-name="Habit Helper" aria-label="Open the Habit Helper chat" title="Habit Helper: tell it what you did or didn't do" onClick={() => setOpen(true)}>
        Chat
      </button>
      {Dialog ? <Dialog open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
