/**
 * components/Bim/phone/bim-phone.tsx — BIM Chat on the iPhone shell
 *
 * A plain text terminal: `YOU:` / `BIM:` lines on a dark glass screen, quick
 * command keycaps, the clarify answers as keycaps, and a Send key. The line
 * goes through the Telegram bot's executor (`lib/ingest/bim-chat.ts`), so every
 * command BIM knows works here and writes the same stores.
 */
"use client"

import { Camera } from "lucide-react"
import { Fragment, memo, useLayoutEffect, useRef, useState } from "react"
import { BIM_FULL, BIM_SHORT } from "@/lib/ingest/bim"
import { BIM_QUICK, openChoices, useBimChat } from "@/components/Bim/use-bim-chat"
import { insertSecretMarks } from "@/lib/secrets"
import type { BimLine } from "@/lib/ingest/bim-chat"
import { ReportCard } from "@/components/Bim/report-card"
import { WireCard } from "@/components/Bim/wire-card"
import { DayCard } from "@/components/Bim/day-card"
import { HabitCard } from "@/components/Bim/habit-card"
import { ConvoKeys, ConvoList } from "@/components/Bim/convo-list"
import "@/components/Bim/bim-ink.css"
import "./bim-phone.css"

/** The transcript. Memoized: a keystroke in the compose box does not repaint every line and card. */
const PhoneLog = memo(function PhoneLog({ lines, onRetry }: { lines: BimLine[]; onRetry: (text: string) => void }) {
  return (
    <>
      {lines.length === 0 ? (
        <p className="bim-phone-line is-bim">
          <b>BIM</b> Listening. Type anything you would text me — info, groc, gm, log: …
        </p>
      ) : (
        lines.map((line) => (
          <Fragment key={line.id}>
            <p className={`bim-phone-line is-${line.who}${line.status === "error" ? " is-error" : ""}`}>
              <b>{line.who === "you" ? "YOU" : "BIM"}</b> {line.waiting ? (line.text === "…" ? "▮▮▮" : `▮▮▮ ${line.text}`) : line.text}
            </p>
            {line.aboutCard ? <span className="bim-about">↳ re: {line.aboutCard}</span> : null}
            {line.readAs ? <span className="bim-phone-route">read as: {line.readAs}</span> : null}
            {line.route ? <span className="bim-phone-route">{line.route}</span> : null}
            {line.general ? <span className="bim-phone-route">general, not from your data</span> : null}
            {line.retry && !line.waiting ? (
              <button type="button" className="m-keycap bim-phone-retry" onClick={() => onRetry(line.retry!)}>
                retry
              </button>
            ) : null}
            {line.reportId ? <ReportCard reportId={line.reportId} /> : null}
            {line.wireId ? <WireCard wireId={line.wireId} /> : null}
            {line.dayId ? <DayCard dayId={line.dayId} lineId={line.id} /> : null}
            {line.habitLineId ? <HabitCard lineId={line.habitLineId} /> : null}
            {line.evidence?.length ? (
              <details className="bim-phone-ev">
                <summary>evidence ({line.evidence.length})</summary>
                {line.evidence.map((row, i) => <p key={i}>{row}</p>)}
              </details>
            ) : null}
          </Fragment>
        ))
      )}
    </>
  )
})

export function BimPhoneScreen() {
  const { lines, draft, setDraft, submit, onKeyDown, clear, logRef, llm, setLlm, photos, addPhotos, removePhoto, photoError, replyTarget, clearReplyTarget } = useBimChat()
  const fileInput = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  // The SECRET key's caret, placed once the new draft is on screen (a controlled box jumps to the end otherwise).
  const caretTo = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (caretTo.current == null || !el) return
    el.focus()
    el.setSelectionRange(caretTo.current, caretTo.current)
    caretTo.current = null
  }, [draft])
  const choices = openChoices(lines)
  const [showPast, setShowPast] = useState(false)

  return (
    <section className="bim-phone bim-ink" aria-label="BIM Chat" data-ui-name="BIM Chat">
      <header className="bim-phone-head">
        <span className="bim-phone-title">{BIM_SHORT} CHAT</span>
        <span className="bim-phone-sub">{BIM_FULL}</span>
        <button
          type="button"
          className={`m-keycap bim-phone-llm${llm ? " is-on" : ""}`}
          aria-pressed={llm}
          aria-label={llm ? "LLM mode on. Tap for commands only." : "LLM mode off. Tap to use the Mac's models."}
          onClick={() => setLlm(!llm)}
        >
          LLM {llm ? "on" : "off"}
        </button>
        <button type="button" className="m-keycap bim-phone-clear" onClick={clear} disabled={!lines.length}>
          Clear
        </button>
        <ConvoKeys showing={showPast} setShowing={setShowPast} keyClass="m-keycap" />
      </header>

      <div className="bim-phone-screen" ref={logRef} role="log" aria-live="polite">
        {showPast ? <ConvoList onDone={() => setShowPast(false)} /> : <PhoneLog lines={lines} onRetry={submit} />}
        <span className="bim-phone-cursor" aria-hidden="true" />
      </div>

      {choices.length ? (
        <div className="bim-phone-keys" aria-label="Answers">
          {choices.map((choice) => (
            <button key={choice.text + choice.label} type="button" className="m-keycap" onClick={() => submit(choice.text)}>
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="bim-phone-compose"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {photos.length ? (
          <div className="bim-phone-photos" aria-label="Photos to send">
            {photos.map((photo, i) => (
              <span key={i} className="bim-phone-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.dataUrl} alt={photo.name} />
                <button type="button" aria-label={`Remove ${photo.name}`} onClick={() => removePhoto(i)}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {photoError ? <p className="bim-phone-photo-error">{photoError}</p> : null}
        {replyTarget ? (
          <p className="bim-replying">
            ↳ replying to <b>{replyTarget.label}</b>
            <button type="button" aria-label="Stop replying to the card" onClick={clearReplyTarget}>✕</button>
          </p>
        ) : null}
        <input ref={fileInput} type="file" accept="image/*" multiple hidden aria-label="Attach photos" onChange={addPhotos} />
        <button type="button" className="m-keycap bim-phone-attach" aria-label="Attach photo" onClick={() => fileInput.current?.click()}>
          <Camera size="1.1em" aria-hidden />
        </button>
        <textarea
          ref={box}
          aria-label="Message BIM"
          value={draft}
          rows={2}
          placeholder={photos.length ? "Caption (optional)" : "Message BIM"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="m-keycap bim-phone-send" disabled={!draft.trim() && !photos.length}>
          Send
        </button>
      </form>

      <div className="bim-phone-keys bim-phone-quick" aria-label="Quick commands">
        {BIM_QUICK.map((word) => (
          <button key={word} type="button" className="m-keycap" onClick={() => submit(word)}>
            {word}
          </button>
        ))}
        <button
          type="button"
          className="m-keycap"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            const el = box.current
            const next = insertSecretMarks(draft, el?.selectionStart ?? draft.length, el?.selectionEnd ?? draft.length)
            setDraft(next.text)
            caretTo.current = next.caret
          }}
        >
          secret
        </button>
      </div>
    </section>
  )
}
