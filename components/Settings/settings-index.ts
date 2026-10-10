/**
 * components/Settings/settings-index.ts — Groups and find-text for Settings
 *
 * One catalog for the dialog index and the search box. Section order inside
 * a group runs from everyday to rare. The dialog still mounts every bay;
 * this file only decides which ones a query keeps.
 */

export type SettingsGroupId = "you" | "appearance" | "points" | "data" | "imports" | "library"

export type SettingsGroup = {
  id: SettingsGroupId
  title: string
}

export type SettingsSection = {
  id: string
  groupId: SettingsGroupId
  title: string
  /** Title, group name, and the labels a person can see in that bay. */
  keywords: string
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  { id: "you", title: "You" },
  { id: "appearance", title: "Appearance" },
  { id: "points", title: "Points" },
  { id: "data", title: "Data" },
  { id: "imports", title: "Imports" },
  { id: "library", title: "Library" },
]

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: "settings-friend",
    groupId: "you",
    title: "Baby animal friend",
    keywords: "gallery photograph name cute shuffle nest friend picture",
  },
  {
    id: "settings-home",
    groupId: "you",
    title: "Home location",
    keywords: "city san diego sunrise sunset place home",
  },
  {
    id: "settings-birthday",
    groupId: "you",
    title: "Birthday",
    keywords: "birthday date star lord report moon",
  },
  {
    id: "settings-day-anchor",
    groupId: "you",
    title: "Default time of day",
    keywords: "assumed finish time bedtime sleep day anchor evening",
  },
  {
    id: "settings-window-gray",
    groupId: "appearance",
    title: "Window gray",
    keywords: "chrome face warmth slider drift default classic metal pause instant timed",
  },
  {
    id: "settings-desktop",
    groupId: "appearance",
    title: "Desktop",
    keywords: "teal pcb ceramic mint ice xray fr4 plate backdrop photograph",
  },
  {
    id: "settings-bouba",
    groupId: "appearance",
    title: "Bouba/Kiki",
    keywords: "corners radius rounded pointy mix experimental bouba kiki",
  },
  {
    id: "settings-points",
    groupId: "points",
    title: "Automatic point allocation",
    keywords: "inbox ritual section whole ritual bonus goal focus multiplier points rules per section",
  },
  {
    id: "settings-profile",
    groupId: "data",
    title: "Data profile",
    keywords: "live demo vault stock river hale reset reload profile",
  },
  {
    id: "settings-backup",
    groupId: "data",
    title: "Full App Backup",
    keywords: "export restore json recovery merge replace snapshot backup",
  },
  {
    id: "settings-mobile",
    groupId: "data",
    title: "Phone ↔ Desktop Live Sync",
    keywords: "phone desktop mobile hub push pull sync",
  },
  {
    id: "settings-notes",
    groupId: "imports",
    title: "Notes and ingest",
    keywords: "ingest from notes phone notes capture",
  },
  {
    id: "settings-messages",
    groupId: "imports",
    title: "Message ingest",
    keywords: "telegram bim pairing grocery cheat sheet simulate shortcut message",
  },
  {
    id: "settings-screen",
    groupId: "imports",
    title: "Screen Time",
    keywords: "activitywatch url lookback sync now screen time",
  },
  {
    id: "settings-instagram",
    groupId: "imports",
    title: "Import from Instagram data",
    keywords: "instagram followers following json download import",
  },
  {
    id: "settings-types",
    groupId: "library",
    title: "Item Types",
    keywords: "item types attributes behaviors rules manage module platform",
  },
  {
    id: "settings-second-brain",
    groupId: "library",
    title: "Second Brain",
    keywords: "second brain source belief trust knowledge base seed setup",
  },
]

const GROUP_BY_ID = new Map(SETTINGS_GROUPS.map((group) => [group.id, group]))

export function groupDomId(groupId: SettingsGroupId): string {
  return `settings-group-${groupId}`
}

export function groupForSection(sectionId: string): SettingsGroup | undefined {
  const section = SETTINGS_SECTIONS.find((item) => item.id === sectionId)
  return section ? GROUP_BY_ID.get(section.groupId) : undefined
}

function haystack(section: SettingsSection): string {
  const group = GROUP_BY_ID.get(section.groupId)
  return `${section.title} ${group?.title ?? ""} ${section.keywords}`.toLowerCase()
}

/** Empty query matches everything. Every word must appear. */
export function sectionMatches(section: SettingsSection, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = haystack(section)
  return words.every((word) => text.includes(word))
}

export function matchingSections(query: string): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) => sectionMatches(section, query))
}

export function sectionShown(sectionId: string, query: string): boolean {
  const section = SETTINGS_SECTIONS.find((item) => item.id === sectionId)
  return section ? sectionMatches(section, query) : false
}

export function groupShown(groupId: SettingsGroupId, query: string): boolean {
  return SETTINGS_SECTIONS.some((section) => section.groupId === groupId && sectionMatches(section, query))
}

/** A group row selects that group's first section that still matches. */
export function resolveSettingsSelection(id: string, query: string): string | null {
  if (id.startsWith("settings-group-")) {
    const groupId = id.slice("settings-group-".length) as SettingsGroupId
    return SETTINGS_SECTIONS.find((section) => section.groupId === groupId && sectionMatches(section, query))?.id ?? null
  }
  return sectionShown(id, query) ? id : null
}

/**
 * The bay on screen. Keep the current selection when it still matches.
 * Otherwise take the first match. An empty result leaves the stored
 * selection alone so clearing Find can restore it.
 */
export function selectedSectionId(activeId: string | null, query: string): string | null {
  if (activeId && sectionShown(activeId, query)) return activeId
  return matchingSections(query)[0]?.id ?? null
}
