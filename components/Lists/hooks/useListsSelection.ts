import { useCallback, useState } from "react"

export function useListsSelection() {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const toggleSelectMode = useCallback(() => {
    setSelectMode((v) => !v)
    setSelectedCategories([])
  }, [])

  const cancelSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedCategories([])
  }, [])

  const toggleCategorySelection = useCallback((categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedCategories([])
  }, [])

  return {
    selectMode,
    setSelectMode,
    selectedCategories,
    setSelectedCategories,
    toggleSelectMode,
    cancelSelectMode,
    toggleCategorySelection,
    clearSelection,
  }
}
