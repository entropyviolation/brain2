/**
 * components/Home/dash/dash-faces.tsx — One Dash face per widget kind
 *
 * A face is a gauge: one reading, one engraved legend, an optional lamp, and
 * at most one secondary line from `2x1` up. It reads the same stores and lib
 * helpers as the Milled tile, so the two styles always agree on the number.
 * A face never opens a dialog and has no keys: the cell around it is the
 * button, and the detail is today's tile dialog.
 *
 * Every setting a face reads is listed in `components/Home/dash/README.md`.
 * The keys come from `lib/widgets/kinds.ts`; copy-level title, lamp, and
 * showFoot come on `copy`.
 */
"use client"

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react"
import { format } from "date-fns"
import { short as budgetShort } from "@/components/Home/home-budget-tile"
import { budgetRows, monthTotals } from "@/lib/budget-math"
import { useBudgetStore } from "@/lib/budget-store"
import { formatSpendAmount } from "@/lib/spend"
import { useHomeDayStats, type HomeDayCount } from "@/components/Home/home-day-stats"
import { useHomePeriodStats } from "@/components/Home/home-period-stats"
import { useTodoPrefs } from "@/components/Home/ToDo/todo-prefs"
import { plannedMinutesForDay } from "@/components/Home/Plan/plan-capacity"
import {
  ArcGauge,
  BarMeter,
  DashLamp,
  DashMoon,
  DashPet,
  DashPicto,
  DashReading,
  DashSelector,
  DashTrace,
  DashWord,
  StairMeter,
  type DashPictoName,
} from "@/components/Home/dash/dash-primitives"
import { registerDashFaces, type DashFaceProps } from "@/components/Home/widgets/dash-face-registry"
import type { WidgetSize } from "@/lib/widgets/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { awardFace, latestPointAward } from "@/lib/habit-points"
import {
  affirmationLinesForHome,
  dayLampWord,
  petPose,
  pickHomeNext,
  weatherIconKindFromCode,
} from "@/lib/home-widgets"
import {
  alreadyFlowingFace,
  flowingCounts,
  harvestFace,
  inboxMillFace,
  livedPaintMinutes,
  nightWellFace,
  pickHomeNight,
  planAndLivedFace,
} from "@/lib/home-glances"
import { useHomeDaysUntilStore, type HomeDaysUntilItem } from "@/lib/home-days-until-store"
import { countdownFace } from "@/lib/countdown"
import { useHomeWeatherStore } from "@/lib/home-weather-store"
import { resolveWeatherCity, weatherRainCopy } from "@/lib/home-weather"
import { fetchHomeDayWeather, type HomeDayWeather } from "@/lib/weather-client"
import { moonGlance, moonLitPath } from "@/lib/lunar"
import { pointsTicker, formatTickerChange, type TickerPeriod } from "@/lib/points-ticker"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useStarLordStore } from "@/lib/star-lord-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { countAvailableRituals, listAvailableRituals } from "@/lib/rituals"
import { listAvailableStarLordSlots } from "@/lib/star-lord"
import { useSleepStore } from "@/lib/sleep-store"
import { previousDateKey, sleepMinutes } from "@/lib/sleep-log"
import { clockMinutesOnDay, formatRemainSpan, solarRemainderFace } from "@/lib/solar-remainder"
import { SAN_DIEGO_COORDS, computeDaySun } from "@/lib/sun-times"
import { sunPlaceForCity, useSunTimesStore } from "@/lib/sun-times-store"
import { revisitInboxTasks, openTodosOnDay } from "@/lib/item-slices"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { PRESENCE_SCOPE_LABEL, livePresenceHints, trackingPresenceSnapshot } from "@/lib/tracking-presence"
import { minutesPastMidnight } from "@/lib/ingest/times"
import { useAffirmationLogStore } from "@/lib/affirmation-log-store"
import { affirmationKey, dailyAffirmationSet, lensText, lensesFor } from "@/lib/affirmation-lenses"
import { useVocabStore, vocabShuffleCount } from "@/lib/vocab-store"
import {
  VOCAB_LANG_CODE,
  VOCAB_LANG_ENDONYM,
  VOCAB_LEVEL_LABEL,
  isVocabLang,
  pickVocabWord,
  resolveVocabLevel,
  type VocabLang,
  type VocabLevel,
} from "@/lib/vocab-words"
import { isThousandLang, isVocabKnown, thousandListId } from "@/lib/vocab-lists"
import { cn } from "@/lib/utils"

/* ---- Contract ----------------------------------------------------------- */

function pick<T extends string>(settings: DashFaceProps["settings"] | undefined, key: string, allowed: readonly T[], fallback: T): T {
  const raw = settings?.[key]
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
}

function flag(settings: DashFaceProps["settings"] | undefined, key: string, fallback: boolean): boolean {
  const raw = settings?.[key]
  return typeof raw === "boolean" ? raw : fallback
}

function text(settings: DashFaceProps["settings"] | undefined, key: string): string {
  const raw = settings?.[key]
  return typeof raw === "string" ? raw.trim() : ""
}

function useNow(everyMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs])
  return now
}

