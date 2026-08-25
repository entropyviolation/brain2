import { useCallback, useState } from "react"

export function useListsSelection() {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])

  const toggleSelectMode = useCallback(() => {
    setSelectMode((v) => !v)
    setSelectedCategories([])
    setSelectedFolderIds([])
    setSelectedTaskIds([])
  }, [])

  const cancelSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedCategories([])
    setSelectedFolderIds([])
    setSelectedTaskIds([])
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

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedCategories([])
    setSelectedFolderIds([])
  }, [])

  const clearTaskSelection = useCallback(() => {
    setSelectedTaskIds([])
  }, [])

  const selectAll = useCallback((listIds: string[], folderIds: string[]) => {
    setSelectedCategories(listIds)
    setSelectedFolderIds(folderIds)
  }, [])

  const selectAllTasks = useCallback((taskIds: string[]) => {
    setSelectedTaskIds(taskIds)
  }, [])

  return {
    selectMode,
    setSelectMode,
    selectedCategories,
    setSelectedCategories,
    selectedFolderIds,
    setSelectedFolderIds,
    selectedTaskIds,
    setSelectedTaskIds,
    toggleSelectMode,
    cancelSelectMode,
    toggleCategorySelection,
    toggleFolderSelection,
    toggleTaskSelection,
    clearSelection,
    clearTaskSelection,
    selectAll,
    selectAllTasks,
  }
}
