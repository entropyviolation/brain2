/**
 * components/inbox/link-guess.tsx — The Link BIMBY on the Links tab
 *
 * `useLinkGuesser` reads one link (`/api/link-peek?watch=1`: page, speech, on-screen
 * text), shortlists lists and items, and asks the local model what the link is a
 * resource for (`lib/link-bimby/`). `guessAll` walks a queue one link at a time and can
 * be stopped. The queue lives at module level, so closing the Inbox does not stop it.
 * Guess all is a batch: the Mac never uses the Instagram sign-in for it, only cached watches.
 *
 * `LinkGuessStrip` paints a reading under the row's note: a gist line, up to three
 * guesses with why and how, ✓ / ✗ per guess, **Use**, and a comment box. Verdicts and
 * comments are fed back into later prompts (`lib/link-bimby/feedback.ts`).
 * `LinkGuessBar` is the tab's Guess all / Stop key, progress, and review tally.
 */
"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { Check, Sparkles, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { embedScores, ollamaCall } from "@/lib/bim-flow/ollama"
import { guessKey, tally } from "@/lib/link-bimby/feedback"
import { peekLink } from "@/lib/link-bimby/peek"
import { reviewedReadings, useLinkBimbyStore } from "@/lib/link-bimby/store"
import { guessLink } from "@/lib/link-bimby/suggest"
import type { LinkGuess, LinkReading } from "@/lib/link-bimby/types"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

// ---- One shared queue -------------------------------------------------------

interface QueueState {
  busy: Record<string, string>
  run: { done: number; total: number; failed: number } | null
}

/** On `globalThis`, so a hot reload of this file does not orphan a running pass. */
interface Queue {
  state: QueueState
  stop: boolean
  listeners: Set<() => void>
}
const holder = globalThis as typeof globalThis & { __linkBimbyQueue?: Queue }
const queue: Queue = (holder.__linkBimbyQueue ??= { state: { busy: {}, run: null }, stop: false, listeners: new Set() })
const getState = () => queue.state
const emit = (next: Partial<QueueState>) => {
  queue.state = { ...queue.state, ...next }
  queue.listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  queue.listeners.add(l)
  return () => queue.listeners.delete(l)
}

function mark(id: string, step: string | null) {
  const { [id]: _gone, ...rest } = getState().busy
  emit({ busy: step ? { ...rest, [id]: step } : rest })
}

async function guessOne(task: Task, opts: { batch?: boolean } = {}): Promise<boolean> {
  if (!task.savedLink || getState().busy[task.id]) return false
  mark(task.id, "Watching the link (a new reel can take a minute or two)…")
  try {
    const peek = await peekLink(task.savedLink.url, { watch: true, batch: opts.batch })
    mark(task.id, "Thinking…")
    const crew = await chatCrew().catch(() => null)
    const { tasks, lists } = useTaskStore.getState()
    const live = tasks.find((t) => t.id === task.id) ?? task
    const reading = await guessLink({
      link: live,
      tasks,
      lists,
      peek,
      call: crew ? ollamaCall(crew.main) : null,
      ladder: crew?.pick ?? [],
      embed: (q, texts) => embedScores(q, texts),
      reviewed: reviewedReadings(),
    })
    useLinkBimbyStore.getState().put(reading)
    return true
  } catch {
    return false
  } finally {
    mark(task.id, null)
  }
}

/** Guess each link in order, one at a time. Links still on the Links tab only. */
async function guessAll(links: Task[]) {
  if (getState().run) return
  queue.stop = false
  emit({ run: { done: 0, total: links.length, failed: 0 } })
  for (const task of links) {
    if (queue.stop) break
    const stillThere = useTaskStore.getState().tasks.find((t) => t.id === task.id && t.stage === "inbox" && t.savedLink)
    const ok = stillThere ? await guessOne(stillThere, { batch: true }) : true
    const run = getState().run!
    emit({ run: { ...run, done: run.done + 1, failed: run.failed + (ok ? 0 : 1) } })
  }
  emit({ run: null })
}

export function useLinkGuesser() {
  const snap = useSyncExternalStore(subscribe, getState, getState)
  return {
    guess: (task: Task) => void guessOne(task),
    guessAll: (queue: Task[]) => void guessAll(queue),
    stop: () => {
      queue.stop = true
    },
    busy: snap.busy,
    run: snap.run,
  }
}

// ---- The tab's bar ---------------------------------------------------------

