/**
 * components/Lists/hooks/useListsCsvImport.ts
 *
 * Spreadsheet import. The hidden file input stays in the window body; this
 * hook owns the ref, the parse, and the import into a new or existing list.
 * The accept string stays on that input.
 */
import { useCallback, useRef, useState } from "react"
import type React from "react"
import { inferColumnType } from "@/lib/csv"
import { parseSpreadsheetFile } from "@/lib/spreadsheet-file"
import { isExplicitlyScheduleable } from "@/lib/scheduling"
import type { ListDisplay } from "@/lib/lists-ui-store"
import type { AttributeValue, Folder, List, Task } from "@/lib/types"
import type { CsvImportState, OpenTarget } from "@/components/Lists/types"
import type { useListsTaskActions } from "@/components/Lists/hooks/useListsTaskActions"

export function useListsCsvImport({
  categories,
  currentFolder,
  isHome,
  addList,
  addTask,
  updateList,
  addListToFolder,
  toggleHomePin,
  taskActions,
  setListDisplay,
  setOpenTarget,
}: {
  categories: List[]
  currentFolder: Folder | null
  isHome: boolean
  addList: (list: List) => void
  addTask: (task: Task) => void
  updateList: (list: List) => void
  addListToFolder: (folderId: string, listId: string) => void
  toggleHomePin: (id: string) => void
  taskActions: ReturnType<typeof useListsTaskActions>
  setListDisplay: (id: string, display: ListDisplay) => void
  setOpenTarget: (target: OpenTarget) => void
}) {
  const csvRef = useRef<HTMLInputElement>(null)
  const [csvImport, setCsvImport] = useState<CsvImportState | null>(null)

  const handleCsvFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void (async () => {
      try {
        const { headers, rows } = await parseSpreadsheetFile(file)
        if (headers.length === 0) return
        const lower = headers.map((h) => h.toLowerCase())
        const nameCandidates = ["name", "title", "item", "task", "description", "book", "product"]
        let nameCol = lower.findIndex((h) => nameCandidates.some((c) => h.includes(c)))
        if (nameCol === -1) nameCol = 0
        const listName = file.name.replace(/\.(csv|tsv|txt|xlsx|xls)$/i, "")
        setCsvImport({ fileName: file.name, headers, rows, listName, nameCol, targetCategoryId: "" })
      } catch (err) {
        console.error("Failed to parse spreadsheet", err)
        window.alert("Could not read that spreadsheet. Try exporting as CSV or XLSX and upload again.")
      }
    })()
    if (csvRef.current) csvRef.current.value = ""
  }, [])

  const performCsvImport = useCallback(() => {
    if (!csvImport) return
    const { headers, rows, nameCol, listName, targetCategoryId } = csvImport
    const slug = (s: string) => "attr_" + s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    const attrDefs = headers
      .map((h, i) => ({ h, i }))
      .filter(({ i }) => i !== nameCol)
      .map(({ h, i }) => ({ id: slug(h) || `attr_${i}`, name: h || `Column ${i + 1}`, type: inferColumnType(h, rows.map((r) => r[i] ?? "")) }))
    let categoryId = targetCategoryId
    if (!categoryId) {
      categoryId = Date.now().toString()
      addList({
        id: categoryId,
        name: listName || "Imported list",
        color: "#3B82F6",
        description: `Imported from ${csvImport.fileName}`,
        createdAt: new Date(),
        order: categories.length,
        scheduleable: isExplicitlyScheduleable(currentFolder),
        itemAttributes: attrDefs,
      })
      if (currentFolder) addListToFolder(currentFolder.id, categoryId)
      if (isHome) toggleHomePin(categoryId)
    } else {
      const existing = categories.find((c) => c.id === categoryId)
      if (existing) {
        const merged = [...(existing.itemAttributes || [])]
        attrDefs.forEach((d) => { if (!merged.some((m) => m.id === d.id)) merged.push(d) })
        const displays = existing.enabledDisplays
        updateList({
          ...existing,
          itemAttributes: merged,
          // Ensure spreadsheet view is available after a sheet import.
          enabledDisplays:
            displays && displays.length > 0 && !displays.includes("spreadsheet")
              ? [...displays, "spreadsheet"]
              : displays,
        })
      }
    }
    rows.forEach((row, idx) => {
      const description = (row[nameCol] || "").trim() || `Row ${idx + 1}`
      const base = taskActions.buildBaseTask(description)
      base.lists = [categoryId]
      const attributes: Record<string, AttributeValue> = {}
      headers.forEach((h, i) => {
        if (i === nameCol) return
        const def = attrDefs.find((d) => d.id === (slug(h) || `attr_${i}`))
        if (!def) return
        const raw = (row[i] ?? "").trim()
        if (raw === "") return
        attributes[def.id] = def.type === "number" ? Number(raw.replace(/[$,]/g, "")) || 0 : raw
      })
      base.attributes = attributes
      addTask(base)
    })
    // Open the imported list in spreadsheet view so the grid matches the file.
    setListDisplay(categoryId, "spreadsheet")
    setOpenTarget({ type: "category", id: categoryId })
    setCsvImport(null)
  }, [csvImport, addList, addTask, updateList, categories, currentFolder, addListToFolder, isHome, toggleHomePin, taskActions, setListDisplay, setOpenTarget])

  return { csvRef, csvImport, setCsvImport, handleCsvFile, performCsvImport }
}
