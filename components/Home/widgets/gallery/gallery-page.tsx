/**
 * components/Home/widgets/gallery/gallery-page.tsx — One kind's page in the Widget gallery
 *
 * Reads top to bottom like a manual: the install rule and the Install key,
 * sample faces in Dash and Milled, what it does, how it works, when it is
 * worth it, every setting a copy can change, the first-run guide, and the
 * installed copies (show or hide, settings, remove). Install opens the
 * kind's setup (`install-setup.tsx`); Settings opens the same gear panel the
 * detail popup uses, for that copy alone.
 */
"use client"

import { useState } from "react"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { useHomeDaysUntilStore, type HomeDaysUntilItem } from "@/lib/home-days-until-store"
import { copyDisplayName, orderedCopies } from "@/lib/widgets/dashboard"
import { sizeLabel } from "@/lib/widgets/kinds"
import { CEFR_LABEL, CEFR_LEVELS, LANGUAGE_EXAMS, isCefrLevel } from "@/lib/widgets/language-levels"
import { VOCAB_LANGS, VOCAB_LANG_LABEL, isVocabLang } from "@/lib/vocab-words"
import type { WidgetCopy, WidgetKind } from "@/lib/widgets/types"
import { CopySettingsPanel } from "@/components/Home/widgets/copy-settings"
import { LanguageStudySettings } from "@/components/Home/widgets/language-study-settings"
import { WidgetGuide } from "@/components/Home/widgets/widget-guide"
import { CountdownSettings } from "@/components/Home/home-days-until"
import { SampleFaces } from "@/components/Home/widgets/gallery/sample-faces"
import { InstallSetup } from "@/components/Home/widgets/gallery/install-setup"
import { installPlain, removeInstalledCopy, removeNoteFor } from "@/components/Home/widgets/gallery/install"

type PageView = { at: "page" } | { at: "setup" } | { at: "guide" } | { at: "settings"; copyId: string }

/** Settings that live in a kind's own gear panel rather than its manifest fields. */
const PANEL_SETTINGS: Record<string, { label: string; help: string }[]> = {
  daysuntil: [
    { label: "Mark", help: "The name, date, and an optional time it counts to or from." },
    { label: "Counts", help: "Down to the date, up from it, or down then up once it passes." },
    { label: "Units", help: "Days and hours, a decimal, days, weeks, sleeps, or working days." },
    { label: "Repeats", help: "Every year or every month; the face rolls to the next one." },
    { label: "Start", help: "An optional start date draws how far along the span is." },
    { label: "Milestones", help: "Count-ups light the lamp at round numbers." },
    { label: "When it passes", help: "Stay at zero, start counting up, or hide the face." },
    { label: "Plan", help: "Attach a Plan event, or keep the mark as an all-day day on the scheduler." },
  ],
  vocab: [
    { label: "This language is", help: "Learning (levels, placement quiz, 1000 words) or native (vocabulary building)." },
    { label: "Level", help: "A1 to C2. It picks the word pool the face and flashcards draw from." },
    { label: "Placement quiz", help: "Short, in the format of that language's real exam. It sets the level." },
    { label: "Face", help: "The word of the day, or your level with a known-word meter." },
    { label: "Mode", help: "Vocab today: word of the day, 1000 words, flashcards, and look-up." },
  ],
}

function installRuleText(kind: WidgetKind): string {
  if (kind.installs === "once") return "One copy"
  if (kind.installs === "perKey") return `One per ${kind.keyLabel?.toLowerCase() ?? "key"}`
  return "As many as you like"
}

function installRuleNote(kind: WidgetKind): string {
  if (kind.installs === "once") return "There is one of these. Install puts it on the dashboard; hiding keeps its settings."
  if (kind.installs === "perKey") {
    return `Install one for each ${kind.keyLabel?.toLowerCase() ?? "key"}. Each copy has its own settings.`
  }
  return "Each copy is its own widget with its own settings, so you can keep several side by side."
}

