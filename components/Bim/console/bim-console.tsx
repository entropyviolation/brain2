/**
 * components/Bim/console/bim-console.tsx — BIM Chat console on the desktop
 *
 * A green-phosphor terminal: tab strip, chat log, BIM's dossier card, and a
 * compose well with a keypad (digits answer numbered questions). CHAT, LOG,
 * and COMMANDS are live. GRAPH, LLM, ACTIONS, and RULES are **Planned**: they
 * say what they will show once BIM reads the knowledge graph and a model.
 * Every line runs through the Telegram bot's executor (`lib/ingest/bim-chat.ts`).
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { BIM_FULL, BIM_HANDLE, BIM_INTRO, BIM_SHORT } from "@/lib/ingest/bim"
import { BIM_CHAT_ID } from "@/lib/ingest/bim-chat"
import { ALL_COMMANDS } from "@/lib/ingest/command-glossary"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { BIM_QUICK, openChoices, useBimChat } from "@/components/Bim/use-bim-chat"
import "./bim-console.css"

const TABS = ["chat", "log", "commands", "graph", "llm", "actions", "rules"] as const
type ConsoleTab = (typeof TABS)[number]

const PLANNED: Partial<Record<ConsoleTab, string>> = {
  graph: "Knowledge graph. Items, people, and links BIM can name and walk from a chat line.",
  llm: "Model link. Free text BIM cannot parse goes to a model with the vault as context.",
  actions: "Actions. What BIM did for you, and what he proposes to do, each one approvable.",
  rules: "Rules. Standing instructions BIM follows when a message or a time matches.",
}

const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "DEL"] as const

function clock(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function ChatPane() {
  const { lines, busy, draft, setDraft, submit, onKeyDown, clear, logRef } = useBimChat()
  const choices = openChoices(lines)

  const press = (key: (typeof KEYPAD)[number]) => {
    if (key === "CLR") setDraft("")
    else if (key === "DEL") setDraft(draft.slice(0, -1))
    else setDraft(draft + key)
  }

  return (
    <>
      <div className="bim-crt-box bim-crt-log" ref={logRef} role="log" aria-live="polite">
        {lines.length === 0 ? (
          <p className="bim-crt-line">BIM: LISTENING. TYPE WHAT YOU WOULD TEXT ME. INFO FOR THE BASICS.</p>
        ) : (
          lines.map((line) => (
            <p key={line.id} className={`bim-crt-line is-${line.who}${line.status === "error" ? " is-error" : ""}`}>
              <span className="bim-crt-who">{line.who === "you" ? "YOU:" : "BIM:"}</span> {line.text}
            </p>
          ))
        )}
        {busy ? <p className="bim-crt-line is-wait">BIM: …</p> : null}
      </div>
      <div className="bim-crt-compose">
        <div className="bim-crt-box bim-crt-input">
          {choices.length ? (
            <div className="bim-crt-chips" aria-label="Answers">
              {choices.map((choice) => (
                <button data-no95 key={choice.text + choice.label} type="button" onClick={() => submit(choice.text)}>
                  {choice.label}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            aria-label="Message BIM"
            value={draft}
            placeholder="TYPE A MESSAGE…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
          />
          <div className="bim-crt-chips bim-crt-quick" aria-label="Quick commands">
            {BIM_QUICK.map((word) => (
              <button data-no95 key={word} type="button" disabled={busy} onClick={() => submit(word)}>
                {word}
              </button>
            ))}
            <button data-no95 type="button" onClick={clear} disabled={!lines.length}>
              clear
            </button>
          </div>
        </div>
        <div className="bim-crt-pad">
          <div className="bim-crt-keys">
            {KEYPAD.map((key) => (
              <button data-no95 key={key} type="button" onClick={() => press(key)}>
                {key}
              </button>
            ))}
          </div>
          <button data-no95 type="button" className="bim-crt-send" disabled={busy || !draft.trim()} onClick={() => submit()}>
            SEND
          </button>
        </div>
      </div>
    </>
  )
}

function LogPane() {
  const events = useIngestStore((s) => s.events)
  const mine = useMemo(() => events.filter((e) => e.channel === "simulate" && e.chatId === BIM_CHAT_ID), [events])
  return (
    <div className="bim-crt-box bim-crt-log bim-crt-wide">
      {mine.length === 0 ? <p className="bim-crt-line">NO BIM CHAT WRITES IN THE INGEST LOG YET.</p> : null}
      {mine.map((e) => (
        <p key={e.id} className={`bim-crt-line${e.status === "error" ? " is-error" : ""}`}>
          {clock(e.at)} [{e.kind.toUpperCase()}] {e.status.toUpperCase()} — {e.summary}
          <br />
          <span className="bim-crt-dim">&gt; {e.raw}</span>
        </p>
      ))}
    </div>
  )
}

function Dossier() {
  const pending = useIngestStore((s) => s.pendingByChat[`simulate:${BIM_CHAT_ID}`])
  const count = useIngestStore((s) => s.events.filter((e) => e.chatId === BIM_CHAT_ID).length)
  return (
    <aside className="bim-crt-side">
      <div className="bim-crt-box bim-crt-card">
        <div className="bim-crt-face" aria-hidden="true">
          <span>BIM</span>
        </div>
        <dl>
          <dt>HANDLE:</dt>
          <dd>{BIM_SHORT}</dd>
          <dt>FULL NAME:</dt>
          <dd>{BIM_FULL.toUpperCase()}</dd>
          <dt>TELEGRAM:</dt>
          <dd>{BIM_HANDLE}</dd>
          <dt>OPEN THREAD:</dt>
          <dd>{pending ? (pending.ritual?.flow ?? pending.kind).toUpperCase() : "NONE"}</dd>
          <dt>LOGGED:</dt>
          <dd>{count}</dd>
        </dl>
      </div>
      <div className="bim-crt-box bim-crt-bio">{BIM_INTRO.toUpperCase()}</div>
    </aside>
  )
}

export function BimConsole({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<ConsoleTab>("chat")
  const planned = PLANNED[tab]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bim-crt" hideClose>
        <DialogTitle className="sr-only">{BIM_SHORT} Chat</DialogTitle>
        <DialogDescription className="sr-only">{BIM_FULL} console</DialogDescription>
        <div className="bim-crt-top">
          <span>BRAIN2 BIM TERM 1.0</span>
          <span>{BIM_FULL.toUpperCase()}</span>
          <button data-no95 type="button" className="bim-crt-x" onClick={() => onOpenChange(false)} aria-label="Close BIM Chat">
            [X]
          </button>
        </div>
        <nav className="bim-crt-tabs" aria-label="BIM console tabs">
          {TABS.map((t) => (
            <button data-no95
              key={t}
              type="button"
              className={t === tab ? "is-on" : undefined}
              aria-pressed={t === tab}
              onClick={() => setTab(t)}
            >
              {t.toUpperCase()}
              {PLANNED[t] ? <sup>·</sup> : null}
            </button>
          ))}
        </nav>
        <div className="bim-crt-main">
          <div className="bim-crt-left">
            {tab === "chat" ? <ChatPane /> : null}
            {tab === "log" ? <LogPane /> : null}
            {tab === "commands" ? <pre className="bim-crt-box bim-crt-log bim-crt-wide">{ALL_COMMANDS}</pre> : null}
            {planned ? (
              <div className="bim-crt-box bim-crt-log bim-crt-wide">
                <p className="bim-crt-line">PLANNED — NOT CONNECTED YET.</p>
                <p className="bim-crt-line bim-crt-dim">{planned.toUpperCase()}</p>
              </div>
            ) : null}
          </div>
          <Dossier />
        </div>
        <div className="bim-crt-foot">
          <span>LINK: LOCAL EXECUTOR · SAME BRAIN AS TELEGRAM</span>
          <span>PROPERTY OF BRAIN2</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
