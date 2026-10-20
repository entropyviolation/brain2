/**
 * lib/widgets/dashboard.ts — Installed copies and their layouts (pure)
 *
 * The Visual dashboard is a list of installed copies plus one layout per
 * style. Milled is today's look and keeps today's footprints unless a size
 * was picked in edit mode; Dash is the vintage car display with small cells.
 * Switching style never deletes the other style's layout.
 *
 * `dashboardFromLegacy` builds the first dashboard from the stores that
 * already exist: each id in the old `brain2-home-widgets` order becomes one
 * copy, each Days Until mark becomes one Countdown copy, and each Vocab
 * language becomes one Language study copy. Nothing old is deleted.
 * `legacyViewOf` folds the copies back into the old order / hidden pair for
 * the dual-write. The store is `dashboard-store.ts`.
 */

import {
  BUILT_IN_KIND_IDS,
  defaultWidgetSettings,
  isKnownWidgetKind,
  sanitizeWidgetSettings,
  snapWidgetSize,
  widgetKind,
} from "@/lib/widgets/kinds"
import {
  WIDGET_LAMPS,
  WIDGET_SIZES,
  type DashboardLayout,
  type DashboardStyle,
  type MilledLayout,
  type MilledSize,
  type WidgetCopy,
  type WidgetDaySource,
  type WidgetKindId,
  type WidgetLamp,
  type WidgetSettings,
  type WidgetSize,
} from "@/lib/widgets/types"
import { cefrFromVocabLevel, type LanguageRole } from "@/lib/widgets/language-levels"

export type DashboardData = {
  copies: WidgetCopy[]
  /** Copies whose kind this build does not know. Kept verbatim, never dropped. */
  unknown: Record<string, unknown>[]
  style: DashboardStyle
  dash: DashboardLayout
  milled: MilledLayout
  /** The old order / hidden pair as first read, for Reset to my old layout. */
  legacy: { order: string[]; hidden: string[] } | null
}

export const EMPTY_DASHBOARD: DashboardData = {
  copies: [],
  unknown: [],
  style: "dash",
  dash: { order: [], sizes: {} },
  milled: { order: [], sizes: {} },
  legacy: null,
}