export function useCopyName() {
  const marks = useHomeDaysUntilStore((s) => s.items)
  return (copy: WidgetCopy) => {
    if (copy.kind === "daysuntil" && !copy.title.trim()) {
      const mark = marks.find((item) => item.id === copy.settings.markId)
      return mark?.label ? `Countdown · ${mark.label}` : "Countdown"
    }
    return copyDisplayName(copy, (key) => (isVocabLang(key) ? VOCAB_LANG_LABEL[key] : key || "Pinned city"))
  }
}

export function GalleryKindPage({ kind }: { kind: WidgetKind }) {
  const data = useDashboardStore((s) => s)
  const showCopy = useDashboardStore((s) => s.showCopy)
  const hideCopy = useDashboardStore((s) => s.hideCopy)
  const markGuideSeen = useDashboardStore((s) => s.markGuideSeen)
  const nameOf = useCopyName()
  const [view, setView] = useState<PageView>({ at: "page" })
  const [notice, setNotice] = useState("")
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const copies = orderedCopies(data, data.style).filter((copy) => copy.kind === kind.id)
  const showing = copies.filter((copy) => !copy.hidden)
  const sizeOf = (copy: WidgetCopy) =>
    data.style === "milled" ? data.milled.sizes[copy.id] ?? "auto" : data.dash.sizes[copy.id] ?? kind.defaultSize

  const installedNotice = (copyId: string) => {
    const copy = useDashboardStore.getState().copies.find((entry) => entry.id === copyId)
    setNotice(copy ? `${nameOf(copy)} is on your Visual dashboard. Click its face to open it.` : "Installed.")
    setView({ at: "page" })
  }

  const install = () => {
    setNotice("")
    if (kind.hasSetup || kind.guide) {
      setView({ at: "setup" })
      return
    }
    const id = installPlain(kind.id)
    if (id) installedNotice(id)
  }

  const once = kind.installs === "once"
  const onceCopy = once ? copies[0] : undefined
  const installKey =
    once && onceCopy && !onceCopy.hidden ? (
      <p className="vdg-installed-mark">Installed</p>
    ) : once && onceCopy ? (
      <button
        type="button"
        className="home-review-key is-on"
        onClick={() => {
          showCopy(onceCopy.id)
          setNotice(`${kind.name} is back on your Visual dashboard.`)
        }}
      >
        Show on dashboard
      </button>
    ) : (
      <button type="button" className="home-review-key is-on" onClick={install} data-testid="widget-install">
        {copies.length > 0 && !once ? "Install another" : "Install"}
      </button>
    )

  if (view.at === "setup") {
    return (
      <article className="vdg-page" data-kind={kind.id} data-view="setup">
        <InstallSetup kind={kind} onInstalled={installedNotice} onCancel={() => setView({ at: "page" })} />
      </article>
    )
  }

  if (view.at === "guide" && kind.guide) {
    return (
      <article className="vdg-page" data-kind={kind.id} data-view="guide">
        <WidgetGuide cards={kind.guide} onDone={() => setView({ at: "page" })} />
      </article>
    )
  }

  if (view.at === "settings") {
    const copy = copies.find((entry) => entry.id === view.copyId)
    if (copy) {
      return (
        <article className="vdg-page" data-kind={kind.id} data-view="settings">
          <h4 className="vdg-setup-title">{nameOf(copy)} · Settings</h4>
          <CopySettingsPanel
            copyId={copy.id}
            custom={<KindPanel copy={copy} />}
            removeNote={removeNoteFor(kind.id)}
            onShowGuide={kind.guide ? () => setView({ at: "guide" }) : undefined}
            onRemoved={() => {
              removeInstalledCopy(copy)
              setView({ at: "page" })
            }}
          />
          <div className="home-widget-actions vd-settings-done">
            <button type="button" className="home-review-key is-on" onClick={() => setView({ at: "page" })}>
              Done
            </button>
          </div>
        </article>
      )
    }
  }

  const panelSettings = PANEL_SETTINGS[kind.id] ?? []

  return (
    <article className="vdg-page" data-kind={kind.id} data-view="page" aria-live="polite">
      <header className="vdg-head">
        <div className="vdg-head-text">
          <p className="vdg-group">{kind.group}</p>
          <h3 className="vdg-name">{kind.name}</h3>
          <p className="vdg-rule">
            <span className="vdg-chip">{installRuleText(kind)}</span>
            <span className="vdg-chip">
              {copies.length === 0 ? "Not installed" : `${showing.length} showing · ${copies.length} installed`}
            </span>
          </p>
        </div>
        <div className="vdg-head-keys">{installKey}</div>
      </header>
      {notice ? (
        <p className="vdg-notice" role="status">
          {notice}
        </p>
      ) : null}

      <SampleFaces kind={kind} initialStyle={data.style} />

      <section className="vdg-section">
        <h4>What it does</h4>
        <p>{kind.gallery.what}</p>
      </section>

      <section className="vdg-section">
        <h4>How it works</h4>
        <ol className="vdg-how">
          {kind.gallery.how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      <section className="vdg-section">
        <h4>Worth it when</h4>
        <p>{kind.gallery.useful}</p>
        <p className="home-widget-note">{installRuleNote(kind)}</p>
      </section>

      {kind.id === "vocab" ? <LevelsTable /> : null}

      <section className="vdg-section">
        <h4>Settings for each copy</h4>
        <p className="home-widget-note">The gear in a copy&apos;s detail changes that copy alone.</p>
        <dl className="vdg-settings-list">
          {kind.settings.map((field) => (
            <div key={field.key} className="vdg-setting">
              <dt>{field.label}</dt>
              <dd>
                {field.type === "choice" ? (
                  <span className="vdg-options">
                    {field.options.map((option) => (
                      <span key={option.value} className="vdg-chip" data-default={option.value === field.default ? "true" : undefined}>
                        {option.label}
                      </span>
                    ))}
                  </span>
                ) : field.type === "toggle" ? (
                  <span className="vdg-chip">{field.default ? "On" : "Off"} by default</span>
                ) : null}
                {field.help ? <span className="vdg-setting-help">{field.help}</span> : null}
              </dd>
            </div>
          ))}
          {panelSettings.map((entry) => (
            <div key={entry.label} className="vdg-setting">
              <dt>{entry.label}</dt>
              <dd>
                <span className="vdg-setting-help">{entry.help}</span>
              </dd>
            </div>
          ))}
          <div className="vdg-setting">
            <dt>Face</dt>
            <dd>
              <span className="vdg-options">
                {kind.sizes.map((size) => (
                  <span key={size} className="vdg-chip" data-default={size === kind.defaultSize ? "true" : undefined}>
                    {sizeLabel(size)} {size}
                  </span>
                ))}
              </span>
              <span className="vdg-setting-help">Title, lamp color, footer line, and size. Every copy has these.</span>
            </dd>
          </div>
          <div className="vdg-setting">
            <dt>Day</dt>
            <dd>
              <span className="vdg-setting-help">Read the dashboard&apos;s day, always the wall clock, or always the day you are viewing.</span>
            </dd>
          </div>
        </dl>
      </section>

      {kind.guide ? (
        <section className="vdg-section">
          <h4>First-run guide</h4>
          <ol className="vdg-guide-list">
            {kind.guide.map((card) => (
              <li key={card.title}>
                <strong>{card.title}.</strong> {card.body}
              </li>
            ))}
          </ol>
          <div className="home-widget-actions">
            <button type="button" className="home-review-key" onClick={() => setView({ at: "guide" })}>
              Play the guide
            </button>
            {copies.length > 0 ? (
              <button
                type="button"
                className="home-review-key"
                onClick={() => {
                  for (const copy of copies) markGuideSeen(copy.id, false)
                  setNotice("The guide will show the next time you open each copy.")
                }}
              >
                Show the guide again
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="vdg-section vdg-copies" aria-label="Installed copies">
        <h4>Installed copies</h4>
        {copies.length === 0 ? (
          <p className="home-widget-note">None yet. Install puts one on your Visual dashboard.</p>
        ) : (
          <ul className="vdg-copy-list">
            {copies.map((copy) => (
              <li key={copy.id} className="vdg-copy" data-copy-id={copy.id} data-hidden={copy.hidden ? "true" : "false"}>
                <span className="home-widgets-lamp" data-on={copy.hidden ? "false" : "true"} aria-hidden="true" />
                <span className="vdg-copy-name">
                  {nameOf(copy)}
                  <span className="vdg-copy-meta">
                    {copy.hidden ? "Hidden" : "Showing"} · {sizeOf(copy) === "auto" ? "Original size" : sizeLabel(sizeOf(copy))}
                  </span>
                </span>
                <span className="home-widget-actions vdg-copy-keys">
                  <button
                    type="button"
                    className="home-review-key"
                    onClick={() => (copy.hidden ? showCopy(copy.id) : hideCopy(copy.id))}
                  >
                    {copy.hidden ? "Show" : "Hide"}
                  </button>
                  <button
                    type="button"
                    className="home-review-key"
                    aria-label={`Settings for ${nameOf(copy)}`}
                    onClick={() => setView({ at: "settings", copyId: copy.id })}
                  >
                    Settings
                  </button>
                  <button type="button" className="home-review-key" onClick={() => setConfirmRemove(copy.id)}>
                    Remove…
                  </button>
                </span>
                {confirmRemove === copy.id ? (
                  <div className="vd-remove-confirm" role="alert">
                    <p className="home-widget-note">
                      Remove {nameOf(copy)} and its settings? {removeNoteFor(kind.id) ?? "Its data elsewhere in Brain2 stays."}
                    </p>
                    <div className="home-widget-actions">
                      <button type="button" className="home-review-key" onClick={() => setConfirmRemove(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="home-review-key"
                        onClick={() => {
                          setConfirmRemove(null)
                          removeInstalledCopy(copy)
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}

/** The kind's own gear panel, as the detail popup draws it. */
function KindPanel({ copy }: { copy: WidgetCopy }) {
  const marks = useHomeDaysUntilStore((s) => s.items)
  if (copy.kind === "daysuntil") {
    const item: HomeDaysUntilItem | undefined = marks.find((entry) => entry.id === copy.settings.markId)
    return item ? <CountdownSettings item={item} /> : null
  }
  if (copy.kind === "vocab") {
    const lang = isVocabLang(copy.key) ? copy.key : isVocabLang(copy.settings.lang) ? copy.settings.lang : null
    return lang ? <LanguageStudySettings copy={copy} lang={lang} /> : null
  }
  return null
}

function LevelsTable() {
  const copies = useDashboardStore((s) => s.copies)
  const levelOf = new Map(
    copies
      .filter((copy) => copy.kind === "vocab" && copy.settings.role === "studied" && isCefrLevel(copy.settings.cefr))
      .map((copy) => [copy.key, copy.settings.cefr as string]),
  )
  return (
    <section className="vdg-section vdg-levels">
      <h4>Levels and real exams</h4>
      <p>
        Studied languages sit on the CEFR ladder, the scale the real exams use. The placement quiz follows each exam&apos;s
        format, so the level it gives you means the same thing an examiner would.
      </p>
      <div className="vdg-table-wrap">
        <table className="vdg-table">
          <thead>
            <tr>
              <th scope="col">Level</th>
              {VOCAB_LANGS.map((lang) => (
                <th key={lang} scope="col">
                  {VOCAB_LANG_LABEL[lang]}
                  <span className="vdg-table-exam">{LANGUAGE_EXAMS[lang].name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CEFR_LEVELS.map((level) => (
              <tr key={level}>
                <th scope="row">
                  {level}
                  <span className="vdg-table-exam">{CEFR_LABEL[level]}</span>
                </th>
                {VOCAB_LANGS.map((lang) => (
                  <td key={lang} data-mine={levelOf.get(lang) === level ? "true" : undefined}>
                    {LANGUAGE_EXAMS[lang].levels[level] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="home-widget-note">A lit cell is a language you study, at its current level. Native languages skip levels.</p>
    </section>
  )
}
