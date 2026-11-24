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

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { ArrowUp, Mic, Paperclip } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { KeycapClose } from "@/components/keycap-close"
import { BIM_CONSOLE_BIO, BIM_FULL, BIM_HANDLE, BIM_SHORT } from "@/lib/ingest/bim"
import { BIM_CHAT_ID, useBimChatStore, type BimLine } from "@/lib/ingest/bim-chat"
import { ConvoKeys, ConvoList } from "../convo-list"
import { ALL_COMMANDS } from "@/lib/ingest/command-glossary"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { useBimLlmMode } from "@/lib/ingest/bim-switchboard"
import { SecretsToggle } from "@/components/Secrets/SecretsToggle"
import { BIM_QUICK, openChoices, useBimChat } from "@/components/Bim/use-bim-chat"
import { ReportCard } from "@/components/Bim/report-card"
import { WireCard } from "@/components/Bim/wire-card"
import { DayCard } from "@/components/Bim/day-card"
import { HabitCard } from "@/components/Bim/habit-card"
import { BimBlob } from "@/components/Bim/bim-blob"
import { listOllamaModels } from "@/lib/bim-flow/ollama"
import { LlmSuggestions } from "./llm-suggestions"
import { appendDictated, useDesktopDictation } from "@/lib/desktop-dictation"
import { dmMonoFace } from "@/lib/fonts/dm-mono"
import { useStampFontVariables } from "@/lib/fonts/stamp-font-variables"
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

/** The time alone for today; "Nov 9 · 11:40" for another day, with the year when it is not this year. */
export function clock(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (d.toDateString() === now.toDateString()) return time
  const sameYear = d.getFullYear() === now.getFullYear()
  const day = d.toLocaleDateString([], { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })
  return `${day} · ${time}`
}

/** The chat history. Memoized: a keystroke in the well does not repaint every line under the glass. */
const ChatLog = memo(function ChatLog({ lines, onTry }: { lines: BimLine[]; onTry: (text: string) => void }) {
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
            {line.waiting ? (
              <span className="bim-wait" role="status" aria-label={line.text === "…" ? "BIM is working" : `BIM: ${line.text}`}>
                <i />
                <i />
                <i />
                {line.text !== "…" ? <em className="bim-msg-route"> {line.text}</em> : null}
              </span>
            ) : (
              <p className="bim-msg-text">{line.text}</p>
            )}
            {line.aboutCard ? <span className="bim-about">↳ re: {line.aboutCard}</span> : null}
            {line.readAs ? <span className="bim-msg-route">read as: {line.readAs}</span> : null}
            {line.route ? <span className="bim-msg-route">{line.route}</span> : null}
            {line.general ? <span className="bim-msg-route">general, not from your data</span> : null}
            {line.reportId ? <ReportCard reportId={line.reportId} /> : null}
            {line.wireId ? <WireCard wireId={line.wireId} /> : null}
            {line.dayId ? <DayCard dayId={line.dayId} lineId={line.id} /> : null}
            {line.habitLineId ? <HabitCard lineId={line.habitLineId} /> : null}
            {line.evidence?.length ? (
              <details className="bim-msg-ev">
                <summary>evidence ({line.evidence.length})</summary>
                {line.evidence.map((row, i) => <p key={i}>{row}</p>)}
              </details>
            ) : null}
          </div>
        ))
      )}
    </>
  )
})

