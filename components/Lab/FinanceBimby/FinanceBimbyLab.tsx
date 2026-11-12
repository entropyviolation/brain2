/**
 * components/Lab/FinanceBimby/FinanceBimbyLab.tsx — The Financial BIMBY's own chat and what it remembers
 *
 * Talk to it directly (the same engine BIM chat's `money` lane calls), attach a receipt, and see its ledger:
 * who owes whom, purchases with their receipts and verdicts, discounts waiting, and the reminders it is tied
 * to. The verdict keys write the same record a sentence does. Engine: `lib/finance-bimby/`.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getAttachmentObjectUrl } from "@/lib/attachments"
import { useBudgetStore } from "@/lib/budget-store"
import { useCueStore } from "@/lib/cues/store"
import { dayLabel, perkLabel } from "@/lib/finance-bimby/advise"
import { markPerkUsed, setVerdict } from "@/lib/finance-bimby/apply"
import { money } from "@/lib/finance-bimby/read"
import { useFinanceBimby } from "@/lib/finance-bimby/store"
import type { Purchase, Verdict } from "@/lib/finance-bimby/types"
import { chatPhotoFromFile } from "@/lib/ingest/chat-photo"
import type { IncomingAttachment } from "@/lib/ingest/types"
import "../bimby-lab.css"
import "./finance-bimby.css"

const VERDICTS: { kind: Verdict; label: string }[] = [
  { kind: "satisfied", label: "glad" },
  { kind: "mixed", label: "mixed" },
  { kind: "regret", label: "regret" },
]

function Receipt({ uri }: { uri: string }) {
  const [src, setSrc] = useState("")
  useEffect(() => {
    let live = true
    void getAttachmentObjectUrl(uri).then((url) => live && setSrc(url)).catch(() => {})
    return () => {
      live = false
    }
  }, [uri])
  if (!src) return <span className="fb-receipt fb-receipt-missing">receipt</span>
  return (
    <a href={src} target="_blank" rel="noreferrer" className="fb-receipt">
      {/* A receipt from the person's own attachment store: a blob URL, so next/image has nothing to optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Receipt" />
    </a>
  )
}

function PurchaseRow({ p }: { p: Purchase }) {
  return (
    <li className="fb-purchase" data-verdict={p.verdict?.kind ?? "none"}>
      <div className="fb-purchase-head">
        <b>{money(p.cents)}</b>
        <span>{p.what}</span>
        <span className="bl-dim">{[p.merchant, p.account, dayLabel(p.date)].filter(Boolean).join(" · ")}</span>
      </div>
      {p.verdict?.why && <p className="fb-why">“{p.verdict.why}”</p>}
      <div className="bl-row">
        {p.receipts.map((uri) => <Receipt key={uri} uri={uri} />)}
        <span className="fb-keys" role="group" aria-label={`How ${p.what} sat`}>
          {VERDICTS.map((v) => (
            <button key={v.kind} type="button" aria-pressed={p.verdict?.kind === v.kind} onClick={() => setVerdict(p.id, v.kind, p.verdict?.why)}>{v.label}</button>
          ))}
        </span>
      </div>
    </li>
  )
}

export function FinanceBimbyLab() {
  const lines = useFinanceBimby((s) => s.lines)
  const busy = useFinanceBimby((s) => s.busy)
  const purchases = useFinanceBimby((s) => s.purchases)
  const perks = useFinanceBimby((s) => s.perks)
  const send = useFinanceBimby((s) => s.send)
  const clearChat = useFinanceBimby((s) => s.clearChat)
  const debts = useBudgetStore((s) => s.debts)
  const cues = useCueStore((s) => s.cues)
  const [draft, setDraft] = useState("")
  const [photos, setPhotos] = useState<IncomingAttachment[]>([])
  const file = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [lines.length, busy])

  const newest = useMemo(() => [...purchases].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30), [purchases])
  const owed = debts.filter((d) => d.direction === "owed")
  const owe = debts.filter((d) => d.direction === "owe")
  const live = perks.filter((p) => !p.usedAt)
  const openCues = cues.filter((c) => !c.doneAt)

  function go(text = draft) {
    if (busy || (!text.trim() && !photos.length)) return
    void send(text, photos)
    setDraft("")
    setPhotos([])
  }

  async function pick(files: FileList | null) {
    if (!files?.length) return
    const next: IncomingAttachment[] = []
    for (const f of Array.from(files)) next.push(await chatPhotoFromFile(f))
    setPhotos((p) => [...p, ...next])
    if (file.current) file.current.value = ""
  }

  return (
    <div className="bl-lab fb-lab">
      <a className="bl-back" href="/lab/agents">← Agent lab</a>
      <h1>Financial BIMBY</h1>
      <p className="bl-note">Say what you spent, who owes whom, or how a purchase sat. It files the money where it already lives (Tracking log, money book) and keeps the receipt and your verdict beside it. The same lines work in BIM chat. Type /info for its manual.</p>

      <section>
        <h2>Chat</h2>
        <div className="fb-log" ref={log} aria-live="polite">
          {lines.length === 0 && <p className="bl-note">Try: “spent 90 on the amex getting hairdye and other stuff on instacart”, then attach the receipt.</p>}
          {lines.map((l) => (
            <div key={l.id} className="fb-line" data-who={l.who}>
              <p>{l.text}</p>
              {l.choices && l.id === lines[lines.length - 1]?.id && (
                <div className="bl-row">
                  {l.choices.map((c) => <button key={c.text} type="button" disabled={busy} onClick={() => go(c.text)}>{c.label}</button>)}
                </div>
              )}
            </div>
          ))}
          {busy && <p className="bl-note">Working…</p>}
        </div>
        <div className="fb-compose">
          <textarea
            value={draft}
            rows={2}
            aria-label="Message the Financial BIMBY"
            placeholder="spent 12 on coffee · foxtide owes me 600 · i regret the instacart order"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                go()
              }
            }}
          />
          <div className="bl-row">
            <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e.target.files)} />
            <button type="button" onClick={() => file.current?.click()}>Attach receipt{photos.length ? ` (${photos.length})` : ""}</button>
            <button type="button" disabled={busy || (!draft.trim() && !photos.length)} onClick={() => go()}>Send</button>
            {lines.length > 0 && <button type="button" className="bl-dim" onClick={clearChat}>Clear chat</button>}
          </div>
        </div>
      </section>

      <section>
        <h2>Owed</h2>
        {owed.length + owe.length === 0 ? <p className="bl-note">No debts either way.</p> : (
          <ul className="bl-list">
            {owed.map((d) => <li key={d.id}><b>{d.who}</b> owes you {money(d.cents)}{d.note ? ` for ${d.note}` : ""}</li>)}
            {owe.map((d) => <li key={d.id}>You owe <b>{d.who}</b> {money(d.cents)}{d.note ? ` for ${d.note}` : ""}</li>)}
          </ul>
        )}
      </section>

      <section>
        <h2>Purchases</h2>
        {newest.length === 0 ? <p className="bl-note">None told yet.</p> : <ul className="bl-list">{newest.map((p) => <PurchaseRow key={p.id} p={p} />)}</ul>}
      </section>

      <section>
        <h2>Discounts waiting</h2>
        {live.length === 0 ? <p className="bl-note">None.</p> : (
          <ul className="bl-list">
            {live.map((p) => (
              <li key={p.id} className="bl-row">
                <span>{perkLabel(p)}</span>
                <span className="bl-dim">told {dayLabel(p.at.slice(0, 10))}</span>
                <button type="button" onClick={() => markPerkUsed(p.id)}>used it</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Reminders in a situation</h2>
        {openCues.length === 0 ? <p className="bl-note">None. In BIM chat: “got $15 off on instacart, remind me if I’m thinking about ordering food”.</p> : (
          <ul className="bl-list">
            {openCues.map((c) => (
              <li key={c.id} className="bl-row">
                <span>{c.fact}</span>
                <span className="bl-dim">when you are {c.when}{c.fires ? ` · said ${c.fires}×` : ""}</span>
                <button type="button" onClick={() => useCueStore.getState().done(c.id)}>stop</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
