/**
 * components/genius-talk-back.tsx — Answer a genius on its mission sheet, and hear it answer back
 *
 * You type a reason, an argument or a counter-offer; the genius answers through the local model (`lib/geniuses/run.ts`),
 * or from its script when the model is off or its answer fails the checks. Six exchanges at most. Each answer may come
 * with one key: do the smaller step, move it, let it go, or remember what you said. Nothing is written until you press
 * it. The talk is kept as the genius's memory.
 */
"use client"

import { useState } from "react"
import { addFriendStep } from "@/lib/friend-mission-steps"
import { friendMissionItemId } from "@/lib/friend-mission"
import { liveContext, liveRun } from "@/lib/geniuses/live"
import { MAX_TURNS } from "@/lib/geniuses/reply"
import { speak, turnOf, type Sent } from "@/lib/geniuses/run"
import { useGeniusesStore } from "@/lib/geniuses/store"
import type { Genius, GeniusReply, GeniusTalk } from "@/lib/geniuses/types"

/** Close the newest open talk with this genius about this task. */
export function closeGeniusTalk(geniusId: string, taskId: string | null, outcome: GeniusTalk["outcome"]): void {
  const s = useGeniusesStore.getState()
  const talk = [...s.talks].reverse().find((t) => t.geniusId === geniusId && t.taskId === taskId && t.outcome === "open")
  if (talk) s.endTalk(talk.id, outcome)
}

export function GeniusTalkBack({
  genius,
  taskId,
  title,
  onAccept,
  onDecline,
}: {
  genius: Genius
  taskId: string | null
  title: string
  onAccept: (step?: { stepId: string; stepTitle: string }) => void
  onDecline: (reason: string) => void
}) {
  const talks = useGeniusesStore((s) => s.talks)
  const talk = [...talks].reverse().find((t) => t.geniusId === genius.id && t.taskId === taskId && t.outcome === "open") ?? null
  const [said, setSaid] = useState("")
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<Sent<GeniusReply> | null>(null)
  const [kept, setKept] = useState(false)
  const [lastSaid, setLastSaid] = useState("")
  const lines = talk?.lines ?? []
  const over = turnOf(lines) > MAX_TURNS
  const name = genius.name

  async function send() {
    const text = said.trim()
    if (!text || busy || over) return
    setBusy(true)
    try {
      const store = useGeniusesStore.getState()
      const id = talk?.id ?? store.startTalk(genius.id, title, taskId)
      const current = useGeniusesStore.getState().talks.find((t) => t.id === id)!
      const sent = await speak({ context: liveContext(genius, id), talk: current, said: text, run: await liveRun(), overrides: store.prompts })
      store.addTalkLine(id, { who: "you", text })
      store.addTalkLine(id, { who: "genius", text: sent.value.line, stance: sent.value.stance, by: sent.by })
      setLast(sent)
      setLastSaid(text)
      setKept(false)
      setSaid("")
    } finally {
      setBusy(false)
    }
  }

  const reply = last?.value
  const canStep = !!friendMissionItemId(taskId)

  return (
    <div className="genius-talk" aria-label={`Talk with ${name}`}>
      {lines.length ? (
        <ol className="genius-talk-lines">
          {lines.map((l, i) => (
            <li key={i} className={`genius-talk-line${l.who === "you" ? " is-you" : ""}`}>
              {l.who === "genius" ? <b>{name}: </b> : null}
              {l.text}
            </li>
          ))}
        </ol>
      ) : null}
      {reply ? (
        <div className="baby-friend-mission-actions is-stack">
          {reply.stance === "split" && reply.smaller ? (
            <button
              type="button"
              className="friend-key is-primary"
              data-no95=""
              onClick={() => {
                const step = canStep ? addFriendStep(taskId, reply.smaller!) : null
                closeGeniusTalk(genius.id, taskId, "accepted")
                onAccept(step ?? undefined)
              }}
            >
              Just this: {reply.smaller}
            </button>
          ) : null}
          {reply.stance === "reschedule" ? (
            <button
              type="button"
              className="friend-key"
              data-no95=""
              onClick={() => {
                closeGeniusTalk(genius.id, taskId, "rescheduled")
                onDecline(`Moved${reply.when ? ` to ${reply.when}` : ""}: ${lastSaid}`)
              }}
            >
              Ask me {reply.when || "later"}
            </button>
          ) : null}
          {reply.stance === "concede" ? (
            <button
              type="button"
              className="friend-key"
              data-no95=""
              onClick={() => {
                closeGeniusTalk(genius.id, taskId, "conceded")
                onDecline(`${name} let it go: ${lastSaid}`)
              }}
            >
              Thanks, not today
            </button>
          ) : null}
          {reply.keep && !kept ? (
            <button
              type="button"
              className="friend-key"
              data-no95=""
              onClick={() => {
                useGeniusesStore.getState().addNote(genius.id, reply.keep!.said, canStep ? { kind: "item", id: friendMissionItemId(taskId)! } : null, "picked-up")
                setKept(true)
              }}
            >
              Remember: “{reply.keep.said}”
            </button>
          ) : null}
          {kept ? <p className="genius-talk-meta">{name} will remember that.</p> : null}
        </div>
      ) : null}
      {last && last.by === "script" ? <p className="genius-talk-meta">{last.why === "model off" ? "No local model: scripted answer." : `Scripted answer (${last.why}).`}</p> : null}
      <label className="baby-friend-mission-ask" htmlFor="genius-talk-said">
        {over ? `That is six exchanges. ${name} rests the case.` : `Answer ${name}: a reason, a counter-offer, how you feel.`}
      </label>
      <textarea
        id="genius-talk-said"
        className="fm-input baby-friend-decline-why"
        rows={2}
        value={said}
        disabled={over || busy}
        onChange={(event) => setSaid(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send()
        }}
      />
      <div className="baby-friend-mission-actions is-one">
        <button type="button" className="friend-key" data-no95="" disabled={!said.trim() || busy || over} onClick={() => void send()}>
          {busy ? `${name} is thinking…` : "Say it"}
        </button>
      </div>
    </div>
  )
}