export function LinkGuessBar({
  links,
  reviewOnly,
  onReviewOnly,
}: {
  links: Task[]
  reviewOnly: boolean
  onReviewOnly: (on: boolean) => void
}) {
  const { guessAll: start, stop, run } = useLinkGuesser()
  const readings = useLinkBimbyStore((s) => s.readings)
  const mine = links.map((t) => readings[t.id]).filter((r): r is LinkReading => Boolean(r))
  const unread = links.filter((t) => !readings[t.id])
  const t = tally(mine)
  const toReview = mine.length - t.reviewed
  return (
    <div className="inbox-link-guess-bar" data-ui-name="Link BIMBY bar">
      {run ? (
        <>
          <span className="inbox-link-guess-run">
            Guessing {Math.min(run.done + 1, run.total)} of {run.total}
            {run.failed ? ` · ${run.failed} failed` : ""}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={stop} title="Stop after the link being read">
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        </>
      ) : (
        <>
          <Button type="button" variant="outline" size="sm" disabled={!unread.length} onClick={() => start(unread)} title="Guess every link that has no guess yet, one at a time">
            <Sparkles className="h-4 w-4" />
            Guess all {unread.length ? `(${unread.length})` : ""}
          </Button>
          {unread.length === 0 && links.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => start(links)} title="Guess every link again (reviewed guesses are kept as lessons)">
              Redo all
            </Button>
          )}
        </>
      )}
      <span className="inbox-link-guess-tally">
        {mine.length} guessed · {t.reviewed} reviewed · {t.approved} ✓ · {t.rejected} ✗ · {t.comments} comments
      </span>
      <button type="button" className="inbox-link-guess-filter" aria-pressed={reviewOnly} onClick={() => onReviewOnly(!reviewOnly)}>
        To review <i>{toReview}</i>
      </button>
    </div>
  )
}

// ---- One reading -----------------------------------------------------------

const pct = (n: number) => `${Math.round(n * 100)}%`

function CommentBox({ reading }: { reading: LinkReading }) {
  const setComment = useLinkBimbyStore((s) => s.setComment)
  const saved = reading.review?.comment ?? ""
  const [draft, setDraft] = useState(saved)
  useEffect(() => setDraft(saved), [saved])
  const save = () => {
    if (draft.trim() !== saved) setComment(reading.taskId, draft)
  }
  return (
    <textarea
      className="inbox-link-guess-comment"
      rows={1}
      value={draft}
      placeholder="Comment for the BIMBY: what's wrong, what it's really for…"
      aria-label="Comment on this guess"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          save()
          ;(e.target as HTMLTextAreaElement).blur()
        } else if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          setDraft(saved)
        }
      }}
    />
  )
}

export function LinkGuessStrip({
  reading,
  onUse,
  onAgain,
}: {
  reading: LinkReading
  onUse: (guess: LinkGuess) => void
  onAgain: () => void
}) {
  const drop = useLinkBimbyStore((s) => s.drop)
  const setVerdict = useLinkBimbyStore((s) => s.setVerdict)
  const verdicts = reading.review?.verdicts ?? {}
  const toggle = (key: string, v: "approved" | "rejected") => setVerdict(reading.taskId, key, verdicts[key] === v ? null : v)
  return (
    <div className="inbox-link-guess" data-ui-name="Link BIMBY">
      <div className="inbox-link-guess-head">
        <b>For?</b>
        <span>{reading.gist || (reading.peeked ? "" : "The page could not be read; guessing from the note.")}</span>
        <button type="button" className="inbox-link-guess-x" title="Clear the guess (a reviewed one is kept as a lesson)" aria-label="Clear the guess" onClick={() => drop(reading.taskId)}>
          <X className="h-3 w-3" />
        </button>
      </div>
      {reading.guesses.length === 0 ? (
        <p className="inbox-link-guess-none">No good fit in Brain2 yet.</p>
      ) : (
        <ul>
          {reading.guesses.map((g) => {
            const key = guessKey(g)
            const v = verdicts[key]
            return (
              <li key={key} data-verdict={v ?? "none"}>
                <span className="inbox-link-guess-kind" data-kind={g.kind}>
                  {g.kind === "list" ? "List" : "Item"}
                </span>
                <span className="inbox-link-guess-text">
                  <b>{g.name}</b>
                  {g.use && <span> — {g.use}</span>}
                  {g.why && <em>{g.why}</em>}
                </span>
                <span className="inbox-link-guess-sure" title="How sure">
                  {pct(g.sure)}
                </span>
                <span className="inbox-link-guess-verdict">
                  <button data-no95 className="inbox-link-guess-v" data-v="approved" type="button" aria-pressed={v === "approved"} title="Approve: right place" aria-label={`Approve ${g.name}`} onClick={() => toggle(key, "approved")}>
                    <Check className="h-3 w-3" />
                  </button>
                  <button data-no95 className="inbox-link-guess-v" data-v="rejected" type="button" aria-pressed={v === "rejected"} title="Reject: wrong place" aria-label={`Reject ${g.name}`} onClick={() => toggle(key, "rejected")}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
                <button
                  type="button"
                  className="inbox-link-guess-use"
                  title={g.kind === "list" ? `Approve, add to ${g.name} and file` : `Approve, tie to “${g.name}” and file into its lists`}
                  onClick={() => {
                    setVerdict(reading.taskId, key, "approved")
                    onUse(g)
                  }}
                >
                  Use
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <CommentBox reading={reading} />
      <div className="inbox-link-guess-foot">
        {reading.watched ? "watched the video · " : reading.watchError ? `video not watched: ${reading.watchError} · ` : ""}
        {reading.by === "model" ? `by ${reading.model ?? "the model"}` : `word match${reading.fallback ? ` (${reading.fallback})` : ""}`}
        {" · "}
        <button type="button" onClick={onAgain}>
          Again
        </button>
      </div>
    </div>
  )
}
