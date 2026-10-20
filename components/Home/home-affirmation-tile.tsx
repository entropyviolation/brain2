/**
 * components/Home/home-affirmation-tile.tsx — Affirmation square + detail
 *
 * Face: today's next unsaid line in the chosen lens (Original, E-Prime,
 * Français, Italiano, Español, Vivid, Higher Self). ⇄ flips the lens, ✓ logs
 * one recitation. Today's five are the morning ritual's five when it chose
 * them, else a seeded draw from the Affirmations list for that date.
 *
 * Detail, three modes: **Card** walks today's five on a graph-rule card that
 * flips between lenses (← → or the tabs; ↑ ↓ change line; Enter logs, S
 * speaks); the phosphor console under it counts today, total, days, streak,
 * and first / last said, with a 14-day ledger. **Library** lists every list
 * line and every bank row with its count. **Log** lists recitations by day
 * with their source (widget, ritual tap, Speak them). Bank:
 * `lib/affirmation-bank.ts`; lenses `lib/affirmation-lenses.ts`; log
 * `lib/affirmation-log-store.ts`.
 */
"use client"

import { CopyCaption, useCopySetting } from "@/components/Home/widgets/copy-context"

import { useEffect, useMemo, useState } from "react"
import { HomeWidgetDialog, TileHide, TileOpen } from "@/components/Home/home-widget-dialog"
import { addCalendarDays, formatLocalDateKey } from "@/lib/date-utils"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { affirmationLinesForHome } from "@/lib/home-widgets"
import { AFFIRMATION_BANK } from "@/lib/affirmation-bank"
import { findAffirmationsCategory } from "@/lib/affirmations"
import { createListItem } from "@/lib/item-utils"
import {
  AFFIRMATION_LENSES,
  AFFIRMATION_LENS_CODE,
  AFFIRMATION_LENS_LABEL,
  AFFIRMATION_LENS_NOTE,
  AFFIRMATION_LENS_SPEECH,
  affirmationKey,
  dailyAffirmationSet,
  findBankRow,
  lensText,
  lensesFor,
  type AffirmationLens,
} from "@/lib/affirmation-lenses"
import {
  recitationStats,
  recitationsByDay,
  useAffirmationLogStore,
  type Recitation,
  type RecitationSource,
} from "@/lib/affirmation-log-store"
import { speakVocab } from "@/lib/vocab-words"
import "./home-affirmation.css"

const SOURCE_LABEL: Record<RecitationSource, string> = {
  widget: "widget",
  ritual: "ritual",
  speak: "spoken",
}

function useTodaysAffirmations(currentDate: Date) {
  const lists = useTaskStore((s) => s.lists)
  const tasks = useTaskStore((s) => s.tasks)
  const dateKey = formatLocalDateKey(currentDate)
  const morning = useReviewsStore((s) => s.reviews.find((r) => r.period === "day" && r.periodKey === dateKey)?.morning)
  return useMemo(() => {
    const pool = affirmationLinesForHome(lists, tasks)
    const chosen = morning?.affirmations?.length ? morning.affirmations : morning?.shownAffirmations ?? []
    const lines = chosen.filter((l) => l.trim())
    return {
      dateKey,
      pool,
      lines: lines.length ? lines : dailyAffirmationSet(pool, dateKey),
      fromRitual: lines.length > 0,
    }
  }, [lists, tasks, morning, dateKey])
}

function speak(text: string, lens: AffirmationLens) {
  speakVocab(text, AFFIRMATION_LENS_SPEECH[lens])
}

