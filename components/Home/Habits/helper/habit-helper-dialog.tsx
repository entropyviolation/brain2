/**
 * components/Home/Habits/helper/habit-helper-dialog.tsx — Chat with the Daily Habit Helper
 *
 * Opening it lists today's open habits with a nudge each and may ask why one keeps being missed. Tell it
 * what you did or didn't do; it proposes cell changes (`ProposalTable`), and nothing is written until
 * Accept. Enter sends, Shift+Enter is a new line. The flow is `lib/habit-helper/`, tuned in `/lab/habit-helper`.
 */
"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useHabitHelper } from "@/lib/habit-helper/store"
import { ProposalTable } from "./proposal-table"
import { ReasonsView } from "./reasons-view"

const TRY = [
  "daily habits completed - drank water, read 10 pages, stretched",
  "I didn't go outside today because I woke up too late and it was dark",
  "Give relevant shorthand names to all of my daily habits that don't already have them",
  "what's left today?",
]

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

export function HabitHelperDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const lines = useHabitHelper((s) => s.lines)
  const busy = useHabitHelper((s) => s.busy)
  const pending = useHabitHelper((s) => s.pending)
  const send = useHabitHelper((s) => s.send)
  const greet = useHabitHelper((s) => s.open)
  const clear = useHabitHelper((s) => s.clear)
  const [draft, setDraft] = useState("")
  const [reasonsFor, setReasonsFor] = useState<string | null>(null)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) greet()
  }, [open, greet])
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [lines.length, busy, open])

  const submit = (text = draft) => {
    if (!text.trim() || busy) return
    void send(text)
    if (text === draft) setDraft("")
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hh-dialog" data-ui-name="Habit Helper" data-ui-docs="components/Home/Habits/helper/README.md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <header className="hh-head">
          <span className="hh-lamp" data-busy={busy ? "1" : "0"} aria-hidden />
          <DialogTitle>Habit Helper</DialogTitle>
          <DialogDescription className="hh-sub">Say what you did or didn't do. It proposes the changes; nothing is saved until you accept.</DialogDescription>
          <span className="hh-doors">
            <a className="hh-cap" href="/lab/habit-helper" title="Edit and test the Helper's prompt and routing">Flow lab</a>
            {lines.length ? (
              <button type="button" className="hh-cap" data-no95="" onClick={clear}>Clear</button>
            ) : null}
          </span>
        </header>
        <div className="hh-log" ref={log} aria-live="polite">
          {lines.length <= 1 ? (
            <div className="hh-empty">
              {TRY.map((t) => (
                <button key={t} type="button" className="hh-chip" data-no95="" onClick={() => setDraft(t)}>{t}</button>
              ))}
            </div>
          ) : null}
          {lines.map((l) => (
            <div key={l.id} className="hh-line" data-who={l.who} data-why={l.why ? "1" : undefined}>
              <div className="hh-bubble">
                <span className="hh-who">
                  {l.who === "you" ? "YOU" : "HELPER"} · {clock(l.at)}
                  {l.who === "helper" && l.ms ? ` · ${(l.ms / 1000).toFixed(1)}s${l.model ? ` · ${l.model}` : l.route === "log" ? " · rules" : ""}` : ""}
                </span>
                <p>{l.text}</p>
                {l.why && pending?.habitId === l.why.habitId && pending.day === l.why.day ? (
                  <button type="button" className="hh-link" data-no95="" disabled={busy} onClick={() => submit("skip")}>Skip this question</button>
                ) : null}
                {l.reasonsFor ? (
                  <button type="button" className="hh-link" data-no95="" onClick={() => setReasonsFor(l.reasonsFor!)}>Open Reasons</button>
                ) : null}
              </div>
              {l.who === "helper" ? <ProposalTable line={l} onReasons={setReasonsFor} /> : null}
            </div>
          ))}
          {busy ? <div className="hh-line" data-who="helper"><div className="hh-bubble hh-thinking" aria-label="Thinking"><i /><i /><i /></div></div> : null}
        </div>
        {reasonsFor ? <ReasonsView habitId={reasonsFor} onClose={() => setReasonsFor(null)} /> : null}
        <div className="hh-compose">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder={pending ? "Why it was missed, in your words… (or “skip”)" : "drank water, read 10 pages, stretched…"}
            aria-label="Tell the Habit Helper what you did"
          />
          <button type="button" className="hh-cap hh-go" data-no95="" disabled={busy || !draft.trim()} onClick={() => submit()}>Send</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
