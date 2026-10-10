/**
 * components/header-reminder-bell.tsx — Header bell for current reminders
 *
 * Icon key on the System cluster. The orange count is undismissed persistent
 * reminders that are due now. Zero hides the banner; the bell stays.
 * The dialog lists name, when, and source (the Reminders list), opens the
 * existing item detail view, and Dismiss. Dismiss is not delete.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { currentReminders, dismissReminder } from "@/lib/reminders"
import { useTaskStore } from "@/lib/task-store"
import "./shell-chrome.css"

export function HeaderReminderBell({ onTaskSelect }: { onTaskSelect: (taskId: string) => void }) {
  const tasks = useTaskStore((state) => state.tasks)
  const lists = useTaskStore((state) => state.lists)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, 15_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  const rows = useMemo(() => currentReminders(tasks, lists, now), [tasks, lists, now])
  const count = rows.length
  const label = count > 0 ? `Reminders, ${count} current` : "Reminders"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="b2-shell-icon b2-reminder-bell"
          data-testid="reminder-bell"
          aria-label={label}
          title={count > 0 ? `${count} current reminder${count === 1 ? "" : "s"}` : "Reminders"}
        >
          <Bell />
          {count > 0 ? (
            <span className="b2-reminder-count" data-testid="reminder-bell-count" aria-hidden="true">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="hpp95 hpp95-dialog b2-reminder-dialog sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        data-ui-name="Reminders"
        data-ui-docs="components/README.md"
      >
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle>Reminders</DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            Due now and still on the bell. Dismiss hides this time. The reminder stays on the list.
          </DialogDescription>
        </DialogHeader>
        <div className="hpp-body b2-reminder-list">
          {rows.length === 0 ? (
            <p className="b2-reminder-empty">No current reminders.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="b2-reminder-row" data-testid="reminder-bell-row">
                <div className="b2-reminder-copy">
                  <div className="b2-reminder-name">{row.name}</div>
                  <div className="b2-reminder-when">{row.whenLabel}</div>
                  <div className="b2-reminder-source">Source · {row.source}</div>
                </div>
                <div className="b2-reminder-actions">
                  <button
                    type="button"
                    className="hpp-key-go"
                    onClick={() => {
                      setOpen(false)
                      onTaskSelect(row.id)
                    }}
                  >
                    Details
                  </button>
                  <button type="button" onClick={() => dismissReminder(row.id)}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
