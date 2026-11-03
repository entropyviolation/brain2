/**
 * components/Bim/console/bim-console.tsx — BIM Chat console on the desktop
 *
 * A silver handheld with CRT glass wells (`bim-console.css`, ink from `components/Bim/bim-ink.css`):
 * tab keys, the chat glass with a compose well, and BIM's dossier card with a pixel face. Digits 1–9
 * pick a numbered answer while a question is open. CHAT, LOG, COMMANDS (filterable), and LLM (week
 * suggestions, then a door to `/lab/bim-flow`) are live. GRAPH, ACTIONS, and RULES are **Planned**:
 * they say what they will show once BIM reads the knowledge graph and a model.
 * Every line runs through the Telegram bot's executor (`lib/ingest/bim-chat.ts`). The MODE switch on
 * top of the chat picks plain routing or the local models; BIM checks in ("ask me", and on open).
 */
"use client"

import { Fragment, memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { ArrowUp, Paperclip } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { KeycapClose } from "@/components/keycap-close"
import { BIM_FULL, BIM_HANDLE, BIM_INTRO, BIM_SHORT } from "@/lib/ingest/bim"
import { BIM_CHAT_ID, useBimChatStore, type BimLine } from "@/lib/ingest/bim-chat"
import { ALL_COMMANDS } from "@/lib/ingest/command-glossary"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { useBimLlmMode } from "@/lib/ingest/bim-switchboard"
import { SecretsToggle } from "@/components/Secrets/SecretsToggle"
import { BIM_QUICK, openChoices, useBimChat } from "@/components/Bim/use-bim-chat"
import { LlmSuggestions } from "./llm-suggestions"
import "@/components/Bim/bim-ink.css"
import "./bim-console.css"

const TABS = ["chat", "log", "commands", "llm", "graph", "actions", "rules"] as const
type ConsoleTab = (typeof TABS)[number]

const PLANNED: Partial<Record<ConsoleTab, string>> = {
  graph: "Knowledge graph. Items, people, and links BIM can name and walk from a chat line.",
  actions: "Actions. What BIM did for you, and what he proposes to do, each one approvable.",
  rules: "Rules. Standing instructions BIM follows when a message or a time matches.",
}

/** Sentences to start from. They fill the message well; the person finishes and sends. */
const TRY = ["info", "groc milk eggs", "gm", "log: walked the dog"] as const

/** A touch phone opens the keycap deck on focus; let the person tap the field instead of focusing it on open. */
function touchFirst(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches
}

function clock(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/** The chat history. Memoized: a keystroke in the well does not repaint every line under the glass. */
const ChatLog = memo(function ChatLog({ lines, busy, onTry }: { lines: BimLine[]; busy: boolean; onTry: (text: string) => void }) {
  return (
    <>
      {lines.length === 0 ? (
        <div className="bim-empty">
          <p className="bim-legend">BIM · listening</p>
          <p>Type what you would text me. Tap one to start from it:</p>
          <div className="bim-chips" aria-label="Examples">
            {TRY.map((word) => (
              <button data-no95 key={word} type="button" onClick={() => onTry(word)}>
                {word}
              </button>
            ))}
          </div>
        </div>
      ) : (
        lines.map((line) => (
          <div key={line.id} className={`bim-msg is-${line.who}${line.status === "error" ? " is-error" : ""}`}>
            <span className="bim-msg-who">
              {line.who === "you" ? "YOU" : "BIM"} {clock(line.at)}
            </span>
            <p className="bim-msg-text">{line.text}</p>
            {line.route ? <span className="bim-msg-route">{line.route}</span> : null}
            {line.evidence?.length ? (
              <details className="bim-msg-ev">
                <summary>evidence ({line.evidence.length})</summary>
                {line.evidence.map((row, i) => <p key={i}>{row}</p>)}
              </details>
            ) : null}
          </div>
        ))
      )}
      {busy ? (
        <div className="bim-msg is-bim">
          <span className="bim-msg-who">BIM</span>
          <span className="bim-wait" role="status" aria-label="BIM is working">
            <i />
            <i />
            <i />
          </span>
        </div>
      ) : null}
    </>
  )
})

function ChatPane() {
  const { lines, busy, draft, setDraft, submit, onKeyDown, clear, checkIn, logRef, llm, setLlm, photos, addPhotos, removePhoto, photoError } = useBimChat()
  const choices = openChoices(lines)
  const box = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  /** While a question is open and nothing is typed, a digit taps that numbered answer. */
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!draft && /^[1-9]$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const pick = choices[Number(event.key) - 1]
      if (pick) {
        event.preventDefault()
        submit(pick.text)
        return
      }
    }
    onKeyDown(event)
  }

  const startWith = useCallback(
    (text: string) => {
      setDraft(text)
      box.current?.focus()
    },
    [setDraft],
  )

  return (
    <div className="bim-crt-pane">
      <ModeSwitch llm={llm} setLlm={setLlm} />
      <div className="bim-glass bim-scroll" ref={logRef} role="log" aria-live="polite">
        <ChatLog lines={lines} busy={busy} onTry={startWith} />
      </div>
      <div className="bim-compose">
        <div className="bim-glass bim-well">
          {choices.length ? (
            <div className="bim-chips" aria-label="Answers">
              {choices.map((choice, i) => (
                <button data-no95 key={choice.text + choice.label} type="button" onClick={() => submit(choice.text)}>
                  {i < 9 ? <kbd>{i + 1}</kbd> : null}
                  {choice.label}
                </button>
              ))}
            </div>
          ) : null}
          {photos.length ? (
            <div className="bim-photos" aria-label="Photos to send">
              {photos.map((photo, i) => (
                <span key={i} className="bim-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.dataUrl} alt={photo.name} />
                  <button data-no95 type="button" aria-label={`Remove ${photo.name}`} onClick={() => removePhoto(i)}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {photoError ? <p className="bim-photo-error">{photoError}</p> : null}
          <textarea
            ref={box}
            aria-label="Message BIM"
            value={draft}
            placeholder={photos.length ? "Caption (or leave blank and I will ask)…" : choices.length ? "Type an answer, or press a number…" : "Message BIM…"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKey}
            autoFocus={!touchFirst()}
          />
        </div>
        <div className="bim-send">
          <input ref={fileInput} type="file" accept="image/*" multiple hidden aria-label="Attach photos" onChange={addPhotos} />
          <button data-no95 type="button" className="is-mod" aria-label="Attach photo" disabled={busy} onClick={() => fileInput.current?.click()}>
            <span className="bim-key-word">📷</span>
            <Paperclip className="bim-key-icon" aria-hidden="true" />
          </button>
          <button data-no95 type="button" className="is-primary" aria-label="Send" disabled={busy || (!draft.trim() && !photos.length)} onClick={() => submit()}>
            <span className="bim-key-word">SEND ↵</span>
            <ArrowUp className="bim-key-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="bim-quick" aria-label="Quick commands">
        {BIM_QUICK.map((word) => (
          <button data-no95 key={word} type="button" disabled={busy} onClick={() => submit(word)}>
            {word}
          </button>
        ))}
        <button data-no95 type="button" className="bim-quick-gap" disabled={busy} title="BIM asks what you are doing or how you feel" onClick={() => checkIn()}>
          ask me
        </button>
        <button data-no95 type="button" className="is-mod" onClick={clear} disabled={!lines.length}>
          clear
        </button>
      </div>
    </div>
  )
}

/**
 * How BIM reads a line, on top of the chat where it is seen. ROUTER is the Telegram bot: commands,
 * and plain lines filed by the grammar ladder. LLM adds the local models: questions are answered
 * from your data, and an answer it cannot find becomes a question back to you.
 */
function ModeSwitch({ llm, setLlm }: { llm: boolean; setLlm: (on: boolean) => void }) {
  return (
    <div className="bim-mode" role="radiogroup" aria-label="How BIM reads a line">
      <span className="bim-mode-label">MODE</span>
      <button data-no95 type="button" role="radio" aria-checked={!llm} className={llm ? undefined : "is-on"} onClick={() => setLlm(false)}>
        router
      </button>
      <button data-no95 type="button" role="radio" aria-checked={llm} className={llm ? "is-on" : undefined} onClick={() => setLlm(true)}>
        llm
      </button>
      <span className="bim-mode-says">
        {llm
          ? "Local models answer questions from your data, and ask you when they don't know."
          : "Plain routing, like the Telegram bot: commands run, lines are filed. No models."}
      </span>
      <SecretsToggle surface="chat" label="Include secrets in answers" />
    </div>
  )
}

function LogPane() {
  const events = useIngestStore((s) => s.events)
  const [faultsOnly, setFaultsOnly] = useState(false)
  const mine = useMemo(
    () => events.filter((e) => e.channel === "simulate" && e.chatId === BIM_CHAT_ID && (!faultsOnly || e.status === "error")),
    [events, faultsOnly],
  )
  return (
    <div className="bim-crt-pane">
      <div className="bim-tools">
        <button data-no95 type="button" className={faultsOnly ? "is-on" : undefined} aria-pressed={faultsOnly} onClick={() => setFaultsOnly(!faultsOnly)}>
          errors only
        </button>
      </div>
      <div className="bim-glass bim-scroll">
        {mine.length === 0 ? <p className="bim-dim">{faultsOnly ? "No errors. Good." : "Nothing from BIM chat has been written to the ingest log yet."}</p> : null}
        {mine.map((e) => (
          <p key={e.id} className={`bim-event${e.status === "error" ? " is-error" : ""}`}>
            <small>
              {clock(e.at)} · {e.kind} · {e.status}
            </small>
            {e.summary}
            <span>&gt; {e.raw}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

function CommandsPane() {
  const [query, setQuery] = useState("")
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? ALL_COMMANDS.split("\n").filter((row) => row.toLowerCase().includes(q)).join("\n") : ALL_COMMANDS
  }, [query])
  return (
    <div className="bim-crt-pane">
      <div className="bim-tools">
        <input type="search" aria-label="Filter commands" placeholder="Filter commands…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="bim-glass bim-scroll">
        <pre className="bim-commands">{shown || "No command matches."}</pre>
      </div>
    </div>
  )
}

function Dossier() {
  const pending = useIngestStore((s) => s.pendingByChat[`simulate:${BIM_CHAT_ID}`])
  const count = useIngestStore((s) => s.events.filter((e) => e.chatId === BIM_CHAT_ID).length)
  const busy = useBimChatStore((s) => s.busy)
  const llm = useBimLlmMode((s) => s.on)
  return (
    <aside className="bim-crt-side">
      <div className="bim-glass bim-card">
        <div className={`bim-face${busy ? " is-busy" : ""}`} aria-hidden="true">
          <i />
          <i />
          <b />
        </div>
        <dl>
          <dt>NAME</dt>
          <dd>
            {BIM_SHORT} · {BIM_FULL}
          </dd>
          <dt>TELEGRAM</dt>
          <dd>{BIM_HANDLE}</dd>
          <dt>MODE</dt>
          <dd>{llm ? "LLM · local models" : "router · no models"}</dd>
          <dt>OPEN THREAD</dt>
          <dd>{pending ? (pending.ritual?.flow ?? pending.kind) : "none"}</dd>
          <dt>LOGGED</dt>
          <dd>{count}</dd>
        </dl>
      </div>
      <div className="bim-glass bim-scroll bim-bio">{BIM_INTRO}</div>
    </aside>
  )
}

export function BimConsole({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<ConsoleTab>("chat")
  const planned = PLANNED[tab]
  const busy = useBimChatStore((s) => s.busy)
  const firstSoon = TABS.findIndex((t) => PLANNED[t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bim-crt bim-ink" hideClose>
        <DialogTitle className="sr-only">{BIM_SHORT} Chat</DialogTitle>
        <DialogDescription className="sr-only">{BIM_FULL} console</DialogDescription>
        <div className="bim-crt-top">
          <div className="bim-glass bim-crt-plate">
            <span className={`bim-lamp${busy ? "" : " is-idle"}`} aria-hidden="true" />
            {BIM_SHORT}
          </div>
          <span className="bim-crt-name">{BIM_FULL}</span>
          <KeycapClose className="bim-crt-x" label="Close BIM Chat" onClick={() => onOpenChange(false)} />
        </div>
        <nav className="bim-crt-tabs" aria-label="BIM console tabs">
          {TABS.map((t, i) => (
            <Fragment key={t}>
              {i === firstSoon ? <span className="bim-crt-soon">NOT WIRED YET</span> : null}
              <button
                data-no95
                type="button"
                className={`${t === tab ? "is-on" : ""}${PLANNED[t] ? " is-soon" : ""}`.trim() || undefined}
                aria-pressed={t === tab}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            </Fragment>
          ))}
        </nav>
        <div className="bim-crt-main">
          <div className="bim-crt-left">
            {tab === "chat" ? <ChatPane /> : null}
            {tab === "log" ? <LogPane /> : null}
            {tab === "commands" ? <CommandsPane /> : null}
            {tab === "llm" ? (
              <div className="bim-glass bim-scroll">
                <LlmSuggestions />
                <p className="bim-legend">Flow bench</p>
                <p>Local model gates over BIM text. Writes nothing.</p>
                <button data-no95 type="button" onClick={() => (window.location.href = "/lab/bim-flow/")}>
                  Open flow bench
                </button>
              </div>
            ) : null}
            {planned ? (
              <div className="bim-glass bim-scroll">
                <p className="bim-legend">PLANNED — NOT CONNECTED YET.</p>
                <p className="bim-dim">{planned}</p>
              </div>
            ) : null}
          </div>
          <Dossier />
        </div>
        <div className="bim-foot">
          <span>Enter sends · Shift+Enter new line · 1–9 picks an answer</span>
          <span>Same brain as Telegram</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