function ratio(count: Pick<HomeDayCount, "completed" | "total">): number {
  return count.total > 0 ? count.completed / count.total : 0
}

function joinCounts(a: HomeDayCount, b: HomeDayCount): HomeDayCount {
  const total = a.total + b.total
  const completed = a.completed + b.completed
  return { total, completed, remaining: total - completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 }
}

/* ---- Shell -------------------------------------------------------------- */

/**
 * The pod every face sits in: engraved legend on top with the lamp and a
 * pictogram, the reading in the middle, one foot line under it.
 */
function DashFace({
  props,
  legend,
  picto,
  lit = true,
  foot,
  aside,
  children,
  className,
}: {
  props: DashFaceProps
  legend: string
  picto?: DashPictoName
  /** Lamp on: there is something to read. Off: quiet. */
  lit?: boolean
  foot?: ReactNode
  /** Small indicators at the right end of the legend row. */
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  const { copy, size } = props
  const title = copy.title?.trim() || legend
  const showFoot = foot != null && foot !== "" && copy.showFoot !== false && size !== "1x1"
  return (
    <div
      className={cn("dash-face", className)}
      data-kind={copy.kind}
      data-size={size}
      data-lamp={copy.lamp || "phosphor"}
      data-lit={lit ? "on" : "off"}
    >
      <p className="dash-legend">
        <DashLamp on={lit} />
        {picto ? <DashPicto name={picto} /> : null}
        <span>{title}</span>
        {aside ? <span className="dash-aside">{aside}</span> : null}
      </p>
      <div className="dash-body">{children}</div>
      {showFoot ? <p className="dash-foot">{foot}</p> : null}
    </div>
  )
}

const wide = (size: WidgetSize) => size[0] !== "1"
const tall = (size: WidgetSize) => size[2] !== "1"

/* ---- Today's Progress --------------------------------------------------- */

function ProgressFace(props: DashFaceProps) {
  const { currentDate, size, settings } = props
  const today = useHomeDayStats(currentDate)
  const week = useHomePeriodStats("week", currentDate)
  const month = useHomePeriodStats("month", currentDate)
  const periods = pick(settings, "periods", ["today", "week", "all"] as const, "all")
  const rows: { key: string; label: string; todo: HomeDayCount; habit: HomeDayCount }[] = [
    { key: "D", label: "Day", todo: today.todo, habit: today.habit },
  ]
  if (periods !== "today") rows.push({ key: "W", label: "Week", todo: week.todo, habit: week.habit })
  if (periods === "all") rows.push({ key: "M", label: "Month", todo: month.todo, habit: month.habit })
  const day = joinCounts(today.todo, today.habit)
  const foot = rows.map((row) => `${row.key} ${joinCounts(row.todo, row.habit).completed}/${joinCounts(row.todo, row.habit).total}`).join(" · ")

  if (size === "1x1") {
    return (
      <DashFace props={props} legend="Today" picto="progress" lit={day.total > 0}>
        <DashReading text={`${day.percent}%`} />
      </DashFace>
    )
  }
  if (size === "2x2") {
    return (
      <DashFace props={props} legend="Today's progress" picto="progress" lit={day.total > 0} foot={foot}>
        <div className="dash-pair">
          <ArcGauge value={ratio(today.todo)} lo="0" hi="TO DO">
            <DashReading text={`${today.todo.completed}/${today.todo.total}`} />
          </ArcGauge>
          <ArcGauge value={ratio(today.habit)} lo="0" hi="HAB">
            <DashReading text={`${today.habit.completed}/${today.habit.total}`} />
          </ArcGauge>
        </div>
        {rows.length > 1 ? (
          <div className="dash-rows">
            {rows.slice(1).map((row) => (
              <p key={row.key} className="dash-row">
                <b>{row.key}</b>
                <BarMeter value={ratio(joinCounts(row.todo, row.habit))} segments={14} label={row.label} />
              </p>
            ))}
          </div>
        ) : null}
      </DashFace>
    )
  }
  // 2x1 and 3x1: one bar per line. Today alone splits into To do and Habits.
  const lines =
    rows.length === 1
      ? [
          { key: "TD", value: ratio(today.todo), stat: `${today.todo.completed}/${today.todo.total}` },
          { key: "HB", value: ratio(today.habit), stat: `${today.habit.completed}/${today.habit.total}` },
        ]
      : rows.map((row) => {
          const both = joinCounts(row.todo, row.habit)
          return { key: row.key, value: ratio(both), stat: `${both.completed}/${both.total}` }
        })
  return (
    <DashFace props={props} legend="Today's progress" picto="progress" lit={day.total > 0} foot={size === "3x1" ? foot : undefined}>
      <div className="dash-rows">
        {lines.map((line) => (
          <p key={line.key} className="dash-row">
            <b>{line.key}</b>
            <BarMeter value={line.value} segments={size === "3x1" ? 18 : 10} />
            <DashReading text={line.stat} />
          </p>
        ))}
      </div>
    </DashFace>
  )
}

/* ---- Rituals ------------------------------------------------------------ */

function RitualsFace(props: DashFaceProps) {
  const { currentDate } = props
  const reviews = useReviewsStore((s) => s.reviews)
  const starReports = useStarLordStore((s) => s.reports)
  const birthday = useUserSettingsStore((s) => s.birthday)
  const available = useMemo(() => listAvailableRituals(reviews, currentDate), [reviews, currentDate])
  const starDue = useMemo(
    () => listAvailableStarLordSlots(starReports, currentDate, birthday),
    [starReports, currentDate, birthday],
  )
  const count = useMemo(
    () => countAvailableRituals(reviews, currentDate) + starDue.length,
    [reviews, currentDate, starDue.length],
  )
  const period = available[0]?.periodTitle ?? starDue[0]?.title ?? "None due"
  return (
    <DashFace props={props} legend="Rituals" picto="rituals" lit={count > 0} foot={period}>
      <DashReading text={String(count)} />
    </DashFace>
  )
}

/* ---- Points ------------------------------------------------------------- */

const PERIOD_KEY: Record<TickerPeriod, string> = { day: "D", week: "W", month: "M", all: "A" }

function PointsFace(props: DashFaceProps) {
  const { currentDate, size, settings } = props
  const history = usePointsStore((s) => s.pointsHistory)
  const period = pick(settings, "period", ["day", "week", "month", "all"] as const, "day")
  const chart = flag(settings, "chart", true)
  const keys = flag(settings, "keys", true)
  const ticker = useMemo(() => pointsTicker(history, period, currentDate), [history, period, currentDate])
  const arrow = ticker.direction === "up" ? "▲" : ticker.direction === "down" ? "▼" : "•"
  const change = `${arrow} ${formatTickerChange(ticker)}`
  return (
    <DashFace props={props} legend="Points" picto="points" lit={ticker.value > 0} foot={change}>
      <div className="dash-points">
        {keys && size !== "1x1" ? <DashSelector options={["D", "W", "M", "A"]} active={PERIOD_KEY[period]} /> : null}
        <DashReading text={String(Math.round(ticker.value))} className="dash-points-value" />
        {size === "1x1" ? <span className="dash-unit">{PERIOD_KEY[period]}</span> : null}
      </div>
      {chart && (size === "2x2" || size === "3x1") ? <DashTrace values={ticker.series} previous={ticker.previous} /> : null}
    </DashFace>
  )
}

/* ---- Latest award ------------------------------------------------------- */

function AwardFace(props: DashFaceProps) {
  const history = usePointsStore((s) => s.pointsHistory)
  const face = awardFace(latestPointAward(history))
  return (
    <DashFace props={props} legend="Latest" picto="award" lit={face.crt !== "—"} foot={face.footer}>
      <DashReading text={face.crt} />
    </DashFace>
  )
}

/* ---- Screen pet --------------------------------------------------------- */

const POSE_WORD = { asleep: "asleep", idle: "awake", pleased: "pleased" } as const

function PetFace(props: DashFaceProps) {
  const { currentDate, size, settings } = props
  const stats = useHomeDayStats(currentDate)
  const clock = useNow(30_000)
  const pose = petPose(stats.habit.percent, stats.habit.total, clock.getHours())
  const night = clock.getHours() < 6 || clock.getHours() >= 22
  const caption = pick(settings, "caption", ["clock", "name", "mood"] as const, "clock")
  const name = text(settings, "name")
  const readout =
    caption === "clock" ? (
      <DashReading text={format(clock, "h:mm")} className="dash-pet-clock" />
    ) : (
      <DashWord>{caption === "name" ? name || "Pet" : POSE_WORD[pose]}</DashWord>
    )
  return (
    <DashFace
      props={props}
      legend={caption === "name" && name ? name : "Pet"}
      picto="pet"
      lit={pose !== "asleep"}
      foot={caption === "mood" ? undefined : POSE_WORD[pose]}
      className={cn(size === "1x1" && "is-tight")}
    >
      <div className={cn("dash-pet-plate", tall(props.size) && "is-stacked")}>
        <DashPet pose={pose} night={night} />
        {size === "1x1" ? null : readout}
      </div>
    </DashFace>
  )
}

/* ---- Moon --------------------------------------------------------------- */

function MoonFace(props: DashFaceProps) {
  const { currentDate, size, settings } = props
  const now = useNow(60_000)
  const when = useMemo(() => {
    const sameDay = formatLocalDateKey(now) === formatLocalDateKey(currentDate)
    return sameDay ? now : new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 12)
  }, [now, currentDate])
  const face = useMemo(() => moonGlance(when), [when])
  const readout = pick(settings, "readout", ["phase", "countdown", "light"] as const, "phase")
  const sprite = flag(settings, "sprite", true)
  const reading =
    readout === "countdown" ? (
      <span className="dash-moon-count">
        <DashReading text={`${face.untilDays}d`} />
        <span className="dash-unit">{face.untilKind === "full" ? "FULL" : "NEW"}</span>
      </span>
    ) : readout === "light" ? (
      <DashReading text={`${Math.round(face.illumination * 100)}%`} />
    ) : (
      <DashWord className="dash-moon-name">{face.label}</DashWord>
    )
  return (
    <DashFace props={props} legend="Moon" picto="moon" foot={readout === "countdown" ? face.label : face.untilPhrase}>
      <div className={cn("dash-moon-plate", (tall(size) || size === "1x1") && "is-stacked")}>
        {sprite ? <DashMoon litPath={moonLitPath(face.cycle)} /> : null}
        {reading}
        {size === "1x3" ? (
          <p className="dash-moon-next">
            <span>{face.nextMajor.label}</span>
            <BarMeter value={face.illumination} segments={8} label="Illuminated" />
          </p>
        ) : null}
      </div>
    </DashFace>
  )
}

