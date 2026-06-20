import type { OpenTarget } from "@/components/Lists/types"

export interface BreadcrumbNavProps {
  searchActive: boolean
  searchTerm: string
  openTarget: OpenTarget
  openName: string
  isHome: boolean
  isAll: boolean
  currentFolderName?: string
}

export function getBreadcrumb({
  searchActive,
  searchTerm,
  openTarget,
  openName,
  isHome,
  isAll,
  currentFolderName,
}: BreadcrumbNavProps): string {
  if (searchActive) return `Search: ${searchTerm}`
  if (openTarget) {
    const loc = isHome ? "Home" : isAll ? "All" : currentFolderName || "All"
    return `${loc} \\ ${openName}`
  }
  if (isHome) return "Home"
  if (isAll) return "All"
  return `All \\ ${currentFolderName || ""}`
}

export function BreadcrumbNav(props: BreadcrumbNavProps) {
  return <>{getBreadcrumb(props)}</>
}
