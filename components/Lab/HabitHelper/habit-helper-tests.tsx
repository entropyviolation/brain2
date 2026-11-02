/**
 * components/Lab/HabitHelper/habit-helper-tests.tsx — Test the Habits BIMBY's flow
 *
 * Mounted under the bench on `/lab/habit-helper`. A case is a message, the moment it was said, the proposals it
 * must become, and the model's recorded MATCH answer (`lib/habit-helper/tests.ts`), all against the fixed
 * `FIXTURE` habits so the person's own data never changes an answer. **Replay** runs the code stages on the
 * recording. **Rules** runs the rules reader: what the chat does with Ollama off. **Live** asks the model again.
 */
"use client"

import { useState } from "react"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { loadFlow } from "@/lib/habit-helper/flow"
import { runHabitsBimby, type HabitsBimbyRun } from "@/lib/habit-helper/run"
import { byRules, compare, fixtureCtx, loadTests, replay, rowOf, rowText, rowsFrom, saveMine, type ExpectRow, type HabitsBimbyTest, type TestResult } from "@/lib/habit-helper/tests"
import type { Matching } from "@/lib/habit-helper/types"
import "../TrackingHelper/helper-tests.css"

type Mode = "replay" | "rules" | "live"
type Done = TestResult & { mode: Mode; ms: number }

async function live(text: string, now: string): Promise<HabitsBimbyRun> {
  const flow = loadFlow()
  const crew = await chatCrew().catch(() => null)
  const ladder = flow.match.ladder.length ? flow.match.ladder : crew?.extract ?? []
  return runHabitsBimby({ text, flow, ctx: fixtureCtx(now), call: crew ? ollamaCall(crew.main, undefined, { fresh: true }) : null, ladder })
}

const rowsOfRun = (r: HabitsBimbyRun): ExpectRow[] => [...r.proposals.map(rowOf), ...r.asks.map((a) => ({ kind: "ask" as const, habit: "", to: a.options.map((o) => o.id).join("|") }))]

export function HabitsBimbyTests() {
  const [tests, setTests] = useState<HabitsBimbyTest[]>(() => loadTests())
  const [done, setDone] = useState<Record<string, Done>>({})
  const [busy, setBusy] = useState("")
  const [text, setText] = useState("")
  const [name, setName] = useState("")
  const [draft, setDraft] = useState<{ run: HabitsBimbyRun; now: string } | null>(null)

  async function runOne(t: HabitsBimbyTest, mode: Mode) {
    const t0 = Date.now()
    const r = mode === "replay" ? replay(t) : mode === "rules" ? byRules(t) : t.shorthand ? compare(rowsFrom(t, "rules"), t.expect) : compare(rowsOfRun(await live(t.text, t.now)), t.expect)
    setDone((p) => ({ ...p, [t.id]: { ...r, mode, ms: Date.now() - t0 } }))
  }

  async function all(mode: Mode) {
    setBusy(mode)
    try {
      for (const t of tests) if (mode !== "replay" || t.matching || t.shorthand) await runOne(t, mode)
    } finally {
      setBusy("")
    }
  }

  async function tryText() {
    setBusy("try")
    try {
      const now = new Date().toISOString()
      setDraft({ run: await live(text, now), now })
    } finally {
      setBusy("")
    }
  }

  function save() {
    if (!draft || !name.trim()) return
    const matching = draft.run.trace.find((s) => s.stage === "match")?.output as Matching | undefined
    const next = [...tests, { id: `mine-${Date.now().toString(36)}`, name: name.trim(), text, now: draft.now, ...(matching ? { matching } : {}), expect: rowsOfRun(draft.run) }]
    setTests(next)
    saveMine(next)
    setName("")
  }

  return (
    <section className="tht" aria-label="Habits BIMBY tests">
      <h2>Tests</h2>
      <p>Cases run on fixed test habits (water, read 5 pages, stretch, exercise, go outside, clean, read the news). Replay uses the recorded model answer; Rules is the BIMBY with Ollama off; Live asks the model again.</p>
      <div className="tht-row">
        <button type="button" data-no95="" disabled={!!busy} onClick={() => void all("replay")}>Replay all</button>
        <button type="button" data-no95="" disabled={!!busy} onClick={() => void all("rules")}>Rules all</button>
        <button type="button" data-no95="" disabled={!!busy} onClick={() => void all("live")}>{busy === "live" ? "Running…" : "Run all live"}</button>
      </div>
      <ul className="tht-list">
        {tests.map((t) => {
          const r = done[t.id]
          return (
            <li key={t.id} data-pass={r ? (r.pass ? "1" : "0") : ""}>
              <div className="tht-row">
                <b>{r ? (r.pass ? "PASS" : "FAIL") : "—"}</b>
                <span className="tht-name">{t.name}</span>
                {t.matching || t.shorthand ? <button type="button" data-no95="" disabled={!!busy} onClick={() => void runOne(t, "replay")}>Replay</button> : null}
                <button type="button" data-no95="" disabled={!!busy} onClick={() => void runOne(t, "rules")}>Rules</button>
                <button type="button" data-no95="" disabled={!!busy} onClick={() => void runOne(t, "live")}>Live</button>
                <button type="button" data-no95="" onClick={() => setText(t.text)}>Load text</button>
              </div>
              {r ? <pre>{r.pass ? `${r.mode} ok · ${r.ms} ms · ${r.got.length} rows` : r.diff.join("\n") || r.got.map(rowText).join("\n")}</pre> : null}
            </li>
          )
        })}
      </ul>
      <h3>New case</h3>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="A message about the test habits. Run it live, check the rows, save it as a test." aria-label="Message for a new test" />
      <div className="tht-row">
        <button type="button" data-no95="" disabled={!text.trim() || !!busy} onClick={() => void tryText()}>{busy === "try" ? "Running…" : "Run live"}</button>
        {draft ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this test" aria-label="Test name" />
            <button type="button" data-no95="" disabled={!name.trim()} onClick={save}>Save as test</button>
          </>
        ) : null}
      </div>
      {draft ? <pre>{rowsOfRun(draft.run).map(rowText).join("\n") || draft.run.reply}</pre> : null}
    </section>
  )
}
