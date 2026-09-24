/**
 * components/Settings/MessageIngestPanel.tsx — Telegram pairing + command cheat-sheet
 *
 * Token is stored in Electron safeStorage (never in localStorage). Pairing
 * allowlists a Telegram user. Simulate applies a phrase without Telegram.
 * Shortcuts expand first-word aliases (`store` → `groc`). Discrete event
 * triggers (smoked weed, ate {item}, …) are editable here. iPhone Notes /
 * Screen Time / Call / Text Shortcuts: AirDrop the signed
 * docs/shortcuts/*.shortcut files. See docs/MESSAGE_INGEST.md.
 */
"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import { MessageSquare, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { INGEST_HELP } from "@/lib/ingest/help"
import { IPHONE_NOTES_DUMP_EXAMPLE } from "@/lib/apple-notes"
import { generatePairingCode, unpairedSenders } from "@/lib/ingest/pairing"
import { sanitizeShortcutAlias } from "@/lib/ingest/expand"
import { ingestIncoming, ingestIncomingAsync } from "@/lib/ingest/executor"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { getTelegramDesktop } from "@/lib/ingest/telegram-bridge"
import { normalizeHubUrl, pushVaultToHub } from "@/lib/ingest/vault-push"

export function MessageIngestPanel() {
  const enabled = useIngestStore((s) => s.enabled)
  const setEnabled = useIngestStore((s) => s.setEnabled)
  const allowGroups = useIngestStore((s) => s.allowGroups)
  const setAllowGroups = useIngestStore((s) => s.setAllowGroups)
  const pairing = useIngestStore((s) => s.pairing)
  const setPairing = useIngestStore((s) => s.setPairing)
  const allowedChats = useIngestStore((s) => s.allowedChats)
  const revokeChat = useIngestStore((s) => s.revokeChat)
  const allowChat = useIngestStore((s) => s.allowChat)
  const events = useIngestStore((s) => s.events)
  const lastPollAt = useIngestStore((s) => s.lastPollAt)
  const lastPollError = useIngestStore((s) => s.lastPollError)
  const lastPollSource = useIngestStore((s) => s.lastPollSource)
  const shortcuts = useIngestStore((s) => s.shortcuts)
  const setShortcut = useIngestStore((s) => s.setShortcut)
  const removeShortcut = useIngestStore((s) => s.removeShortcut)
  const discreteEventTriggers = useIngestStore((s) => s.discreteEventTriggers)
  const upsertDiscreteEventTrigger = useIngestStore((s) => s.upsertDiscreteEventTrigger)
  const removeDiscreteEventTrigger = useIngestStore((s) => s.removeDiscreteEventTrigger)
  const phoneHubUrl = useIngestStore((s) => s.phoneHubUrl)
  const setPhoneHubUrl = useIngestStore((s) => s.setPhoneHubUrl)

  const [token, setToken] = useState("")
  const [hasToken, setHasToken] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [simulate, setSimulate] = useState("")
  const [simulateReply, setSimulateReply] = useState<string | null>(null)
  const [scanCaption, setScanCaption] = useState("")
  const [tokenStatus, setTokenStatus] = useState<string | null>(null)
  const [alias, setAlias] = useState("")
  const [expansion, setExpansion] = useState("")
  const [discretePattern, setDiscretePattern] = useState("")
  const [editingDiscreteId, setEditingDiscreteId] = useState<string | null>(null)
  const [hubStatus, setHubStatus] = useState<string | null>(null)

  useEffect(() => {
    const desktop = getTelegramDesktop()
    setIsElectron(Boolean(desktop))
    if (!desktop) return
    void desktop.hasToken().then((r) => setHasToken(Boolean(r.hasToken)))
  }, [])

  const remainingMs = pairing ? pairing.expiresAt - Date.now() : 0
  const codeLive = pairing && remainingMs > 0
  const waiting = unpairedSenders(
    events,
    allowedChats.map((c) => c.chatId),
  )

  const handleGenerate = () => {
    setPairing(generatePairingCode())
  }

  const handlePairSender = (sender: (typeof waiting)[number]) => {
    allowChat({
      chatId: sender.chatId,
      userId: sender.userId,
      username: sender.username,
      pairedAt: new Date().toISOString(),
    })
  }

  const handleSaveToken = async () => {
    const desktop = getTelegramDesktop()
    if (!desktop) {
      setTokenStatus("Use the desktop app to store a token, or COGS_TELEGRAM_BOT_TOKEN with npm run phone:hub.")
      return
    }
    const result = await desktop.setToken(token)
    setHasToken(Boolean(result.hasToken))
    setToken("")
    setTokenStatus(result.hasToken ? "Token saved on this computer." : "Token cleared.")
    if (enabled && result.hasToken) await desktop.start()
  }

  const handleClearToken = async () => {
    const desktop = getTelegramDesktop()
    if (!desktop) return
    await desktop.clearToken()
    setHasToken(false)
    setTokenStatus("Token removed.")
  }

  const handleSimulate = () => {
    if (!simulate.trim()) return
    const result = ingestIncoming({
      source: { channel: "simulate", chatId: "simulate" },
      text: simulate,
      receivedAt: new Date().toISOString(),
    })
    setSimulateReply(result.status === "ignored" ? result.summary || "Ignored" : result.reply || result.status)
    setSimulate("")
  }

  const handleSimulateScan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setSimulateReply("Scanning…")
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(reader.error ?? new Error("Could not read file"))
      reader.readAsDataURL(file)
    })
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    const result = await ingestIncomingAsync({
      source: { channel: "simulate", chatId: "simulate" },
      text: scanCaption,
      receivedAt: new Date().toISOString(),
      attachments: [
        {
          kind: isPdf ? "pdf" : "photo",
          mime: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
          name: file.name,
          dataUrl,
        },
      ],
    })
    setSimulateReply(result.status === "ignored" ? result.summary || "Ignored" : result.reply || result.status)
  }

  const handleAddShortcut = () => {
    const key = sanitizeShortcutAlias(alias)
    if (!key || !expansion.trim()) return
    setShortcut(key, expansion.trim())
    setAlias("")
    setExpansion("")
  }

  const handleSaveDiscrete = () => {
    const pattern = discretePattern.trim()
    if (!pattern) return
    upsertDiscreteEventTrigger({
      id: editingDiscreteId || `de-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      pattern,
    })
    setDiscretePattern("")
    setEditingDiscreteId(null)
  }

  const handleEditDiscrete = (id: string, pattern: string) => {
    setEditingDiscreteId(id)
    setDiscretePattern(pattern)
  }

  const handlePushVault = async () => {
    const target = normalizeHubUrl(phoneHubUrl) || (typeof window !== "undefined" ? window.location.origin : "")
    setHubStatus("Pushing vault…")
    const result = await pushVaultToHub(target)
    setHubStatus(
      result.ok ? `Pushed ${result.keyCount} keys to ${target}` : result.error || "Push failed",
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        <h3 className="font-semibold">Message ingest</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Meet <strong>BIM</strong> (Brain2 Ingestion Messenger) — you can call him BIM for short. Text{" "}
        <a className="underline" href="https://t.me/brain2_phone_bot" target="_blank" rel="noreferrer">
          t.me/brain2_phone_bot
        </a>{" "}
        from your phone. Send <code className="text-foreground">info</code> for the basics,{" "}
        <code className="text-foreground">{"{prefix} info"}</code> /{" "}
        <code className="text-foreground">{"{prefix} commands"}</code> for one family, or{" "}
        <code className="text-foreground">all commands</code> for every keyword. Grocery dump is{" "}
        <code className="text-foreground">groc</code>; check-off is{" "}
        <code className="text-foreground">got milk</code>; tracker notes are{" "}
        <code className="text-foreground">n …</code>. On My iPhone Notes use the iOS Shortcut →{" "}
        <code className="text-foreground">iphone-notes:</code> (header{" "}
        <span className="text-foreground">Phone Notes</span>). Every grocery dump pins a card in the chat so you
        can read it at the store even if this computer is off. Snap a receipt to check off
        grocery and bump pantry, a journal page (or a forwarded PDF) to park a real Docs
        note. For live replies around the clock, leave{" "}
        <code className="text-foreground">npm run phone:hub</code> running on a machine that stays on.
        Pairing required — unknown senders get no reply.
      </p>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border border-primary"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Enable ingest</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border border-primary"
          checked={allowGroups}
          onChange={(e) => setAllowGroups(e.target.checked)}
        />
        <span>Accept group chats (off by default)</span>
      </label>

      {isElectron ? (
        <div className="space-y-2">
          <Label htmlFor="telegram-token">Telegram bot token</Label>
          <div className="flex gap-2">
            <Input
              id="telegram-token"
              type="password"
              autoComplete="off"
              placeholder={hasToken ? "Token stored — paste to replace" : "123456:ABC… from BotFather"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => void handleSaveToken()} disabled={!token.trim()}>
              Save
            </Button>
          </div>
          {hasToken && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void handleClearToken()}>
              Remove token
            </Button>
          )}
          {tokenStatus && <p className="text-xs text-muted-foreground">{tokenStatus}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Browser session: token is on this machine in gitignored <code className="text-foreground">.env.local</code>{" "}
          or the desktop app (`safeStorage`). For 24/7 replies run{" "}
          <code className="text-foreground">npm run phone:hub</code>. Simulate below works without Telegram.
          Pair in the desktop app, then text{" "}
          <a className="underline" href="https://t.me/brain2_phone_bot" target="_blank" rel="noreferrer">
            t.me/brain2_phone_bot
          </a>
          .
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Pairing code</Label>
          <Button type="button" size="sm" variant="outline" onClick={handleGenerate}>
            Generate pairing code
          </Button>
        </div>
        {codeLive ? (
          <div className="flex items-center gap-2">
            <p className="set-crt">{pairing.code}</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Copy pairing code"
              onClick={() => void navigator.clipboard.writeText(pairing.code)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Send <code className="text-foreground">/start {pairing.code}</code> to the bot. Expires in{" "}
              {Math.max(1, Math.ceil(remainingMs / 60000))} min.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Generate a code, then message the bot <code className="text-foreground">/start 123456</code> or{" "}
            <code className="text-foreground">pair: 123456</code>.
          </p>
        )}
      </div>

      {waiting.length > 0 && (
        <div className="space-y-1">
          <Label>Texted but not paired</Label>
          <p className="text-xs text-muted-foreground">
            These senders reached the bot and were refused. Pair one and it stays paired — no code, no
            expiry. Only do this for a chat you recognize.
          </p>
          {waiting.map((sender) => (
            <div key={sender.chatId} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                {sender.username ? `@${sender.username}` : "Telegram"}{" "}
                <span className="text-muted-foreground">{sender.chatId}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {sender.attempts} message{sender.attempts === 1 ? "" : "s"} · “{sender.lastText}”
                </span>
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => handlePairSender(sender)}>
                Pair
              </Button>
            </div>
          ))}
        </div>
      )}

      {allowedChats.length > 0 && (
        <div className="space-y-1">
          <Label>Paired chats</Label>
          {allowedChats.map((chat) => (
            <div key={chat.chatId} className="flex items-center justify-between text-sm">
              <span>
                {chat.username ? `@${chat.username}` : "Telegram"}{" "}
                <span className="text-muted-foreground">{chat.chatId}</span>
              </span>
              <Button type="button" size="icon" variant="ghost" aria-label="Revoke" onClick={() => revokeChat(chat.chatId)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Poll: {lastPollSource ?? "idle"}
        {lastPollAt ? ` · ${new Date(lastPollAt).toLocaleTimeString()}` : ""}
        {lastPollError ? ` · ${lastPollError}` : ""}
        {lastPollSource === "phone-hub" ? " · always-on hub owns Telegram" : ""}
      </p>

      <div className="space-y-2">
        <Label htmlFor="phone-hub-url">Always-on hub URL</Label>
        <div className="flex gap-2">
          <Input
            id="phone-hub-url"
            placeholder="http://127.0.0.1:8787"
            value={phoneHubUrl}
            onChange={(e) => setPhoneHubUrl(e.target.value)}
          />
          <Button type="button" variant="outline" onClick={() => void handlePushVault()}>
            Sync vault
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Default local hub is port 8787. Sync copies this profile’s lists to the hub file so{" "}
          <code className="text-foreground">groc</code> at the store sees today’s grocery list.
        </p>
        {hubStatus && <p className="text-xs text-muted-foreground">{hubStatus}</p>}
      </div>

      <div className="space-y-2">
        <Label>Shortcuts</Label>
        <p className="text-xs text-muted-foreground">
          First-word aliases. Example: <code className="text-foreground">store</code> →{" "}
          <code className="text-foreground">groc</code> (bare <code className="text-foreground">g</code> is
          retired).
        </p>
        <div className="flex gap-2">
          <Input
            aria-label="Shortcut alias"
            placeholder="store"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
          <Input
            aria-label="Shortcut expansion"
            placeholder="groc"
            value={expansion}
            onChange={(e) => setExpansion(e.target.value)}
          />
          <Button type="button" variant="outline" onClick={handleAddShortcut} disabled={!alias.trim() || !expansion.trim()}>
            Add
          </Button>
        </div>
        {Object.entries(shortcuts).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span>
              <code>{key}</code> → {value}
            </span>
            <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${key}`} onClick={() => removeShortcut(key)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Discrete event triggers</Label>
        <p className="text-xs text-muted-foreground">
          Whole-message patterns that log an Activity instant. Examples:{" "}
          <code className="text-foreground">smoked weed</code>,{" "}
          <code className="text-foreground">drank water</code>,{" "}
          <code className="text-foreground">ate {"{item}"}</code>,{" "}
          <code className="text-foreground">took {"{item}"}</code>.{" "}
          <code className="text-foreground">log:</code> still works separately.
        </p>
        <div className="flex gap-2">
          <Input
            aria-label="Discrete event pattern"
            placeholder="ate {item}"
            value={discretePattern}
            onChange={(e) => setDiscretePattern(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDiscrete}
            disabled={!discretePattern.trim()}
          >
            {editingDiscreteId ? "Update" : "Add"}
          </Button>
          {editingDiscreteId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingDiscreteId(null)
                setDiscretePattern("")
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
        {discreteEventTriggers.map((trigger) => (
          <div key={trigger.id} className="flex items-center justify-between gap-2 text-sm">
            <code className="min-w-0 truncate">{trigger.pattern}</code>
            <span className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleEditDiscrete(trigger.id, trigger.pattern)}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${trigger.pattern}`}
                onClick={() => removeDiscreteEventTrigger(trigger.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </span>
          </div>
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">iPhone Notes Shortcut</summary>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <p>
            Telegram cannot open Notes on the phone. AirDrop the signed file{" "}
            <code className="text-foreground">docs/shortcuts/Dump iPhone Notes to Brain2.shortcut</code>{" "}
            onto the iPhone (or double-click it on this Mac if Shortcuts iCloud is on). Details:{" "}
            <code className="text-foreground">docs/shortcuts/dump-iphone-notes-to-brain2.md</code>. Each
            note is one <code className="text-foreground">iphone-notes:</code> message to this bot. They
            park in header <span className="text-foreground">Phone Notes</span> (Lists → iPhone Notes Store
            → Parked), not Mac From Notes.
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Pair this Telegram account (code above).</li>
            <li>
              AirDrop the <code className="text-foreground">.shortcut</code> file, or open it on this Mac.
              On the phone: Settings → Shortcuts → Allow Untrusted Shortcuts, then tap Add Shortcut.
            </li>
            <li>
              When asked who to message, pick the @brain2_phone_bot chat. Run the Shortcut or share a note.
            </li>
            <li>
              Keep Brain2 or <code className="text-foreground">npm run phone:hub</code> polling, then open
              Phone Notes.
            </li>
          </ol>
          <p>Desktop test (no phone): paste the Simulate example below, Apply locally, then open Phone Notes.</p>
        </div>
      </details>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">iPhone Screen Time / Calls / Texts Shortcuts</summary>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <p>
            AirDrop the signed files next to the Notes dump:{" "}
            <code className="text-foreground">Screen Time to Brain2.shortcut</code>,{" "}
            <code className="text-foreground">iPhone Call to Brain2.shortcut</code>,{" "}
            <code className="text-foreground">iPhone Text to Brain2.shortcut</code>{" "}
            in <code className="text-foreground">docs/shortcuts/</code>. Same Telegram Send Message as Notes
            — pick the @brain2_phone_bot chat on import. Recipes:{" "}
            <code className="text-foreground">screen-time-to-brain2.md</code>,{" "}
            <code className="text-foreground">iphone-calls-and-texts-to-brain2.md</code>.
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Pair this Telegram account (code above).</li>
            <li>
              AirDrop each <code className="text-foreground">.shortcut</code>, or open it on this Mac. On the
              phone: Settings → Shortcuts → Allow Untrusted Shortcuts, then tap Add Shortcut.
            </li>
            <li>
              Screen Time Asks for an app name (<code className="text-foreground">screen: Instagram</code>).
              Attach a duplicate to Automation → App Is Opened for a silent per-app ping.
            </li>
            <li>
              After a call, run Call (who + duration). From Messages, Share → iPhone Text to Brain2 (type
              the recipient).
            </li>
          </ol>
          <p>
            These never paint Mac Screen Time. Desktop test: Simulate{" "}
            <code className="text-foreground">screen: Instagram 30m</code>,{" "}
            <code className="text-foreground">call: Jane 12m</code>,{" "}
            <code className="text-foreground">text: Jane on my way</code>.
          </p>
        </div>
      </details>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">iPhone location</summary>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <p>
            The bot cannot pull location off the phone. AirDrop{" "}
            <code className="text-foreground">Location to Brain2.shortcut</code> in{" "}
            <code className="text-foreground">docs/shortcuts/</code> (same Telegram Send Message as Notes —
            pick the @brain2_phone_bot chat on import). Attach duplicates to Automation → Arrive and Leave
            (Ask Before Running off). Or share <strong>Live Location</strong> in the bot chat (Telegram →
            Location → Always), or text <code className="text-foreground">gps: Home</code>. Recipe:{" "}
            <code className="text-foreground">docs/shortcuts/iphone-location-to-brain2.md</code>.
          </p>
        </div>
      </details>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer text-foreground">Command cheat-sheet</summary>
        <pre className="mt-2 whitespace-pre-wrap font-sans">{INGEST_HELP}</pre>
      </details>

      <div className="space-y-2">
        <Label htmlFor="ingest-simulate">Simulate a message</Label>
        <Textarea
          id="ingest-simulate"
          placeholder={`groc   or   ${IPHONE_NOTES_DUMP_EXAMPLE.split("\n")[0]}`}
          value={simulate}
          onChange={(e) => setSimulate(e.target.value)}
          rows={6}
        />
        <Button type="button" variant="outline" onClick={handleSimulate}>
          Apply locally
        </Button>
        {simulateReply && <p className="text-sm">{simulateReply}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="ingest-scan">Simulate a scan</Label>
        <Input
          id="ingest-scan-caption"
          placeholder="caption: receipt · journal: morning · pdf · or leave blank"
          value={scanCaption}
          onChange={(e) => setScanCaption(e.target.value)}
        />
        <Input
          id="ingest-scan"
          type="file"
          accept="image/*,.pdf,application/pdf"
          onChange={(e) => void handleSimulateScan(e)}
        />
        <p className="text-xs text-muted-foreground">
          Photo of a receipt or notebook, or a PDF. Local OCR — same path as Telegram.
        </p>
      </div>
    </div>
  )
}
