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

import { useCallback, useEffect, useRef, useState } from "react"
import {
  INSTAGRAM_EXPORT_URL,
  STANDALONE_EXPORT_SNIPPET,
  formatExportDate,
  formatInstagramStamp,
  instagramSource,
  parseStandaloneSettings,
  readReportStateMessage,
  type InstagramSource,
  type InstagramStatus,
} from "@/lib/instagram-report"
import "./instagram-view.css"

function ExportSteps() {
  return (
    <ol className="an-ig-steps">
      <li>
        Open Accounts Center → Your information and permissions → Download your information (
        <a href={INSTAGRAM_EXPORT_URL} target="_blank" rel="noreferrer">
          accountscenter.instagram.com
        </a>
        ).
      </li>
      <li>Create export → Export to device. Pick All time, JSON, and all information.</li>
      <li>When Meta emails that it is ready (it can take days), download the zip within 4 days into Downloads.</li>
      <li>Brain2 desktop picks it up from Downloads, copies it into its own data folder, and builds this report.</li>
    </ol>
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
              title={`Watched: ${(status?.watching ?? []).join(", ") || "Downloads"}. Add one more folder.`}
              onClick={() => void pickFolder()}
            >
              Watch a folder…
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
        />
      ) : null}

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