/* ---- Countdown (was Days Until) ---------------------------------------- */

/** Printed beside the digits for the whole-unit formats. */
const COUNT_UNIT: Partial<Record<HomeDaysUntilItem["format"], string>> = {
  days: "DAYS",
  weeks: "WK",
  sleeps: "SLEEPS",
  workdays: "WORK",
}

function CountdownFace(props: DashFaceProps) {
  const { settings, size } = props
  const markId = text(settings, "markId")
  const item = useHomeDaysUntilStore((s) => s.items.find((entry) => entry.id === markId))
  const now = useNow(15_000)
  if (!item) {
    return (
      <DashFace props={props} legend="Countdown" picto="flag" lit={false} foot="Set a date">
        <DashReading text="—" />
      </DashFace>
    )
  }
  const face = countdownFace(item, now)
  const counting = face.caption === "Count up" ? "SINCE" : "UNTIL"
  const unit = COUNT_UNIT[item.format]
  return (
    <DashFace
      props={props}
      legend={item.label || "Countdown"}
      picto="flag"
      lit={Boolean(face.date) && !face.hidden && !(face.passed && face.caption === "Countdown")}
      foot={face.footer}
      className={cn(face.milestone && "is-milestone")}
    >
      <div className="dash-count">
        {size !== "1x1" && face.date ? <DashSelector options={["UNTIL", "SINCE"]} active={counting} className="is-column" /> : null}
        <DashReading text={face.crt} />
        {unit && face.date ? <span className="dash-unit">{unit}</span> : null}
      </div>
      {face.progress != null && size !== "1x1" ? <BarMeter value={face.progress} segments={16} label="Of the span" /> : null}
    </DashFace>
  )
}

