/**
 * lib/plan-text.ts — Plan period keys on the shared append log
 *
 * Day / week / month Plan areas are append logs (`lib/append-log.ts`), not one
 * overwriteable blob. Each Submit plan stamps the writing time. Storage keys
 * `dayPlan-*`, `weekPlan-*`, `monthPlan-*` hold the versioned JSON envelope
 * (entries + optional unsubmitted `draft`). Writes go through `cogsStateStorage`
 * so Chrome posts the persist hub and Electron can hydrate missing keys.
 * An empty string on a plan key is a tombstone (not a value); it is skipped
 * so aliases and a later write can win. Hub / phone-hub merges **union entries
 * by id** so a desktop Sync that never saw a Telegram `plan for rn` cannot
 * drop that stamp. Legacy plaintext and older period-key spellings migrate on read. Target:
 * MongoDB `plans` collection.
 */
import { getISOWeek, getISOWeekYear, setISOWeek, startOfISOWeek } from "date-fns"
import { getWeekString, parseLocalDate } from "@/lib/date-utils"
import { cogsStateStorage } from "@/lib/persist-storage"
import { persistKeyAliases } from "@/lib/storage-keys"
import type { ReviewPeriod } from "@/lib/types"
import {
  type AppendLogEntry,
  type AppendLogViewMode,
  appendLogBodies,
  emitAppendLogChange,
  formatAppendEntry,
  formatAppendLog,
  formatAppendStamp,
  getAppendLogViewMode,
  makeAppendLogEntry,
  parseAppendLog,
  parseAppendLogDraft,
  serializeAppendLog,
  setAppendLogViewMode,
  sortAppendLogNewestFirst,
  subscribeAppendLog,
} from "@/lib/append-log"

export type PlanTextPeriod = Extract<ReviewPeriod, "day" | "week" | "month">
export type PlanTextViewMode = AppendLogViewMode
export type PlanEntry = AppendLogEntry

export const PLAN_TEXT_CHANGE_EVENT = "cogs-append-log-change"

const ISO_WEEK_RE = /^(\d{4})-W(\d{2})$/
const MONTH_KEY_RE = /^(\d{4})-(\d{1,2})$/
const WEEK_RANGE_RE = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/

export function dayPlanKey(dayKey: string): string {
  return `dayPlan-${dayKey}`
}

export function weekPlanKey(weekKey: string): string {
  return `weekPlan-${weekKey}`
}

export function monthPlanKey(monthKey: string): string {
  return `monthPlan-${monthKey}`
}

export function canonicalMonthPeriodKey(periodKey: string): string {
  const match = MONTH_KEY_RE.exec(periodKey.trim())
  if (!match) return periodKey
  return `${match[1]}-${match[2].padStart(2, "0")}`
}

function isoWeekToMonday(iso: string): Date | null {
  const match = ISO_WEEK_RE.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  if (week < 1 || week > 53) return null
  return startOfISOWeek(setISOWeek(new Date(year, 0, 4), week))
}

