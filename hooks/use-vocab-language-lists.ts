/**
 * hooks/use-vocab-language-lists.ts — Languages folder + fill on Vocab add
 *
 * Mounted once from `app/page.tsx` (`IdleVaultSeeds`). After the task vault
 * and the Vocab settings have loaded, it creates Languages → <language> →
 * the 1000-word list and My words (`lib/vocab-lists.ts`), and fills the
 * 1000-word list for every target language added in the Vocab widget. Adding
 * a language later fills its list then. Both lists open as a table the first
 * time.
 */
"use client"

import { useEffect } from "react"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"
import {
  THOUSAND_LANGS,
  ensureVocabLanguageLists,
  fillThousandList,
  isThousandLang,
  mineListId,
  thousandListId,
} from "@/lib/vocab-lists"
import { useVocabStore } from "@/lib/vocab-store"

function fillAdded(languages: readonly string[]): void {
  for (const lang of THOUSAND_LANGS) {
    if (languages.includes(lang) && isThousandLang(lang)) void fillThousandList(lang)
  }
}

export function useVocabLanguageLists(): void {
  useEffect(() => {
    let cancelled = false
    const stops: Array<() => void> = []
    stops.push(
      afterPersistHydrated(useTaskStore.persist, () => {
        if (cancelled) return
        stops.push(
          afterPersistHydrated(useVocabStore.persist, () => {
            if (cancelled) return
            ensureVocabLanguageLists()
            fillAdded(useVocabStore.getState().languages)
            stops.push(
              useVocabStore.subscribe((state, prev) => {
                if (state.languages !== prev.languages) fillAdded(state.languages)
              }),
            )
          }),
        )
        stops.push(
          afterPersistHydrated(useListsUiStore.persist, () => {
            if (cancelled) return
            const ui = useListsUiStore.getState()
            for (const lang of THOUSAND_LANGS) {
              for (const id of [thousandListId(lang), mineListId(lang)]) {
                if (!ui.listDisplay[id]) ui.setListDisplay(id, "table")
              }
            }
          }),
        )
      }),
    )
    return () => {
      cancelled = true
      for (const stop of stops) stop()
    }
  }, [])
}
