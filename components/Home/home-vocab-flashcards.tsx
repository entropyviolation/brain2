/**
 * components/Home/home-vocab-flashcards.tsx — Flashcards for favorited words
 *
 * The deck is one language's favorites. The front is a cool index card on
 * graph rule (picture, word, reading); flip turns it to the phosphor glass
 * back (definition in that language, the English, and the example). Know it /
 * Still learning sort the pass; the end card offers another pass over the
 * words still learning. Start with flips which side leads. Keys: Space or
 * Enter flips, ← → step, 1 still learning, 2 know it. Nothing here is saved:
 * a review is a session, the favorites are the record.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import {
  VOCAB_LANG_LABEL,
  VOCAB_LANG_SPEECH,
  VOCAB_LEVEL_LABEL,
  speakVocab,
  vocabIpa,
  vocabIsTarget,
  type VocabEntry,
  type VocabLang,
  type VocabLevel,
} from "@/lib/vocab-words"
import { cn } from "@/lib/utils"

type Card = { entry: VocabEntry; level: VocabLevel }
type Lead = "term" | "meaning"

function shuffled<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = next[i]!
    next[i] = next[j]!
    next[j] = swap
  }
  return next
}

export function VocabFlashcards({
  lang,
  deck,
  onUnfavorite,
}: {
  lang: VocabLang
  deck: Card[]
  onUnfavorite: (word: string) => void
}) {
  const [cards, setCards] = useState<Card[]>(deck)
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [lead, setLead] = useState<Lead>("term")
  const [known, setKnown] = useState<Set<string>>(() => new Set())
  const [learning, setLearning] = useState<Set<string>>(() => new Set())
  const [finished, setFinished] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const target = vocabIsTarget(lang)

  // A word unfavorited mid-review leaves the deck without restarting the pass.
  const deckWords = useMemo(() => new Set(deck.map((card) => card.entry.word)), [deck])
  useEffect(() => {
    setCards((current) => {
      const kept = current.filter((card) => deckWords.has(card.entry.word))
      const added = deck.filter((card) => !current.some((c) => c.entry.word === card.entry.word))
      return [...kept, ...added]
    })
  }, [deck, deckWords])

  useEffect(() => {
    if (pos >= cards.length && cards.length > 0) setPos(cards.length - 1)
  }, [cards.length, pos])

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  const restart = (next: Card[]) => {
    setCards(next)
    setPos(0)
    setFlipped(false)
    setKnown(new Set())
    setLearning(new Set())
    setFinished(false)
    rootRef.current?.focus()
  }

  const step = (delta: number) => {
    setFlipped(false)
    setPos((p) => Math.min(Math.max(p + delta, 0), Math.max(cards.length - 1, 0)))
  }

  const mark = (word: string, knowIt: boolean) => {
    setKnown((set) => {
      const next = new Set(set)
      if (knowIt) next.add(word)
      else next.delete(word)
      return next
    })
    setLearning((set) => {
      const next = new Set(set)
      if (knowIt) next.delete(word)
      else next.add(word)
      return next
    })
    setFlipped(false)
    if (pos >= cards.length - 1) setFinished(true)
    else setPos((p) => p + 1)
  }

  if (deck.length === 0) {
    return (
      <div className="home-vocab-flash-empty">
        <p className="home-vocab-flash-empty-mark" aria-hidden="true">♡</p>
        <p>No {VOCAB_LANG_LABEL[lang]} favorites yet.</p>
        <p className="home-widget-note">
          Press ♡ Favorite on a word of the day and it joins this deck. Shuffle to find more.
        </p>
      </div>
    )
  }

  const card = cards[pos]
  const reviewed = known.size + learning.size
  const percent = cards.length > 0 ? Math.round((reviewed / cards.length) * 100) : 0

  if (finished || !card) {
    const stillLearning = cards.filter((c) => learning.has(c.entry.word))
    return (
      <div className="home-vocab-flash" ref={rootRef} tabIndex={-1}>
        <div className="home-vocab-flash-done">
          <p className="home-vocab-flash-done-figure">
            {known.size}<span>/{cards.length}</span>
          </p>
          <p className="home-vocab-flash-done-label">known this pass</p>
          <div className="home-vocab-flash-tally">
            <span className="is-know">{known.size} know it</span>
            <span className="is-learning">{stillLearning.length} still learning</span>
          </div>
          <div className="home-widget-actions">
            {stillLearning.length > 0 ? (
              <button type="button" className="home-review-key is-on" onClick={() => restart(stillLearning)}>
                Review {stillLearning.length} still learning
              </button>
            ) : null}
            <button type="button" className="home-review-key" onClick={() => restart(deck)}>
              Restart deck
            </button>
            <button type="button" className="home-review-key" onClick={() => restart(shuffled(deck))}>
              Shuffle and restart
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { entry, level } = card
  const reading = [entry.reading, entry.romanization].filter(Boolean).join(" · ")
  const showMeaningFirst = lead === "meaning"

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault()
      setFlipped((f) => !f)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      step(1)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      step(-1)
    } else if (event.key === "1") {
      mark(entry.word, false)
    } else if (event.key === "2") {
      mark(entry.word, true)
    }
  }

  const term = (
    <div className="home-vocab-flash-term" lang={VOCAB_LANG_SPEECH[lang]}>
      {entry.picture ? <span className="home-vocab-flash-picture" aria-hidden="true">{entry.picture}</span> : null}
      <span className="home-vocab-flash-word">{entry.word}</span>
      {reading ? <span className="home-vocab-flash-reading">{reading}</span> : null}
      {vocabIpa(lang, entry.word) ? <span className="home-vocab-flash-reading home-vocab-flash-ipa">/{vocabIpa(lang, entry.word)}/</span> : null}
    </div>
  )

  const meaning = (
    <div className="home-vocab-flash-meaning">
      <p className="home-vocab-flash-pos">{entry.pos}</p>
      {target && entry.gloss ? (
        <p className="home-vocab-flash-gloss" lang="en">{entry.gloss}</p>
      ) : null}
      <p className="home-vocab-flash-definition" lang={VOCAB_LANG_SPEECH[lang]}>{entry.definition}</p>
      {target && entry.definitionEn ? (
        <p className="home-vocab-flash-english" lang="en">{entry.definitionEn}</p>
      ) : null}
      {entry.example ? (
        <p className="home-vocab-flash-example" lang={VOCAB_LANG_SPEECH[lang]}>“{entry.example}”</p>
      ) : null}
      {target && entry.exampleEn ? (
        <p className="home-vocab-flash-english" lang="en">“{entry.exampleEn}”</p>
      ) : null}
    </div>
  )

  return (
    <div
      className="home-vocab-flash"
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      aria-label={`${VOCAB_LANG_LABEL[lang]} flashcards`}
    >
      <div className="home-vocab-flash-bar">
        <span className="home-vocab-flash-count">
          {pos + 1} / {cards.length}
        </span>
        <span className="home-vocab-flash-progress" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </span>
        <span className="home-vocab-flash-tally">
          <span className="is-learning">{learning.size}</span>
          <span className="is-know">{known.size}</span>
        </span>
      </div>

      <button
        type="button"
        className={cn("home-vocab-flash-card", flipped && "is-flipped")}
        aria-label={flipped ? "Show the front" : "Flip the card"}
        aria-live="polite"
        onClick={() => setFlipped((f) => !f)}
      >
        <span className="home-vocab-flash-inner">
          <span className="home-vocab-flash-face is-front">
            <span className="home-vocab-flash-fig" aria-hidden="true">
              FIG. {String(pos + 1).padStart(2, "0")} · {VOCAB_LEVEL_LABEL[level]}
            </span>
            {showMeaningFirst ? meaning : term}
            <span className="home-vocab-flash-hint" aria-hidden="true">click or space to flip</span>
          </span>
          <span className="home-vocab-flash-face is-back">
            <span className="home-vocab-flash-fig" aria-hidden="true">
              {showMeaningFirst ? "TERM" : "MEANING"}
            </span>
            {showMeaningFirst ? term : meaning}
          </span>
        </span>
      </button>

      <div className="home-vocab-flash-controls">
        <button type="button" className="home-review-key" onClick={() => step(-1)} disabled={pos === 0} aria-label="Previous card">
          ‹
        </button>
        <button type="button" className="home-review-key home-vocab-flash-learning" onClick={() => mark(entry.word, false)}>
          Still learning
        </button>
        <button type="button" className="home-review-key home-vocab-flash-know" onClick={() => mark(entry.word, true)}>
          Know it
        </button>
        <button
          type="button"
          className="home-review-key"
          onClick={() => step(1)}
          disabled={pos >= cards.length - 1}
          aria-label="Next card"
        >
          ›
        </button>
      </div>

      <div className="home-vocab-flash-tools">
        <button type="button" className="home-review-key" onClick={() => speakVocab(entry.word, lang)}>
          Say it
        </button>
        <button type="button" className="home-review-key" onClick={() => speakVocab(entry.definition, lang)}>
          ♪ Definition
        </button>
        <button
          type="button"
          className="home-review-key"
          onClick={() => {
            setLead((l) => (l === "term" ? "meaning" : "term"))
            setFlipped(false)
          }}
        >
          Start with: {lead === "term" ? "Term" : "Meaning"}
        </button>
        <button type="button" className="home-review-key" onClick={() => restart(shuffled(cards))}>
          Shuffle
        </button>
        <button type="button" className="home-review-key" onClick={() => onUnfavorite(entry.word)}>
          Remove ♥
        </button>
      </div>
      <p className="home-widget-note home-vocab-flash-keys">
        Space flips · ← → step · 1 still learning · 2 know it
      </p>
    </div>
  )
}