function isoWeekFromDate(date: Date): string {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`
}

function mondayFromWeekRange(periodKey: string): Date | null {
  const match = WEEK_RANGE_RE.exec(periodKey)
  if (!match) return null
  return parseLocalDate(match[1])
}

export function weekPeriodKeyAliases(periodKey: string): string[] {
  const keys = new Set<string>([periodKey])
  if (ISO_WEEK_RE.test(periodKey)) {
    const monday = isoWeekToMonday(periodKey)
    if (monday) keys.add(getWeekString(monday))
  }
  const monday = mondayFromWeekRange(periodKey)
  if (monday) {
    keys.add(getWeekString(monday))
    keys.add(isoWeekFromDate(monday))
  }
  return [...keys]
}

export function monthPeriodKeyAliases(periodKey: string): string[] {
  const padded = canonicalMonthPeriodKey(periodKey)
  const match = MONTH_KEY_RE.exec(padded)
  if (!match) return [periodKey]
  const unpadded = `${match[1]}-${Number(match[2])}`
  return [...new Set([padded, unpadded, periodKey])]
}

export function planPeriodKeyAliases(period: PlanTextPeriod, periodKey: string): string[] {
  switch (period) {
    case "month":
      return monthPeriodKeyAliases(periodKey)
    case "week":
      return weekPeriodKeyAliases(periodKey)
    case "day":
      return [...new Set([periodKey])]
  }
}

export function planStorageKey(period: PlanTextPeriod, periodKey: string): string {
  switch (period) {
    case "day":
      return dayPlanKey(periodKey)
    case "week":
      return weekPlanKey(periodKey)
    case "month":
      return monthPlanKey(canonicalMonthPeriodKey(periodKey))
  }
}

function writeStorageKey(period: PlanTextPeriod, periodKey: string): string {
  if (period === "month") return monthPlanKey(canonicalMonthPeriodKey(periodKey))
  return planStorageKey(period, periodKey)
}

function withPersistPrefixes(storageKey: string): string[] {
  return persistKeyAliases(storageKey)
}

function candidateStorageKeys(period: PlanTextPeriod, periodKey: string): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  const push = (storageKey: string) => {
    for (const name of withPersistPrefixes(storageKey)) {
      if (seen.has(name)) continue
      seen.add(name)
      keys.push(name)
    }
  }
  if (period === "month") {
    const padded = canonicalMonthPeriodKey(periodKey)
    push(monthPlanKey(padded))
    const match = MONTH_KEY_RE.exec(padded)
    if (match) push(monthPlanKey(`${match[1]}-${Number(match[2])}`))
    return keys
  }
  for (const alias of planPeriodKeyAliases(period, periodKey)) {
    push(period === "week" ? weekPlanKey(alias) : dayPlanKey(alias))
  }
  return keys
}

function readLocalRaw(storageKey: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw === "") {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        /* ignore */
      }
      return null
    }
    return raw
  } catch {
    return null
  }
}

function persist() {
  return cogsStateStorage()
}

function writeRecord(storageKey: string, entries: PlanEntry[], draft: string): void {
  if (typeof window === "undefined") return
  const trimmedDraft = draft
  if (entries.length === 0 && !trimmedDraft) {
    persist().removeItem(storageKey)
  } else {
    const payload = serializeAppendLog(entries, trimmedDraft)
    persist().setItem(storageKey, payload)
  }
  emitAppendLogChange()
}

function rawForPeriod(period: PlanTextPeriod, periodKey: string): { storageKey: string; raw: string | null } {
  const preferred = writeStorageKey(period, periodKey)
  const preferredRaw = readLocalRaw(preferred)
  if (preferredRaw != null && preferredRaw !== "") return { storageKey: preferred, raw: preferredRaw }

  for (const storageKey of candidateStorageKeys(period, periodKey)) {
    const raw = readLocalRaw(storageKey)
    if (raw == null || raw === "") continue
    if (storageKey !== preferred) {
      try {
        persist().setItem(preferred, serializeAppendLog(parseAppendLog(raw), parseAppendLogDraft(raw)))
      } catch {
        /* keep reading the alias even if the copy fails */
      }
    }
    return { storageKey: preferred, raw }
  }
  return { storageKey: preferred, raw: null }
}

export function getPlanEntries(period: ReviewPeriod, periodKey: string): PlanEntry[] {
  if (period !== "day" && period !== "week" && period !== "month") return []
  if (typeof window === "undefined") return []
  return parseAppendLog(rawForPeriod(period, periodKey).raw)
}

export function getPlanDraft(period: ReviewPeriod, periodKey: string): string {
  if (period !== "day" && period !== "week" && period !== "month") return ""
  if (typeof window === "undefined") return ""
  return parseAppendLogDraft(rawForPeriod(period, periodKey).raw)
}

export function savePlanDraft(period: PlanTextPeriod, periodKey: string, draft: string): void {
  if (typeof window === "undefined") return
  const { storageKey, raw } = rawForPeriod(period, periodKey)
  if (parseAppendLogDraft(raw) === draft) return
  writeRecord(storageKey, parseAppendLog(raw), draft)
}

export const sortPlanEntriesNewestFirst = sortAppendLogNewestFirst
export const formatPlanStamp = formatAppendStamp
export const formatPlanEntry = formatAppendEntry
export const formatPlanLog = formatAppendLog

export function getPlanBodies(period: ReviewPeriod, periodKey: string): string | null {
  return appendLogBodies(getPlanEntries(period, periodKey))
}

export function getStoredPlanText(period: ReviewPeriod, periodKey: string): string | null {
  const entries = getPlanEntries(period, periodKey)
  if (entries.length === 0) return null
  return formatAppendLog(entries, "all")
}

export function appendPlanEntry(
  period: PlanTextPeriod,
  periodKey: string,
  text: string,
  createdAt: Date = new Date(),
  opts?: { stampSuffix?: string },
): PlanEntry | null {
  if (typeof window === "undefined") return null
  const entry = makeAppendLogEntry(text, createdAt, opts)
  if (!entry) return null
  const { storageKey, raw } = rawForPeriod(period, periodKey)
  writeRecord(storageKey, [...parseAppendLog(raw), entry], "")
  return entry
}

export function saveStoredPlanText(period: PlanTextPeriod, periodKey: string, text: string): void {
  appendPlanEntry(period, periodKey, text)
}

/** Electron: pull this period from the persist hub if the profile key is still empty. */
export async function hydratePlanText(period: PlanTextPeriod, periodKey: string): Promise<void> {
  if (typeof window === "undefined") return
  const storage = persist()
  for (const storageKey of candidateStorageKeys(period, periodKey)) {
    await Promise.resolve(storage.getItem(storageKey))
  }
  rawForPeriod(period, periodKey)
  emitAppendLogChange()
}

export const subscribePlanText = subscribeAppendLog
export const getPlanTextViewMode = getAppendLogViewMode
export const setPlanTextViewMode = setAppendLogViewMode
