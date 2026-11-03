/**
 * components/Home/Tracking/helper/tracking-helper-dialog.tsx — Chat with the Tracking Helper
 *
 * Tell it what you did and roughly when; it proposes Activity and Location blocks (`ProposalBoard`).
 * Enter sends, Shift+Enter is a new line. The flow behind it is `lib/tracking-helper/`, tuned in
 * `/lab/tracking-helper`. A correction ("actually the walk ended at 4:45") re-reads the account on screen.
 */
"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useTrackingHelper } from "@/lib/tracking-helper/store"
import { ProposalBoard } from "./proposal-board"

const TRY = [
  "Friday I walked Ocean Beach from 4:30 to about 5, then did dishes until 6:19",
  "yesterday scrolled from 9 to 10:15, then worked on foxtide until noon",
]

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

export function TrackingHelperDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const lines = useTrackingHelper((s) => s.lines)
  const busy = useTrackingHelper((s) => s.busy)
  const send = useTrackingHelper((s) => s.send)
  const clear = useTrackingHelper((s) => s.clear)
  const [draft, setDraft] = useState("")
  const log = useRef<HTMLDivElement>(null)

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
      <DialogContent className="th-dialog" data-ui-name="Tracking Helper" data-ui-docs="components/Home/Tracking/helper/README.md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <header className="th-head">
          <span className="th-lamp" data-busy={busy ? "1" : "0"} aria-hidden />
          <DialogTitle>Tracking Helper</DialogTitle>
          <DialogDescription className="th-sub">Say what you did and roughly when. It proposes the blocks; nothing is saved until you add it.</DialogDescription>
          <span className="th-doors">
            <a className="th-key" data-no95="" href="/lab/tracking-helper" title="Edit and test the Helper's prompts and routing">Flow lab</a>
            {lines.length ? (
              <button type="button" className="th-key" data-no95="" onClick={clear}>Clear</button>
            ) : null}
          </span>
        </header>
        <div className="th-log" ref={log} aria-live="polite">
          {!lines.length ? (
            <div className="th-empty">
              <p>Try one of these, or tell it about a whole afternoon, or several days at once.</p>
              {TRY.map((t) => (
                <button key={t} type="button" className="th-chip" data-no95="" onClick={() => setDraft(t)}>{t}</button>
              ))}
            </div>
          ) : null}
          {lines.map((l) => (
            <div key={l.id} className="th-line" data-who={l.who}>
              <div className="th-bubble">
                <span className="th-who">{l.who === "you" ? "YOU" : "HELPER"} · {clock(l.at)}{l.who === "helper" && l.ms ? ` · ${(l.ms / 1000).toFixed(1)}s${l.model ? ` · ${l.model}` : l.route === "log" || l.route === "revise" ? " · rules" : ""}` : ""}</span>
                <p>{l.text}</p>
              </div>
              {l.who === "helper" ? <ProposalBoard line={l} /> : null}
            </div>
          ))}
          {busy ? <div className="th-line" data-who="helper"><div className="th-bubble th-thinking" aria-label="Thinking"><i /><i /><i /></div></div> : null}
        </div>
        <div className="th-compose">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            rows={3}
            placeholder="On Friday I was walking around Ocean Beach from about 4:30 until 5…"
            aria-label="Tell the Tracking Helper what you did"
          />
          <button type="button" className="th-key th-key-go th-send" data-no95="" disabled={busy || !draft.trim()} onClick={() => submit()}>Send</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
