/**
 * components/Mobile/nfc-hub/MobileNfcHub.tsx — Phone page for the NFC radio
 *
 * Writes the testing-settings record (hub URL, token, sync URL), reads that
 * record back, and scans a sticker the same way the home card does. The
 * radio is `BrainNfc` in `lib/mobile/nfc-bridge.ts`. A browser shows the
 * page and says the radio is only in the iPhone app.
 */
"use client"

import { useEffect, useState } from "react"
import { MobileLogin } from "@/components/Mobile/MobileLogin"
import { readMobileSession, type MobileAuthSession } from "@/lib/mobile-auth"
import { isNfcPluginAvailable, readNfcTag, scanNfcTag, writeNfcTag } from "@/lib/mobile/nfc-bridge"
import { encodeTestingSettings, parseTestingSettings, type TestingSettings } from "@/lib/mobile/nfc-settings"
import {
  afterNfcRead,
  forgetNfcChip,
  lineForQuantity,
  loadNfcCatalog,
  nfcHubOrigin,
  readNfcChips,
  readNfcHub,
  rememberNfcChip,
  sendNfcScan,
  writeNfcHub,
  type NfcHubSetup,
  type NfcTagCatalogRow,
} from "@/lib/mobile/nfc-scan"
import { readMobileSyncUrl, writeMobileSyncUrl } from "@/lib/mobile-sync"
import { nfcScanLine, nfcTagAsksQuantity } from "@/lib/ingest/nfc-tag"
import "./nfc-hub.css"

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function MobileNfcHubScreen() {
  const [session, setSession] = useState<MobileAuthSession | null>(null)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    setSession(readMobileSession())
    setBooted(true)
  }, [])

  if (!booted) return <div className="nfc-hub" />
  if (!session) return <MobileLogin onLoggedIn={() => setSession(readMobileSession())} />
  return <MobileNfcHub />
}