/* ---- Language study (was Vocab) ---------------------------------------- */

/* Word levels short enough for a 1x1 glass. */
const LEVEL_SHORT: Record<VocabLevel, string> = {
  common: "Common",
  everyday: "Everyday",
  sat: "SAT",
  advanced: "Advanced",
  rare: "Rare",
}

function LanguageFace(props: DashFaceProps) {
  const { copy, currentDate, settings, size } = props
  const active = useVocabStore((s) => s.active)
  const levels = useVocabStore((s) => s.levels)
  const shuffles = useVocabStore((s) => s.shuffles)
  const tasks = useTaskStore((s) => s.tasks)
  const lang: VocabLang = isVocabLang(copy.key) ? copy.key : active
  const role = pick(settings, "role", ["studied", "native"] as const, lang === "en" ? "native" : "studied")
  const cefr = text(settings, "cefr")
  const faceMode = pick(settings, "face", ["word", "level"] as const, size === "1x1" ? "level" : "word")
  const dateKey = formatLocalDateKey(currentDate)
  const level = resolveVocabLevel(lang, levels[lang])
  const count = vocabShuffleCount(shuffles, lang, dateKey)
  const entry = useMemo(() => pickVocabWord(lang, level, dateKey, count)?.entry, [lang, level, dateKey, count])
  const known = useMemo(() => {
    if (!isThousandLang(lang)) return null
    const listId = thousandListId(lang)
    const words = tasks.filter((task) => task.lists?.includes(listId))
    if (words.length === 0) return null
    return { known: words.filter(isVocabKnown).length, total: words.length }
  }, [tasks, lang])
  const levelText = role === "native" ? (size === "1x1" ? LEVEL_SHORT[level] : VOCAB_LEVEL_LABEL[level]) : cefr || "—"
  const legend = `${VOCAB_LANG_CODE[lang] ?? lang} · ${VOCAB_LANG_ENDONYM[lang] ?? lang}`
  const reading = entry ? [entry.reading, entry.romanization].filter(Boolean).join(" · ") : ""

  if (faceMode === "level") {
    return (
      <DashFace props={props} legend={legend} picto="language" foot={known ? `${known.known}/${known.total} known` : undefined}>
        <div className="dash-level">
          <DashWord className="dash-level-word">{levelText}</DashWord>
          {known ? <StairMeter value={known.known / known.total} steps={5} /> : null}
        </div>
      </DashFace>
    )
  }
  return (
    <DashFace props={props} legend={legend} picto="language" lit={Boolean(entry)} foot={entry?.definition}>
      <div className="dash-vocab" lang={lang}>
        <DashWord className="dash-vocab-word" title={entry?.word}>
          {entry?.word ?? "—"}
        </DashWord>
        {reading ? <span className="dash-vocab-reading">{reading}</span> : null}
        {size === "2x2" ? (
          <span className="dash-vocab-level">
            <b>{levelText}</b>
            {known ? <BarMeter value={known.known / known.total} segments={12} label="Known words" /> : null}
          </span>
        ) : null}
      </div>
    </DashFace>
  )
}

