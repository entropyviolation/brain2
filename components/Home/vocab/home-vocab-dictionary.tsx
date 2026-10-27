/**
 * components/Home/vocab/home-vocab-dictionary.tsx — Full dictionary entry for a vocab word
 *
 * The whole Wiktionary entry for the word, from the dictionary written in
 * that language (`lib/vocab-dictionary.ts`): IPA, every sense with its
 * examples, synonyms, antonyms, derived words, and inflection tables. A word
 * linked inside the entry opens in place (← steps back); Conjugation fetches
 * the separate conjugation page when the wiki has one. ♪ says the word and
 * the first definition. With `onAdd`, **Add to My words** files the word in
 * that language's My words list with its English gloss and IPA.
 * `VocabDictionaryFold` mounts the entry only when its fold opens (one lookup
 * per opened word, not per card shown). `VocabLookup` is the Look up mode:
 * any word in the language, not only the bundled ones.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react"
import { useTaskStore } from "@/lib/task-store"
import {
  DICTIONARY_NAME,
  lookupConjugation,
  lookupDictionary,
  lookupEnglishGloss,
  type DictionaryEntry,
} from "@/lib/vocab-dictionary"
import { MINE_LIST_NAME, addMyWord, isThousandLang, mineListId, studyWordsOn } from "@/lib/vocab-lists"
import { VOCAB_LANG_LABEL, VOCAB_LANG_SPEECH, speakVocab, type VocabLang } from "@/lib/vocab-words"

type Status = { kind: "loading" } | { kind: "missing" } | { kind: "error"; message: string } | { kind: "ready"; entry: DictionaryEntry }

export function VocabDictionary({
  lang,
  word,
  fallbackIpa,
  onAdd,
  addedLabel,
}: {
  lang: VocabLang
  word: string
  /** Bundled IPA shown until (or when) the entry has none. */
  fallbackIpa?: string
  onAdd?: (entry: DictionaryEntry) => void
  /** Set when this word is already filed; replaces the Add key. */
  addedLabel?: string
}) {
  const [trail, setTrail] = useState<string[]>([word])
  const [status, setStatus] = useState<Status>({ kind: "loading" })
  const [conjugation, setConjugation] = useState<{ title: string; html: string | null; loading: boolean } | null>(null)
  const current = trail[trail.length - 1]!
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTrail([word])
  }, [word, lang])

  useEffect(() => {
    const controller = new AbortController()
    setStatus({ kind: "loading" })
    setConjugation(null)
    lookupDictionary(lang, current, controller.signal)
      .then((entry) => {
        if (controller.signal.aborted) return
        setStatus(entry ? { kind: "ready", entry } : { kind: "missing" })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setStatus({ kind: "error", message: error instanceof Error ? error.message : "Lookup failed" })
      })
    return () => controller.abort()
  }, [lang, current])

  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0 })
  }, [status])

  const openLinked = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest("a[data-vocab-word]")
    if (!link) return
    event.preventDefault()
    const next = link.getAttribute("data-vocab-word")
    if (next && next !== current) setTrail((t) => [...t, next])
  }

  const loadConjugation = (title: string) => {
    setConjugation({ title, html: null, loading: true })
    lookupConjugation(lang, title)
      .then((html) => setConjugation({ title, html, loading: false }))
      .catch(() => setConjugation({ title, html: null, loading: false }))
  }

  const entry = status.kind === "ready" ? status.entry : null
  const ipa = entry?.ipa ?? (current === word ? fallbackIpa : undefined)

  return (
    <section className="home-vocab-dict" aria-label={`Dictionary: ${current}`} aria-busy={status.kind === "loading"}>
      <header className="home-vocab-dict-head">
        {trail.length > 1 ? (
          <button
            type="button"
            className="home-vocab-dict-back"
            aria-label="Back to the previous word"
            onClick={() => setTrail((t) => t.slice(0, -1))}
          >
            ←
          </button>
        ) : null}
        <div className="home-vocab-dict-title" lang={VOCAB_LANG_SPEECH[lang]}>
          <strong>{entry?.title ?? current}</strong>
          {ipa ? <span className="home-vocab-ipa">/{ipa}/</span> : null}
        </div>
        <div className="home-vocab-dict-keys">
          <button type="button" className="home-vocab-inline-speak" aria-label={`Say ${current} aloud`} onClick={() => speakVocab(entry?.title ?? current, lang)}>
            ♪ word
          </button>
          {entry?.firstDefinition ? (
            <button
              type="button"
              className="home-vocab-inline-speak"
              aria-label="Say the definition aloud"
              onClick={() => speakVocab(entry.firstDefinition!, lang)}
            >
              ♪ definition
            </button>
          ) : null}
        </div>
      </header>

      {status.kind === "loading" ? <p className="home-vocab-dict-note">Looking it up in {DICTIONARY_NAME[lang]}…</p> : null}
      {status.kind === "missing" ? (
        <p className="home-vocab-dict-note">{DICTIONARY_NAME[lang]} has no entry for “{current}” in this language.</p>
      ) : null}
      {status.kind === "error" ? (
        <p className="home-vocab-dict-note">Could not reach {DICTIONARY_NAME[lang]} ({status.message}). Check the connection and open it again.</p>
      ) : null}

      {entry ? (
        <>
          <div
            ref={bodyRef}
            className="home-vocab-dict-body"
            lang={VOCAB_LANG_SPEECH[lang]}
            onClick={openLinked}
            // Rebuilt on an allowlist in lib/vocab-dictionary.ts (no scripts, styles, or handlers).
            dangerouslySetInnerHTML={{ __html: entry.html }}
          />
          {entry.conjugationTitle ? (
            <details
              className="home-vocab-dict-conj"
              onToggle={(event) => {
                if ((event.target as HTMLDetailsElement).open && conjugation?.title !== entry.conjugationTitle) {
                  loadConjugation(entry.conjugationTitle!)
                }
              }}
            >
              <summary>Full conjugation</summary>
              {conjugation?.loading ? <p className="home-vocab-dict-note">Loading…</p> : null}
              {conjugation && !conjugation.loading && conjugation.html ? (
                <div
                  className="home-vocab-dict-body is-conj"
                  lang={VOCAB_LANG_SPEECH[lang]}
                  onClick={openLinked}
                  dangerouslySetInnerHTML={{ __html: conjugation.html }}
                />
              ) : null}
              {conjugation && !conjugation.loading && !conjugation.html ? (
                <p className="home-vocab-dict-note">That conjugation page did not load.</p>
              ) : null}
            </details>
          ) : null}
          <footer className="home-vocab-dict-foot">
            <a href={entry.url} target="_blank" rel="noopener noreferrer">
              {DICTIONARY_NAME[lang]} ↗
            </a>
            <span>CC BY-SA</span>
            {addedLabel ? (
              <span className="home-vocab-dict-added">{addedLabel}</span>
            ) : onAdd ? (
              <button type="button" className="home-review-key" onClick={() => onAdd(entry)}>
                + Add to My words
              </button>
            ) : null}
          </footer>
        </>
      ) : null}
    </section>
  )
}

