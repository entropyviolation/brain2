/**
 * components/Home/home-vocab-tile.tsx — Vocab word of the day
 *
 * Optional overview square. The face is today's word for the active language
 * view: a picture when the word has one, the word, its kana or pinyin, and the
 * definition in that language on the foot. ↻ on the tile (and Shuffle in the
 * detail) draws another word for the day. The detail switches and adds
 * language views, sets the level per language, says the word aloud, and
 * Translate reveals the English for a target language. ♡ Favorite saves a word
 * to that language's deck; Flashcards reviews the deck
 * (`home-vocab-flashcards.tsx`). Banks: `lib/vocab/`.
 */
"use client"

import { useMemo, useState } from "react"
import { VocabFlashcards } from "@/components/Home/home-vocab-flashcards"
import { HomeWidgetDialog, TileHide, TileOpen } from "@/components/Home/home-widget-dialog"
import { addCalendarDays, formatLocalDateKey } from "@/lib/date-utils"
import { useVocabStore, vocabShuffleCount } from "@/lib/vocab-store"
import {
  VOCAB_LANGS,
  VOCAB_LANG_CODE,
  VOCAB_LANG_ENDONYM,
  VOCAB_LANG_LABEL,
  VOCAB_LANG_SPEECH,
  VOCAB_LEVEL_LABEL,
  VOCAB_LEVEL_NOTE,
  isVocabLang,
  pickVocabWord,
  resolveVocabLevel,
  speakVocab,
  vocabDeck,
  vocabIsTarget,
  vocabLevelsFor,
  type VocabEntry,
  type VocabLang,
} from "@/lib/vocab-words"

function readingLine(entry: VocabEntry): string {
  return [entry.reading, entry.romanization].filter(Boolean).join(" · ")
}

export function VocabTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const active = useVocabStore((s) => s.active)
  const levels = useVocabStore((s) => s.levels)
  const shuffles = useVocabStore((s) => s.shuffles)
  const shuffle = useVocabStore((s) => s.shuffle)
  const [open, setOpen] = useState(false)

  const dateKey = formatLocalDateKey(currentDate)
  const level = resolveVocabLevel(active, levels[active])
  const count = vocabShuffleCount(shuffles, active, dateKey)
  const pick = useMemo(() => pickVocabWord(active, level, dateKey, count), [active, level, dateKey, count])
  const entry = pick?.entry

  return (
    <>
      <div
        className="home-tile is-vocab"
        data-widget="vocab"
        data-vocab-lang={active}
        data-testid="home-vocab-tile"
        lang={VOCAB_LANG_SPEECH[active]}
      >
        <TileHide id="vocab" onHide={onHide} />
        <button
          type="button"
          className="home-vocab-shuffle"
          aria-label="Shuffle the word"
          title="Another word for today"
          onClick={(event) => {
            event.stopPropagation()
            shuffle(active, dateKey)
          }}
        >
          ↻
        </button>
        <TileOpen label="Vocab" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Vocab · {VOCAB_LANG_CODE[active]}</span>
          </div>
          <div className="home-crt home-vocab-crt">
            {entry ? (
              <>
                {entry.picture ? (
                  <span className="home-vocab-picture" aria-hidden="true">{entry.picture}</span>
                ) : null}
                <span className="home-vocab-word-stack">
                  <span className="home-vocab-word">{entry.word}</span>
                  {entry.reading ? <span className="home-vocab-reading">{entry.reading}</span> : null}
                </span>
              </>
            ) : (
              <span className="home-vocab-word">—</span>
            )}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub home-vocab-foot">
              {entry ? `${entry.pos} · ${entry.definition}` : "No words at this level"}
            </p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Vocab" className="home-vocab-dialog">
        <VocabDetail currentDate={currentDate} />
      </HomeWidgetDialog>
    </>
  )
}