/* ---- Affirmation -------------------------------------------------------- */

function AffirmationFace(props: DashFaceProps) {
  const { currentDate, settings } = props
  const lists = useTaskStore((s) => s.lists)
  const tasks = useTaskStore((s) => s.tasks)
  const dateKey = formatLocalDateKey(currentDate)
  const morning = useReviewsStore((s) => s.reviews.find((r) => r.period === "day" && r.periodKey === dateKey)?.morning)
  const rows = useAffirmationLogStore((s) => s.recitations)
  const lens = useAffirmationLogStore((s) => s.lens)
  const pips = flag(settings, "pips", true)
  const lines = useMemo(() => {
    const pool = affirmationLinesForHome(lists, tasks)
    const chosen = (morning?.affirmations?.length ? morning.affirmations : morning?.shownAffirmations ?? []).filter((l) => l.trim())
    return chosen.length ? chosen : dailyAffirmationSet(pool, dateKey)
  }, [lists, tasks, morning, dateKey])
  const said = useMemo(() => {
    const today = new Set(rows.filter((r) => r.date === dateKey).map((r) => r.key))
    return lines.map((l) => today.has(affirmationKey(l)))
  }, [rows, lines, dateKey])
  const focus = lines[Math.max(0, said.indexOf(false))] ?? ""
  const shown = lensesFor(focus).includes(lens) ? lens : "original"
  const saidCount = said.filter(Boolean).length
  return (
    <DashFace
      props={props}
      legend="Affirmation"
      picto="affirmation"
      lit={saidCount < lines.length}
      foot={`${saidCount}/${lines.length} said today`}
      aside={
        pips ? (
          <span className="dash-pips" aria-label={`${saidCount} of ${lines.length} said`}>
            {said.map((on, i) => (
              <DashLamp key={i} on={on} />
            ))}
          </span>
        ) : null
      }
    >
      <DashWord className="dash-affirm-line" title={focus}>
        {focus ? lensText(focus, shown) : "—"}
      </DashWord>
    </DashFace>
  )
}

/* ---- Weather ------------------------------------------------------------ */

function toUnits(f: number, units: "f" | "c"): number {
  return units === "c" ? Math.round(((f - 32) * 5) / 9) : Math.round(f)
}

