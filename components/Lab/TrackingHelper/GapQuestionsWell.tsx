/**
 * components/Lab/TrackingHelper/GapQuestionsWell.tsx — Run the gap questions pipeline on the past 7 days
 *
 * The Tracking BIMBY's second pipeline (`lib/tracking-helper/gaps.ts`). Reads the Tracking store, shows how much of
 * the week each lane covers and the questions it would ask. "Use" puts a question's seed into the description to
 * timeblock "Try it" box. Pure code, no model, writes nothing. Copy gives a step-by-step report.
 */
"use client"

import { useState } from "react"
import { clockText } from "@/lib/tracking-helper/clock"
import { runGapQuestions, type GapRun } from "@/lib/tracking-helper/gaps"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { CopyReportButton } from "../Agents/CopyReportButton"
import type { RunReport } from "../Agents/run-report"

const lanePct = (n: number) => `${n}%`

export function reportOfGaps(run: GapRun): RunReport {
  const s = run.summary
  return {
    agent: "Tracking BIMBY · generate gap questions pipeline",
    where: "lib/tracking-helper/gaps.ts",
    input: `Past 7 days, ${run.dates[0]} to ${run.dates[run.dates.length - 1]}`,
    summary: `activity ${lanePct(s.activity)} · location ${lanePct(s.location)} · company ${lanePct(s.company)} · ${s.foodEntries} food entries · ${run.gaps.length} gaps · ${run.questions.length} questions`,
    stages: run.trace.map((t) => ({ stage: t.stage, note: t.note, ms: t.ms, output: t.output })),
    result: run.questions.map((q) => `[${q.lane}] ${q.text} (${q.reason})`),
  }
}

export function GapQuestionsWell({ onUseSeed }: { onUseSeed: (seed: string) => void }) {
  const [run, setRun] = useState<GapRun | null>(null)

  const go = () => setRun(runGapQuestions(useTimeTrackingStore.getState().entries))

  return (
    <section className="bf-inspector th-try" aria-label="Gap questions">
      <b className="bf-k">Generate gap questions pipeline</b>
      <CopyReportButton report={run ? reportOfGaps(run) : null} />
      <div className="bf-row">
        <button type="button" data-no95 className="bf-cap" onClick={go}>
          Run on the past 7 days
        </button>
      </div>
      {run ? (
        <>
          <p className="th-live">
            activity <b>{lanePct(run.summary.activity)}</b> · location <b>{lanePct(run.summary.location)}</b> · company <b>{lanePct(run.summary.company)}</b> · food <b>{run.summary.foodEntries}</b> entries · {run.gaps.length} gaps
          </p>
          <ul className="th-blocks">
            {run.coverage.map((c) => (
              <li key={c.date}>
                <b>{c.date.slice(5)}</b>{" "}
                {c.awakeMin ? `activity ${lanePct(c.lanes.activity.percent)} · location ${lanePct(c.lanes.location.percent)} · company ${lanePct(c.lanes.company.percent)} · food ${c.foodEntries}` : <span className="bf-k">not yet</span>}
              </li>
            ))}
          </ul>
          <ol className="th-trace">
            {run.questions.map((q) => (
              <li key={q.id} className="bf-step">
                <b>{q.text}</b> <span className="bf-k">{q.lane} · {clockText(q.startMin)}–{clockText(q.endMin)} · {q.reason}</span>
                {q.seed ? (
                  <button type="button" data-no95 className="th-link" onClick={() => onUseSeed(q.seed)} title="Put the opening words in Try it above">
                    Use
                  </button>
                ) : null}
              </li>
            ))}
            {!run.questions.length ? <li className="bf-k">No big gaps in the past 7 days.</li> : null}
          </ol>
        </>
      ) : (
        <p className="th-help">Measures how much awake time in the past 7 days Activity, Location and Company cover, counts food entries, and asks about the biggest holes. Use puts a question's opening words in Try it, so the answer becomes blocks. Nothing is written.</p>
      )}
    </section>
  )
}
