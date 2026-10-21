/**
 * lib/widgets/types.ts — Widget kinds and installed copies
 *
 * A **kind** is the app as the Widget gallery lists it (Points, Countdown,
 * Language study). An **installed copy** is one instance of a kind on the
 * Visual dashboard, with its own id, settings, size, and place. Every face,
 * detail, and gear reads one copy. Plan: `docs/WIDGETS_REDESIGN.md`.
 */

/** Built-in kinds use bare ids. A user-made kind will use `user:<slug>`. */
export type WidgetKindId = string

/** once = at most one copy. perKey = one copy per key (a language, a place). many = any number. */
export type WidgetInstallRule = "once" | "perKey" | "many"

/** Footprint in dash cells, columns × rows. */
export const WIDGET_SIZES = ["1x1", "2x1", "1x2", "2x2", "3x1", "3x2", "1x3"] as const
export type WidgetSize = (typeof WIDGET_SIZES)[number]

/** Milled keeps today's CSS footprint unless a size was picked in edit mode. */
export type MilledSize = WidgetSize | "auto"

/** Milled is today's look. Dash is the vintage car display. */
export type DashboardStyle = "milled" | "dash"

/** Where a copy reads its day: the dashboard default, the wall clock, or the day being viewed. */
export type WidgetDaySource = "dashboard" | "clock" | "viewed"

/** Lamp colors a copy can pick. The DSi lights rule allows no amber or orange, and keeps red for a fault. */
export const WIDGET_LAMPS = ["phosphor", "blue", "violet", "white"] as const
export type WidgetLamp = (typeof WIDGET_LAMPS)[number]

export type WidgetSettings = Record<string, string | number | boolean>

export type WidgetCopy = {
  id: string
  kind: WidgetKindId
  /** perKey kinds only: the value that stays unique, such as "fr". */
  key?: string
  /** Empty means the kind's own caption. */
  title: string
  hidden: boolean
  lamp: WidgetLamp
  daySource: WidgetDaySource
  /** Off hides the footer line, so the face is only its reading. */
  showFoot: boolean
  /** Kind-specific settings, shaped by the kind's `settings` fields. */
  settings: WidgetSettings
  /** The kind's settings version these settings were saved at. */
  settingsVersion: number
  /** True once the first-run guide was finished or skipped. */
  guideSeen: boolean
  installedAt: string
}

export type DashboardLayout = {
  /** Copy ids in reading order. */
  order: string[]
  sizes: Record<string, WidgetSize>
}

export type MilledLayout = {
  order: string[]
  sizes: Record<string, MilledSize>
}

type SettingBase = {
  key: string
  label: string
  /** One plain line on what changes on the face or in the detail. */
  help?: string
}

export type WidgetSettingField =
  | (SettingBase & {
      type: "choice"
      options: { value: string; label: string }[]
      default: string
    })
  | (SettingBase & { type: "toggle"; default: boolean })
  | (SettingBase & { type: "text"; default: string; maxLength: number; placeholder?: string })

export type WidgetGuideCard = { title: string; body: string }

export type WidgetGallery = {
  /** One paragraph: what the face and detail show. */
  what: string
  /** Where the numbers come from, in plain words. */
  how: string[]
  /** When it is worth installing. */
  useful: string
  /** A static sample face. */
  preview: { caption: string; crt: string; footer: string }
}

/**
 * A kind manifest. Plain data, so a built-in kind and a future user-made kind
 * register the same way (`registerWidgetKind`). React parts live in
 * `components/Home/widgets/registry.tsx`.
 */
export type WidgetKind = {
  id: WidgetKindId
  name: string
  /** Settings schema version. */
  version: number
  installs: WidgetInstallRule
  /** perKey only: what the key is called ("Language", "Place"). */
  keyLabel?: string
  /** Sizes the Dash face can draw. */
  sizes: WidgetSize[]
  defaultSize: WidgetSize
  /** Today's Milled footprint, for the gallery and the size picker. */
  milledSize: WidgetSize
  /** On for a fresh install. */
  startsShowing: boolean
  settings: WidgetSettingField[]
  gallery: WidgetGallery
  /** Optional first-run guide shown the first time a copy's detail opens. */
  guide?: WidgetGuideCard[]
  /** True when installing asks a few questions first (Setup). */
  hasSetup?: boolean
  /** Short group name in the gallery. */
  group: "Day" | "Score" | "Sky" | "Clock" | "Capture" | "Study" | "Money"
}
