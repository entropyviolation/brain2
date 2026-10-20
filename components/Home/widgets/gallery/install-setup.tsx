/**
 * components/Home/widgets/gallery/install-setup.tsx — Install, with setup where a kind needs it
 *
 * A kind with `hasSetup` asks a few questions before its copy lands:
 * - Countdown: a name, a date, which way it counts, and whether it repeats.
 * - Language study: the language, whether it is native or studied, and a
 *   level, or the placement quiz right after install.
 * - Weather and Solar: a place (city search), or follow the pinned city.
 * A kind with a first-run guide also asks whether to show it on first open.
 * Logic lives in `./install.ts`.
 */
"use client"

import { useEffect, useState, type FormEvent } from "react"
import { searchCities, type CitySuggestion } from "@/lib/city-search"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { languageRoleFor } from "@/lib/widgets/dashboard"
import {
  CEFR_LABEL,
  CEFR_LEVELS,
  CEFR_NOTE,
  LANGUAGE_EXAMS,
  examLevelName,
  type CefrLevel,
  type LanguageRole,
} from "@/lib/widgets/language-levels"
import { VOCAB_LANGS, VOCAB_LANG_LABEL } from "@/lib/vocab-words"
import type { DaysUntilMode, DaysUntilRepeat } from "@/lib/home-days-until-store"
import type { VocabLang } from "@/lib/vocab/types"
import type { WidgetKind } from "@/lib/widgets/types"
import { CockpitSwitch } from "@/components/Home/Habits/cockpit-switch"
import { placementQuiz } from "@/components/Home/widgets/placement-registry"
import { applyCefrLevel } from "@/components/Home/widgets/language-study-settings"
import {
  installCountdown,
  installLanguage,
  installPlace,
  installPlain,
  type InstallPlace,
} from "@/components/Home/widgets/gallery/install"

export function InstallSetup({
  kind,
  onInstalled,
  onCancel,
}: {
  kind: WidgetKind
  onInstalled: (copyId: string) => void
  onCancel: () => void
}) {
  const [guide, setGuide] = useState(true)
  const guideSwitch = kind.guide ? (
    <div className="vd-settings-switch vdg-setup-guide">
      <CockpitSwitch checked={guide} onCheckedChange={setGuide} label="Show the guide the first time I open it" />
      <p className="home-widget-note">
        {kind.guide.length} short cards. You can replay them from the gear or this page.
      </p>
    </div>
  ) : null

  const body =
    kind.id === "daysuntil" ? (
      <CountdownSetup guide={guide} onInstalled={onInstalled} onCancel={onCancel} />
    ) : kind.id === "vocab" ? (
      <LanguageSetup guide={guide} onInstalled={onInstalled} onCancel={onCancel} />
    ) : kind.id === "weather" || kind.id === "solar" ? (
      <PlaceSetup kind={kind} guide={guide} onInstalled={onInstalled} onCancel={onCancel} />
    ) : (
      <SetupKeys
        onCancel={onCancel}
        onInstall={() => {
          const id = installPlain(kind.id, guide)
          if (id) onInstalled(id)
        }}
      />
    )

  return (
    <section className="vdg-setup" data-kind={kind.id} aria-label={`Install ${kind.name}`} data-testid="widget-install-setup">
      <h4 className="vdg-setup-title">Install {kind.name}</h4>
      {body}
      {guideSwitch}
    </section>
  )
}

function SetupKeys({
  onCancel,
  onInstall,
  disabled,
  label = "Install",
}: {
  onCancel: () => void
  onInstall?: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <div className="home-widget-actions vdg-setup-keys">
      <button type="button" className="home-review-key" onClick={onCancel}>
        Cancel
      </button>
      <button
        type={onInstall ? "button" : "submit"}
        className="home-review-key is-on"
        disabled={disabled}
        onClick={onInstall}
      >
        {label}
      </button>
    </div>
  )
}

type SetupProps = { guide: boolean; onInstalled: (copyId: string) => void; onCancel: () => void }

