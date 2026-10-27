/**
 * components/Settings/InstagramAccountsPanel.tsx — Log into Instagram
 *
 * Settings → Imports → Instagram accounts. Each login opens Instagram's own
 * page in a desktop window, so two-factor and "confirm it's you" work as they
 * do in a browser. Main seals the session with the OS keychain. This panel
 * lists accounts, renames them, checks a session, keeps an opt-in password,
 * and removes an account. Nothing here fetches on its own.
 * The export import (`InstagramImportPanel`) stays separate and needs no login.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { AtSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  describeInstagramAccount,
  instagramBridge,
  isPlausibleInstagramUsername,
  normalizeInstagramUsername,
  type InstagramAccountView,
} from "@/lib/instagram-accounts"

function AccountRow({
  account,
  onChanged,
  onRemoved,
}: {
  account: InstagramAccountView
  onChanged: (next: InstagramAccountView) => void
  onRemoved: (id: string) => void
}) {
  const bridge = instagramBridge()
  const [label, setLabel] = useState(account.label)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")

  useEffect(() => setLabel(account.label), [account.label])

  if (!bridge) return null

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setNote("")
    try {
      await work()
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="space-y-2 rounded border p-3" data-testid={`instagram-account-${account.username}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong>@{account.username}</strong>
        <span className="text-xs text-muted-foreground">id {account.userId}</span>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="instagram-account-status">
        {describeInstagramAccount(account)}
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor={`ig-label-${account.id}`}>Label</Label>
          <Input
            id={`ig-label-${account.id}`}
            value={label}
            placeholder="main, research, …"
            maxLength={60}
            onChange={(event) => setLabel(event.target.value)}
            onBlur={() => {
              if (label.trim() === account.label) return
              void run(async () => {
                const res = await bridge.update(account.id, { label })
                if (res.ok) onChanged(res.account)
              })
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const res = await bridge.check(account.id)
              if (res.ok) onChanged(res.account)
              else setNote(res.error || "Check failed.")
            })
          }
        >
          Check session
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const res = await bridge.login({
                username: account.username,
                label: account.label,
                expectUserId: account.userId,
              })
              if (res.ok) onChanged(res.account)
              else setNote(res.error || "Login did not finish.")
            })
          }
        >
          Log in again
        </Button>
        {account.hasPassword ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const res = await bridge.setPassword(account.id, "")
                if (res.ok) onChanged(res.account)
              })
            }
          >
            Forget password
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowPassword((v) => !v)}>
            Remember password…
          </Button>
        )}
        {confirmRemove ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const res = await bridge.remove(account.id)
                  if (res.ok) onRemoved(account.id)
                })
              }
            >
              OK, remove @{account.username}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmRemove(true)}>
            Remove
          </Button>
        )}
      </div>
      {showPassword && !account.hasPassword ? (
        <form
          className="space-y-1"
          onSubmit={(event) => {
            event.preventDefault()
            if (!password) return
            void run(async () => {
              const res = await bridge.setPassword(account.id, password)
              setPassword("")
              if (res.ok) {
                setShowPassword(false)
                onChanged(res.account)
              } else setNote(res.error || "Not saved.")
            })
          }}
        >
          <Label htmlFor={`ig-pw-${account.id}`}>Password for @{account.username}</Label>
          <p className="text-xs text-muted-foreground">
            Optional. Sealed with the OS keychain and kept for planned export requests, which Instagram can ask to
            confirm with a password. Nothing uses it yet.
          </p>
          <div className="flex gap-2">
            <Input
              id={`ig-pw-${account.id}`}
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button size="sm" type="submit" disabled={busy || !password}>
              Save
            </Button>
          </div>
        </form>
      ) : null}
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </li>
  )
}

export function InstagramAccountsPanel() {
  const bridge = instagramBridge()
  const [accounts, setAccounts] = useState<InstagramAccountView[]>([])
  const [encryption, setEncryption] = useState<boolean | null>(null)
  const [username, setUsername] = useState("")
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")

  const refresh = useCallback(async () => {
    if (!bridge) return
    const [status, listed] = await Promise.all([bridge.status(), bridge.list()])
    setEncryption(status.encryption)
    if (listed.ok) setAccounts(listed.accounts)
  }, [bridge])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const name = normalizeInstagramUsername(username)
  const nameOk = isPlausibleInstagramUsername(name)

  const replace = (next: InstagramAccountView) =>
    setAccounts((list) => {
      const found = list.some((a) => a.id === next.id)
      return found ? list.map((a) => (a.id === next.id ? next : a)) : [...list, next]
    })

  return (
    <div
      className="space-y-3 rounded-lg border border-dashed p-4"
      data-ui-name="Instagram accounts"
      data-ui-docs="components/Settings/README.md"
      data-testid="instagram-accounts-settings"
    >
      <div className="flex items-center gap-2">
        <AtSign className="h-4 w-4" />
        <h3 className="font-semibold">Instagram accounts</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Log into one or more Instagram accounts on Instagram’s own page. Brain2 keeps each session cookie, sealed with
        the OS keychain, in the desktop app. Pages in Brain2 never see it.
      </p>
      <p className="text-sm text-muted-foreground">
        Nothing uses these logins on its own yet. Profile lookups and export requests are planned. Automated lookups
        with a login break Instagram’s terms and can end in a checkpoint or a ban on that account. The export import
        does not need a login, and it keeps working as it does now.
      </p>

      {!bridge ? (
        <p className="text-sm" data-testid="instagram-accounts-web">
          Logging in works in the desktop app only.
        </p>
      ) : (
        <>
          {encryption === false ? (
            <p className="text-sm" data-testid="instagram-accounts-no-keychain">
              This computer has no OS keychain Brain2 can use, so Brain2 will not store a login.
            </p>
          ) : null}
          {accounts.length ? (
            <ul className="space-y-2">
              {accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onChanged={replace}
                  onRemoved={(id) => setAccounts((list) => list.filter((a) => a.id !== id))}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No accounts yet.</p>
          )}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!nameOk) return
              setBusy(true)
              setNote("The Instagram window is open. Log in there.")
              void bridge
                .login({ username: name, label })
                .then((res) => {
                  if (res.ok) {
                    replace(res.account)
                    setUsername("")
                    setLabel("")
                    setNote(`Saved @${res.account.username}.`)
                  } else setNote(res.error || "Login did not finish.")
                })
                .catch((err) => setNote(err instanceof Error ? err.message : String(err)))
                .finally(() => setBusy(false))
            }}
          >
            <div className="flex flex-wrap gap-2">
              <div className="min-w-[10rem] flex-1 space-y-1">
                <Label htmlFor="ig-new-username">Username</Label>
                <Input
                  id="ig-new-username"
                  value={username}
                  placeholder="@username"
                  autoComplete="off"
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              <div className="min-w-[8rem] flex-1 space-y-1">
                <Label htmlFor="ig-new-label">Label</Label>
                <Input
                  id="ig-new-label"
                  value={label}
                  placeholder="optional"
                  maxLength={60}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={busy || !nameOk || encryption === false}>
              Log into Instagram
            </Button>
          </form>
          {note ? (
            <p className="text-sm text-muted-foreground" data-testid="instagram-accounts-note">
              {note}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
