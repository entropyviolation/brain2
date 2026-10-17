/**
 * components/Home/home-vocab-thousand.tsx — Work through the 1000 most common words
 *
 * The Vocab detail's **1000 words** mode for a target language. Words are the
 * items on that language's list in Lists (Languages → <language>,
 * `lib/vocab-lists.ts`), so Known is the same tick in both places. The meter
 * counts known words. The card shows rank, word, reading, IPA, and (on Show
 * meaning) the English; ♪ says the word or the meaning. Know it / Still
 * learning set Known. Shuffle jumps to a random word in the current filter.
 * **Practice 20** runs a quick round over 20 words still to learn (Space
 * flips, 1 still learning, 2 know it). **My words** switches to the words
 * added from Look up. The word grid and the full dictionary entry open on
 * demand.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { VocabDictionaryFold } from "@/components/Home/home-vocab-dictionary"
import { requestNavigateToList } from "@/lib/app-navigation"
import { useTaskStore } from "@/lib/task-store"
import {
  MINE_LIST_NAME,
  THOUSAND_LIST_NAME,
  fillThousandList,
  mineListId,
  setVocabKnown,
  studyWordsOn,
  thousandListId,
  type StudyWord,
  type ThousandLang,
} from "@/lib/vocab-lists"
import { VOCAB_LANG_SPEECH, speakVocab } from "@/lib/vocab-words"
import { cn } from "@/lib/utils"

type Source = "thousand" | "mine"
type Filter = "learn" | "all" | "known"

function shuffled<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j]!, next[i]!]
  }
  return next
}

function inFilter(word: StudyWord, filter: Filter): boolean {
  return filter === "all" || (filter === "known" ? word.known : !word.known)
}

export function VocabThousand({ lang }: { lang: ThousandLang }) {
  const tasks = useTaskStore((s) => s.tasks)
  const [source, setSource] = useState<Source>("thousand")
  const listId = source === "thousand" ? thousandListId(lang) : mineListId(lang)
  const words = useMemo(() => studyWordsOn(tasks, listId), [tasks, listId])
  const mineCount = useMemo(() => tasks.filter((t) => t.lists?.includes(mineListId(lang))).length, [tasks, lang])
  const [filter, setFilter] = useState<Filter>("learn")
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)
  const [drill, setDrill] = useState<StudyWord[] | null>(null)
  const [filling, setFilling] = useState(false)

  const known = words.filter((w) => w.known).length
  const pool = words.filter((w) => inFilter(w, filter))
  const current = words.find((w) => w.id === currentId && inFilter(w, filter)) ?? pool[0] ?? null
  const index = current ? pool.indexOf(current) : -1

  useEffect(() => {
    setCurrentId(null)
    setReveal(false)
    setDrill(null)
  }, [lang, source])

  useEffect(() => {
    if (source !== "thousand" || words.length > 0) return
    setFilling(true)
    let live = true
    void fillThousandList(lang).finally(() => {
      if (live) setFilling(false)
    })
    return () => {
      live = false
    }
  }, [lang, source, words.length])

  const go = (step: number) => {
    if (pool.length === 0) return
    const next = pool[(index + step + pool.length) % pool.length]!
    setCurrentId(next.id)
    setReveal(false)
  }

  const mark = (word: StudyWord, value: boolean) => {
    setVocabKnown(word.id, value)
    // Marking moves on when the word leaves the current filter.
    if (filter !== "all" && pool.length > 1) {
      const next = pool[(index + 1) % pool.length]!
      setCurrentId(next.id === word.id ? null : next.id)
      setReveal(false)
    }
  }

  const listName = source === "thousand" ? THOUSAND_LIST_NAME[lang] : MINE_LIST_NAME[lang]

  if (drill) {
    return (
      <VocabPractice
        key={drill.map((w) => w.id).join(",")}
        lang={lang}
        words={drill}
        onDone={() => setDrill(null)}
        onAnother={() => setDrill(shuffled(words.filter((w) => !w.known)).slice(0, 20))}
      />
    )
  }

  return (
    <div className="home-vocab-thousand">
      <div className="home-vocab-thousand-bar">
        <div className="home-vocab-sources" role="tablist" aria-label="Word list">
          <button
            type="button"
            role="tab"
            aria-selected={source === "thousand"}
            className={source === "thousand" ? "home-vocab-chip is-on" : "home-vocab-chip"}
            onClick={() => setSource("thousand")}
          >
            1000 most common
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === "mine"}
            className={source === "mine" ? "home-vocab-chip is-on" : "home-vocab-chip"}
            onClick={() => setSource("mine")}
          >
            My words ({mineCount})
          </button>
        </div>
        <button
          type="button"
          className="home-vocab-chip"
          title={`Open “${listName}” in Lists`}
          onClick={() => requestNavigateToList(listId, useTaskStore.getState().folders)}
        >
          Open in Lists ↗
        </button>
      </div>

      <div className="home-vocab-known" aria-label={`Known ${known} of ${words.length}`}>
        <span className="home-vocab-known-count">
          <strong>{known}</strong> / {words.length} known
        </span>
        <span className="home-vocab-known-bar" aria-hidden="true">
          <span style={{ width: `${words.length ? (known / words.length) * 100 : 0}%` }} />
        </span>
        <span className="home-vocab-known-list" lang={VOCAB_LANG_SPEECH[lang]}>{listName}</span>
      </div>

      {words.length === 0 ? (
        <p className="home-widget-note">
          {source === "thousand"
            ? filling
              ? "Filling the list…"
              : "This list is empty."
            : "No words yet. Look a word up and choose Add to My words."}
        </p>
      ) : (
        <>
          <div className="home-vocab-filters" role="radiogroup" aria-label="Which words">
            {(
              [
                ["learn", `To learn (${words.length - known})`],
                ["all", `All (${words.length})`],
                ["known", `Known (${known})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                className={filter === value ? "home-vocab-chip is-on" : "home-vocab-chip"}
                onClick={() => {
                  setFilter(value)
                  setReveal(false)
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {current ? (
            <section className="home-vocab-card home-vocab-study-card" lang={VOCAB_LANG_SPEECH[lang]} aria-live="polite">
              <div className="home-vocab-card-head">
                {current.rank ? <span className="home-vocab-rank" lang="en">#{current.rank}</span> : null}
                <div className="home-vocab-card-title">
                  <p className="home-widget-lead home-vocab-card-word">{current.word}</p>
                  {current.reading ? <p className="home-vocab-card-reading">{current.reading}</p> : null}
                  {current.ipa ? <p className="home-vocab-ipa">/{current.ipa}/</p> : null}
                </div>
                <div className="home-vocab-card-keys">
                  <button type="button" className="home-review-key home-vocab-speak" aria-label={`Say ${current.word} aloud`} onClick={() => speakVocab(current.word, lang)}>
                    Say it
                  </button>
                  {current.known ? (
                    <button type="button" className="home-review-key home-vocab-speak is-known" aria-pressed onClick={() => mark(current, false)}>
                      ✓ Known
                    </button>
                  ) : (
                    <button type="button" className="home-review-key home-vocab-speak" aria-pressed={false} onClick={() => mark(current, true)}>
                      Know it
                    </button>
                  )}
                </div>
              </div>
              {reveal ? (
                <p className="home-vocab-definition" lang="en">
                  {current.gloss || "—"}
                  {current.gloss ? (
                    <button type="button" className="home-vocab-inline-speak" aria-label="Say the meaning aloud" onClick={() => speakVocab(current.gloss, "en")}>
                      ♪
                    </button>
                  ) : null}
                </p>
              ) : (
                <button type="button" className="home-vocab-reveal" onClick={() => setReveal(true)}>
                  Show meaning
                </button>
              )}
              <div className="home-vocab-study-nav" lang="en">
                <button type="button" className="home-vocab-chip" onClick={() => go(-1)} aria-label="Previous word">
                  ← Prev
                </button>
                <span>
                  {index + 1} / {pool.length}
                </span>
                <button type="button" className="home-vocab-chip" onClick={() => go(1)} aria-label="Next word">
                  Next →
                </button>
              </div>
            </section>
          ) : (
            <p className="home-widget-note">{filter === "known" ? "Nothing marked known yet." : "Every word here is known."}</p>
          )}

          <div className="home-widget-actions">
            <button
              type="button"
              className="home-review-key"
              disabled={pool.length < 2}
              onClick={() => {
                const others = pool.filter((w) => w.id !== current?.id)
                const pick = others[Math.floor(Math.random() * others.length)]
                if (pick) {
                  setCurrentId(pick.id)
                  setReveal(false)
                }
              }}
            >
              Shuffle
            </button>
            <button
              type="button"
              className="home-review-key"
              disabled={words.every((w) => w.known)}
              onClick={() => setDrill(words.filter((w) => !w.known).slice(0, 20))}
            >
              Practice next 20
            </button>
            <button
              type="button"
              className="home-review-key"
              disabled={words.every((w) => w.known)}
              onClick={() => setDrill(shuffled(words.filter((w) => !w.known)).slice(0, 20))}
            >
              Practice 20 shuffled
            </button>
          </div>

          <WordGrid words={pool} currentId={current?.id ?? null} onPick={(id) => { setCurrentId(id); setReveal(false) }} />

          {current ? (
            <VocabDictionaryFold lang={lang} word={current.word} fallbackIpa={current.ipa} />
          ) : null}
        </>
      )}
    </div>
  )
}

function WordGrid({ words, currentId, onPick }: { words: StudyWord[]; currentId: string | null; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="home-vocab-grid-fold" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <span className="home-widget-fold" aria-hidden="true">
          <span className="is-shut">&gt;</span>
          <span className="is-open">^</span>
        </span>
        Word grid ({words.length})
      </summary>
      {open ? (
        <ol className="home-vocab-grid">
          {words.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className={cn("home-vocab-grid-word", w.known && "is-known", w.id === currentId && "is-current")}
                title={w.gloss}
                onClick={() => onPick(w.id)}
              >
                {w.rank ? <span className="home-vocab-grid-rank">{w.rank}</span> : null}
                {w.word}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </details>
  )
}

function VocabPractice({
  lang,
  words,
  onDone,
  onAnother,
}: {
  lang: ThousandLang
  words: StudyWord[]
  onDone: () => void
  /** Start a new round from the words still to learn (read live by the parent). */
  onAnother: () => void
}) {
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [tally, setTally] = useState({ know: 0, learning: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const card = words[pos]
  const finished = pos >= words.length

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  const answer = (knowIt: boolean) => {
    if (!card) return
    if (knowIt) setVocabKnown(card.id, true)
    setTally((t) => (knowIt ? { ...t, know: t.know + 1 } : { ...t, learning: t.learning + 1 }))
    setPos((p) => p + 1)
    setFlipped(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (finished) return
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault()
      setFlipped((f) => !f)
    } else if (event.key === "1") answer(false)
    else if (event.key === "2") answer(true)
  }

  return (
    <div className="home-vocab-practice" ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="home-vocab-flash-bar">
        <span className="home-vocab-flash-count">
          {Math.min(pos + 1, words.length)} / {words.length}
        </span>
        <span className="home-vocab-known-bar" aria-hidden="true">
          <span style={{ width: `${(pos / Math.max(words.length, 1)) * 100}%` }} />
        </span>
        <button type="button" className="home-vocab-chip" onClick={onDone}>
          End round
        </button>
      </div>
      {finished ? (
        <div className="home-vocab-card home-vocab-practice-done">
          <p className="home-widget-lead">Round done</p>
          <p>
            {tally.know} marked known · {tally.learning} still learning
          </p>
          <div className="home-widget-actions">
            <button type="button" className="home-review-key" onClick={onAnother}>
              Another 20
            </button>
            <button type="button" className="home-review-key" onClick={onDone}>
              Back to the list
            </button>
          </div>
        </div>
      ) : card ? (
        <>
          <button
            type="button"
            className={cn("home-vocab-card home-vocab-practice-card", flipped && "is-flipped")}
            lang={VOCAB_LANG_SPEECH[lang]}
            aria-label={flipped ? `${card.word}: ${card.gloss}` : `${card.word}. Flip for the meaning`}
            onClick={() => setFlipped((f) => !f)}
          >
            {card.rank ? <span className="home-vocab-rank" lang="en">#{card.rank}</span> : null}
            <span className="home-vocab-practice-word">{card.word}</span>
            {flipped ? (
              <span className="home-vocab-practice-back">
                {card.reading ? <span className="home-vocab-card-reading">{card.reading}</span> : null}
                {card.ipa ? <span className="home-vocab-ipa">/{card.ipa}/</span> : null}
                <span className="home-vocab-definition" lang="en">{card.gloss}</span>
              </span>
            ) : (
              <span className="home-vocab-flash-hint" lang="en">Space or click to flip</span>
            )}
          </button>
          <div className="home-widget-actions">
            <button type="button" className="home-review-key" onClick={() => speakVocab(card.word, lang)}>
              ♪ Say it
            </button>
            <button type="button" className="home-review-key" onClick={() => answer(false)}>
              1 · Still learning
            </button>
            <button type="button" className="home-review-key is-on" onClick={() => answer(true)}>
              2 · Know it
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