function CountdownSetup({ guide, onInstalled, onCancel }: SetupProps) {
  const [label, setLabel] = useState("")
  const [date, setDate] = useState("")
  const [mode, setMode] = useState<DaysUntilMode>("countdown")
  const [repeat, setRepeat] = useState<DaysUntilRepeat>("none")
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!date) return
    const id = installCountdown({ label: label.trim(), date, mode, repeat }, guide)
    if (id) onInstalled(id)
  }
  return (
    <form className="vdg-setup-form" onSubmit={submit}>
      <label className="home-widget-field">
        What it counts
        <input value={label} maxLength={40} placeholder="Launch, Mom's birthday, sober" onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="home-widget-field">
        Date
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <fieldset className="home-widget-fieldset">
        <legend>Counts</legend>
        <label className="home-widget-choice">
          <input type="radio" name="vdg-cd-mode" checked={mode === "countdown"} onChange={() => setMode("countdown")} />
          Down to the date
        </label>
        <label className="home-widget-choice">
          <input type="radio" name="vdg-cd-mode" checked={mode === "countup"} onChange={() => setMode("countup")} />
          Up from the date (days since)
        </label>
      </fieldset>
      <fieldset className="home-widget-fieldset">
        <legend>Repeats</legend>
        {(
          [
            ["none", "Once"],
            ["yearly", "Every year (birthdays, anniversaries)"],
            ["monthly", "Every month"],
          ] as const
        ).map(([value, text]) => (
          <label key={value} className="home-widget-choice">
            <input type="radio" name="vdg-cd-repeat" checked={repeat === value} onChange={() => setRepeat(value)} />
            {text}
          </label>
        ))}
      </fieldset>
      <p className="home-widget-note">Units, a start date, milestones, a Plan event, and what happens once it passes are in the gear.</p>
      <SetupKeys onCancel={onCancel} disabled={!date} />
    </form>
  )
}

