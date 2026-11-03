/**
 * components/Settings/you/SecretsField.tsx — The secrets passphrase
 *
 * Set it once. Items marked Secret stay out of search and BIM answers until
 * you unlock with it and switch "Include secrets" on there. It gates the app;
 * it does not encrypt the vault on disk.
 */
"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { MIN_PASSPHRASE_LENGTH } from "@/lib/secrets"
import { useSecretsStore } from "@/lib/secrets-store"

export function SecretsField() {
  const hasPassphrase = useSecretsStore((s) => s.record !== null)
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [message, setMessage] = React.useState("")

  const run = async (action: () => Promise<boolean>, done: string) => {
    const ok = await action()
    setMessage(ok ? done : "That did not work. Check the passphrase.")
    if (ok) {
      setCurrent("")
      setNext("")
    }
  }
  const store = useSecretsStore.getState

  return (
    <div data-ui-name="SecretsField" className="flex flex-col gap-2">
      <p className="text-sm">
        Mark an item Secret in its settings. Secret items are left out of search and BIM answers unless you unlock and
        switch on Include secrets. The passphrase is a gate, not encryption: the text still sits in your vault.
      </p>
      {hasPassphrase ? (
        <Input type="password" placeholder="Current passphrase" aria-label="Current passphrase" value={current} onChange={(e) => setCurrent(e.target.value)} />
      ) : null}
      <Input
        type="password"
        placeholder={hasPassphrase ? "New passphrase" : `Passphrase (${MIN_PASSPHRASE_LENGTH}+ characters)`}
        aria-label="New passphrase"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <div className="flex gap-2">
        {hasPassphrase ? (
          <>
            <button type="button" disabled={!next} onClick={() => void run(() => store().changePassphrase(current, next), "Passphrase changed.")}>
              Change
            </button>
            <button type="button" onClick={() => void run(() => store().clearPassphrase(current), "Passphrase removed. Secrets stay hidden.")}>
              Remove
            </button>
          </>
        ) : (
          <button type="button" disabled={!next} onClick={() => void run(() => store().setPassphrase(next), "Passphrase set.")}>
            Set passphrase
          </button>
        )}
      </div>
      {message ? <p role="status" className="text-xs">{message}</p> : null}
    </div>
  )
}
