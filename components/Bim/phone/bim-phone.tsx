/**
 * components/Bim/phone/bim-phone.tsx — BIM Chat on the iPhone shell
 *
 * A plain text terminal: `YOU:` / `BIM:` lines on a dark glass screen, quick
 * command keycaps, the clarify answers as keycaps, and a Send key. The line
 * goes through the Telegram bot's executor (`lib/ingest/bim-chat.ts`), so every
 * command BIM knows works here and writes the same stores.
 */
"use client"

import { BIM_FULL, BIM_SHORT } from "@/lib/ingest/bim"
import { BIM_QUICK, openChoices, useBimChat } from "@/components/Bim/use-bim-chat"
import "./bim-phone.css"

export function BimPhoneScreen() {
  const { lines, busy, draft, setDraft, submit, onKeyDown, clear, logRef } = useBimChat()
  const choices = openChoices(lines)

  return (
    <section className="bim-phone" aria-label="BIM Chat" data-ui-name="BIM Chat">
      <header className="bim-phone-head">
        <span className="bim-phone-title">{BIM_SHORT} CHAT</span>
        <span className="bim-phone-sub">{BIM_FULL}</span>
        <button type="button" className="m-keycap bim-phone-clear" onClick={clear} disabled={!lines.length}>
          Clear
        </button>
      </header>

      <div className="bim-phone-screen" ref={logRef} role="log" aria-live="polite">
        {lines.length === 0 ? (
          <p className="bim-phone-line is-bim">
            <b>BIM:</b> Listening. Type anything you would text me — info, groc, gm, log: …
          </p>
        ) : (
          lines.map((line) => (
            <p key={line.id} className={`bim-phone-line is-${line.who}${line.status === "error" ? " is-error" : ""}`}>
              <b>{line.who === "you" ? "YOU:" : "BIM:"}</b> {line.text}
            </p>
          ))
        )}
        {busy ? <p className="bim-phone-line is-bim is-wait">BIM: …</p> : null}
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
        <textarea
          aria-label="Message BIM"
          value={draft}
          rows={2}
          placeholder="Message BIM"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="m-keycap bim-phone-send" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>

      <div className="bim-phone-keys bim-phone-quick" aria-label="Quick commands">
        {BIM_QUICK.map((word) => (
          <button key={word} type="button" className="m-keycap" disabled={busy} onClick={() => submit(word)}>
            {word}
          </button>
        ))}
      </div>
    </section>
  )
}