function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function AffirmationTile({ currentDate, onHide }: { currentDate: Date; onHide: () => void }) {
  const { dateKey, lines } = useTodaysAffirmations(currentDate)
  const rows = useAffirmationLogStore((s) => s.recitations)
  const lens = useAffirmationLogStore((s) => s.lens)
  const setLens = useAffirmationLogStore((s) => s.setLens)
  const recite = useAffirmationLogStore((s) => s.recite)
  const [open, setOpen] = useState(false)
  const faceKeys = useCopySetting<boolean>("keys", true)
  const showPips = useCopySetting<boolean>("pips", true)

  const said = useMemo(() => {
    const today = new Set(rows.filter((r) => r.date === dateKey).map((r) => r.key))
    return lines.map((l) => today.has(affirmationKey(l)))
  }, [rows, lines, dateKey])
  const saidCount = said.filter(Boolean).length
  const focusIndex = Math.max(0, said.indexOf(false))
  const focus = lines[focusIndex] ?? ""
  const shownLens = lensesFor(focus).includes(lens) ? lens : "original"
  const row = findBankRow(focus)
  const faceText = shownLens === "vivid" && row ? row.vivid.feel : lensText(focus, shownLens)
  const total = useMemo(() => rows.filter((r) => r.key === affirmationKey(focus)).length, [rows, focus])

  return (
    <>
      <div
        className="home-tile is-affirmation"
        data-widget="affirmation"
        data-testid="home-affirmation-tile"
        data-lens={shownLens}
      >
        <TileHide id="affirmation" onHide={onHide} />
        {faceKeys ? (
        <>
        <button
          type="button"
          className="home-affirm-key is-flip"
          aria-label="Flip the lens"
          title={`Next lens (${AFFIRMATION_LENS_LABEL[shownLens]})`}
          onClick={(event) => {
            event.stopPropagation()
            const at = AFFIRMATION_LENSES.indexOf(lens)
            setLens(AFFIRMATION_LENSES[(at + 1) % AFFIRMATION_LENSES.length]!)
          }}
        >
          ⇄
        </button>
        <button
          type="button"
          className="home-affirm-key is-said"
          aria-label="Log that I said it"
          title="Said it — log one recitation"
          onClick={(event) => {
            event.stopPropagation()
            if (focus) recite(focus, dateKey, "widget")
          }}
        >
          ✓
        </button>
        </>
        ) : null}
        <TileOpen label="Affirmation" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>Affirmation</CopyCaption> · {AFFIRMATION_LENS_CODE[shownLens]}
            </span>
          </div>
          <div className="home-crt home-affirmation-crt">
            <p key={`${shownLens}|${focus}`} className="home-affirmation-line home-affirm-roll" lang={AFFIRMATION_LENS_SPEECH[shownLens]}>
              {faceText}
            </p>
          </div>
          <div className="home-tile-foot home-affirm-foot">
            {showPips ? (
              <span className="home-affirm-pips" aria-hidden="true">
                {said.map((on, i) => (
                  <i key={i} className={on ? "is-on" : i === focusIndex ? "is-now" : ""} />
                ))}
              </span>
            ) : null}
            <p className="hab-score-sub">
              {saidCount} of {lines.length} said · ×{total}
            </p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Affirmations" className="home-affirm-dialog">
        <AffirmationDetail currentDate={currentDate} />
      </HomeWidgetDialog>
    </>
  )
}

type Mode = "card" | "library" | "log"

