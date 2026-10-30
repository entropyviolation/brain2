"use client"

/**
 * components/spreadsheet/use-spreadsheet-catalog.ts
 *
 * The column catalog for a small list is built before paint. A large list
 * (global All Items, or any vault past the eager limit) paints from list and
 * type schemas first, then reads item payloads once the rows are up.
 */
import { useEffect, useMemo, useState } from "react"
import {
  buildSpreadsheetCatalog,
  CATALOG_EAGER_ITEM_LIMIT,
  type BuildCatalogInput,
  type SheetColumnCandidate,
} from "@/lib/spreadsheet-catalog"
import type { Task } from "@/lib/types"

function scheduleIdle(work: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(work, { timeout: 400 })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(work, 32)
  return () => clearTimeout(id)
}

export function useSpreadsheetCatalog(input: BuildCatalogInput): SheetColumnCandidate[] {
  const { list, lists, types, listItems, vaultItems } = input
  const skipList = listItems.length > CATALOG_EAGER_ITEM_LIMIT
  const skipVault = vaultItems.length > CATALOG_EAGER_ITEM_LIMIT
  const large = skipList || skipVault
  const eager = useMemo(
    () =>
      buildSpreadsheetCatalog({
        list,
        lists,
        types,
        listItems: skipList ? [] : listItems,
        vaultItems: skipVault ? [] : vaultItems,
      }),
    [list, lists, types, listItems, vaultItems, skipList, skipVault],
  )
  const [full, setFull] = useState<{
    listItems: readonly Task[]
    vaultItems: readonly Task[]
    catalog: SheetColumnCandidate[]
  } | null>(null)

  useEffect(() => {
    if (!large) return
    let cancel = false
    const stop = scheduleIdle(() => {
      if (cancel) return
      setFull({
        listItems,
        vaultItems,
        catalog: buildSpreadsheetCatalog({ list, lists, types, listItems, vaultItems }),
      })
    })
    return () => {
      cancel = true
      stop()
    }
  }, [large, list, lists, types, listItems, vaultItems])

  if (!large) return eager
  if (full && full.listItems === listItems && full.vaultItems === vaultItems) return full.catalog
  return eager
}