export function newCopyId(kind: WidgetKindId): string {
  return `${kind}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function makeCopy(
  kind: WidgetKindId,
  patch: Partial<Omit<WidgetCopy, "kind">> = {},
): WidgetCopy {
  const def = widgetKind(kind)
  return {
    id: patch.id ?? newCopyId(kind),
    kind,
    ...(patch.key != null ? { key: patch.key } : {}),
    title: patch.title ?? "",
    hidden: patch.hidden ?? false,
    lamp: patch.lamp ?? "phosphor",
    daySource: patch.daySource ?? "dashboard",
    showFoot: patch.showFoot ?? true,
    settings: sanitizeWidgetSettings(kind, { ...defaultWidgetSettings(kind), ...(patch.settings ?? {}) }),
    settingsVersion: def?.version ?? 1,
    guideSeen: patch.guideSeen ?? false,
    installedAt: patch.installedAt ?? new Date().toISOString(),
  }
}

const DAY_SOURCES: WidgetDaySource[] = ["dashboard", "clock", "viewed"]

/** Clean one saved copy. Unknown kinds return null so the caller can keep them raw. */
export function sanitizeCopy(raw: unknown): WidgetCopy | null {
  if (!raw || typeof raw !== "object") return null
  const value = raw as Record<string, unknown>
  if (!isKnownWidgetKind(value.kind)) return null
  const id = typeof value.id === "string" && value.id.trim() ? value.id.slice(0, 96) : null
  if (!id) return null
  const kind = value.kind
  return {
    id,
    kind,
    ...(typeof value.key === "string" && value.key ? { key: value.key.slice(0, 64) } : {}),
    title: typeof value.title === "string" ? value.title.replace(/[\r\n\t]/g, " ").slice(0, 40) : "",
    hidden: value.hidden === true,
    lamp: (WIDGET_LAMPS as readonly string[]).includes(value.lamp as string) ? (value.lamp as WidgetLamp) : "phosphor",
    daySource: DAY_SOURCES.includes(value.daySource as WidgetDaySource) ? (value.daySource as WidgetDaySource) : "dashboard",
    showFoot: value.showFoot !== false,
    settings: sanitizeWidgetSettings(kind, value.settings),
    settingsVersion: typeof value.settingsVersion === "number" ? value.settingsVersion : 1,
    guideSeen: value.guideSeen === true,
    installedAt: typeof value.installedAt === "string" ? value.installedAt : "",
  }
}

function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === "string" && (WIDGET_SIZES as readonly string[]).includes(value)
}

function sanitizeOrder(raw: unknown, ids: Set<string>): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id !== "string" || !ids.has(id) || seen.has(id)) continue
      seen.add(id)
      next.push(id)
    }
  }
  for (const id of ids) {
    if (!seen.has(id)) next.push(id)
  }
  return next
}

export function sanitizeDashboard(raw: unknown): DashboardData {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const copies: WidgetCopy[] = []
  const unknown: Record<string, unknown>[] = []
  const seen = new Set<string>()
  const keepUnknown = (entry: unknown) => {
    if (!entry || typeof entry !== "object") return
    const id = (entry as { id?: unknown }).id
    if (typeof id !== "string" || seen.has(id)) return
    seen.add(id)
    unknown.push(entry as Record<string, unknown>)
  }
  if (Array.isArray(value.copies)) {
    for (const entry of value.copies) {
      const copy = sanitizeCopy(entry)
      if (copy && !seen.has(copy.id)) {
        seen.add(copy.id)
        copies.push(copy)
      } else if (!copy) {
        keepUnknown(entry)
      }
    }
  }
  if (Array.isArray(value.unknown)) {
    for (const entry of value.unknown) {
      // A newer build's kind may be known now: promote it.
      const copy = sanitizeCopy(entry)
      if (copy && !seen.has(copy.id)) {
        seen.add(copy.id)
        copies.push(copy)
      } else if (!copy) {
        keepUnknown(entry)
      }
    }
  }
  const ids = new Set(seen)
  const dashRaw = (value.dash ?? {}) as Partial<DashboardLayout>
  const milledRaw = (value.milled ?? {}) as Partial<MilledLayout>
  const dashSizes: Record<string, WidgetSize> = {}
  const milledSizes: Record<string, MilledSize> = {}
  const kindOf = new Map(copies.map((copy) => [copy.id, copy.kind]))
  if (dashRaw.sizes && typeof dashRaw.sizes === "object") {
    for (const [id, size] of Object.entries(dashRaw.sizes)) {
      if (!ids.has(id) || !isWidgetSize(size)) continue
      const kind = kindOf.get(id)
      dashSizes[id] = kind ? snapWidgetSize(kind, size) : size
    }
  }
  if (milledRaw.sizes && typeof milledRaw.sizes === "object") {
    for (const [id, size] of Object.entries(milledRaw.sizes)) {
      if (ids.has(id) && isWidgetSize(size)) milledSizes[id] = size
    }
  }
  const legacyRaw = value.legacy as { order?: unknown; hidden?: unknown } | null | undefined
  const legacy =
    legacyRaw && Array.isArray(legacyRaw.order)
      ? {
          order: legacyRaw.order.filter((id): id is string => typeof id === "string"),
          hidden: Array.isArray(legacyRaw.hidden) ? legacyRaw.hidden.filter((id): id is string => typeof id === "string") : [],
        }
      : null
  return {
    copies,
    unknown,
    style: value.style === "milled" ? "milled" : "dash",
    dash: { order: sanitizeOrder(dashRaw.order, ids), sizes: dashSizes },
    milled: { order: sanitizeOrder(milledRaw.order, ids), sizes: milledSizes },
    legacy,
  }
}

/** Dash size for a copy: the saved one, else the kind's default. */
export function dashSizeOf(data: Pick<DashboardData, "dash">, copy: WidgetCopy): WidgetSize {
  return data.dash.sizes[copy.id] ?? snapWidgetSize(copy.kind, widgetKind(copy.kind)?.defaultSize)
}

export function milledSizeOf(data: Pick<DashboardData, "milled">, copy: WidgetCopy): MilledSize {
  return data.milled.sizes[copy.id] ?? "auto"
}

/** Copies in the active style's order, hidden ones included. */
export function orderedCopies(data: DashboardData, style: DashboardStyle = data.style): WidgetCopy[] {
  const byId = new Map(data.copies.map((copy) => [copy.id, copy]))
  const order = style === "milled" ? data.milled.order : data.dash.order
  return order.map((id) => byId.get(id)).filter((copy): copy is WidgetCopy => copy != null)
}

export function visibleCopies(data: DashboardData, style: DashboardStyle = data.style): WidgetCopy[] {
  return orderedCopies(data, style).filter((copy) => !copy.hidden)
}

/** Unknown-kind copies that still hold a place on the active layout. */
export function unknownOnLayout(data: DashboardData, style: DashboardStyle = data.style): Record<string, unknown>[] {
  const order = style === "milled" ? data.milled.order : data.dash.order
  const byId = new Map(data.unknown.map((entry) => [entry.id as string, entry]))
  return order.map((id) => byId.get(id)).filter((entry): entry is Record<string, unknown> => entry != null && entry.hidden !== true)
}

// ---------------------------------------------------------------------------
// Migration from the old strip
// ---------------------------------------------------------------------------

export type LegacyDashboardInput = {
  /** `brain2-home-widgets` order after its own v10 migration. */
  order: string[]
  hidden: string[]
  /** Days Until mark ids, in strip order. */
  countdownIds: string[]
  vocab: { languages: string[]; active: string; levels: Record<string, string | undefined> }
  /** `brain2-home-points-period`, when one was saved. */
  pointsPeriod?: string | null
  /** True when the vault already had a saved strip: it lands on Milled. */
  hadSavedLayout: boolean
  now?: string
}

/** Fixed copy ids for copies that came from the old strip, so a rebuild lands on the same ids. */
export function legacyCopyId(kind: string, key?: string): string {
  return key ? `${kind}:${key}` : kind
}

export function languageRoleFor(lang: string): LanguageRole {
  return lang === "en" ? "native" : "studied"
}

export function dashboardFromLegacy(input: LegacyDashboardInput): DashboardData {
  const hidden = new Set(input.hidden)
  const copies: WidgetCopy[] = []
  const unknown: Record<string, unknown>[] = []
  const order: string[] = []
  const installedAt = input.now ?? new Date().toISOString()
  const seenKinds = new Set<string>()

  const push = (copy: WidgetCopy) => {
    copies.push(copy)
    order.push(copy.id)
  }

  const walk = [...input.order]
  for (const id of BUILT_IN_KIND_IDS) {
    if (!walk.includes(id)) walk.push(id)
  }

  for (const id of walk) {
    if (seenKinds.has(id)) continue
    seenKinds.add(id)
    if (!isKnownWidgetKind(id)) {
      const raw = { id: legacyCopyId(id), kind: id, hidden: hidden.has(id), installedAt }
      unknown.push(raw)
      order.push(raw.id)
      continue
    }
    const familyHidden = hidden.has(id) || !input.order.includes(id)
    if (id === "daysuntil") {
      const marks = input.countdownIds.length > 0 ? input.countdownIds : []
      for (const markId of marks) {
        push(
          makeCopy("daysuntil", {
            id: legacyCopyId("daysuntil", markId),
            hidden: familyHidden,
            settings: { markId },
            guideSeen: true,
            installedAt,
          }),
        )
      }
      continue
    }
    if (id === "vocab") {
      const languages = input.vocab.languages.length > 0 ? input.vocab.languages : ["en"]
      const active = languages.includes(input.vocab.active) ? input.vocab.active : languages[0]!
      for (const lang of languages) {
        const role = languageRoleFor(lang)
        push(
          makeCopy("vocab", {
            id: legacyCopyId("vocab", lang),
            key: lang,
            hidden: familyHidden || lang !== active,
            settings: {
              lang,
              role,
              cefr: role === "studied" ? cefrFromVocabLevel(input.vocab.levels[lang]) : "",
            },
            guideSeen: true,
            installedAt,
          }),
        )
      }
      continue
    }
    const settings: WidgetSettings = {}
    if (id === "points" && input.pointsPeriod) settings.period = input.pointsPeriod
    const kind = widgetKind(id)!
    push(
      makeCopy(id, {
        id: legacyCopyId(id),
        ...(kind.installs === "perKey" ? { key: "" } : {}),
        hidden: familyHidden,
        settings,
        guideSeen: true,
        installedAt,
      }),
    )
  }

  return {
    copies,
    unknown,
    style: input.hadSavedLayout ? "milled" : "dash",
    dash: { order: [...order], sizes: {} },
    milled: { order: [...order], sizes: {} },
    legacy: { order: [...input.order], hidden: [...input.hidden] },
  }
}

// ---------------------------------------------------------------------------
// The old order / hidden pair, for the dual-write and for old tests
// ---------------------------------------------------------------------------

/** Fold copies into the old strip: kinds in first-seen Milled order; a kind is hidden when every copy is. */
export function legacyViewOf(data: DashboardData): { order: string[]; hidden: string[] } {
  const order: string[] = []
  const showing = new Set<string>()
  for (const copy of orderedCopies(data, "milled")) {
    if (!order.includes(copy.kind)) order.push(copy.kind)
    if (!copy.hidden) showing.add(copy.kind)
  }
  for (const id of BUILT_IN_KIND_IDS) {
    if (!order.includes(id)) order.push(id)
  }
  return { order, hidden: order.filter((id) => !showing.has(id)) }
}

/**
 * Apply an old order / hidden pair written by something else (an older build,
 * an old backup, an old caller). Show or hide whole kinds, and when the kind
 * order moved, regroup both layouts by it. Copies are never removed.
 */
export function applyLegacyView(data: DashboardData, legacy: { order: string[]; hidden: string[] }): DashboardData {
  const current = legacyViewOf(data)
  const wantHidden = new Set(legacy.hidden)
  let copies = data.copies
  for (const kind of new Set(data.copies.map((copy) => copy.kind))) {
    const nowHidden = current.hidden.includes(kind)
    if (wantHidden.has(kind) && !nowHidden) {
      copies = copies.map((copy) => (copy.kind === kind ? { ...copy, hidden: true } : copy))
    } else if (!wantHidden.has(kind) && nowHidden && legacy.order.includes(kind)) {
      // Show the copy that sat first, the way the old strip showed one family.
      const first = orderedCopies({ ...data, copies }, "milled").find((copy) => copy.kind === kind)
      const showAll = kind === "daysuntil"
      copies = copies.map((copy) =>
        copy.kind === kind && (showAll || copy.id === first?.id) ? { ...copy, hidden: false } : copy,
      )
    }
  }
  let next: DashboardData = { ...data, copies }
  const sameOrder =
    current.order.filter((id) => legacy.order.includes(id)).join("|") ===
    legacy.order.filter((id) => current.order.includes(id)).join("|")
  if (!sameOrder) {
    const rank = (id: string) => {
      const kind = data.copies.find((copy) => copy.id === id)?.kind ?? id
      const at = legacy.order.indexOf(kind)
      return at < 0 ? legacy.order.length : at
    }
    const regroup = (order: string[]) =>
      order
        .map((id, index) => ({ id, index }))
        .sort((a, b) => rank(a.id) - rank(b.id) || a.index - b.index)
        .map((entry) => entry.id)
    next = {
      ...next,
      milled: { ...next.milled, order: regroup(next.milled.order) },
      dash: { ...next.dash, order: regroup(next.dash.order) },
    }
  }
  return next
}

// ---------------------------------------------------------------------------
// Layout edits
// ---------------------------------------------------------------------------

export function moveInOrder(order: string[], id: string, toIndex: number): string[] {
  const from = order.indexOf(id)
  if (from < 0) return order
  const next = order.filter((item) => item !== id)
  const at = Math.max(0, Math.min(next.length, toIndex))
  next.splice(at, 0, id)
  return next
}

/** Move a copy one step among the copies that are showing, keeping hidden ones where they sit. */
export function stepInOrder(order: string[], id: string, direction: -1 | 1, showing: Set<string>): string[] {
  const visible = order.filter((item) => showing.has(item))
  const at = visible.indexOf(id)
  const target = visible[at + direction]
  if (at < 0 || !target) return order
  const targetIndex = order.indexOf(target)
  const next = order.filter((item) => item !== id)
  const insertAt = direction > 0 ? next.indexOf(target) + 1 : next.indexOf(target)
  next.splice(insertAt < 0 ? targetIndex : insertAt, 0, id)
  return next
}

/** Can this kind take another copy, and if not, which copy already holds the place? */
export function installBlocker(data: DashboardData, kind: WidgetKindId, key?: string): WidgetCopy | null {
  const def = widgetKind(kind)
  if (!def) return null
  const mine = data.copies.filter((copy) => copy.kind === kind)
  if (def.installs === "once") return mine[0] ?? null
  if (def.installs === "perKey") return mine.find((copy) => (copy.key ?? "") === (key ?? "")) ?? null
  return null
}

/** Add a copy to the end of both layouts. */
export function withCopy(data: DashboardData, copy: WidgetCopy, after?: string): DashboardData {
  const place = (order: string[]) => {
    const next = order.filter((id) => id !== copy.id)
    const at = after ? next.indexOf(after) : -1
    if (at >= 0) next.splice(at + 1, 0, copy.id)
    else next.push(copy.id)
    return next
  }
  return {
    ...data,
    copies: [...data.copies.filter((entry) => entry.id !== copy.id), copy],
    dash: { ...data.dash, order: place(data.dash.order) },
    milled: { ...data.milled, order: place(data.milled.order) },
  }
}

export function withoutCopy(data: DashboardData, id: string): DashboardData {
  const dashSizes = { ...data.dash.sizes }
  const milledSizes = { ...data.milled.sizes }
  delete dashSizes[id]
  delete milledSizes[id]
  return {
    ...data,
    copies: data.copies.filter((copy) => copy.id !== id),
    unknown: data.unknown.filter((entry) => entry.id !== id),
    dash: { order: data.dash.order.filter((item) => item !== id), sizes: dashSizes },
    milled: { order: data.milled.order.filter((item) => item !== id), sizes: milledSizes },
  }
}

/**
 * Keep Countdown copies and Days Until marks one to one. A mark with no copy
 * gets one (showing, after the last Countdown). A copy whose mark is gone is
 * removed.
 */
export function reconcileCountdowns(data: DashboardData, markIds: string[]): DashboardData {
  const marks = new Set(markIds)
  let next = data
  for (const copy of data.copies) {
    if (copy.kind !== "daysuntil") continue
    const markId = copy.settings.markId
    if (typeof markId !== "string" || !marks.has(markId)) next = withoutCopy(next, copy.id)
  }
  const held = new Set(next.copies.filter((copy) => copy.kind === "daysuntil").map((copy) => copy.settings.markId))
  for (const markId of markIds) {
    if (held.has(markId)) continue
    const last = orderedCopies(next, "milled").filter((copy) => copy.kind === "daysuntil").pop()
    next = withCopy(
      next,
      makeCopy("daysuntil", { id: legacyCopyId("daysuntil", markId), settings: { markId }, hidden: last?.hidden ?? false }),
      last?.id,
    )
  }
  return next
}

/** Each Vocab language without a Language study copy gets a hidden one, so nothing is lost. */
export function reconcileLanguages(data: DashboardData, languages: string[]): DashboardData {
  let next = data
  const held = new Set(data.copies.filter((copy) => copy.kind === "vocab").map((copy) => copy.key ?? ""))
  for (const lang of languages) {
    if (held.has(lang)) continue
    const last = orderedCopies(next, "milled").filter((copy) => copy.kind === "vocab").pop()
    const role = languageRoleFor(lang)
    next = withCopy(
      next,
      makeCopy("vocab", {
        id: legacyCopyId("vocab", lang),
        key: lang,
        hidden: true,
        settings: { lang, role, cefr: role === "studied" ? "A1" : "" },
      }),
      last?.id,
    )
  }
  return next
}

/** Display name for a copy: its title, else the kind name plus its key. */
export function copyDisplayName(copy: WidgetCopy, keyName?: (key: string) => string): string {
  if (copy.title.trim()) return copy.title.trim()
  const kind = widgetKind(copy.kind)
  const base = kind?.name ?? copy.kind
  if (copy.key) return `${base} · ${keyName ? keyName(copy.key) : copy.key}`
  return base
}