function AffirmationDetail({ currentDate }: { currentDate: Date }) {
  const { dateKey, lines, pool, fromRitual } = useTodaysAffirmations(currentDate)
  const rows = useAffirmationLogStore((s) => s.recitations)
  const [mode, setMode] = useState<Mode>("card")
  const [index, setIndex] = useState(0)
  /** A line opened from the Library that is not one of today's five. */
  const [picked, setPicked] = useState<string | null>(null)

  const todayKeys = useMemo(() => new Set(rows.filter((r) => r.date === dateKey).map((r) => r.key)), [rows, dateKey])
  const text = picked ?? lines[Math.min(index, lines.length - 1)] ?? ""

  return (
    <div className="home-affirm">
      <div className="home-vocab-modes home-affirm-modes" role="tablist" aria-label="Affirmation mode">
        {(["card", "library", "log"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? "home-vocab-mode is-on" : "home-vocab-mode"}
            onClick={() => setMode(m)}
          >
            {m === "card" ? "Today" : m === "library" ? "Library" : "Log"}
            {m === "log" ? <span className="home-vocab-mode-count">× {rows.length}</span> : null}
          </button>
        ))}
      </div>

      {mode === "card" ? (
        <>
          <div className="home-affirm-five" role="tablist" aria-label="Today's affirmations">
            {lines.map((line, i) => {
              const on = !picked && i === index
              return (
                <button
                  key={line}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  title={line}
                  className={`home-affirm-chip${on ? " is-on" : ""}${todayKeys.has(affirmationKey(line)) ? " is-said" : ""}`}
                  onClick={() => {
                    setPicked(null)
                    setIndex(i)
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
              )
            })}
            {picked ? <span className="home-affirm-chip is-on is-picked">LIB</span> : null}
            <span className="home-affirm-source">{picked ? "from the Library" : fromRitual ? "this morning's five" : "drawn for today"}</span>
          </div>
          {text ? (
            <AffirmationCard
              key={affirmationKey(text)}
              text={text}
              dateKey={dateKey}
              place={picked ? undefined : `${String(index + 1).padStart(2, "0")} / ${String(lines.length).padStart(2, "0")}`}
              onStep={(delta) => {
                if (picked || lines.length === 0) return
                setIndex((i) => (i + delta + lines.length) % lines.length)
              }}
            />
          ) : (
            <p className="home-widget-note">Add lines to your Lists → affirmations list.</p>
          )}
        </>
      ) : mode === "library" ? (
        <AffirmationLibrary
          pool={pool}
          rows={rows}
          onOpen={(line) => {
            const at = lines.findIndex((l) => affirmationKey(l) === affirmationKey(line))
            if (at >= 0) {
              setPicked(null)
              setIndex(at)
            } else setPicked(line)
            setMode("card")
          }}
        />
      ) : (
        <AffirmationLog rows={rows} currentDate={currentDate} />
      )}
    </div>
  )
}

function AffirmationCard({
  text,
  dateKey,
  place,
  onStep,
}: {
  text: string
  dateKey: string
  place?: string
  onStep: (delta: number) => void
}) {
  const rows = useAffirmationLogStore((s) => s.recitations)
  const storedLens = useAffirmationLogStore((s) => s.lens)
  const setLens = useAffirmationLogStore((s) => s.setLens)
  const recite = useAffirmationLogStore((s) => s.recite)
  const undoRecite = useAffirmationLogStore((s) => s.undoRecite)
  const [flash, setFlash] = useState(0)

  const lenses = lensesFor(text)
  const lens = lenses.includes(storedLens) ? storedLens : "original"
  const row = findBankRow(text)
  const stats = useMemo(() => recitationStats(rows, text, dateKey), [rows, text, dateKey])
  const byDay = useMemo(() => recitationsByDay(rows, text), [rows, text])
  const ledger = useMemo(() => {
    const [y, m, d] = dateKey.split("-").map(Number)
    const anchor = new Date(y!, m! - 1, d!)
    return Array.from({ length: 14 }, (_, i) => {
      const day = addCalendarDays(anchor, i - 13)
      const key = formatLocalDateKey(day)
      return { key, count: byDay.get(key) ?? 0, initial: day.toLocaleDateString(undefined, { weekday: "narrow" }) }
    })
  }, [byDay, dateKey])
  const peak = Math.max(1, ...ledger.map((d) => d.count))

  const flip = (delta: number) => {
    const at = lenses.indexOf(lens)
    setLens(lenses[(at + delta + lenses.length) % lenses.length]!)
  }
  const logOne = () => {
    recite(text, dateKey, "widget")
    setFlash((n) => n + 1)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "ArrowRight") flip(1)
      else if (event.key === "ArrowLeft") flip(-1)
      else if (event.key === "ArrowDown") onStep(1)
      else if (event.key === "ArrowUp") onStep(-1)
      else if (event.key === "Enter" && target?.tagName !== "BUTTON") logOne()
      else if (event.key.toLowerCase() === "s") speak(lensText(text, lens), lens)
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <>
      <section className="home-affirm-card" data-lens={lens} aria-live="polite">
        <header className="home-affirm-card-head">
          <span className="home-affirm-fig">
            {place ? `FIG. ${place}` : "FIG. LIB"}
            {row ? ` · No. ${row.n}` : ""}
          </span>
          <span className="home-affirm-fig is-lens">{AFFIRMATION_LENS_LABEL[lens]}</span>
        </header>

        <button type="button" className="home-affirm-flip is-prev" aria-label="Previous lens" onClick={() => flip(-1)} disabled={lenses.length < 2}>
          ‹
        </button>
        <div key={lens} className="home-affirm-face home-affirm-roll" lang={AFFIRMATION_LENS_SPEECH[lens]}>
          {lens === "vivid" && row ? (
            <ol className="home-affirm-vivid">
              <li><b>Feel</b>{row.vivid.feel}</li>
              <li><b>Senses</b>{row.vivid.senses}</li>
              <li><b>Sincerity</b>{row.vivid.sincerity}</li>
            </ol>
          ) : (
            <p className={lens === "higher" ? "home-affirm-text is-long" : "home-affirm-text"}>{lensText(text, lens)}</p>
          )}
          {lens !== "original" && lens !== "vivid" ? <p className="home-affirm-under" lang="en">{text}</p> : null}
          {lens === "eprime" && row?.eprimeSame ? <p className="home-affirm-badge">already E-Prime</p> : null}
        </div>
        <button type="button" className="home-affirm-flip is-next" aria-label="Next lens" onClick={() => flip(1)} disabled={lenses.length < 2}>
          ›
        </button>

        <footer className="home-affirm-card-foot">
          <span>{AFFIRMATION_LENS_NOTE[lens]}</span>
          <span className="home-affirm-keys-hint">← → lens · ↑ ↓ line · ⏎ said · S speak</span>
        </footer>
      </section>

      <div className="home-affirm-lenses" role="tablist" aria-label="Lens">
        {AFFIRMATION_LENSES.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={lens === option}
            disabled={!lenses.includes(option)}
            className={lens === option ? "home-affirm-lens is-on" : "home-affirm-lens"}
            onClick={() => setLens(option)}
            title={AFFIRMATION_LENS_LABEL[option]}
          >
            {AFFIRMATION_LENS_CODE[option]}
          </button>
        ))}
      </div>
      {!row ? <p className="home-widget-note">This line is not in the transformation bank, so only the Original lens shows.</p> : null}

      <section className="home-affirm-console" aria-label="Recitations">
        <div className="home-affirm-readouts">
          <Readout label="today" value={stats.today} flash={flash} />
          <Readout label="total" value={stats.total} />
          <Readout label="days" value={stats.days} />
          <Readout label="streak" value={stats.streak} />
        </div>
        <div className="home-affirm-ledger" aria-label="Last 14 days">
          {ledger.map((d) => (
            <span key={d.key} className={d.key === dateKey ? "is-today" : ""} title={`${shortDate(d.key)}: ${d.count}`}>
              <i style={{ height: `${d.count ? 18 + (d.count / peak) * 82 : 6}%` }} className={d.count ? "is-on" : ""} />
              <em>{d.initial}</em>
            </span>
          ))}
        </div>
        <p className="home-affirm-since">
          {stats.last
            ? `Last said ${shortDate(stats.last.date)} ${new Date(stats.last.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · first ${shortDate(stats.first!.date)}`
            : "Not said yet. Say it out loud, then log it."}
        </p>
      </section>

      <div className="home-widget-actions home-affirm-actions">
        <button type="button" className="home-review-key home-affirm-said" onClick={logOne}>
          ✓ Said it
        </button>
        <button type="button" className="home-review-key" onClick={() => speak(lensText(text, lens), lens)}>
          Say it
        </button>
        {stats.today > 0 ? (
          <button type="button" className="home-review-key" onClick={() => undoRecite(text, dateKey)}>
            Undo
          </button>
        ) : null}
      </div>
    </>
  )
}