function LanguageSetup({ guide, onInstalled, onCancel }: SetupProps) {
  const copies = useDashboardStore((s) => s.copies)
  const showing = new Set(copies.filter((copy) => copy.kind === "vocab" && !copy.hidden).map((copy) => copy.key))
  const hiddenKeys = new Set(copies.filter((copy) => copy.kind === "vocab" && copy.hidden).map((copy) => copy.key))
  const firstFree = VOCAB_LANGS.find((lang) => !showing.has(lang)) ?? "fr"
  const [lang, setLang] = useState<VocabLang>(firstFree)
  const [role, setRole] = useState<LanguageRole>(languageRoleFor(firstFree))
  const [cefr, setCefr] = useState<CefrLevel>("A1")
  const [quizNext, setQuizNext] = useState(false)
  const [quizCopy, setQuizCopy] = useState<string | null>(null)
  const Quiz = placementQuiz()
  const exam = LANGUAGE_EXAMS[lang]

  if (quizCopy && Quiz) {
    return (
      <section className="vdg-setup-quiz" aria-label="Placement quiz">
        <p className="home-widget-note">
          {VOCAB_LANG_LABEL[lang]} is installed. This quiz follows the {exam.name} format and sets your level.
        </p>
        <Quiz
          lang={lang}
          onCancel={() => onInstalled(quizCopy)}
          onResult={(level, detail) => {
            applyCefrLevel(quizCopy, lang, level, detail)
            onInstalled(quizCopy)
          }}
        />
      </section>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const id = installLanguage({ lang, role, cefr }, guide)
    if (!id) return
    if (role === "studied" && quizNext && Quiz) setQuizCopy(id)
    else onInstalled(id)
  }

  return (
    <form className="vdg-setup-form" onSubmit={submit}>
      <fieldset className="home-widget-fieldset vdg-lang-picks">
        <legend>Language</legend>
        {VOCAB_LANGS.map((option) => {
          const taken = showing.has(option)
          return (
            <label key={option} className="home-widget-choice" data-taken={taken ? "true" : undefined}>
              <input
                type="radio"
                name="vdg-lang"
                disabled={taken}
                checked={lang === option}
                onChange={() => {
                  setLang(option)
                  setRole(languageRoleFor(option))
                }}
              />
              {VOCAB_LANG_LABEL[option]}
              {taken ? <span className="vdg-chip">On the dashboard</span> : hiddenKeys.has(option) ? <span className="vdg-chip">Installed, hidden</span> : null}
            </label>
          )
        })}
      </fieldset>
      <fieldset className="home-widget-fieldset">
        <legend>{VOCAB_LANG_LABEL[lang]} is</legend>
        <label className="home-widget-choice">
          <input type="radio" name="vdg-role" checked={role === "studied"} onChange={() => setRole("studied")} />
          A language I am learning
        </label>
        <label className="home-widget-choice">
          <input type="radio" name="vdg-role" checked={role === "native"} onChange={() => setRole("native")} />
          My native language
        </label>
      </fieldset>
      {role === "studied" ? (
        <>
          <fieldset className="home-widget-fieldset vdg-cefr">
            <legend>My level</legend>
            <div className="vdg-cefr-keys">
              {CEFR_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={cefr === level ? "home-review-key is-on" : "home-review-key"}
                  aria-pressed={cefr === level}
                  onClick={() => setCefr(level)}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="vdg-cefr-name">
              {cefr} · {CEFR_LABEL[cefr]} · {examLevelName(lang, cefr)}
            </p>
            <p className="home-widget-note">{CEFR_NOTE[cefr]}</p>
          </fieldset>
          <div className="vd-settings-switch">
            <CockpitSwitch
              checked={quizNext && Quiz != null}
              onCheckedChange={(on) => setQuizNext(on && Quiz != null)}
              label={`Take the ${exam.name}-style placement quiz next`}
            />
            <p className="home-widget-note">
              {Quiz
                ? "Not sure? The quiz sets the level for you. You can skip it and take it later from the gear."
                : "The placement quiz is on its way. Pick a level for now; the gear can change it any time."}
            </p>
          </div>
        </>
      ) : (
        <p className="home-widget-note">
          A native language skips levels and quizzes. It builds vocabulary: a word of the day from Everyday to Extremely
          advanced, favorites, and flashcards.
        </p>
      )}
      <SetupKeys onCancel={onCancel} disabled={showing.has(lang)} label={hiddenKeys.has(lang) ? "Show it" : "Install"} />
    </form>
  )
}

function PlaceSetup({ kind, guide, onInstalled, onCancel }: SetupProps & { kind: WidgetKind }) {
  const copies = useDashboardStore((s) => s.copies)
  const mine = copies.filter((copy) => copy.kind === kind.id)
  const pinnedTaken = mine.some((copy) => (copy.key ?? "") === "" && !copy.hidden)
  const [follow, setFollow] = useState(!pinnedTaken)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<CitySuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [place, setPlace] = useState<InstallPlace | null>(null)

  useEffect(() => {
    if (follow || query.trim().length < 2 || place?.label === query) {
      setHits([])
      return
    }
    let live = true
    setSearching(true)
    const timer = window.setTimeout(() => {
      searchCities(query)
        .then((found) => {
          if (live) setHits(found)
        })
        .catch(() => {
          if (live) setHits([])
        })
        .finally(() => {
          if (live) setSearching(false)
        })
    }, 250)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [follow, query, place?.label])

  const placeTaken = place ? mine.some((copy) => copy.key === place.label && !copy.hidden) : false
  const ready = follow ? !pinnedTaken : place != null && !placeTaken
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    const id = installPlace(kind.id as "weather" | "solar", follow ? null : place, guide)
    if (id) onInstalled(id)
  }

  return (
    <form className="vdg-setup-form" onSubmit={submit}>
      <fieldset className="home-widget-fieldset">
        <legend>Place</legend>
        <label className="home-widget-choice">
          <input type="radio" name="vdg-place" checked={follow} disabled={pinnedTaken} onChange={() => setFollow(true)} />
          Follow my pinned city
          {pinnedTaken ? <span className="vdg-chip">On the dashboard</span> : null}
        </label>
        <label className="home-widget-choice">
          <input type="radio" name="vdg-place" checked={!follow} onChange={() => setFollow(false)} />
          A place of its own
        </label>
      </fieldset>
      {follow ? (
        <p className="home-widget-note">
          It reads the city pinned in the Weather detail, else your home city in Settings, and moves when you move the pin.
        </p>
      ) : (
        <div className="vdg-place-search">
          <label className="home-widget-field">
            City
            <input
              value={query}
              placeholder="Search a city"
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value)
                setPlace(null)
              }}
            />
          </label>
          {searching && hits.length === 0 ? <p className="home-widget-note">Searching…</p> : null}
          {hits.length > 0 ? (
            <ul className="vdg-place-hits" role="listbox" aria-label="Cities">
              {hits.map((hit) => (
                <li key={`${hit.label}-${hit.lat}-${hit.lng}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={place?.label === hit.label}
                    className="vdg-place-hit"
                    onClick={() => {
                      setPlace({ label: hit.label, lat: hit.lat, lng: hit.lng })
                      setQuery(hit.label)
                      setHits([])
                    }}
                  >
                    {hit.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {place ? (
            <p className="home-widget-note">
              {place.label} · {place.lat.toFixed(2)}, {place.lng.toFixed(2)}
              {placeTaken ? " · already on the dashboard" : ""}
            </p>
          ) : null}
        </div>
      )}
      <SetupKeys onCancel={onCancel} disabled={!ready} />
    </form>
  )
}
