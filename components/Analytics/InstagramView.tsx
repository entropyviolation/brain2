/**
 * components/Analytics/InstagramView.tsx — Sources → Instagram
 *
 * Hosts the generated Instagram report (`report.html` from the person's
 * `build_report.py`) in a frame this view owns. The report keeps its own look
 * and script; nothing here restyles it. Above the frame: export date, last
 * updated, the watched folders, and the last error (the previous report stays
 * on screen when a run fails).
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPersonFromInstagram, linkInstagramToPerson, personForInstagram, unlinkInstagramFromPerson } from "@/lib/instagram-person-links"
import { personRecords } from "@/lib/people-i-know"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import {
  INSTAGRAM_EXPORT_URL,
  STANDALONE_EXPORT_SNIPPET,
  formatExportDate,
  formatInstagramStamp,
  instagramSource,
  parseStandaloneSettings,
  readAccountRequest,
  readReportStateMessage,
  takePendingInstagramOpen,
  type InstagramRemoved,
  type InstagramSource,
  type InstagramStatus,
} from "@/lib/instagram-report"
import { parseLocalDate } from "@/lib/date-utils"
import {
  instagramExportReminderOn,
  nextInstagramExportReminder,
  seedInstagramExportReminderOnce,
  setInstagramExportReminder,
} from "@/lib/instagram-export-reminder"
import { INSTAGRAM_EXPORT_STEPS } from "@/lib/instagram-export-steps"
import { formatReminderWhen } from "@/lib/reminders"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"
import { syncInstagramListsFromReport } from "@/lib/instagram-lists-sync"
import { syncInstagramSessionsFromReport } from "@/lib/instagram-sessions-sync"
import "./instagram-view.css"

function ExportSteps() {
  const [first, ...rest] = INSTAGRAM_EXPORT_STEPS
  return (
    <ol className="an-ig-steps">
      <li>
        {first.replace(/\.$/, "")} (
        <a href={INSTAGRAM_EXPORT_URL} target="_blank" rel="noreferrer">
          accountscenter.instagram.com
        </a>
        ).
      </li>
      {rest.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  )
}

/**
 * Monthly "request a new export" switch. The reminder is a row on the
 * Reminders list (`lib/instagram-export-reminder.ts`), seeded once per device.
 */
