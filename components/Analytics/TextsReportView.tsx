/**
 * components/Analytics/TextsReportView.tsx — Analytics → Texts → Report
 *
 * Frames the texts report exactly as `scripts/texts-analysis/` draws it. The
 * report keeps its own look on purpose (allie, 2026-10-22): no studio skin, no
 * restyle. This view only starts the loopback server, shows when it last
 * updated, and offers Update now. It refreshes itself daily (first check after 04:00).
 *
 * It also hands the frame People I Know (names and saved numbers) by
 * postMessage, so a relationship page can link its chat to a Person. A link
 * saves the chat's numbers on that Person (`lib/phone-person-links.ts`). Only
 * messages from the frame's own window and origin are read.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  getDesktopTextsBridge,
  readReportRequest,
  TEXTS_WEB_BUILD_SENTENCE,
  textsUpdatedLabel,
  type ReportPerson,
  type TextsStatus,
} from "@/lib/texts-report"
import { linkHandlesToPerson, unlinkHandlesFromPerson } from "@/lib/phone-person-links"
import { personRecords } from "@/lib/people-i-know"
import { openItemDetailPage } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import { ChartFrame } from "./chart-frame"

type State =
  | { kind: "loading" }
  | { kind: "web" }
  | { kind: "error"; message: string }
  | { kind: "ready"; url: string; status?: TextsStatus }

export function TextsReportView() {
  const [state, setState] = useState<State>({ kind: "loading" })
  const [frameKey, setFrameKey] = useState(0)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const people = useMemo<ReportPerson[]>(
    () =>
      personRecords(tasks, lists).map((p) => ({
        id: p.id,
        name: p.title || p.description || p.id,
        nicknames: p.personProfile?.nicknames,
        handles: [...(p.personProfile?.phones ?? []), ...(p.personProfile?.emails ?? [])],
      })),
    [tasks, lists],
  )
  const frameOrigin = state.kind === "ready" ? new URL(state.url).origin : null

  const sendPeople = useCallback(() => {
    const win = frameRef.current?.contentWindow
    if (win && frameOrigin) win.postMessage({ source: "brain2", type: "people", people }, frameOrigin)
  }, [people, frameOrigin])

  // Keep the frame's copy current; it asks again with "ready" after each load.
  useEffect(() => sendPeople(), [sendPeople])

  useEffect(() => {
    if (!frameOrigin) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== frameOrigin || event.source !== frameRef.current?.contentWindow) return
      const req = readReportRequest(event.data)
      if (!req) return
      if (req.type === "ready") sendPeople()
      else if (!people.some((p) => p.id === req.personId)) return
      else if (req.type === "link") linkHandlesToPerson(req.personId, req.handles)
      else if (req.type === "unlink") unlinkHandlesFromPerson(req.personId, req.handles)
      else openItemDetailPage(req.personId)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [frameOrigin, sendPeople, people])

  const start = useCallback(async () => {
    const bridge = getDesktopTextsBridge()
    if (!bridge) {
      setState({ kind: "web" })
      return
    }
    const res = await bridge.ensureServer()
    if (res.ok && res.url) setState({ kind: "ready", url: res.url, status: res.status })
    else setState({ kind: "error", message: res.ok ? "The texts server gave no address." : res.error })
  }, [])

  useEffect(() => {
    void start()
  }, [start])

  // While a run is going, check every 20 s and reload the frame when it ends.
  const running = state.kind === "ready" && state.status?.running
  useEffect(() => {
    if (!running) return
    const bridge = getDesktopTextsBridge()
    const timer = setInterval(async () => {
      const res = await bridge?.status()
      if (!res?.ok) return
      setState((s) => (s.kind === "ready" ? { ...s, status: res.status } : s))
      if (!res.status?.running) setFrameKey((k) => k + 1)
    }, 20000)
    return () => clearInterval(timer)
  }, [running])

  const update = async () => {
    const res = await getDesktopTextsBridge()?.refresh()
    if (res?.ok) setState((s) => (s.kind === "ready" ? { ...s, status: { ...s.status, ...res.status, running: true } } : s))
    else if (res && !res.ok) setState({ kind: "error", message: res.error })
  }

  return (
    <div className="an-canvas an-stack" data-testid="texts-report-view" style={{ height: "100%" }}>
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Texts</p>
          <p className="an-canvas-kicker">
            Messages on this Mac, read locally. {state.kind === "ready" ? textsUpdatedLabel(state.status) : null}
            {state.kind === "ready" ? " · Updates daily." : null}
          </p>
        </div>
        {state.kind === "ready" ? (
          <button type="button" className="an-chip" onClick={() => void update()} disabled={Boolean(state.status?.running)}>
            Update now
          </button>
        ) : null}
      </header>
      {state.kind === "loading" ? <ChartFrame empty emptySentence="Starting the texts report…" /> : null}
      {state.kind === "web" ? <ChartFrame empty emptySentence={TEXTS_WEB_BUILD_SENTENCE} /> : null}
      {state.kind === "error" ? <ChartFrame empty emptySentence={state.message} /> : null}
      {state.kind === "ready" ? (
        <iframe
          ref={frameRef}
          key={frameKey}
          title="Texts report"
          src={state.url}
          style={{ flex: 1, width: "100%", minHeight: "78vh", border: 0, background: "transparent" }}
        />
      ) : null}
    </div>
  )
}
