/**
 * components/Home/widgets/gallery/install.ts — What Install does, per kind
 *
 * The gallery's install and remove go through here, so a kind whose copy owns
 * a record elsewhere stays in step with it:
 * - Countdown adds a Days Until mark; the store's reconcile makes its copy.
 * - Language study adds the language to Vocab, then shows its copy with the
 *   role and level from setup.
 * - Weather and Solar install one copy per place (`key` is the place label,
 *   settings `place` / `lat` / `lng`). The empty key follows the pinned city.
 * - Everything else is `installCopy(kind)`.
 * Every install can skip the first-run guide (`guide: false`).
 */
"use client"

import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { useHomeDaysUntilStore, type DaysUntilMode, type DaysUntilRepeat } from "@/lib/home-days-until-store"
import { useVocabStore } from "@/lib/vocab-store"
import { widgetKind } from "@/lib/widgets/kinds"
import type { CefrLevel, LanguageRole } from "@/lib/widgets/language-levels"
import type { VocabLang } from "@/lib/vocab/types"
import type { WidgetCopy, WidgetSettings } from "@/lib/widgets/types"
import { applyCefrLevel } from "@/components/Home/widgets/language-study-settings"

export type InstallPlace = { label: string; lat: number; lng: number }

function afterInstall(copyId: string, guide: boolean) {
  const dash = useDashboardStore.getState()
  const copy = dash.copies.find((entry) => entry.id === copyId)
  if (!copy) return
  if (copy.hidden) dash.showCopy(copyId)
  if (!guide && widgetKind(copy.kind)?.guide) dash.markGuideSeen(copyId, true)
}

export function installPlain(kind: string, guide = true): string | null {
  const result = useDashboardStore.getState().installCopy(kind)
  if (!result) return null
  afterInstall(result.id, guide)
  return result.id
}

export function installCountdown(
  input: { label: string; date: string; mode: DaysUntilMode; repeat: DaysUntilRepeat },
  guide = true,
): string | null {
  const dash = useDashboardStore.getState()
  dash.ensureReady()
  const markId = useHomeDaysUntilStore.getState().addCountdown({
    label: input.label,
    date: input.date,
    mode: input.mode,
    repeat: input.repeat,
    ...(input.mode === "countdown" ? { whenPassed: "stay" as const } : {}),
  })
  // The days-until subscription usually made the copy already.
  const held = useDashboardStore.getState().copies.find((copy) => copy.kind === "daysuntil" && copy.settings.markId === markId)
  const id = held?.id ?? useDashboardStore.getState().installCopy("daysuntil", { settings: { markId } })?.id
  if (!id) return null
  afterInstall(id, guide)
  return id
}

export function installLanguage(
  input: { lang: VocabLang; role: LanguageRole; cefr: CefrLevel },
  guide = true,
): string | null {
  const vocab = useVocabStore.getState()
  if (!vocab.languages.includes(input.lang)) vocab.addLanguage(input.lang)
  const settings = { lang: input.lang, role: input.role, cefr: input.role === "studied" ? input.cefr : "" }
  const dash = useDashboardStore.getState()
  const result = dash.installCopy("vocab", { key: input.lang, settings })
  if (!result) return null
  dash.updateCopySettings(result.id, settings)
  if (input.role === "studied") applyCefrLevel(result.id, input.lang, input.cefr)
  afterInstall(result.id, guide)
  return result.id
}

export function installPlace(kind: "weather" | "solar", place: InstallPlace | null, guide = true): string | null {
  const dash = useDashboardStore.getState()
  const settings: WidgetSettings = place ? { place: place.label, lat: place.lat, lng: place.lng } : {}
  const result = dash.installCopy(kind, { key: place?.label ?? "", settings })
  if (!result) return null
  if (place && !result.created) dash.updateCopySettings(result.id, settings)
  afterInstall(result.id, guide)
  return result.id
}

/** Remove a copy, and the Days Until mark a Countdown owns. */
export function removeInstalledCopy(copy: WidgetCopy) {
  const markId = copy.settings.markId
  if (copy.kind === "daysuntil" && typeof markId === "string") {
    const days = useHomeDaysUntilStore.getState()
    if (days.items.some((item) => item.id === markId)) {
      days.removeCountdown(markId)
      // The reconcile drops the copy; this covers a dashboard that has not built yet.
      if (useDashboardStore.getState().copies.some((entry) => entry.id === copy.id)) {
        useDashboardStore.getState().removeCopy(copy.id)
      }
      return
    }
  }
  useDashboardStore.getState().removeCopy(copy.id)
}

export function removeNoteFor(kind: string): string | undefined {
  if (kind === "daysuntil") return "Its mark is deleted too; a Plan event it made stays on the calendar."
  if (kind === "vocab") return "Favorites, shuffles, and known words stay, so installing it again picks up where you left off."
  return undefined
}
