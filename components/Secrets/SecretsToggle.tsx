/**
 * components/Secrets/SecretsToggle.tsx — "Include secrets" switch for one surface
 *
 * Search and BIM chat each get their own. Turning it on while locked asks for
 * the passphrase inline; with no passphrase set it points to Settings.
 */
"use client"

import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useSecretsStore, type SecretsSurface } from "@/lib/secrets-store"

export function SecretsToggle({ surface, label = "Include secrets" }: { surface: SecretsSurface; label?: string }) {
  const hasPassphrase = useSecretsStore((s) => s.record !== null)
  const unlocked = useSecretsStore((s) => s.unlocked)
  const on = useSecretsStore((s) => s.include[surface])
  const [asking, setAsking] = React.useState(false)
  const [text, setText] = React.useState("")
  const [wrong, setWrong] = React.useState(false)

  const submit = async () => {
    const store = useSecretsStore.getState()
    if (await store.unlock(text)) {
      store.setInclude(surface, true)
      setAsking(false)
      setText("")
      setWrong(false)
    } else {
      setWrong(true)
    }
  }

  const change = (next: boolean) => {
    if (!next) return void useSecretsStore.getState().setInclude(surface, false)
    if (unlocked) return void useSecretsStore.getState().setInclude(surface, true)
    setAsking(hasPassphrase)
  }

  return (
    <div data-ui-name="SecretsToggle" className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={on} disabled={!hasPassphrase} onCheckedChange={(v) => change(v === true)} />
        {label}
        {unlocked ? (
          <button type="button" className="text-xs underline" onClick={() => useSecretsStore.getState().lock()}>
            Lock
          </button>
        ) : null}
      </label>
      {!hasPassphrase ? <span className="text-xs opacity-70">Set a passphrase in Settings → You → Secrets.</span> : null}
      {asking ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void submit()
          }}
        >
          <Input
            type="password"
            autoFocus
            value={text}
            placeholder="Passphrase"
            aria-label="Secrets passphrase"
            aria-invalid={wrong}
            onChange={(e) => {
              setText(e.target.value)
              setWrong(false)
            }}
          />
          {wrong ? <span className="text-xs">Wrong passphrase.</span> : null}
        </form>
      ) : null}
    </div>
  )
}