function ExportReminder({ exportDate, ready }: { exportDate: string | null; ready: boolean }) {
  const tasks = useTaskStore((s) => s.tasks)
  const on = instagramExportReminderOn(tasks)
  const next = nextInstagramExportReminder(tasks)
  const lastExport = exportDate ? parseLocalDate(exportDate) : null

  // Seed once, after the vault and the report status load, so the first
  // fire counts from the export date. A later export does not reseed.
  useEffect(() => {
    if (!ready) return
    return afterPersistHydrated(useTaskStore.persist, () => void seedInstagramExportReminderOnce(new Date(), lastExport))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <span className="an-ig-field" title="A monthly item on the Reminders list with the export link and steps.">
      <b>Reminder</b> {on && next ? formatReminderWhen(next) : "off"}{" "}
      <button
        type="button"
        className="an-range-chip"
        aria-pressed={on}
        onClick={() => setInstagramExportReminder(!on, new Date(), lastExport)}
      >
        {on ? "Turn off" : "Remind me monthly"}
      </button>
    </span>
  )
}

/**
 * DMs an earlier export held and a later one does not: unsent, deleted, or
 * edited. Read from the archive (`electron/instagram-archive.js`) when opened.
 */
function RemovedMessages({ source, buildId }: { source: InstagramSource; buildId: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<InstagramRemoved | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !source.removed) return
    let live = true
    source
      .removed()
      .then((d) => live && setData(d))
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [open, source, buildId])

  if (!source.removed) return null
  const rows = data?.rows ?? []
  const label = { removed: "Unsent or deleted", edited: "Edited", "thread-gone": "Chat gone" } as const

  return (
    <details className="an-ig-more" data-testid="instagram-removed" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Unsent, deleted and edited messages{data ? ` (${rows.length})` : ""}</summary>
      {error ? <p className="an-ig-error">Could not read the archive: {error}</p> : null}
      {data && data.exports < 2 ? (
        <p>Brain2 has {data.exports === 1 ? "one export" : "no exports"} so far. A message shows here once an earlier export has it and a later one does not.</p>
      ) : null}
      {data && data.exports >= 2 && rows.length === 0 ? <p>No message has gone missing between the {data.exports} archived exports.</p> : null}
      {rows.length ? (
        <>
          <p className="an-ig-note">
            A message is here when an earlier export had it and a later one did not. Anything sent and removed between two
            exports was never captured.
          </p>
          <ul className="an-ig-removed">
            {rows.map((r) => (
              <li key={`${r.thread}|${r.ts}|${r.sender}|${r.content ?? ""}`}>
                <b>{r.sender}</b> in {r.title || r.thread} · {formatInstagramStamp(new Date(r.ts).toISOString())} ·{" "}
                {label[r.kind]}, last in the {formatExportDate(r.lastSeen)} export, gone by {formatExportDate(r.removedSince)}
                <div className="an-ig-removed-text">
                  {r.content ?? (r.share?.link ? r.share.link : r.media?.length ? `${r.media.length} attachment(s)` : "(no text)")}
                  {r.kind === "edited" && r.editedTo !== undefined ? <> → {r.editedTo}</> : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </details>
  )
}

export function InstagramView() {
  const [source] = useState<InstagramSource | null>(() => instagramSource())
  const [status, setStatus] = useState<InstagramStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [importText, setImportText] = useState("")
  const [importNote, setImportNote] = useState<string | null>(null)
  const [listsNote, setListsNote] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [paneHeight, setPaneHeight] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    if (!source) return
    try {
      setStatus(await source.status())
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [source])

  useEffect(() => {
    void refresh()
    if (!source) return
    const off = source.onChange?.(() => void refresh())
    // Chrome dev has no push; the desktop app may finish a run meanwhile.
    const timer = source.onChange ? null : window.setInterval(() => void refresh(), 60_000)
    return () => {
      off?.()
      if (timer) window.clearInterval(timer)
    }
  }, [refresh, source])

  // The report tells us when a manual match, column choice, or photo toggle changes.
  useEffect(() => {
    if (!source) return
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return
      const msg = readReportStateMessage(e.data)
      if (msg) void source.saveUi(msg.key, msg.value)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [source])

  // The account card's Person link: the frame asks, Brain2 answers with who carries the handle.
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const people = useMemo(() => personRecords(tasks, lists), [tasks, lists])
  const openHandle = useRef<string | null>(null)
  const sendPersonState = useCallback(() => {
    const handle = openHandle.current
    const win = frameRef.current?.contentWindow
    if (!handle || !win) return
    const linked = personForInstagram(people, handle)
    win.postMessage(
      {
        brain2Instagram: "person-state",
        handle,
        linked: linked ? { id: linked.id, name: linked.title || linked.description || linked.id } : null,
        people: people
          .filter((p) => !p.personProfile?.self)
          .map((p) => ({ id: p.id, name: p.title || p.description || p.id }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
      "*",
    )
  }, [people])
  useEffect(() => sendPersonState(), [sendPersonState])
  useEffect(() => {
    if (!source) return
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return
      const req = readAccountRequest(e.data)
      if (!req) return
      if (req.type === "opened") {
        openHandle.current = req.handle
        sendPersonState()
      } else if (req.type === "create") createPersonFromInstagram(req.handle, req.name)
      else if (req.type === "attach") linkInstagramToPerson(req.personId, req.handle)
      else if (req.type === "detach") unlinkInstagramFromPerson(req.personId, req.handle)
      else if (req.type === "open-person") openItemDetailPopup(req.personId)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [source, sendPersonState])

  // The frame is as tall as the Analytics pane, so the report scrolls inside
  // it and its sticky nav sticks, as it does in its own window.
  useEffect(() => {
    const pane = rootRef.current?.closest(".an-content") as HTMLElement | null
    if (!pane || typeof ResizeObserver === "undefined") return
    const measure = () => setPaneHeight(pane.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(pane)
    return () => ro.disconnect()
  }, [source])

  const checkNow = async () => {
    if (!source?.scan) return
    setBusy(true)
    try {
      setStatus(await source.scan())
    } finally {
      setBusy(false)
    }
  }

  const updateLists = async () => {
    setListsNote("Updating…")
    const result = await syncInstagramListsFromReport({ force: true, source })
    const sessions = await syncInstagramSessionsFromReport({ force: true, source })
    setListsNote(sessions.status === "applied" ? `${result.message} ${sessions.message}` : result.message)
  }

  const pickFolder = async (clear?: boolean) => {
    if (!source?.pickFolder) return
    setStatus(await source.pickFolder(clear))
  }

  const importSettings = async () => {
    const parsed = parseStandaloneSettings(importText)
    if (!parsed || !source) {
      setImportNote("That is not the text the snippet copies.")
      return
    }
    for (const [k, v] of Object.entries(parsed)) await source.saveUi(k as keyof typeof parsed, v ?? null)
    setImportText("")
    setImportNote(`Brought over ${Object.keys(parsed).length} setting${Object.keys(parsed).length === 1 ? "" : "s"}.`)
    setReloadKey((n) => n + 1)
  }

  if (!source) {
    return (
      <div className="an-ig" data-testid="instagram-view">
        <p className="an-ig-empty">
          The Instagram report is built and shown by the Brain2 desktop app on your computer. This build cannot run
          it.
        </p>
        <div className="an-ig-bar">
          <ExportReminder exportDate={null} ready />
        </div>
      </div>
    )
  }

  const current = status?.current
  const deps = status?.deps
  const depsMissing =
    deps && !deps.ok
      ? [
          !deps.pythonFound ? `Python at ${deps.python}` : null,
          !deps.scriptsFound ? "analyze.py and build_report.py" : null,
          deps.missingModules.length ? `Python packages: ${deps.missingModules.join(", ")}` : null,
        ].filter(Boolean)
      : []

  return (
    <div className="an-ig" data-testid="instagram-view" ref={rootRef}>
      <div className="an-ig-bar">
        <span className="an-ig-field" title="The date Meta put in the export's name">
          <b>Export</b> {current ? formatExportDate(current.exportDate) : "none yet"}
        </span>
        <span className="an-ig-field" title="When Brain2 last built this report">
          <b>Last updated</b> {current ? formatInstagramStamp(current.builtAt) : "never"}
        </span>
        <ExportReminder exportDate={current?.exportDate ?? null} ready={status !== null} />
        {status?.drive?.length ? (
          <span className="an-ig-field" title={`Meta's scheduled export is read from ${status.drive.join(", ")}`}>
            <b>Google Drive</b> watched
          </span>
        ) : null}
        {status?.running ? <span className="an-ig-field an-ig-running">Building a new report…</span> : null}
        {source.canIngest ? (
          <span className="an-ig-actions">
            <button
              type="button"
              className="an-range-chip"
              disabled={busy || status?.running}
              title="Look in the watched folders for a new export now, and retry one that failed."
              onClick={() => void checkNow()}
            >
              Check now
            </button>
            <button
              type="button"
              className="an-range-chip"
              title={`Watched: ${[...(status?.watching ?? []), ...(status?.drive ?? [])].join(", ") || "Downloads"}. Add one more folder.`}
              onClick={() => void pickFolder()}
            >
              Watch a folder…
            </button>
            <button
              type="button"
              className="an-range-chip"
              disabled={!status?.hasReport}
              title="Write this report's followers, following, mutuals, no follow-back, fans, pending and blocked onto the seven Instagram lists. Done on its own for each new report; use this to redo it."
              onClick={() => void updateLists()}
            >
              Update my lists
            </button>
            {status && status.watching.length > 1 ? (
              <button
                type="button"
                className="an-range-chip"
                title={`Stop watching ${status.watching[1]}`}
                onClick={() => void pickFolder(true)}
              >
                Stop watching {status.watching[1].split(/[\\/]/).pop()}
              </button>
            ) : null}
          </span>
        ) : (
          <span className="an-ig-field">New exports are picked up by the desktop app.</span>
        )}
      </div>

      {listsNote ? (
        <p className="an-ig-note" role="status">
          {listsNote}
        </p>
      ) : null}

      {loadError ? <p className="an-ig-error">Could not read the report status: {loadError}</p> : null}

      {status?.lastError ? (
        <div className="an-ig-error" role="status">
          <p>
            The last run failed at <b>{status.lastError.step}</b> ({formatInstagramStamp(status.lastError.at)}):{" "}
            {status.lastError.message}
            {current ? ` The report below is still the ${formatExportDate(current.exportDate)} export.` : ""}
          </p>
          {status.lastError.stderr ? (
            <details>
              <summary>Output</summary>
              <pre>{status.lastError.stderr}</pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {depsMissing.length ? <p className="an-ig-error">Missing: {depsMissing.join("; ")}.</p> : null}
      {deps && deps.ok && !deps.ffmpeg ? (
        <p className="an-ig-note">ffmpeg was not found, so video posts get no thumbnail.</p>
      ) : null}

      {status && !status.hasReport ? (
        <div className="an-ig-empty">
          <p>No Instagram export has been read yet. To get one:</p>
          <ExportSteps />
        </div>
      ) : null}

      {status?.hasReport && current ? (
        <iframe
          key={`${current.buildId}:${reloadKey}`}
          ref={frameRef}
          className="an-ig-frame"
          title="Instagram report"
          src={`${status.reportBase}report.html`}
          allow="clipboard-write; fullscreen"
          style={paneHeight ? { height: Math.max(480, paneHeight - 24) } : undefined}
          allowFullScreen
          onLoad={() => {
            const handle = takePendingInstagramOpen()
            if (handle) frameRef.current?.contentWindow?.postMessage({ brain2Instagram: "open-account", handle }, "*")
          }}
        />
      ) : null}

      {status?.hasReport && current ? <RemovedMessages source={source} buildId={current.buildId} /> : null}

      {status?.hasReport ? (
        <details className="an-ig-more">
          <summary>Get a newer export, or bring settings from the standalone report</summary>
          <ExportSteps />
          <p>
            Manual DM matches come over from matches.json. Hidden columns and the profile-photo choice live in the
            browser that opened report.html, so copy them once: open that report, paste this in its console, then
            paste the result here.
          </p>
          <pre className="an-ig-snippet">{STANDALONE_EXPORT_SNIPPET}</pre>
          <textarea
            className="an-ig-paste"
            value={importText}
            placeholder='{"ig-hide-cols":"[…]","ig-photos":"true"}'
            onChange={(e) => {
              setImportText(e.target.value)
              setImportNote(null)
            }}
          />
          <button type="button" className="an-range-chip" disabled={!importText.trim()} onClick={() => void importSettings()}>
            Bring over
          </button>
          {importNote ? <span className="an-ig-note"> {importNote}</span> : null}
        </details>
      ) : null}
    </div>
  )
}
