/**
 * components/Mobile/MobileNfcCard.tsx — Read a sticker and post `nfc:` to the hub.
 *
 * Shows only in the iOS build, where `BrainNfc` exists (`lib/mobile/nfc-bridge.ts`).
 * The first tap of a chip asks which saved tag it is. The phone remembers that.
 * A dose asks how many. Blank uses the quantity saved on the Mac. A door or a
 * plain event posts `nfc:{id}` with no question. Shortcuts stay the other way
 * to log a tag until a real phone scan is the one you trust.
 */
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { isNfcPluginAvailable, scanNfcTag } from "@/lib/mobile/nfc-bridge"
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
import { nfcScanLine, nfcTagAsksQuantity } from "@/lib/ingest/nfc-tag"

export function MobileNfcCard() {
  const [ready, setReady] = useState(false)
  const [setup, setSetup] = useState<NfcHubSetup | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [origin, setOrigin] = useState("")
  const [token, setToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [tags, setTags] = useState<NfcTagCatalogRow[]>([])
  const [bindUid, setBindUid] = useState<string | null>(null)
  const [ask, setAsk] = useState<{ uid: string; tag: NfcTagCatalogRow } | null>(null)
  const [count, setCount] = useState("")

  useEffect(() => {
    if (!isNfcPluginAvailable()) return
    const saved = readNfcHub(localStorage)
    setSetup(saved)
    setSetupOpen(!saved)
    if (saved) setOrigin(saved.origin)
    setReady(true)
  }, [])

  if (!ready) return null

  const run = async (work: () => Promise<string | void>) => {
    setBusy(true)
    try {
      const next = await work()
      if (next) setNote(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message !== "Canceled") setNote(message)
    } finally {
      setBusy(false)
    }
  }

  const post = async (hub: NfcHubSetup, text: string) => {
    const result = await sendNfcScan(hub, text)
    setAsk(null)
    setBindUid(null)
    setCount("")
    return result.reply || result.summary || (result.ok ? "Logged." : "Not logged.")
  }

  const continueWith = async (hub: NfcHubSetup, uid: string, tag: NfcTagCatalogRow) => {
    if (nfcTagAsksQuantity(tag)) {
      setAsk({ uid, tag })
      setBindUid(null)
      setCount("")
      setNote(`${tag.name}. How many? Blank uses ${tag.quantity ?? 1}.`)
      return
    }
    setNote(await post(hub, nfcScanLine(tag.id, null)))
  }

  const scan = () =>
    run(async () => {
      if (!setup) return "Save the hub first."
      const { id } = await scanNfcTag()
      const catalog = await loadNfcCatalog(setup)
      setTags(catalog)
      const next = afterNfcRead(id, readNfcChips(localStorage), catalog)
      if (next.action === "post") return post(setup, next.text)
      if (next.action === "ask") {
        setAsk({ uid: next.uid, tag: next.tag })
        setBindUid(null)
        setCount("")
        return `${next.tag.name}. How many? Blank uses ${next.tag.quantity ?? 1}.`
      }
      setAsk(null)
      setBindUid(next.uid)
      if (catalog.length === 0) return "No tags on the hub. Add them in Settings → NFC tags on the Mac."
      return next.action === "gone" ? `“${next.tagId}” is no longer on the hub. Pick the tag again.` : "Which tag is this sticker?"
    })

  const pick = (tag: NfcTagCatalogRow) =>
    run(async () => {
      if (!setup || !bindUid) return
      rememberNfcChip(localStorage, bindUid, tag.id)
      await continueWith(setup, bindUid, tag)
    })

  const sendCount = () =>
    run(async () => {
      if (!setup || !ask) return
      const line = lineForQuantity(ask.tag.id, count)
      if ("error" in line) return line.error
      return post(setup, line.text)
    })

  const rebind = () => {
    if (!ask) return
    forgetNfcChip(localStorage, ask.uid)
    setBindUid(ask.uid)
    setAsk(null)
    setNote("Which tag is this sticker?")
  }

  const save = () =>
    run(async () => {
      const nextOrigin = nfcHubOrigin(origin)
      const nextToken = token.trim()
      if (!nextOrigin || !nextToken) return "The hub URL and token are both required."
      const next = { origin: nextOrigin, token: nextToken }
      writeNfcHub(localStorage, next)
      setSetup(next)
      setOrigin(nextOrigin)
      setToken("")
      setSetupOpen(false)
      return "Hub saved."
    })

  return (
    <div className="cogs-mobile-pullcard" data-ui-name="NFC">
      <div className="cogs-mobile-pullcard-row">
        <strong>NFC</strong>
        <span>{setup ? "Hub saved. A sticker stays blank." : "Point this at the Mac hub."}</span>
        {note ? <span>{note}</span> : null}
      </div>

      {setupOpen ? (
        <div className="cogs-mobile-pullcard-row">
          <label>
            Hub URL
            <input
              className="w-full border px-1"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="http://mac.local:8787"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </label>
          <label>
            Hub token
            <input
              className="w-full border px-1"
              type="password"
              autoCapitalize="off"
              autoCorrect="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <Button type="button" className="w-full" disabled={busy} onClick={save}>
            Save hub
          </Button>
        </div>
      ) : null}

      {bindUid && tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Button key={tag.id} type="button" size="sm" variant="outline" disabled={busy} onClick={() => pick(tag)}>
              {tag.name}
            </Button>
          ))}
        </div>
      ) : null}

      {ask ? (
        <div className="cogs-mobile-pullcard-row">
          <label>
            How many {ask.tag.name}?
            <input
              className="w-full border px-1"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={sendCount}>
              Log
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={rebind}>
              Not this tag
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !setup} onClick={scan}>
          Scan sticker
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setSetupOpen((open) => !open)}>
          {setupOpen ? "Hide hub" : "Hub"}
        </Button>
      </div>
    </div>
  )
}
