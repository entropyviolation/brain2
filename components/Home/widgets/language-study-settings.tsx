/**
 * components/Home/widgets/language-study-settings.tsx — The Language study gear
 *
 * One copy is one language. Its role is studied or native. A studied
 * language sits on the CEFR ladder (A1 to C2): the level picks the Vocab
 * word pool, and the placement quiz (when one is registered) can set it. A
 * native language skips the ladder and keeps Vocab's own levels (Everyday
 * to Extremely advanced), set in the detail. The face shows the word of the
 * day, or the level with a known-word meter.
 */
"use client"

import { useState } from "react"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import {
  CEFR_LABEL,
  CEFR_LEVELS,
  CEFR_NOTE,
  LANGUAGE_EXAMS,
  examLevelName,
  isCefrLevel,
  vocabLevelForCefr,
  type CefrLevel,
} from "@/lib/widgets/language-levels"
import { useVocabStore } from "@/lib/vocab-store"
import { VOCAB_LANG_LABEL, vocabLevelsFor } from "@/lib/vocab-words"
import type { VocabLang } from "@/lib/vocab/types"
import type { WidgetCopy } from "@/lib/widgets/types"
import { placementQuiz } from "@/components/Home/widgets/placement-registry"

/** Set a studied copy's CEFR level, and point Vocab's word pool at it. */
export function applyCefrLevel(copyId: string, lang: VocabLang, level: CefrLevel, placement?: { correct: number; total: number }) {
  useDashboardStore.getState().updateCopySettings(copyId, {
    cefr: level,
    ...(placement
      ? { placedAt: new Date().toISOString().slice(0, 10), placedScore: `${placement.correct}/${placement.total}` }
      : {}),
  })
  useVocabStore.getState().setLevel(lang, vocabLevelForCefr(level, vocabLevelsFor(lang)))
}

export function LanguageStudySettings({ copy, lang }: { copy: WidgetCopy; lang: VocabLang }) {
  const update = useDashboardStore((s) => s.updateCopySettings)
  const role = copy.settings.role === "native" ? "native" : "studied"
  const cefr = isCefrLevel(copy.settings.cefr) ? copy.settings.cefr : "A1"
  const face = copy.settings.face === "level" ? "level" : "word"
  const [quizzing, setQuizzing] = useState(false)
  const Quiz = placementQuiz()
  const exam = LANGUAGE_EXAMS[lang]

  if (quizzing && Quiz) {
    return (
      <section className="vd-settings-group" aria-label="Placement quiz">
        <h4>Placement quiz · {exam.name} format</h4>
        <Quiz
          lang={lang}
          onCancel={() => setQuizzing(false)}
          onResult={(level, detail) => {
            applyCefrLevel(copy.id, lang, level, detail)
            setQuizzing(false)
          }}
        />
      </section>
    )
  }

  return (
    <section className="vd-settings-group" aria-label="Language study settings">
      <h4>{VOCAB_LANG_LABEL[lang]}</h4>
      <fieldset className="home-widget-fieldset">
        <legend>This language is</legend>
        <label className="home-widget-choice">
          <input
            type="radio"
            name={`role-${copy.id}`}
            checked={role === "studied"}
            onChange={() => {
              update(copy.id, { role: "studied", cefr })
              applyCefrLevel(copy.id, lang, cefr)
            }}
          />
          One I am learning (levels A1 to C2, placement quiz, 1000 words)
        </label>
        <label className="home-widget-choice">
          <input
            type="radio"
            name={`role-${copy.id}`}
            checked={role === "native"}
            onChange={() => update(copy.id, { role: "native", cefr: "" })}
          />
          My native language (vocabulary building and flashcards)
        </label>
      </fieldset>

      {role === "studied" ? (
        <>
          <fieldset className="home-widget-fieldset">
            <legend>Level</legend>
            {CEFR_LEVELS.map((level) => (
              <label key={level} className="home-widget-choice">
                <input
                  type="radio"
                  name={`cefr-${copy.id}`}
                  checked={cefr === level}
                  onChange={() => applyCefrLevel(copy.id, lang, level)}
                />
                <span>
                  <strong>
                    {level} · {CEFR_LABEL[level]}
                  </strong>
                  {exam.levels[level] && exam.levels[level] !== level ? ` (${exam.levels[level]})` : ""} — {CEFR_NOTE[level]}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="home-widget-actions">
            <button
              type="button"
              className="home-review-key"
              disabled={!Quiz}
              onClick={() => setQuizzing(true)}
            >
              Take the placement quiz
            </button>
          </div>
          <p className="home-widget-note">
            {Quiz
              ? `A short quiz in the format of the ${exam.name} (${exam.body}). The questions are written for Brain2, not copied from the exam. Its result sets the level; you can change it any time.`
              : `The placement quiz (${exam.name} format) is not in this build yet. Pick the level by hand.`}
            {typeof copy.settings.placedAt === "string"
              ? ` Last placed ${copy.settings.placedAt}: ${examLevelName(lang, cefr)}, ${String(copy.settings.placedScore ?? "")}.`
              : ""}
          </p>
        </>
      ) : (
        <p className="home-widget-note">
          A native language has no CEFR level. The word of the day runs from Everyday to Extremely advanced;
          pick that level in the detail.
        </p>
      )}

      <fieldset className="home-widget-fieldset">
        <legend>Face shows</legend>
        <label className="home-widget-choice">
          <input
            type="radio"
            name={`face-${copy.id}`}
            checked={face === "word"}
            onChange={() => update(copy.id, { face: "word" })}
          />
          Today&apos;s word
        </label>
        <label className="home-widget-choice">
          <input
            type="radio"
            name={`face-${copy.id}`}
            checked={face === "level"}
            onChange={() => update(copy.id, { face: "level" })}
          />
          {role === "studied" ? "Level and known words" : "Level and favorites"}
        </label>
      </fieldset>

      <fieldset className="home-widget-fieldset">
        <legend>Mode</legend>
        <label className="home-widget-choice">
          <input type="radio" name={`mode-${copy.id}`} checked readOnly />
          Vocab: word of the day, {role === "studied" ? "1000 words, " : ""}flashcards, look up
        </label>
        <p className="home-widget-note">Reading, listening, and grammar modes are planned and will join here.</p>
      </fieldset>
    </section>
  )
}
