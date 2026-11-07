/**
 * components/inbox/helper/inbox-helper-dialog.tsx — The Inbox Helper BIMBY
 *
 * Opened by the foot key. **Ask** reads the checked ideas (or every idea in view)
 * one at a time (`lib/inbox-bimby/`). Each idea gets: lists it would fit (File),
 * items it repeats or sits close to (Merge into), and questions that would make it
 * clear (Clarify). Nothing changes until a key is pressed; File and Merge are one
 * undo step. ✗ drops a suggestion.
 */
"use client"

import { Square, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HELPER_BATCH, runInboxHelper, stopInboxHelper, useInboxHelperStore } from "@/lib/inbox-bimby/store"
import type { FileGuess, MatchGuess } from "@/lib/inbox-bimby/types"
import { itemTitle } from "@/lib/item-utils"
import type { Task } from "@/lib/types"

export function InboxHelperDialog({
  open,
  onClose,
  targets,
  tasks,
  onFile,
  onMerge,
  onClarify,
}: {
  open: boolean
  onClose: () => void
  /** The ideas to ask about: the checked ones, else every idea in view. */
  targets: Task[]
  tasks: readonly Task[]
  onFile: (task: Task, guess: FileGuess) => void
  onMerge: (task: Task, guess: MatchGuess) => void
  onClarify: (task: Task) => void
}) {
  const suggestions = useInboxHelperStore((s) => s.suggestions)
  const run = useInboxHelperStore((s) => s.run)
  const drop = useInboxHelperStore((s) => s.drop)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const rows = targets
    .map((t) => ({ task: t, sug: suggestions[t.id] }))
    .filter((r) => r.sug && byId.has(r.task.id))
  const unasked = targets.filter((t) => !suggestions[t.id])
  const empty = (s: NonNullable<(typeof rows)[number]["sug"]>) => !s.files.length && !s.matches.length && !s.questions.length

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="inbox-dialog inbox-helper fm98-dialog sm:max-w-2xl max-h-[80vh] flex flex-col" data-ui-name="Inbox Helper BIMBY">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Inbox helper
          </DialogTitle>
          <DialogDescription>
            Suggests where each idea goes, what it repeats, and what to clarify. Nothing changes until you press a key.
          </DialogDescription>
        </DialogHeader>
        <div className="inbox-helper-bar">
          {run ? (
            <>
              <span>
                Reading {Math.min(run.done + 1, run.total)} of {run.total}
                {run.failed ? ` · ${run.failed} failed` : ""}
              </span>
              <Button variant="outline" className="inbox-link-guess-short" onClick={stopInboxHelper}>
                <Square className="h-3 w-3" /> Stop
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="inbox-cap-primary"
                disabled={unasked.length === 0 && targets.length === 0}
                onClick={() => void runInboxHelper((unasked.length ? unasked : targets).map((t) => t.id))}
              >
                {unasked.length === 0 && rows.length > 0 ? "Ask again" : rows.length ? `Ask about ${Math.min(unasked.length, HELPER_BATCH)} more` : `Ask about ${Math.min(targets.length, HELPER_BATCH)}`}
              </Button>
              <span className="inbox-helper-note">
                {targets.length > HELPER_BATCH ? `${HELPER_BATCH} at a time. ` : ""}
                {rows.length} read · {targets.length} in scope
              </span>
            </>
          )}
        </div>
        <div className="inbox-helper-rows">
          {rows.length === 0 && !run ? <p className="inbox-helper-note">Press Ask to read the ideas in scope.</p> : null}
          {rows.map(({ task, sug }) => (
            <section key={task.id} className="inbox-helper-row" data-ui-name="Inbox helper idea">
              <header>
                <strong>{itemTitle(task) || "Untitled"}</strong>
                <button type="button" className="inbox-helper-x" title="Drop these suggestions" onClick={() => drop(task.id)}>
                  <X className="h-3 w-3" />
                </button>
              </header>
              {empty(sug!) ? <p className="inbox-helper-note">Nothing to suggest{sug!.fallback ? ` (${sug!.fallback})` : ""}.</p> : null}
              {sug!.matches.map((m) => (
                <div key={m.id} className="inbox-helper-line">
                  <span>
                    <b>{m.relation === "duplicate" ? "Duplicate of" : "Close to"}</b> “{m.name}”{" "}
                    <i>{m.where === "inbox" ? "in Inbox" : "filed"}</i>
                    {m.why ? <em> — {m.why}</em> : null}
                  </span>
                  <Button variant="outline" className="inbox-link-guess-short" onClick={() => onMerge(task, m)} title="Fold this idea into that one. Undo with Cmd/Ctrl-Z.">
                    Merge into
                  </Button>
                </div>
              ))}
              {sug!.files.map((f) => (
                <div key={f.listId} className="inbox-helper-line">
                  <span>
                    <b>File to</b> “{f.name}”{f.why ? <em> — {f.why}</em> : null}
                  </span>
                  <Button variant="outline" className="inbox-link-guess-short" onClick={() => onFile(task, f)} title="Add that list and take the idea out of the Inbox">
                    File
                  </Button>
                </div>
              ))}
              {sug!.questions.length ? (
                <div className="inbox-helper-line">
                  <span>
                    <b>Clarify</b> {sug!.questions.join(" ")}
                  </span>
                  <Button variant="outline" className="inbox-link-guess-short" onClick={() => onClarify(task)}>
                    Clarify
                  </Button>
                </div>
              ) : null}
            </section>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
