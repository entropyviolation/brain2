/**
 * components/Lab/Geniuses/TalkTab.tsx — Argue with one genius about one assignment
 *
 * Pick a genius and a task (one of its open steps, or any words), then answer it. Each turn shows the exact prompt
 * (editable before you send), the model's raw JSON and the checked reply. The talk is kept as the genius's short-term
 * memory; "Remember" keeps a line as a note. Smaller steps and new times are shown as the cards they will become, not
 * written.
 */
"use client"

import { useMemo, useState } from "react"
import { MAX_TURNS } from "@/lib/geniuses/reply"
import { speak, turnOf, voicePrompt, type Sent } from "@/lib/geniuses/run"
import { useGeniusesStore } from "@/lib/geniuses/store"
import type { GeniusReply, GeniusTalk } from "@/lib/geniuses/types"
import { btn, card, field, GeniusSelect, PromptBox, SentMeta, useContextFor, usePromptDraft, type useModelBar } from "./lab-kit"

const OUTCOMES: { id: GeniusTalk["outcome"]; label: string }[] = [
  { id: "accepted", label: "I'll do it" },
  { id: "declined", label: "No" },
  { id: "conceded", label: "It conceded" },
  { id: "rescheduled", label: "Moved" },
]

export function TalkTab({ bar }: { bar: ReturnType<typeof useModelBar> }) {
  const geniuses = useGeniusesStore((s) => s.geniuses)
  const talks = useGeniusesStore((s) => s.talks)
  const store = useGeniusesStore.getState
  const [geniusId, setGeniusId] = useState(geniuses[0]?.id ?? "")
  const [taskText, setTaskText] = useState("")
  const [talkId, setTalkId] = useState<string | null>(null)
  const [said, setSaid] = useState("")
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<Sent<GeniusReply> | null>(null)
  const [kept, setKept] = useState<string | null>(null)
  const contextFor = useContextFor()

  const genius = geniuses.find((g) => g.id === geniusId) ?? geniuses[0]
  const talk = talks.find((t) => t.id === talkId) ?? null
  const context = useMemo(() => (genius ? contextFor(genius, talk?.id) : null), [genius, contextFor, talk?.id])
  const built = useMemo(() => (context ? voicePrompt(context, talk ?? { task: taskText || "(pick a task)", lines: [] }, said) : { system: "", user: "" }), [context, talk, taskText, said])
  const draft = usePromptDraft(built)
  const turn = talk ? turnOf(talk.lines) : 1
  const over = turn > MAX_TURNS

  if (!genius || !context) return <p className="text-sm">No geniuses. Add one on the Geniuses tab.</p>

  const start = (task: string, taskId: string | null) => {
    if (!task.trim()) return
    setTaskText(task)
    setLast(null)
    setKept(null)
    draft.rebuild()
    setTalkId(store().startTalk(genius.id, task, taskId))
  }

  async function send() {
    if (!talk || !said.trim() || busy || over) return
    setBusy(true)
    try {
      const sent = await speak({ context: context!, talk, said, run: bar.run, prompt: draft.edited ? draft.prompt : undefined, overrides: store().prompts })
      store().addTalkLine(talk.id, { who: "you", text: said })
      store().addTalkLine(talk.id, { who: "genius", text: sent.value.line, stance: sent.value.stance, by: sent.by })
      if (sent.value.stance === "concede") store().endTalk(talk.id, "conceded")
      if (sent.value.stance === "reschedule") store().endTalk(talk.id, "rescheduled")
      setLast(sent)
      setKept(null)
      setSaid("")
      draft.rebuild()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <GeniusSelect value={genius.id} onChange={(id) => { setGeniusId(id); setTalkId(null); setLast(null) }} />
        <span className="text-xs opacity-60">{context.animal} · tone {context.tone} · pushiness {context.pushiness}</span>
      </div>

      <section className={card} aria-label="Assignment">
        <h2 className="text-sm font-semibold">Assignment</h2>
        {context.read.open.length ? (
          <ul className="flex flex-wrap gap-1">
            {context.read.open.map((o) => (
              <li key={o.id}><button type="button" className={btn} onClick={() => start(o.title, o.id)}>{o.title}</button></li>
            ))}
          </ul>
        ) : (
          <p className="text-xs opacity-60">{context.read.unbound ? "Not bound yet: type a task, or bind it on the Geniuses tab." : "No open step in its area."}</p>
        )}
        <div className="flex gap-2">
          <input className={field} placeholder="Or type any task: Mix track 2" value={taskText} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") start(taskText, null) }} />
          <button type="button" className={btn} disabled={!taskText.trim()} onClick={() => start(taskText, null)}>Offer</button>
        </div>
      </section>

      {talk ? (
        <section className={card} aria-label="Talk">
          <h2 className="text-sm font-semibold">“{talk.task}” · exchange {Math.min(turn, MAX_TURNS)} of {MAX_TURNS} · {talk.outcome}</h2>
          <ol className="space-y-1 text-sm">
            {talk.lines.map((l, i) => (
              <li key={i} className={l.who === "you" ? "text-right" : ""}>
                <span className={l.who === "you" ? "inline-block rounded bg-neutral-100 px-2 py-1 dark:bg-neutral-800" : ""}>
                  {l.who === "genius" ? <b>{genius.name}: </b> : null}
                  {l.text}
                </span>
                {l.who === "genius" ? <span className="ml-2 text-xs opacity-60">{l.stance}{l.by === "script" ? " · script" : ""}</span> : null}
              </li>
            ))}
          </ol>
          {last ? (
            <div className="space-y-1">
              <SentMeta sent={last} />
              {last.value.smaller ? <p className="text-xs">Card it would offer: <b>add child step</b> “{last.value.smaller}” (GN-6, not written yet)</p> : null}
              {last.value.when ? <p className="text-xs">Card it would offer: <b>move to</b> {last.value.when} (GN-6, not written yet)</p> : null}
              {last.value.keep ? (
                <p className="text-xs">
                  It would like to remember: “{last.value.keep.said}”{" "}
                  {kept ? <span>· kept</span> : <button type="button" className="underline" onClick={() => setKept(store().addNote(genius.id, last.value.keep!.said, null, "picked-up"))}>Remember</button>}
                </p>
              ) : null}
            </div>
          ) : null}
          <textarea
            className={`${field} min-h-16`}
            placeholder={over ? "Six exchanges: this talk is over." : "Answer it: a reason, an argument, a counter-offer, how you feel"}
            value={said}
            disabled={over}
            onChange={(e) => setSaid(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send() }}
          />
          <PromptBox draft={draft} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn} disabled={busy || !said.trim() || over} onClick={() => void send()}>{busy ? "Thinking…" : "Send"}</button>
            <button type="button" className={btn} disabled={!said.trim()} onClick={() => { store().addNote(genius.id, said, talk.taskId ? { kind: "item", id: talk.taskId } : null, "you"); setSaid("") }}>Remember what I typed</button>
            <span className="ml-auto flex flex-wrap gap-1">
              {OUTCOMES.map((o) => (
                <button key={o.id} type="button" className={btn} onClick={() => store().endTalk(talk.id, o.id)}>{o.label}</button>
              ))}
            </span>
          </div>
        </section>
      ) : null}
    </div>
  )
}