function ChatPane() {
  const { lines, busy, draft, setDraft, submit, onKeyDown, clear, checkIn, logRef, llm, setLlm, photos, addPhotos, removePhoto, photoError, replyTarget, clearReplyTarget } = useBimChat()
  const choices = openChoices(lines)
  const box = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // The navy ring shows only once the person clicks into the box or types; autofocus on open stays quiet.
  const [editing, setEditing] = useState(false)
  // Electron only: mic → local Whisper (`lib/desktop-dictation.ts`); the words join the draft.
  const dictate = useDesktopDictation((text) => {
    setDraft(appendDictated(draft, text))
    box.current?.focus()
  })

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

  const [showPast, setShowPast] = useState(false)
  const startWith = useCallback(
    (text: string) => {
      setShowPast(false)
      setDraft(text)
      box.current?.focus()
    },
    [setDraft],
  )

  return (
    <div className="bim-crt-pane">
      <div className="bim-chat-top">
        <ModeSwitch llm={llm} setLlm={setLlm} />
        <ConvoKeys showing={showPast} setShowing={setShowPast} />
      </div>
      <div className="bim-glass bim-scroll" ref={logRef} role="log" aria-live="polite">
        {showPast ? <ConvoList onDone={() => setShowPast(false)} /> : <ChatLog lines={lines} onTry={startWith} />}
      </div>
      <div className="bim-compose">
        <div className={editing || draft ? "bim-glass bim-well is-editing" : "bim-glass bim-well"}>
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
          {dictate.error ? <p className="bim-photo-error">{dictate.error}</p> : null}
          {replyTarget ? (
            <p className="bim-replying">
              ↳ replying to <b>{replyTarget.label}</b>
              <button data-no95 type="button" aria-label="Stop replying to the card" onClick={clearReplyTarget}>✕</button>
            </p>
          ) : null}
          <textarea
            ref={box}
            aria-label="Message BIM"
            value={draft}
            placeholder={photos.length ? "Caption (or leave blank and I will ask)…" : replyTarget ? "Say what's wrong or what you know…" : choices.length ? "Type an answer, or press a number…" : "Message BIM…"}
            onChange={(event) => {
              setEditing(true)
              setDraft(event.target.value)
            }}
            onKeyDown={onKey}
            onPointerDown={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            autoFocus={!touchFirst()}
          />
        </div>
        <div className="bim-send">
          <input ref={fileInput} type="file" accept="image/*" multiple hidden aria-label="Attach photos" onChange={addPhotos} />
          {/* Attach and dictate share one row above SEND, each about half its width. Icons only. */}
          <div className="bim-send-row">
            <button data-no95 type="button" className="is-mod" aria-label="Attach photo" title="Attach photo" onClick={() => fileInput.current?.click()}>
              <Paperclip className="bim-key-icon" aria-hidden="true" />
            </button>
            {dictate.available ? (
              <button
                data-no95
                type="button"
                className={dictate.state === "listening" ? "is-mod bim-dictate is-live" : "is-mod bim-dictate"}
                aria-label={dictate.state === "listening" ? "Stop dictation" : "Dictate"}
                aria-pressed={dictate.state === "listening"}
                title={dictate.state === "listening" ? "Stop and transcribe" : dictate.state === "transcribing" ? "Transcribing…" : "Dictate (local Whisper)"}
                disabled={dictate.state === "transcribing"}
                onClick={() => void dictate.toggle()}
              >
                <Mic className="bim-key-icon" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <button data-no95 type="button" className="is-primary" aria-label="Send" disabled={!draft.trim() && !photos.length} onClick={() => submit()}>
            <span className="bim-key-word">SEND ↵</span>
            <ArrowUp className="bim-key-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="bim-quick" aria-label="Quick commands">
        {BIM_QUICK.map((word) => (
          <button data-no95 key={word} type="button" onClick={() => submit(word)}>
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
    <div className="bim-mode">
      <span className="bim-mode-label">MODE</span>
      {/* One slide switch: ROUTER on the left, LLM on the right. The words are lamps you can tap too. */}
      <div className={`bim-sw${llm ? " is-llm" : ""}`}>
        <span className={`bim-sw-word${llm ? "" : " is-lit"}`} aria-hidden="true" onClick={() => setLlm(false)}>
          router
        </span>
        <button
          data-no95
          type="button"
          role="switch"
          aria-checked={llm}
          aria-label="LLM mode (off is plain routing)"
          className="bim-sw-track"
          onClick={() => setLlm(!llm)}
        >
          <span className="bim-sw-knob" aria-hidden="true" />
        </button>
        <span className={`bim-sw-word${llm ? " is-lit" : ""}`} aria-hidden="true" onClick={() => setLlm(true)}>
          llm
        </span>
      </div>
      <span className="bim-mode-says">
        {llm
          ? "Local models answer questions from your data, and ask you when they don't know."
          : "Plain routing, like the Telegram bot: commands run, lines are filed. No models."}
      </span>
      <div className="bim-secrets">
        <SecretsToggle surface="chat" label="Include secrets in answers" />
      </div>
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

/** With LLM on, asks Ollama for its models now and every minute. `null` until the first answer. */
function useModelsUp(on: boolean): boolean | null {
  const [up, setUp] = useState<boolean | null>(null)
  useEffect(() => {
    if (!on) return
    let live = true
    const check = () => void listOllamaModels().then((m) => live && setUp(!!m))
    check()
    const t = window.setInterval(check, 60_000)
    return () => {
      live = false
      window.clearInterval(t)
    }
  }, [on])
  return on ? up : null
}

function Dossier() {
  const pending = useIngestStore((s) => s.pendingByChat[`simulate:${BIM_CHAT_ID}`])
  const count = useIngestStore((s) => s.events.filter((e) => e.chatId === BIM_CHAT_ID).length)
  const busy = useBimChatStore((s) => s.busy)
  const llm = useBimLlmMode((s) => s.on)
  const up = useModelsUp(llm)
  // The blob holds still when no model is in the loop: LLM off (plain routing) or Ollama not answering.
  const still = !llm || up === false
  return (
    <aside className="bim-crt-side">
      <div className="bim-glass bim-card">
        <div className={`bim-face${busy ? " is-busy" : ""}`} title={busy ? "BIM is thinking" : still ? (llm ? "Models not answering: BIM is still" : "Plain routing: BIM is still") : undefined}>
          <BimBlob thinking={busy} still={still} />
        </div>
        <dl>
          <dt>NAME</dt>
          <dd>
            {BIM_SHORT} · {BIM_FULL}
          </dd>
          <dt>TELEGRAM</dt>
          <dd>{BIM_HANDLE}</dd>
          <dt>MODE</dt>
          <dd>{llm ? (up === false ? "LLM · models not answering" : "LLM · local models") : "router · no models"}</dd>
          <dt>OPEN THREAD</dt>
          <dd>{pending ? (pending.ritual?.flow ?? pending.kind) : "none"}</dd>
          <dt>LOGGED</dt>
          <dd>{count}</dd>
        </dl>
      </div>
      <div className="bim-glass bim-scroll bim-bio">{BIM_CONSOLE_BIO}</div>
    </aside>
  )
}

export function BimConsole({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<ConsoleTab>("chat")
  // The dialog portals to <body>, so the keys' DM Mono variable goes on <html>.
  useStampFontVariables(dmMonoFace)
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
