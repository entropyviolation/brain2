import { useCallback, useState } from "react"

export function useListsSelection() {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([])

  const toggleSelectMode = useCallback(() => {
    setSelectMode((v) => !v)
    setSelectedCategories([])
    setSelectedFolderIds([])
  }, [])

  const cancelSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedCategories([])
    setSelectedFolderIds([])
  }, [])

  const toggleCategorySelection = useCallback((categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    )
  }, [])

  const toggleFolderSelection = useCallback((folderId: string) => {
    setSelectedFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId],
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedCategories([])
    setSelectedFolderIds([])
  }, [])

  const selectAll = useCallback((listIds: string[], folderIds: string[]) => {
    setSelectedCategories(listIds)
    setSelectedFolderIds(folderIds)
  }, [])

  return {
    selectMode,
    setSelectMode,
    selectedCategories,
    setSelectedCategories,
    selectedFolderIds,
    setSelectedFolderIds,
    toggleSelectMode,
    cancelSelectMode,
    toggleCategorySelection,
    toggleFolderSelection,
    clearSelection,
    selectAll,
  }
}