/** A closed fold; the entry is fetched the first time it opens. */
export function VocabDictionaryFold({
  lang,
  word,
  fallbackIpa,
  label = "Dictionary entry",
}: {
  lang: VocabLang
  word: string
  fallbackIpa?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <details className="home-vocab-dict-fold" onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
      <summary>
        <span className="home-widget-fold" aria-hidden="true">
          <span className="is-shut">&gt;</span>
          <span className="is-open">^</span>
        </span>
        {label}
      </summary>
      {open ? <VocabDictionary lang={lang} word={word} fallbackIpa={fallbackIpa} /> : null}
    </details>
  )
}

const LOOKUP_PLACEHOLDER: Record<VocabLang, string> = {
  en: "Any English word",
  fr: "Un mot en français",
  es: "Una palabra en español",
  it: "Una parola in italiano",
  de: "Ein deutsches Wort",
  ja: "日本語の単語",
  zh: "中文词语",
}

/** Look up any word in the language; target languages can file it in My words. */
export function VocabLookup({ lang }: { lang: VocabLang }) {
  const [draft, setDraft] = useState("")
  const [word, setWord] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const tasks = useTaskStore((s) => s.tasks)
  const mine = useMemo(() => (isThousandLang(lang) ? studyWordsOn(tasks, mineListId(lang)) : []), [tasks, lang])

  useEffect(() => {
    setWord(null)
    setDraft("")
  }, [lang])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = draft.trim()
    if (next) setWord(next)
  }

  const add = async (entry: DictionaryEntry) => {
    if (!isThousandLang(lang)) return
    setAdding(true)
    const gloss = await lookupEnglishGloss(lang, entry.title).catch(() => null)
    addMyWord(lang, { word: entry.title, gloss: gloss ?? undefined, ipa: entry.ipa })
    setAdding(false)
  }

  const filed = word
    ? mine.some((w) => w.word.toLowerCase() === word.toLowerCase())
    : false

  return (
    <div className="home-vocab-lookup">
      <form className="home-vocab-lookup-form" onSubmit={submit} role="search">
        <label className="home-widget-field">
          <span className="sr-only">Look up a {VOCAB_LANG_LABEL[lang]} word</span>
          <input
            type="search"
            value={draft}
            lang={VOCAB_LANG_SPEECH[lang]}
            placeholder={LOOKUP_PLACEHOLDER[lang]}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button type="submit" className="home-review-key" disabled={!draft.trim()}>
          Look up
        </button>
      </form>
      <p className="home-widget-note">
        Full entries from {DICTIONARY_NAME[lang]}, the dictionary written in {VOCAB_LANG_LABEL[lang]}.
        {isThousandLang(lang) ? ` Add a word to file it in “${MINE_LIST_NAME[lang]}” in Lists.` : ""}
      </p>
      {word ? (
        <VocabDictionary
          key={`${lang}:${word}`}
          lang={lang}
          word={word}
          onAdd={isThousandLang(lang) ? (entry) => void add(entry) : undefined}
          addedLabel={adding ? "Adding…" : filed && isThousandLang(lang) ? `In ${MINE_LIST_NAME[lang]} ✓` : undefined}
        />
      ) : null}
    </div>
  )
}