function VocabDetail({ currentDate }: { currentDate: Date }) {
  const languages = useVocabStore((s) => s.languages)
  const active = useVocabStore((s) => s.active)
  const levels = useVocabStore((s) => s.levels)
  const shuffles = useVocabStore((s) => s.shuffles)
  const addLanguage = useVocabStore((s) => s.addLanguage)
  const removeLanguage = useVocabStore((s) => s.removeLanguage)
  const setActive = useVocabStore((s) => s.setActive)
  const setLevel = useVocabStore((s) => s.setLevel)
  const shuffle = useVocabStore((s) => s.shuffle)
  const unshuffle = useVocabStore((s) => s.unshuffle)
  const favorites = useVocabStore((s) => s.favorites)
  const toggleFavorite = useVocabStore((s) => s.toggleFavorite)
  const [translate, setTranslate] = useState(false)
  const [mode, setMode] = useState<"word" | "cards">("word")

  const dateKey = formatLocalDateKey(currentDate)
  const level = resolveVocabLevel(active, levels[active])
  const count = vocabShuffleCount(shuffles, active, dateKey)
  const pick = pickVocabWord(active, level, dateKey, count)
  const entry = pick?.entry
  const target = vocabIsTarget(active)
  const addable = VOCAB_LANGS.filter((lang) => !languages.includes(lang))
  const reading = entry ? readingLine(entry) : ""
  const saved = favorites[active]
  const deck = useMemo(() => vocabDeck(active, saved), [active, saved])
  const isFavorite = (word: string) => saved?.includes(word) ?? false

  const week = useMemo(() => {
    const rows: { key: string; label: string; entry: VocabEntry }[] = []
    for (let back = 1; back <= 6; back++) {
      const day = addCalendarDays(currentDate, -back)
      const key = formatLocalDateKey(day)
      const past = pickVocabWord(active, level, key, 0)
      if (past) {
        rows.push({
          key,
          label: day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
          entry: past.entry,
        })
      }
    }
    return rows
  }, [active, level, currentDate])

  return (
    <div className="home-vocab-detail">
      <div className="home-vocab-views" role="tablist" aria-label="Language views">
        {languages.map((lang) => (
          <button
            key={lang}
            type="button"
            role="tab"
            aria-selected={lang === active}
            className={lang === active ? "home-review-key is-on" : "home-review-key"}
            onClick={() => {
              setActive(lang)
              setTranslate(false)
            }}
          >
            {VOCAB_LANG_ENDONYM[lang]}
          </button>
        ))}
        {addable.length > 0 ? (
          <label className="home-widget-field home-vocab-add" aria-label="Add a language">
            <select
              value=""
              onChange={(event) => {
                const lang = event.target.value
                if (isVocabLang(lang)) {
                  addLanguage(lang)
                  setTranslate(false)
                }
              }}
            >
              <option value="">+ Add language</option>
              {addable.map((lang) => (
                <option key={lang} value={lang}>
                  {VOCAB_LANG_LABEL[lang]} — {VOCAB_LANG_ENDONYM[lang]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="home-vocab-modes" role="tablist" aria-label="Vocab mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "word"}
          className={mode === "word" ? "home-vocab-mode is-on" : "home-vocab-mode"}
          onClick={() => setMode("word")}
        >
          Word of the day
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "cards"}
          className={mode === "cards" ? "home-vocab-mode is-on" : "home-vocab-mode"}
          onClick={() => setMode("cards")}
        >
          Flashcards <span className="home-vocab-mode-count">♥ {deck.length}</span>
        </button>
      </div>

      {mode === "cards" ? (
        <VocabFlashcards key={active} lang={active} deck={deck} onUnfavorite={(word) => toggleFavorite(active, word)} />
      ) : (
      <>
      {entry && pick ? (
        <section className="home-vocab-card" lang={VOCAB_LANG_SPEECH[active]} aria-live="polite">
          <div className="home-vocab-card-head">
            {entry.picture ? (
              <span className="home-vocab-card-picture" aria-hidden="true">{entry.picture}</span>
            ) : null}
            <div className="home-vocab-card-title">
              <p className="home-widget-lead home-vocab-card-word">{entry.word}</p>
              {reading ? <p className="home-vocab-card-reading">{reading}</p> : null}
              <p className="home-vocab-card-meta">
                {entry.pos} · {VOCAB_LEVEL_LABEL[pick.level]} · {pick.place} of {pick.poolSize}
              </p>
            </div>
            <div className="home-vocab-card-keys">
              <button
                type="button"
                className={isFavorite(entry.word) ? "home-review-key home-vocab-speak home-vocab-fav is-on" : "home-review-key home-vocab-speak home-vocab-fav"}
                aria-pressed={isFavorite(entry.word)}
                onClick={() => toggleFavorite(active, entry.word)}
              >
                {isFavorite(entry.word) ? "♥ Favorited" : "♡ Favorite"}
              </button>
              <button
                type="button"
                className="home-review-key home-vocab-speak"
                aria-label={`Say ${entry.word} aloud`}
                onClick={() => speakVocab(entry.word, active)}
              >
                Say it
              </button>
            </div>
          </div>

          <p className="home-vocab-definition">{entry.definition}</p>
          {entry.example ? (
            <p className="home-vocab-example">
              “{entry.example}”
              <button
                type="button"
                className="home-vocab-inline-speak"
                aria-label="Say the example aloud"
                onClick={() => speakVocab(entry.example!, active)}
              >
                ♪
              </button>
            </p>
          ) : null}
          {entry.root ? <p className="home-widget-note">Root: {entry.root}</p> : null}

          {target ? (
            translate ? (
              <div className="home-vocab-translation" lang="en">
                <p>
                  <span className="home-vocab-tag">English</span> <strong>{entry.gloss}</strong>
                </p>
                {entry.definitionEn ? <p>{entry.definitionEn}</p> : null}
                {entry.exampleEn ? <p className="home-vocab-example">“{entry.exampleEn}”</p> : null}
              </div>
            ) : null
          ) : null}
        </section>
      ) : (
        <p className="home-widget-note">No words at this level yet.</p>
      )}

      <div className="home-widget-actions">
        {target ? (
          <button
            type="button"
            className={translate ? "home-review-key is-on" : "home-review-key"}
            aria-pressed={translate}
            onClick={() => setTranslate((on) => !on)}
          >
            {translate ? "Hide English" : "Translate"}
          </button>
        ) : null}
        <button
          type="button"
          className="home-review-key"
          onClick={() => {
            shuffle(active, dateKey)
            setTranslate(false)
          }}
        >
          Shuffle
        </button>
        {count > 0 ? (
          <button type="button" className="home-review-key" onClick={() => unshuffle(active)}>
            Today's word
          </button>
        ) : null}
      </div>

      <fieldset className="home-widget-fieldset">
        <legend>{VOCAB_LANG_LABEL[active]} level</legend>
        {vocabLevelsFor(active).map((option) => (
          <label key={option} className="home-widget-choice">
            <input
              type="radio"
              name={`vocab-level-${active}`}
              checked={level === option}
              onChange={() => setLevel(active, option)}
            />
            <span>
              <strong>{VOCAB_LEVEL_LABEL[option]}</strong> — {VOCAB_LEVEL_NOTE[option]}
            </span>
          </label>
        ))}
      </fieldset>

      {week.length > 0 ? (
        <details className="home-vocab-week">
          <summary>
            <span className="home-widget-fold" aria-hidden="true">
              <span className="is-shut">&gt;</span>
              <span className="is-open">^</span>
            </span>
            Earlier this week
          </summary>
          <ul lang={VOCAB_LANG_SPEECH[active]}>
            {week.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  className={isFavorite(row.entry.word) ? "home-vocab-week-fav is-on" : "home-vocab-week-fav"}
                  aria-pressed={isFavorite(row.entry.word)}
                  aria-label={`${isFavorite(row.entry.word) ? "Unfavorite" : "Favorite"} ${row.entry.word}`}
                  onClick={() => toggleFavorite(active, row.entry.word)}
                >
                  {isFavorite(row.entry.word) ? "♥" : "♡"}
                </button>{" "}
                <span className="home-vocab-week-day" lang="en">{row.label}</span>{" "}
                {row.entry.picture ? `${row.entry.picture} ` : ""}
                <strong>{row.entry.word}</strong>
                {target && row.entry.gloss ? <span lang="en"> — {row.entry.gloss}</span> : ` — ${row.entry.definition}`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      </>
      )}

      {languages.length > 1 ? (
        <div className="home-widget-actions">
          <button type="button" className="home-review-key" onClick={() => removeLanguage(active)}>
            Remove {VOCAB_LANG_LABEL[active]}
          </button>
        </div>
      ) : null}
    </div>
  )
}
