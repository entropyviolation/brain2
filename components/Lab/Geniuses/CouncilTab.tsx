/**
 * components/Lab/Geniuses/CouncilTab.tsx — Call a council meeting
 *
 * Name the time or the question ("Tonight, 7 to 10"). Each genius makes one ask from its own area and memory. Then each
 * hears the others' asks (never their notes) and holds or gives way. You pick; the meeting is kept, and from then on
 * each genius remembers what it asked and which area got the time. Every call's exact prompt is editable first.
 */
"use client"

import { useMemo, useState } from "react"
import type { PromptPair } from "@/lib/geniuses/prompts"
import { askPrompt, councilAnswer, councilAsk, councilReplyPrompt, type Sent } from "@/lib/geniuses/run"
import { useGeniusesStore } from "@/lib/geniuses/store"
import type { CouncilAsk, CouncilReply, Genius } from "@/lib/geniuses/types"
import { btn, card, field, PromptBox, SentMeta, useContextFor, useGeniusNames, type useModelBar } from "./lab-kit"

type Edits = Record<string, PromptPair | undefined>

const draftFrom = (built: PromptPair, id: string, edits: Edits, setEdits: (e: Edits) => void) => ({
  prompt: edits[id] ?? built,
  edited: edits[id] !== undefined,
  edit: (part: keyof PromptPair, text: string) => setEdits({ ...edits, [id]: { ...(edits[id] ?? built), [part]: text } }),
  rebuild: () => setEdits({ ...edits, [id]: undefined }),
})

