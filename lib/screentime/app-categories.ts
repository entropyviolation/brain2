/**
 * lib/screentime/app-categories.ts — App names onto Screen Time category pens
 *
 * Brain2 is the meaning layer. ActivityWatch says which process was focused;
 * this table says what that process *is*. Never a window watcher: titles and
 * URLs are not read here. Domain helpers are for optional web-watcher child
 * pens under a browser app, not for painting Activity / Location / Mood.
 */

export const SCREENTIME_CATEGORY_IDS = {
  work: "st-cat-work",
  communication: "st-cat-communication",
  browsing: "st-cat-browsing",
  media: "st-cat-media",
  system: "st-cat-system",
  other: "st-cat-other",
} as const

export type ScreenTimeCategoryId = (typeof SCREENTIME_CATEGORY_IDS)[keyof typeof SCREENTIME_CATEGORY_IDS]

export const SCREENTIME_CATEGORY_NAMES: Record<ScreenTimeCategoryId, string> = {
  "st-cat-work": "Work",
  "st-cat-communication": "Communication",
  "st-cat-browsing": "Browsing",
  "st-cat-media": "Media",
  "st-cat-system": "System",
  "st-cat-other": "Other",
}

interface CategoryNeedle {
  needle: string
  id: ScreenTimeCategoryId
}

/** Longest needles first so "Visual Studio" wins over a later short token. */
const CATEGORY_NEEDLES: CategoryNeedle[] = (
  [
    { needle: "github desktop", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "visual studio", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "cursor", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "xcode", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "terminal", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "iterm", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "warp", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "notion", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "obsidian", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "figma", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "linear", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "intellij", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "pycharm", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "sublime", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "emacs", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "pages", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "numbers", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "vim", id: SCREENTIME_CATEGORY_IDS.work },
    { needle: "code", id: SCREENTIME_CATEGORY_IDS.work },

    { needle: "facetime", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "telegram", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "whatsapp", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "messages", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "discord", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "signal", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "teams", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "skype", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "slack", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "zoom", id: SCREENTIME_CATEGORY_IDS.communication },
    { needle: "mail", id: SCREENTIME_CATEGORY_IDS.communication },

    { needle: "chromium", id: SCREENTIME_CATEGORY_IDS.browsing },
    { needle: "firefox", id: SCREENTIME_CATEGORY_IDS.browsing },
    { needle: "vivaldi", id: SCREENTIME_CATEGORY_IDS.browsing },
    { needle: "safari", id: SCREENTIME_CATEGORY_IDS.browsing },
    { needle: "chrome", id: SCREENTIME_CATEGORY_IDS.browsing },
    { needle: "brave", id: SCREENTIME_CATEGORY_IDS.browsing },
    { needle: "opera", id: SCREENTIME_CATEGORY_IDS.browsing },
    { needle: "orion", id: SCREENTIME_CATEGORY_IDS.browsing },
    { needle: "edge", id: SCREENTIME_CATEGORY_IDS.browsing },
    { needle: "arc", id: SCREENTIME_CATEGORY_IDS.browsing },

    { needle: "quicktime", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "podcasts", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "spotify", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "youtube", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "netflix", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "photos", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "music", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "plex", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "iina", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "vlc", id: SCREENTIME_CATEGORY_IDS.media },
    { needle: "tv", id: SCREENTIME_CATEGORY_IDS.media },

    { needle: "system preferences", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "notification center", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "activity monitor", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "system settings", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "control center", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "window server", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "loginwindow", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "screensaver", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "spotlight", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "wallpaper", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "finder", id: SCREENTIME_CATEGORY_IDS.system },
    { needle: "dock", id: SCREENTIME_CATEGORY_IDS.system },

    { needle: "textedit", id: SCREENTIME_CATEGORY_IDS.other },
    { needle: "preview", id: SCREENTIME_CATEGORY_IDS.other },
  ] as CategoryNeedle[]
).sort((a, b) => b.needle.length - a.needle.length)

const BROWSER_NEEDLES = CATEGORY_NEEDLES.filter((n) => n.id === SCREENTIME_CATEGORY_IDS.browsing)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function matchesNeedle(app: string, needle: string): boolean {
  const haystack = app.trim().toLowerCase()
  const token = needle.trim().toLowerCase()
  if (!haystack || !token) return false
  if (haystack === token) return true
  if (token.length <= 4) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(token)}(?:$|[^a-z0-9])`, "i").test(haystack)
  }
  return haystack.includes(token)
}

/** Lowercase `[a-z0-9]+` tokens joined by `-`. Empty / punctuation-only → `app`. */
export function slugApp(name: string): string {
  const tokens = String(name ?? "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
  return tokens?.length ? tokens.join("-") : "app"
}

export function appPenId(slug: string): string {
  return `st-app-${slug || "app"}`
}

export function domainPenId(browserSlug: string, domainSlug: string): string {
  return `st-app-${browserSlug || "app"}-${domainSlug || "site"}`
}

export function categoryForApp(app: string): { id: ScreenTimeCategoryId; name: string } {
  const name = String(app ?? "")
  for (const row of CATEGORY_NEEDLES) {
    if (matchesNeedle(name, row.needle)) {
      return { id: row.id, name: SCREENTIME_CATEGORY_NAMES[row.id] }
    }
  }
  return { id: SCREENTIME_CATEGORY_IDS.other, name: SCREENTIME_CATEGORY_NAMES[SCREENTIME_CATEGORY_IDS.other] }
}

export function isBrowserApp(app: string): boolean {
  return BROWSER_NEEDLES.some((row) => matchesNeedle(String(app ?? ""), row.needle))
}

/** Hostname without a leading `www.`. Invalid / empty → `null`. */
export function domainFromUrl(url: string): string | null {
  const raw = String(url ?? "").trim()
  if (!raw) return null
  try {
    const withProto = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
    const host = new URL(withProto).hostname.replace(/^\./, "")
    if (!host) return null
    const stripped = host.replace(/^www\./i, "")
    return stripped || null
  } catch {
    return null
  }
}