export function MobileNfcHub() {
  const [origin, setOrigin] = useState("")
  const [token, setToken] = useState("")
  const [savedToken, setSavedToken] = useState("")
  const [syncUrl, setSyncUrl] = useState("")
  const [radio, setRadio] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState(false)
  const [readText, setReadText] = useState<string | null>(null)
  const [readSettings, setReadSettings] = useState<TestingSettings | null>(null)
  const [tags, setTags] = useState<NfcTagCatalogRow[]>([])
  const [bindUid, setBindUid] = useState<string | null>(null)
  const [ask, setAsk] = useState<{ uid: string; tag: NfcTagCatalogRow } | null>(null)
  const [count, setCount] = useState("")

  useEffect(() => {
    const saved = readNfcHub(localStorage)
    if (saved) {
      setOrigin(saved.origin)
      setSavedToken(saved.token)
    }
    setSyncUrl(readMobileSyncUrl())
    setRadio(isNfcPluginAvailable())
  }, [])

  const say = (text: string, error = false) => {
    setNote(text)
    setNoteError(error)
  }

  const run = async (work: () => Promise<string | void>) => {
    setBusy(true)
    try {
      const next = await work()
      if (next) say(next)
    } catch (err) {
      const message = messageOf(err)
      if (message !== "Canceled") say(message, true)
    } finally {
      setBusy(false)
    }
  }

  const drafted = (): TestingSettings | { error: string } => {
    const nextOrigin = nfcHubOrigin(origin)
    const nextToken = token.trim() || savedToken
    if (!nextOrigin || !nextToken) return { error: "The hub URL and token are both required." }
    const rawSync = syncUrl.trim()
    if (!rawSync) return { origin: nextOrigin, token: nextToken, syncUrl: "" }
    const nextSync = nfcHubOrigin(rawSync)
    if (!nextSync) return { error: "The sync URL needs to be an http address." }
    return { origin: nextOrigin, token: nextToken, syncUrl: nextSync }
  }

  const remember = (settings: TestingSettings) => {
    writeNfcHub(localStorage, { origin: settings.origin, token: settings.token })
    setOrigin(settings.origin)
    setSavedToken(settings.token)
    setToken("")
    if (settings.syncUrl) {
      writeMobileSyncUrl(settings.syncUrl)
      setSyncUrl(settings.syncUrl)
    }
  }

  const hubSetup = (): NfcHubSetup | { error: string } => {
    const settings = drafted()
    if ("error" in settings) return settings
    remember(settings)
    return { origin: settings.origin, token: settings.token }
  }

  const writeSettings = () =>
    run(async () => {
      const settings = drafted()
      if ("error" in settings) throw new Error(settings.error)
      remember(settings)
      await writeNfcTag(encodeTestingSettings(settings))
      setReadText(null)
      setReadSettings(null)
      return "Testing settings are on the sticker."
    })

  const readTag = () =>
    run(async () => {
      const { text } = await readNfcTag()
      setBindUid(null)
      setAsk(null)
      if (!text) {
        setReadText("")
        setReadSettings(null)
        return "This sticker is blank."
      }
      const settings = parseTestingSettings(text)
      setReadText(text)
      setReadSettings(settings)
      return settings ? "Read testing settings." : "Read the sticker."
    })

  const applyRead = () => {
    if (!readSettings) return
    remember(readSettings)
    say("Saved on this phone.")
  }

  const post = async (hub: NfcHubSetup, text: string) => {
    const result = await sendNfcScan(hub, text)
    setAsk(null)
    setBindUid(null)
    setCount("")
    return result.reply || result.summary || (result.ok ? "Logged." : "Not logged.")
  }

  const continueWith = async (hub: NfcHubSetup, tag: NfcTagCatalogRow) => {
    if (nfcTagAsksQuantity(tag)) {
      setAsk({ uid: bindUid ?? "", tag })
      setBindUid(null)
      setCount("")
      return `${tag.name}. How many? Blank uses ${tag.quantity ?? 1}.`
    }
    return post(hub, nfcScanLine(tag.id, null))
  }

  const scan = () =>
    run(async () => {
      const hub = hubSetup()
      if ("error" in hub) throw new Error(hub.error)
      const { id } = await scanNfcTag()
      const catalog = await loadNfcCatalog(hub)
      setTags(catalog)
      setReadText(null)
      setReadSettings(null)
      const next = afterNfcRead(id, readNfcChips(localStorage), catalog)
      if (next.action === "post") return post(hub, next.text)
      if (next.action === "ask") {
        setAsk({ uid: next.uid, tag: next.tag })
        setBindUid(null)
        setCount("")
        return `${next.tag.name}. How many? Blank uses ${next.tag.quantity ?? 1}.`
      }
      setAsk(null)
      setBindUid(next.uid)
      if (catalog.length === 0) return "No tags on the hub. Add them in Settings → NFC tags on the Mac."
      return next.action === "gone"
        ? `“${next.tagId}” is no longer on the hub. Pick the tag again.`
        : "Which tag is this sticker?"
    })

  const pick = (tag: NfcTagCatalogRow) =>
    run(async () => {
      const hub = hubSetup()
      if ("error" in hub) throw new Error(hub.error)
      if (!bindUid) return
      rememberNfcChip(localStorage, bindUid, tag.id)
      setAsk(nfcTagAsksQuantity(tag) ? { uid: bindUid, tag } : null)
      return continueWith(hub, tag)
    })

  const sendCount = () =>
    run(async () => {
      const hub = hubSetup()
      if ("error" in hub) throw new Error(hub.error)
      if (!ask) return
      const line = lineForQuantity(ask.tag.id, count)
      if ("error" in line) throw new Error(line.error)
      return post(hub, line.text)
    })

  const rebind = () => {
    if (!ask) return
    forgetNfcChip(localStorage, ask.uid)
    setBindUid(ask.uid)
    setAsk(null)
    say("Which tag is this sticker?")
  }

  return (
    <div className="nfc-hub" data-ui-name="NFC hub">
      <div className="nfc-hub-top">
        <h1>NFC hub</h1>
        <a className="nfc-hub-back" href="/mobile/">
          Home
        </a>
      </div>
      <p>
        {radio
          ? "Write testing settings onto a sticker, read them back, or scan a sticker to log it."
          : "NFC read and write run in the iPhone app. This browser cannot use the radio. The Simulator cannot either."}
      </p>

      <div className="nfc-hub-fields">
        <label>
          Hub URL
          <input
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="http://mac.local:8787"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
          />
        </label>
        <label>
          Hub token
          <input
            type="password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={savedToken ? "Saved on this phone" : ""}
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <label>
          Sync URL
          <input
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="http://mac.local:3000"
            value={syncUrl}
            onChange={(event) => setSyncUrl(event.target.value)}
          />
        </label>
      </div>

      <div className="nfc-hub-actions">
        <button type="button" className="nfc-hub-btn" disabled={busy} onClick={writeSettings}>
          Write testing settings
        </button>
        <button type="button" className="nfc-hub-btn" disabled={busy} onClick={readTag}>
          Read tag
        </button>
        <button type="button" className="nfc-hub-btn" disabled={busy} onClick={scan}>
          Scan sticker
        </button>
      </div>

      {note ? (
        <p className="nfc-hub-note" role={noteError ? "alert" : "status"} data-kind={noteError ? "error" : "ok"}>
          {note}
        </p>
      ) : null}

      {readText ? (
        <div className="nfc-hub-read">
          {readSettings ? (
            <>
              <p>
                Hub {readSettings.origin}. Sync {readSettings.syncUrl || "left as it is"}.
              </p>
              <button type="button" className="nfc-hub-btn" disabled={busy} onClick={applyRead}>
                Save on this phone
              </button>
            </>
          ) : null}
          {readText && !readSettings ? <pre>{readText}</pre> : null}
        </div>
      ) : null}

      {bindUid && tags.length > 0 ? (
        <div className="nfc-hub-row">
          {tags.map((tag) => (
            <button key={tag.id} type="button" className="nfc-hub-btn" disabled={busy} onClick={() => pick(tag)}>
              {tag.name}
            </button>
          ))}
        </div>
      ) : null}

      {ask ? (
        <div className="nfc-hub-fields">
          <label>
            How many {ask.tag.name}?
            <input inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} />
          </label>
          <div className="nfc-hub-row">
            <button type="button" className="nfc-hub-btn" disabled={busy} onClick={sendCount}>
              Log
            </button>
            <button type="button" className="nfc-hub-btn" disabled={busy} onClick={rebind}>
              Not this tag
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
