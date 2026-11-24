/**
 * components/Bim/convo-list.tsx — BIM chat's conversations, for the console and the phone
 *
 * `ConvoKeys` is the "＋ new" key and the "chats" key that shows the past list. `ConvoList` is that
 * list, drawn inside the chat glass in place of the log. Both read `useBimChatStore` directly.
 */
"use client"

import { useBimChatStore, type BimConvo } from "@/lib/ingest/bim-chat"

function when(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ""
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return time
  const day = d.toLocaleDateString([], { month: "short", day: "numeric", ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) })
  return `${day} · ${time}`
}

/** "＋ new" and "chats N". `keyClass` is the screen's keycap class (`m-keycap` on the phone). */
export function ConvoKeys({ showing, setShowing, keyClass = "" }: { showing: boolean; setShowing: (on: boolean) => void; keyClass?: string }) {
  const count = useBimChatStore((s) => s.past.length)
  const hasLines = useBimChatStore((s) => s.lines.length > 0)
  const newConvo = useBimChatStore((s) => s.newConvo)
  return (
    <span className="bim-convo-keys">
      {/* Never disabled: on an empty chat it still closes the list and drops BIM's open question, so the key always answers. */}
      <button
        data-no95
        type="button"
        className={`${keyClass} bim-convo-new`.trim()}
        title={hasLines ? "Start a new conversation. This one is kept under chats." : "This chat is already new. Type to start it."}
        onClick={() => {
          newConvo()
          setShowing(false)
        }}
      >
        ＋ new
      </button>
      <button
        data-no95
        type="button"
        className={`${keyClass} bim-convo-past${showing ? " is-on" : ""}`.trim()}
        aria-pressed={showing}
        disabled={!count && !showing}
        onClick={() => setShowing(!showing)}
      >
        chats{count ? ` ${count}` : ""}
      </button>
    </span>
  )
}

/** Past conversations, newest first. Tapping one opens it; ✕ deletes it. */
export function ConvoList({ onDone }: { onDone: () => void }) {
  const past = useBimChatStore((s) => s.past)
  const openConvo = useBimChatStore((s) => s.openConvo)
  const dropConvo = useBimChatStore((s) => s.dropConvo)
  if (!past.length) return <p className="bim-convo-empty">No other conversations yet. ＋ new keeps this one here.</p>
  return (
    <ul className="bim-convo-list" aria-label="Conversations">
      {past.map((c: BimConvo) => (
        <li key={c.id}>
          <button
            data-no95
            type="button"
            className="bim-convo-open"
            onClick={() => {
              openConvo(c.id)
              onDone()
            }}
          >
            <span className="bim-convo-title">{c.title}</span>
            <span className="bim-convo-meta">
              {when(c.startedAt)} · {c.lines.length} lines
            </span>
          </button>
          <button data-no95 type="button" className="bim-convo-drop" aria-label={`Delete "${c.title}"`} onClick={() => dropConvo(c.id)}>
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