export function CouncilTab({ bar }: { bar: ReturnType<typeof useModelBar> }) {
  const geniuses = useGeniusesStore((s) => s.geniuses)
  const meetings = useGeniusesStore((s) => s.meetings)
  const prompts = useGeniusesStore((s) => s.prompts)
  const store = useGeniusesStore.getState
  const names = useGeniusNames()
  const contextFor = useContextFor()
  const active = useMemo(() => geniuses.filter((g) => g.status === "active"), [geniuses])
  const [topic, setTopic] = useState("Tonight, 7 to 10")
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(active.map((g) => g.id)))
  const [asks, setAsks] = useState<Record<string, Sent<CouncilAsk>>>({})
  const [replies, setReplies] = useState<Record<string, Sent<CouncilReply>>>({})
  const [askEdits, setAskEdits] = useState<Edits>({})
  const [replyEdits, setReplyEdits] = useState<Edits>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [pickNote, setPickNote] = useState("")
  const [saved, setSaved] = useState<string | null>(null)

  const seated = useMemo(() => active.filter((g) => chosen.has(g.id)), [active, chosen])
  const askList = seated.map((g) => asks[g.id]?.value).filter((a): a is CouncilAsk => !!a)
  const contexts = useMemo(() => Object.fromEntries(seated.map((g) => [g.id, contextFor(g)])), [seated, contextFor])

  const askOne = async (g: Genius) => {
    const c = contexts[g.id]!
    const sent = await councilAsk({ context: c, topic, run: bar.run, prompt: askEdits[g.id], overrides: prompts })
    setAsks((a) => ({ ...a, [g.id]: sent }))
  }
  const replyOne = async (g: Genius, all: CouncilAsk[]) => {
    const c = contexts[g.id]!
    const sent = await councilAnswer({ context: c, topic, asks: all, names, run: bar.run, prompt: replyEdits[g.id], overrides: prompts })
    setReplies((r) => ({ ...r, [g.id]: sent }))
  }
  const runAll = async (job: "ask" | "reply") => {
    setBusy(job)
    setSaved(null)
    try {
      if (job === "ask") setReplies({})
      for (const g of seated) await (job === "ask" ? askOne(g) : replyOne(g, askList))
    } finally {
      setBusy(null)
    }
  }
  const close = (pickedId: string | null) => {
    const id = store().addMeeting({
      topic,
      geniusIds: seated.map((g) => g.id),
      asks: askList,
      replies: seated.map((g) => replies[g.id]?.value).filter((r): r is CouncilReply => !!r),
      pickedId,
      pickNote,
    })
    setSaved(id)
  }

  return (
    <div className="space-y-4">
      <section className={card} aria-label="Call the council">
        <h2 className="text-sm font-semibold">Call the council</h2>
        <input className={field} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tonight, 7 to 10 · This Saturday · Should I take the gig?" />
        <div className="flex flex-wrap gap-3 text-sm">
          {active.map((g) => (
            <label key={g.id} className="flex items-center gap-1">
              <input type="checkbox" checked={chosen.has(g.id)} onChange={(e) => { const next = new Set(chosen); if (e.target.checked) next.add(g.id); else next.delete(g.id); setChosen(next) }} />
              {g.name}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className={btn} disabled={!!busy || seated.length < 2 || !topic.trim()} onClick={() => void runAll("ask")}>{busy === "ask" ? "Each is asking…" : "1 · Each genius asks"}</button>
          <button type="button" className={btn} disabled={!!busy || askList.length < 2} onClick={() => void runAll("reply")}>{busy === "reply" ? "Listening…" : "2 · They hear each other"}</button>
        </div>
        {seated.length < 2 ? <p className="text-xs opacity-60">Seat at least two geniuses.</p> : null}
      </section>

      {seated.map((g) => {
        const c = contexts[g.id]!
        const a = asks[g.id]
        const r = replies[g.id]
        return (
          <section key={g.id} className={card} aria-label={`${g.name} at the council`}>
            <h3 className="text-sm font-semibold">{g.name} <span className="font-normal opacity-60">· {g.area}</span></h3>
            {a ? (
              <div>
                <p className="text-sm"><b>Asks:</b> {a.value.ask}{a.value.why ? <span className="opacity-70"> {a.value.why}</span> : null}</p>
                <SentMeta sent={a} />
              </div>
            ) : null}
            <PromptBox draft={draftFrom(askPrompt(c, topic, prompts), g.id, askEdits, setAskEdits)} label="Ask prompt" />
            <button type="button" className={btn} disabled={!!busy} onClick={() => { setBusy(g.id); void askOne(g).finally(() => setBusy(null)) }}>Ask this one again</button>
            {askList.length >= 2 ? (
              <>
                {r ? (
                  <div>
                    <p className="text-sm"><b>Says:</b> {r.value.line}{r.value.yieldsTo ? <span className="opacity-70"> · gives way to {names[r.value.yieldsTo]}</span> : <span className="opacity-70"> · holds</span>}</p>
                    <SentMeta sent={r} />
                  </div>
                ) : null}
                <PromptBox draft={draftFrom(councilReplyPrompt(c, topic, askList, names, prompts), g.id, replyEdits, setReplyEdits)} label="Answer prompt" />
              </>
            ) : null}
          </section>
        )
      })}

      {askList.length >= 2 ? (
        <section className={card} aria-label="Your pick">
          <h2 className="text-sm font-semibold">Your pick (the ego decides)</h2>
          <input className={field} placeholder="Why, in your words (optional): rent is due" value={pickNote} onChange={(e) => setPickNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {seated.filter((g) => asks[g.id]).map((g) => (
              <button key={g.id} type="button" className={btn} disabled={!!saved} onClick={() => close(g.id)}>Give it to {g.name}</button>
            ))}
            <button type="button" className={btn} disabled={!!saved} onClick={() => close(null)}>Keep the minutes, decide later</button>
          </div>
          {saved ? <p className="text-xs">Kept. Each genius will remember this meeting.</p> : null}
        </section>
      ) : null}

      <section aria-label="Past meetings">
        <h2 className="text-sm font-semibold">Minutes · {meetings.length}</h2>
        <ul className="mt-1 space-y-2 text-sm">
          {[...meetings].reverse().slice(0, 12).map((m) => (
            <li key={m.id} className="opacity-80">
              <span className="text-xs opacity-60">{new Date(m.at).toLocaleString()}</span> · <b>{m.topic}</b> · {m.pickedId ? `went to ${names[m.pickedId] ?? "a retired genius"}` : "undecided"}{m.pickNote ? ` (“${m.pickNote}”)` : ""}
              <ul className="ml-4 text-xs">
                {m.asks.map((a) => <li key={a.geniusId}>{names[a.geniusId] ?? a.geniusId}: {a.ask}</li>)}
              </ul>
              {!m.pickedId ? (
                <span className="flex flex-wrap gap-1 text-xs">
                  {m.geniusIds.map((id) => <button key={id} type="button" className="underline" onClick={() => store().updateMeeting(m.id, { pickedId: id })}>give to {names[id] ?? id}</button>)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
