import type { OpenTarget } from "@/components/Lists/types"

export interface BreadcrumbNavProps {
  searchActive: boolean
  searchTerm: string
  openTarget: OpenTarget
  openName: string
  isHome: boolean
  isAll: boolean
  currentFolderName?: string
  /**
   * Ancestor list names from root → parent for a nested category (Feature 8),
   * excluding the open category itself. When present, they're inserted before
   * `openName` so the breadcrumb reflects the sublist depth.
   */
  categoryAncestorNames?: string[]
}

export function getBreadcrumb({
  searchActive,
  searchTerm,
  openTarget,
  openName,
  isHome,
  isAll,
  currentFolderName,
  categoryAncestorNames,
}: BreadcrumbNavProps): string {
  if (searchActive) return `Search: ${searchTerm}`
  if (openTarget) {
    const loc = isHome ? "Home" : isAll ? "All" : currentFolderName || "All"
    const trail = (categoryAncestorNames ?? []).filter(Boolean)
    return [loc, ...trail, openName].join(" \\ ")
  }
  if (isHome) return "Home"
  if (isAll) return "All"
  return `All \\ ${currentFolderName || ""}`
}

export function BreadcrumbNav(props: BreadcrumbNavProps) {
  return <>{getBreadcrumb(props)}</>
}
