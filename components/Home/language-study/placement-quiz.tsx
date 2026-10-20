/**
 * components/Home/language-study/placement-quiz.tsx — Language study placement quiz
 *
 * Three screens: the intro (which exam the quiz follows, the ladder, where to
 * start), the run, and the result. The run climbs the CEFR ladder stage by
 * stage (`lib/language-study/placement/scorer.ts`): four questions a level,
 * three right to move up, and it stops at the first level not passed. Each
 * answer shows right or wrong with one line on why before the next. Listening
 * items are read aloud by the device; the transcript can be shown.
 *
 * Nothing is saved here. "Use this level" hands the level and the per-level
 * tally to `onResult`; the Language study copy decides what to keep.
 * Keys: 1–4 pick, Enter goes on.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import {
  answerPlacement,
  currentItem,
  loadPlacementBank,
  placementMaxQuestions,
  placementResult,
  startPlacement,
  PLACEMENT_PASS,
  PLACEMENT_PER_LEVEL,
  PLACEMENT_SKILL_LABEL,
  type PlacementBank,
  type PlacementState,
} from "@/lib/language-study/placement"
import { CEFR_LABEL, CEFR_LEVELS, CEFR_NOTE, LANGUAGE_EXAMS, examLevelName, type CefrLevel } from "@/lib/widgets/language-levels"
import { VOCAB_LANG_LABEL, VOCAB_LANG_SPEECH, speakVocab, type VocabLang } from "@/lib/vocab-words"
import { cn } from "@/lib/utils"
import "@/components/Home/language-study/placement-quiz.css"

export type PlacementDetail = { correct: number; total: number; byLevel: Record<CefrLevel, [number, number]> }

type Phase = "intro" | "run" | "result"

export function PlacementQuiz({
  lang,
  onResult,
  onCancel,
}: {
  lang: VocabLang
  onResult: (level: CefrLevel, detail: PlacementDetail) => void
  onCancel: () => void
}) {
  const [bank, setBank] = useState<PlacementBank | null>(null)
  const [failed, setFailed] = useState(false)
  const [phase, setPhase] = useState<Phase>("intro")
  const [start, setStart] = useState<CefrLevel>("A1")
  const [run, setRun] = useState<PlacementState | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [transcript, setTranscript] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const exam = LANGUAGE_EXAMS[lang]
  const speech = VOCAB_LANG_SPEECH[lang]

  useEffect(() => {
    let live = true
    setBank(null)
    setFailed(false)
    loadPlacementBank(lang).then(
      (next) => live && setBank(next),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [lang])

  useEffect(() => {
    rootRef.current?.focus()
  }, [phase])

  const begin = () => {
    if (!bank) return
    setRun(startPlacement(bank, { start }))
    setPicked(null)
    setTranscript(false)
    setPhase("run")
  }

  const item = run ? currentItem(run) : undefined
  const result = useMemo(() => (run ? placementResult(run) : null), [run])

  const next = () => {
    if (!run || picked === null) return
    const after = answerPlacement(run, picked)
    setRun(after)
    setPicked(null)
    setTranscript(false)
    if (after.done) setPhase("result")
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (phase !== "run" || !item) return
    if (event.target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return
    const n = Number(event.key)
    if (picked === null && n >= 1 && n <= item.choices.length) {
      event.preventDefault()
      setPicked(n - 1)
    } else if (picked !== null && event.key === "Enter") {
      event.preventDefault()
      next()
    }
  }

  if (failed) {
    return (
      <div className="home-vocab-flash home-placement">
        <p className="home-widget-note">The {VOCAB_LANG_LABEL[lang]} quiz could not load. Try again in a moment.</p>
        <div className="home-widget-actions">
          <button type="button" className="home-review-key" onClick={onCancel}>Close</button>
        </div>
      </div>
    )
  }

  if (phase === "intro" || !run) {
    return (
      <div className="home-vocab-flash home-placement" ref={rootRef} tabIndex={-1}>
        <div className="home-placement-head">
          <span className="home-placement-badge">{exam.name}</span>
          <span className="home-placement-title">{VOCAB_LANG_LABEL[lang]} placement</span>
        </div>
        <p className="home-widget-note">
          A short quiz in the format of the {exam.name} ({exam.body}). The questions are original, written to
          match each level&apos;s reading, listening and grammar tasks. It is a guide to where to start, not a
          certificate.
        </p>
        <ol className="home-placement-ladder" aria-label="Levels">
          {CEFR_LEVELS.map((level) => (
            <li key={level} className={cn(level === start && "is-on")}>
              <b>{level}</b>
              <span>{CEFR_LABEL[level]}</span>
              <em>{examLevelName(lang, level)}</em>
            </li>
          ))}
        </ol>
        <p className="home-widget-note">
          How it works: {PLACEMENT_PER_LEVEL} questions a level. Get {PLACEMENT_PASS} right and you climb to the
          next. The quiz stops at the first level you do not pass, so it takes two to ten minutes. Listening
          questions are read aloud, so turn your sound on.
        </p>
        <div className="home-placement-start" role="group" aria-label="Start at">
          <span>Start at</span>
          {CEFR_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              className={cn("home-vocab-chip", level === start && "is-on")}
              aria-pressed={level === start}
              onClick={() => setStart(level)}
            >
              {level}
            </button>
          ))}
        </div>
        {start !== "A1" ? (
          <p className="home-widget-note">
            Starting at {start} skips the levels below. If you miss {start}, the quiz steps down to find your level.
          </p>
        ) : null}
        <div className="home-widget-actions">
          <button type="button" className="home-review-key is-on" onClick={begin} disabled={!bank}>
            {bank ? "Begin" : "Loading…"}
          </button>
          <button type="button" className="home-review-key" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    )
  }

  if (phase === "result" || !item) {
    const final = result!
    const visited = CEFR_LEVELS.filter((level) => final.byLevel[level][1] > 0)
    return (
      <div className="home-vocab-flash home-placement" ref={rootRef} tabIndex={-1}>
        <div className="home-vocab-flash-done">
          <p className="home-vocab-flash-done-label">{VOCAB_LANG_LABEL[lang]} level</p>
          <p className="home-vocab-flash-done-figure">{final.level}</p>
          <p className="home-placement-result-name">
            {CEFR_LABEL[final.level]} · {examLevelName(lang, final.level)}
          </p>
          <p className="home-placement-result-note">
            {final.belowA1
              ? "A1 is the place to start. The quiz found the first level still ahead of you."
              : CEFR_NOTE[final.level]}
          </p>
          <ul className="home-placement-tally" aria-label="Score by level">
            {visited.map((level) => {
              const [right, asked] = final.byLevel[level]
              const passed = run.passed.includes(level)
              return (
                <li key={level} className={passed ? "is-pass" : "is-miss"}>
                  <b>{level}</b>
                  <span className="home-placement-pips" aria-hidden="true">
                    {Array.from({ length: asked }, (_, i) => (
                      <i key={i} className={i < right ? "is-on" : undefined} />
                    ))}
                  </span>
                  <span>
                    {right}/{asked} {passed ? "passed" : "missed"}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="home-vocab-flash-done-label">
            {final.correct} of {final.total} right
          </p>
          <div className="home-widget-actions">
            <button
              type="button"
              className="home-review-key is-on"
              onClick={() => onResult(final.level, { correct: final.correct, total: final.total, byLevel: final.byLevel })}
            >
              Use {final.level}
            </button>
            <button type="button" className="home-review-key" onClick={() => setPhase("intro")}>
              Retake
            </button>
            <button type="button" className="home-review-key" onClick={onCancel}>
              Keep my level
            </button>
          </div>
        </div>
      </div>
    )
  }

  const asked = run.answers.length
  const percent = Math.round((asked / Math.max(placementMaxQuestions(run), 1)) * 100)
  const stage = run.stages[run.level] ?? []
  const listening = item.skill === "listening"
  const right = picked !== null && picked === item.answer

  return (
    <div
      className="home-vocab-flash home-placement"
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      aria-label={`${VOCAB_LANG_LABEL[lang]} placement quiz`}
    >
      <div className="home-vocab-flash-bar">
        <span className="home-vocab-flash-count">
          {run.level} · {run.pos + 1}/{stage.length}
        </span>
        <span className="home-vocab-flash-progress" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </span>
        <span className="home-placement-steps" aria-label="Levels passed">
          {CEFR_LEVELS.map((level) => (
            <i
              key={level}
              title={level}
              className={cn(
                run.passed.includes(level) && "is-done",
                run.failed.includes(level) && "is-miss",
                level === run.level && "is-on",
              )}
            />
          ))}
        </span>
      </div>

      <div className="home-placement-card">
        <span className="home-vocab-flash-fig">
          {examLevelName(lang, run.level)} · {item.task} · {PLACEMENT_SKILL_LABEL[item.skill]}
        </span>
        <p className="home-placement-ask">{item.ask}</p>
        {listening && item.passage ? (
          <div className="home-placement-listen">
            <button type="button" className="home-review-key is-on" onClick={() => speakVocab(item.passage!, lang)}>
              ▶ Play
            </button>
            <button type="button" className="home-review-key" onClick={() => speakVocab(item.passage!, lang, { slow: true })}>
              Slower
            </button>
            <button type="button" className="home-review-key" onClick={() => setTranscript((t) => !t)}>
              {transcript ? "Hide text" : "Show text"}
            </button>
          </div>
        ) : null}
        {item.passage && (!listening || transcript || picked !== null) ? (
          <blockquote className="home-placement-passage" lang={speech}>
            {item.passage}
          </blockquote>
        ) : null}
        <p className="home-placement-stem" lang={speech}>
          {item.stem}
        </p>
        <div className="home-placement-choices" role="radiogroup" aria-label="Answers">
          {item.choices.map((choice, i) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={picked === i}
              disabled={picked !== null}
              className={cn(
                "home-placement-choice",
                picked !== null && i === item.answer && "is-right",
                picked === i && i !== item.answer && "is-wrong",
              )}
              lang={speech}
              onClick={() => setPicked(i)}
            >
              <span className="home-placement-key" aria-hidden="true">{i + 1}</span>
              {choice}
            </button>
          ))}
        </div>
        {picked !== null ? (
          <p className={cn("home-placement-why", right ? "is-right" : "is-wrong")} aria-live="polite">
            <b>{right ? "Right." : "Not quite."}</b> {item.why}
          </p>
        ) : null}
      </div>

      <div className="home-widget-actions">
        <button type="button" className="home-review-key is-on" onClick={next} disabled={picked === null}>
          Next
        </button>
        <button type="button" className="home-review-key" onClick={() => setPhase("result")} disabled={asked === 0}>
          Stop and score
        </button>
        <button type="button" className="home-review-key" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="home-widget-note home-vocab-flash-keys">1–4 pick · Enter next</p>
    </div>
  )
}
