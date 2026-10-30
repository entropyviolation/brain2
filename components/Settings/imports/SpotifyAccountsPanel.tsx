/**
 * components/Settings/imports/SpotifyAccountsPanel.tsx — Log into Spotify
 *
 * Settings → Imports → Spotify accounts. Official Web API with PKCE: the person
 * registers their own Spotify app, pastes its Client ID, and logs in on
 * Spotify's page in a desktop window. Main seals the refresh token with the OS
 * keychain (`electron/spotify-accounts.js`). Several accounts. Nothing reads
 * listening data yet; that is planned.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { Music } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SPOTIFY_REDIRECT_URI,
  describeSpotifyAccount,
  isPlausibleSpotifyClientId,
  spotifyBridge,
  type SpotifyAccountView,
} from "@/lib/spotify-accounts"

function AccountRow({
  account,
  onChanged,
  onRemoved,
}: {
  account: SpotifyAccountView
  onChanged: (next: SpotifyAccountView) => void
  onRemoved: (id: string) => void
}) {
  const bridge = spotifyBridge()
  const [label, setLabel] = useState(account.label)
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
    <li className="space-y-2 rounded border p-3" data-testid={`spotify-account-${account.spotifyId}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong>{account.displayName}</strong>
        <span className="text-xs text-muted-foreground">id {account.spotifyId}</span>
      </div>
      <p className="text-sm text-muted-foreground">{describeSpotifyAccount(account)}</p>
      <div className="space-y-1">
        <Label htmlFor={`sp-label-${account.id}`}>Label</Label>
        <Input
          id={`sp-label-${account.id}`}
          value={label}
          placeholder="main, shared, …"
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
          Check login
        </Button>
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
              OK, remove {account.displayName}
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
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </li>
  )
}

export function SpotifyAccountsPanel() {
  const bridge = spotifyBridge()
  const [accounts, setAccounts] = useState<SpotifyAccountView[]>([])
  const [encryption, setEncryption] = useState<boolean | null>(null)
  const [savedClientId, setSavedClientId] = useState("")
  const [clientId, setClientId] = useState("")
  const [redirectUri, setRedirectUri] = useState(SPOTIFY_REDIRECT_URI)
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")

  const refresh = useCallback(async () => {
    if (!bridge) return
    const [status, listed] = await Promise.all([bridge.status(), bridge.list()])
    setEncryption(status.encryption)
    setSavedClientId(status.clientId)
    setClientId(status.clientId)
    setRedirectUri(status.redirectUri || SPOTIFY_REDIRECT_URI)
    if (listed.ok) setAccounts(listed.accounts)
  }, [bridge])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const replace = (next: SpotifyAccountView) =>
    setAccounts((list) =>
      list.some((a) => a.id === next.id) ? list.map((a) => (a.id === next.id ? next : a)) : [...list, next],
    )

  const clientIdOk = isPlausibleSpotifyClientId(clientId)

  return (
    <div
      className="space-y-3 rounded-lg border border-dashed p-4"
      data-ui-name="Spotify accounts"
      data-ui-docs="components/Settings/README.md"
      data-testid="spotify-accounts-settings"
    >
      <div className="flex items-center gap-2">
        <Music className="h-4 w-4" />
        <h3 className="font-semibold">Spotify accounts</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Log into one or more Spotify accounts through Spotify’s official Web API. Brain2 asks only to read what you
        play: recently played, top tracks and artists, and what is playing now. The login is sealed with the OS
        keychain in the desktop app. Nothing reads listening data yet; tracking is planned.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          On developer.spotify.com, open the Dashboard and create an app. Choose <strong>Web API</strong>.
        </li>
        <li>
          Add this redirect URI exactly: <code data-testid="spotify-redirect-uri">{redirectUri}</code>
        </li>
        <li>Copy the app’s Client ID into the field below. Brain2 uses no client secret.</li>
        <li>
          In development mode the app owner needs Spotify Premium, and each other account has to be added under
          User Management (five at most).
        </li>
      </ol>
      <p className="text-sm text-muted-foreground">
        Spotify’s API returns only the last 50 plays. A full history comes from Spotify’s own download: Account →
        Privacy settings → Extended streaming history.
      </p>

      {!bridge ? (
        <p className="text-sm" data-testid="spotify-accounts-web">
          Logging in works in the desktop app only.
        </p>
      ) : (
        <>
          {encryption === false ? (
            <p className="text-sm" data-testid="spotify-accounts-no-keychain">
              This computer has no OS keychain Brain2 can use, so Brain2 will not store a login.
            </p>
          ) : null}
          <form
            className="space-y-1"
            onSubmit={(event) => {
              event.preventDefault()
              void bridge.setClientId(clientId).then((res) => {
                if (res.ok) {
                  setSavedClientId(res.clientId)
                  setNote(res.clientId ? "Client ID saved." : "Client ID cleared.")
                } else setNote(res.error || "Not saved.")
              })
            }}
          >
            <Label htmlFor="sp-client-id">Client ID</Label>
            <div className="flex gap-2">
              <Input
                id="sp-client-id"
                value={clientId}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setClientId(event.target.value.trim())}
              />
              <Button
                size="sm"
                type="submit"
                variant="outline"
                disabled={clientId === savedClientId || (clientId !== "" && !clientIdOk)}
              >
                Save
              </Button>
            </div>
          </form>
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
              setBusy(true)
              setNote("The Spotify window is open. Log in there.")
              void bridge
                .login({ label })
                .then((res) => {
                  if (res.ok) {
                    replace(res.account)
                    setLabel("")
                    setNote(`Saved ${res.account.displayName}.`)
                  } else setNote(res.error || "Login did not finish.")
                })
                .catch((err) => setNote(err instanceof Error ? err.message : String(err)))
                .finally(() => setBusy(false))
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="sp-new-label">Label for the next account</Label>
              <Input
                id="sp-new-label"
                value={label}
                placeholder="optional"
                maxLength={60}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy || !savedClientId || encryption === false}>
              Log into Spotify
            </Button>
          </form>
          {note ? (
            <p className="text-sm text-muted-foreground" data-testid="spotify-accounts-note">
              {note}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