function WeatherFace(props: DashFaceProps) {
  const { currentDate, size, settings, copy } = props
  const settingsCity = useUserSettingsStore((s) => s.homeCity)
  const pinned = useHomeWeatherStore((s) => s)
  const units = pick(settings, "units", ["f", "c"] as const, "f")
  const foot = pick(settings, "foot", ["glance", "range", "rain"] as const, "glance")
  const place = text(settings, "place") || (copy.key ?? "")
  const city = place || resolveWeatherCity(pinned, settingsCity)
  const coords = !place && pinned.lat != null && pinned.lng != null ? { lat: pinned.lat, lng: pinned.lng, name: pinned.cityName || city } : null
  const dateKey = formatLocalDateKey(currentDate)
  const [wx, setWx] = useState<HomeDayWeather | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading")
  useEffect(() => {
    let alive = true
    setStatus("loading")
    fetchHomeDayWeather(city, dateKey, coords)
      .then((next) => {
        if (!alive) return
        setWx(next)
        setStatus(next ? "ready" : "empty")
      })
      .catch(() => {
        if (alive) setStatus("empty")
      })
    return () => {
      alive = false
    }
    // coords is rebuilt each render; its parts are the identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, dateKey, coords?.lat, coords?.lng])
  const icon = wx ? weatherIconKindFromCode(wx.weatherCode) : "cloud"
  const label = (wx?.cityName ?? city).split(",")[0] || "Weather"
  const deg = units === "c" ? "°C" : "°F"
  const footText = !wx
    ? status === "loading"
      ? "Looking up…"
      : "No reading"
    : foot === "range"
      ? `L ${toUnits(wx.lowF, units)}° · H ${toUnits(wx.highF, units)}°`
      : foot === "rain"
        ? weatherRainCopy(wx.precipChance)
        : wx.condition
  const span = wx ? Math.max(1, wx.highF - wx.lowF) : 1
  return (
    <DashFace props={props} legend={label} picto={icon} lit={Boolean(wx)} foot={footText}>
      {wx ? (
        size === "2x2" ? (
          <ArcGauge value={(wx.tempF - wx.lowF) / span} lo={`${toUnits(wx.lowF, units)}`} hi={`${toUnits(wx.highF, units)}`} segments={14}>
            <DashReading text={`${toUnits(wx.tempF, units)}${deg}`} />
          </ArcGauge>
        ) : (
          <div className="dash-weather">
            <DashReading text={`${toUnits(wx.tempF, units)}${deg}`} />
            {size !== "1x1" ? (
              <span className="dash-weather-range">
                <b>L</b>
                <BarMeter value={(wx.tempF - wx.lowF) / span} segments={8} label="Between today's low and high" />
                <b>H</b>
              </span>
            ) : null}
          </div>
        )
      ) : (
        <DashReading text={status === "loading" ? "---" : "—"} />
      )}
    </DashFace>
  )
}

/* ---- Next --------------------------------------------------------------- */

const NEXT_LEGEND = { both: "Next", events: "Next event", todos: "Next to-do" } as const

function NextFace(props: DashFaceProps) {
  const { currentDate, settings, size } = props
  const events = useEventStore((s) => s.events)
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const sources = pick(settings, "sources", ["both", "events", "todos"] as const, "both")
  const hit = useMemo(() => {
    const todos =
      sources === "events"
        ? []
        : openTodosOnDay(tasks, currentDate).map((task) => {
            const list = lists.find((item) => item.id === task.lists?.[0])
            return { title: itemTitleOrUntitled(task), footer: list?.name || "To Do" }
          })
    return pickHomeNext({ now: currentDate, clock: new Date(), events: sources === "todos" ? [] : events, todos })
  }, [events, tasks, lists, currentDate, sources])
  const time = hit?.tab === "plan" ? hit.footer.match(/\d{1,2}:\d{2}/)?.[0] : undefined
  return (
    <DashFace props={props} legend={NEXT_LEGEND[sources]} picto="next" lit={Boolean(hit)} foot={hit?.footer ?? "Nothing next"}>
      {size === "1x1" ? (
        time ? <DashReading text={time} /> : <DashWord>{hit ? (hit.tab === "plan" ? "Event" : "To do") : "—"}</DashWord>
      ) : (
        <div className="dash-next">
          {time ? <DashReading text={time} className="dash-next-time" /> : null}
          <DashWord className="dash-next-title" title={hit?.title}>
            {hit?.title ?? "—"}
          </DashWord>
        </div>
      )}
    </DashFace>
  )
}

/* ---- Day lamp ----------------------------------------------------------- */

const LAMP_WORDS = ["Quiet", "Dim", "Warm", "Bright", "Full"] as const

function DayLampFace(props: DashFaceProps) {
  const { currentDate, settings, size } = props
  const stats = useHomeDayStats(currentDate)
  const bars = pick(settings, "bars", ["both", "habits", "todos"] as const, "both")
  const word = dayLampWord({
    habitPercent: stats.habit.percent,
    habitTotal: bars === "todos" ? 0 : stats.habit.total,
    todoPercent: stats.todo.percent,
    todoTotal: bars === "habits" ? 0 : stats.todo.total,
  })
  const level = LAMP_WORDS.indexOf(word)
  const bits: string[] = []
  if (bars !== "todos" && stats.habit.total > 0) bits.push(`habits ${stats.habit.completed}/${stats.habit.total}`)
  if (bars !== "habits" && stats.todo.total > 0) bits.push(`to do ${stats.todo.completed}/${stats.todo.total}`)
  return (
    <DashFace props={props} legend="Day lamp" picto="lamp" lit={level > 0} foot={bits.join(" · ") || "Nothing scheduled"}>
      <div className={cn("dash-daylamp", size === "1x1" && "is-stacked")} data-level={level}>
        <span className="dash-daylamp-cells" aria-hidden="true">
          {LAMP_WORDS.slice(1).map((name, i) => (
            <i key={name} className={i < level ? "is-on" : undefined} />
          ))}
        </span>
        <DashWord>{word}</DashWord>
      </div>
    </DashFace>
  )
}

/* ---- Harvest leftover --------------------------------------------------- */

function HarvestFace(props: DashFaceProps) {
  const { currentDate, settings, size } = props
  const tasks = useTaskStore((s) => s.tasks)
  const getDayPoints = usePointsStore((s) => s.getDayPoints)
  const getPossibleDayPoints = usePointsStore((s) => s.getPossibleDayPoints)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const earned = mounted ? getDayPoints(currentDate) : 0
  const possible = mounted ? getPossibleDayPoints(currentDate, tasks) : 0
  const face = harvestFace(earned, possible)
  const readout = pick(settings, "readout", ["points", "percent"] as const, "points")
  const whole = Math.max(0, earned) + Math.max(0, possible)
  const paidShare = whole > 0 ? Math.max(0, earned) / whole : 0
  const value = readout === "percent" ? (whole > 0 ? `${Math.round((1 - paidShare) * 100)}%` : "—") : face.crt
  return (
    <DashFace props={props} legend="Left" picto="harvest" lit={possible > 0} foot={face.footer}>
      <div className="dash-harvest">
        <DashReading text={value} />
        {size !== "1x1" ? <StairMeter value={paidShare} steps={6} /> : null}
      </div>
    </DashFace>
  )
}

/* ---- Inbox mill --------------------------------------------------------- */

function InboxFace(props: DashFaceProps) {
  const { settings } = props
  const inbox = useTaskStore((s) => revisitInboxTasks(s.tasks))
  const footPick = pick(settings, "foot", ["newest", "oldest"] as const, "newest")
  const titles = inbox.map((task) => itemTitleOrUntitled(task))
  const face = inboxMillFace(footPick === "oldest" ? [...titles].reverse() : titles)
  return (
    <DashFace props={props} legend="Inbox" picto="inbox" lit={titles.length > 0} foot={face.footer}>
      <DashReading text={face.crt} />
    </DashFace>
  )
}

/* ---- Budget ------------------------------------------------------------- */

function BudgetFace(props: DashFaceProps) {
  const { currentDate } = props
  const entries = useTimeTrackingStore((s) => s.entries)
  const lines = useBudgetStore((s) => s.lines)
  const monthKey = formatLocalDateKey(currentDate).slice(0, 7)
  const face = useMemo(() => monthTotals(budgetRows(entries, lines), monthKey), [entries, lines, monthKey])
  const foot =
    face.aheadAll !== 0
      ? `maybe ${budgetShort(face.aheadAll)}`
      : `earned ${formatSpendAmount(face.earned)} · spent ${formatSpendAmount(face.spent)}`
  return (
    <DashFace props={props} legend="Budget" picto="budget" lit={face.net !== 0} foot={foot}>
      <DashReading text={budgetShort(face.net)} />
    </DashFace>
  )
}

/* ---- Night well --------------------------------------------------------- */

function NightFace(props: DashFaceProps) {
  const { currentDate, settings } = props
  const nights = useSleepStore((s) => s.nights)
  const settingsCity = useUserSettingsStore((s) => s.homeCity)
  const lat = useHomeWeatherStore((s) => s.lat)
  const lng = useHomeWeatherStore((s) => s.lng)
  const places = useSunTimesStore((s) => s.places)
  const night = pickHomeNight(nights, currentDate)
  const pin = lat != null && lng != null ? { lat, lng } : sunPlaceForCity(settingsCity, places) ?? SAN_DIEGO_COORDS
  const sunset = night ? computeDaySun(previousDateKey(night.date), pin.lat, pin.lng)?.sunsetMinutes : undefined
  const face = nightWellFace(night, sunset)
  const formatPick = pick(settings, "format", ["hm", "decimal"] as const, "hm")
  const minutes = sleepMinutes(night)
  const value = formatPick === "decimal" && minutes != null ? `${(minutes / 60).toFixed(1)}h` : face.crt
  return (
    <DashFace props={props} legend="Night" picto="night" lit={minutes != null} foot={face.footer}>
      {night?.allNighter ? <DashWord>All-nighter</DashWord> : <DashReading text={value} />}
    </DashFace>
  )
}

/* ---- Already flowing ---------------------------------------------------- */

const FLOW_WORDS = ["Quiet", "Flowing", "Mixed", "Pushed"] as const

function FlowFace(props: DashFaceProps) {
  const { currentDate, settings, size } = props
  const tasks = useTaskStore((s) => s.tasks)
  const stats = useHomeDayStats(currentDate)
  const counts = useMemo(() => flowingCounts(tasks, currentDate, stats.habit.completed), [tasks, currentDate, stats.habit.completed])
  const face = alreadyFlowingFace(counts.flowing, counts.pushed)
  const readout = pick(settings, "readout", ["word", "counts"] as const, "word")
  return (
    <DashFace props={props} legend="Flowing" picto="flow" lit={face.word !== "Quiet"} foot={face.footer}>
      {readout === "counts" ? (
        <DashReading text={`${counts.flowing}-${counts.pushed}`} />
      ) : size === "1x1" ? (
        <DashWord>{face.word}</DashWord>
      ) : (
        <DashSelector options={FLOW_WORDS} active={face.word} className={cn(size === "2x2" && "is-column")} />
      )}
    </DashFace>
  )
}

/* ---- Plan and lived ----------------------------------------------------- */

const PAINT_WORDS = ["Short", "Close", "Over"] as const

function PaintFace(props: DashFaceProps) {
  const { currentDate, settings, size } = props
  const tasks = useTaskStore((s) => s.tasks)
  const events = useEventStore((s) => s.events)
  const actions = usePlannedActionStore((s) => s.actions)
  const { defaultEstimateMin } = useTodoPrefs()
  const entries = useTimeTrackingStore((s) => s.entries)
  const face = useMemo(() => {
    const planned = plannedMinutesForDay(currentDate, tasks, events, actions, defaultEstimateMin)
    const lived = livedPaintMinutes(entries, formatLocalDateKey(currentDate))
    return { ...planAndLivedFace(planned, lived), planned, lived }
  }, [currentDate, tasks, events, actions, entries, defaultEstimateMin])
  const readout = pick(settings, "readout", ["word", "plan", "lived"] as const, "word")
  const hm = (m: number) => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, "0")}`
  const scale = Math.max(face.planned, face.lived, 1)
  return (
    <DashFace props={props} legend="Lived" picto="paint" lit={face.word !== "Open"} foot={face.footer}>
      {readout === "plan" || readout === "lived" ? (
        <DashReading text={hm(readout === "plan" ? face.planned : face.lived)} />
      ) : size === "1x1" || !(PAINT_WORDS as readonly string[]).includes(face.word) ? (
        <DashWord>{face.word}</DashWord>
      ) : (
        <DashSelector options={PAINT_WORDS} active={face.word} />
      )}
      {size === "2x2" ? (
        <div className="dash-rows">
          <p className="dash-row">
            <b>PL</b>
            <BarMeter value={face.planned / scale} segments={14} label="Planned" />
          </p>
          <p className="dash-row">
            <b>LV</b>
            <BarMeter value={face.lived / scale} segments={14} label="Lived" />
          </p>
        </div>
      ) : null}
    </DashFace>
  )
}

/* ---- Tracking now ------------------------------------------------------- */

function TrackingFace(props: DashFaceProps) {
  const { settings, size } = props
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const workSession = useWorkSessionStore((s) => s.session)
  const penSession = usePenColorSessionStore((s) => s.session)
  const now = useNow(60_000)
  const lanePick = pick(settings, "lane", ["activity", "location", "mood", "company"] as const, "activity")
  const live = livePresenceHints({
    workSession: workSession ? { title: workSession.title, scopeId: workSession.scopeId } : null,
    penSession: penSession ? { title: penSession.title, scopeId: penSession.scopeId } : null,
  })
  const snap = trackingPresenceSnapshot({ date: formatLocalDateKey(now), min: minutesPastMidnight(now), entries, scopes, live })
  const lane = snap.lanes.find((l) => l.scopeId === lanePick) ?? (lanePick === "activity" ? snap.activity : undefined)
  const others = snap.lanes
    .filter((l) => l.scopeId !== lanePick && l.kind !== "empty")
    .map((l) => l.name)
    .slice(0, 2)
    .join(" · ")
  const name = lane && lane.kind !== "empty" ? lane.name : "—"
  return (
    <DashFace props={props} legend={`${PRESENCE_SCOPE_LABEL[lanePick]} · ${snap.caption || "Now"}`} picto="tracking" lit={name !== "—"} foot={others || undefined}>
      <DashWord className={cn("dash-tracking", size === "1x1" && "is-small")} title={name}>
        {name}
      </DashWord>
    </DashFace>
  )
}

/* ---- Solar remainder ---------------------------------------------------- */

function SolarFace(props: DashFaceProps) {
  const { settings, size } = props
  const settingsCity = useUserSettingsStore((s) => s.homeCity)
  const lat = useHomeWeatherStore((s) => s.lat)
  const lng = useHomeWeatherStore((s) => s.lng)
  const places = useSunTimesStore((s) => s.places)
  const now = useNow(15_000)
  const place = text(settings, "place")
  const target = pick(settings, "target", ["auto", "sunset", "sunrise"] as const, "auto")
  const pin = useMemo(() => {
    if (place) {
      const named = sunPlaceForCity(place, places)
      if (named) return named
    }
    if (lat != null && lng != null) return { lat, lng }
    return sunPlaceForCity(settingsCity, places) ?? SAN_DIEGO_COORDS
  }, [place, lat, lng, settingsCity, places])
  const dateKey = formatLocalDateKey(now)
  const sun = useMemo(() => computeDaySun(dateKey, pin.lat, pin.lng), [dateKey, pin.lat, pin.lng])
  const nowMin = clockMinutesOnDay(now)
  let reading: string
  let foot: string
  let picto: DashPictoName = "sun"
  if (!sun) {
    reading = "—"
    foot = "No sun clock"
  } else if (target === "auto") {
    const face = solarRemainderFace(nowMin, sun)
    reading = face.crt
    foot = face.footer
    if (face.phase === "after-sunset" || face.phase === "until-sunrise" || face.phase === "sunset") picto = "sunset"
  } else {
    const at = target === "sunset" ? sun.sunsetMinutes : sun.sunriseMinutes
    const until = (((Math.round(at) - Math.floor(nowMin)) % 1440) + 1440) % 1440
    reading = formatRemainSpan(until)
    foot = `to ${target} · ${target === "sunset" ? sun.sunsetLabel : sun.sunriseLabel}`
    picto = target === "sunset" ? "sunset" : "sun"
  }
  const dayShare = sun ? (nowMin - sun.sunriseMinutes) / Math.max(1, sun.sunsetMinutes - sun.sunriseMinutes) : 0
  const daylight = dayShare >= 0 && dayShare <= 1
  return (
    <DashFace props={props} legend="Sun" picto={picto} lit={daylight} foot={foot}>
      {size === "1x1" ? (
        <DashReading text={reading.replace(/\s+/g, "")} />
      ) : (
        <ArcGauge value={daylight ? dayShare : dayShare < 0 ? 0 : 1} marker lo="R" hi="S" segments={13} from={-90} to={90}>
          <DashReading text={reading.replace(/\s+/g, "")} />
        </ArcGauge>
      )}
    </DashFace>
  )
}

/* ---- Registry ----------------------------------------------------------- */

export const DASH_FACES: Record<string, ComponentType<DashFaceProps>> = {
  progress: ProgressFace,
  review: RitualsFace,
  points: PointsFace,
  award: AwardFace,
  pet: PetFace,
  moon: MoonFace,
  daysuntil: CountdownFace,
  vocab: LanguageFace,
  affirmation: AffirmationFace,
  weather: WeatherFace,
  next: NextFace,
  daylamp: DayLampFace,
  harvest: HarvestFace,
  inbox: InboxFace,
  night: NightFace,
  flow: FlowFace,
  paint: PaintFace,
  tracking: TrackingFace,
  solar: SolarFace,
  budget: BudgetFace,
}

registerDashFaces(DASH_FACES)