function Readout({ label, value, flash }: { label: string; value: number; flash?: number }) {
  return (
    <div className="home-affirm-readout">
      <span key={flash} className={flash ? "home-affirm-num is-bump" : "home-affirm-num"}>
        {String(value).padStart(2, "0")}
      </span>
      <span className="home-affirm-label">{label}</span>
    </div>
  )
}

function AffirmationLibrary({
  pool,
  rows,
  onOpen,
}: {
  pool: string[]
  rows: Recitation[]
  onOpen: (line: string) => void
}) {
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<"list" | "all">("list")
  const counts = useMemo(() => {
    const out = new Map<string, number>()
    for (const r of rows) out.set(r.key, (out.get(r.key) ?? 0) + 1)
    return out
  }, [rows])
  const entries = useMemo(() => {
    const seen = new Set<string>()
    const out: { text: string; inList: boolean }[] = []
    for (const line of pool) {
      const key = affirmationKey(line)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ text: line, inList: true })
    }
    if (scope === "all") {
      for (const row of AFFIRMATION_BANK) {
        const key = affirmationKey(row.original)
        if (seen.has(key) || (findBankRow(row.original) !== row)) continue
        if (pool.some((l) => findBankRow(l) === row)) continue
        seen.add(key)
        out.push({ text: row.original, inList: false })
      }
    }
    const q = query.trim().toLowerCase()
    return q
      ? out.filter((e) => {
          const row = findBankRow(e.text)
          return [e.text, row?.fr, row?.it, row?.es, row?.eprime].some((t) => t?.toLowerCase().includes(q))
        })
      : out
  }, [pool, scope, query])

  const lists = useTaskStore((s) => s.lists)
  const addTask = useTaskStore((s) => s.addTask)
  const list = findAffirmationsCategory(lists)
  const missing = useMemo(
    () => AFFIRMATION_BANK.filter((row) => !pool.some((line) => findBankRow(line) === row)),
    [pool],
  )

  return (
    <div className="home-affirm-library">
      {list && missing.length > 0 ? (
        <button
          type="button"
          className="home-review-key home-affirm-addbank"
          title="Adds the bank's original lines to Lists → affirmations, so their translations and transformations show up in your daily five"
          onClick={() => {
            for (const row of missing) addTask(createListItem(row.original, [list.id]))
          }}
        >
          + Add {missing.length} bank lines to my list
        </button>
      ) : null}
      <div className="home-affirm-libbar">
        <input
          type="search"
          className="home-affirm-search"
          placeholder="Search any language…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search affirmations"
        />
        <div className="home-affirm-scope" role="radiogroup" aria-label="Which lines">
          <button type="button" role="radio" aria-checked={scope === "list"} className={scope === "list" ? "home-affirm-lens is-on" : "home-affirm-lens"} onClick={() => setScope("list")}>
            My list
          </button>
          <button type="button" role="radio" aria-checked={scope === "all"} className={scope === "all" ? "home-affirm-lens is-on" : "home-affirm-lens"} onClick={() => setScope("all")}>
            + Bank
          </button>
        </div>
      </div>
      <ul className="home-affirm-rows">
        {entries.map((e) => {
          const count = counts.get(affirmationKey(e.text)) ?? 0
          const row = findBankRow(e.text)
          return (
            <li key={e.text}>
              <button type="button" onClick={() => onOpen(e.text)} className={e.inList ? "" : "is-bank"}>
                <span className="home-affirm-row-n">{row ? String(row.n).padStart(2, "0") : "··"}</span>
                <span className="home-affirm-row-text">{e.text}</span>
                <span className={count ? "home-affirm-row-count is-on" : "home-affirm-row-count"}>×{count}</span>
              </button>
            </li>
          )
        })}
        {entries.length === 0 ? <li className="home-widget-note">Nothing matches.</li> : null}
      </ul>
    </div>
  )
}

function AffirmationLog({ rows, currentDate }: { rows: Recitation[]; currentDate: Date }) {
  const days = useMemo(() => {
    const byDate = new Map<string, Recitation[]>()
    for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r])
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 30)
  }, [rows])
  const todayKey = formatLocalDateKey(currentDate)

  if (days.length === 0) {
    return <p className="home-widget-note">No recitations yet. Tap ✓ Said it, tick a line in the morning ritual, or finish one in Speak them.</p>
  }
  return (
    <ol className="home-affirm-log">
      {days.map(([date, list]) => (
        <li key={date}>
          <p className="home-affirm-log-day">
            <span>{date === todayKey ? "Today" : shortDate(date)}</span>
            <span className="home-affirm-row-count is-on">×{list.length}</span>
          </p>
          <ul>
            {[...list].reverse().map((r) => (
              <li key={r.at + r.key}>
                <time>{new Date(r.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                <span className="home-affirm-row-text">{r.text}</span>
                <span className={`home-affirm-tag is-${r.source}`}>{SOURCE_LABEL[r.source]}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
