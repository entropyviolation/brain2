"use client"

/**
 * components/Lists/board/list-inner-caption.tsx
 *
 * Open-list caption bar. Search state stays in useOpenListItems. This bar
 * only draws the name, the search field, and the caption keys.
 */
import { ListCaptionSearch, CaptionKeyGlyph } from "@/components/Lists/list-content/ListCaptionSearch"
import { openTargetKey } from "@/components/Lists/open-target"
import type { List } from "@/lib/types"
import type { OpenTarget } from "@/components/Lists/types"

export function ListInnerCaption({
  openTarget,
  innerCaption,
  listSearchOpen,
  listSearchable,
  listSearchQuery,
  setListSearchQuery,
  listSearchAllFields,
  setListSearchAllFields,
  shownCount,
  closeListSearch,
  setListSearchOpen,
  setAddingTaskToTarget,
  openCategory,
  canEditFolderAllSettings,
  setEditingCategory,
  openFolderAllSettings,
  closeTarget,
}: {
  openTarget: OpenTarget
  innerCaption: string
  listSearchOpen: boolean
  listSearchable: boolean
  listSearchQuery: string
  setListSearchQuery: (query: string) => void
  listSearchAllFields: boolean
  setListSearchAllFields: (allFields: boolean) => void
  shownCount: number
  closeListSearch: () => void
  setListSearchOpen: (open: boolean) => void
  setAddingTaskToTarget: (target: string | null) => void
  openCategory: List | null
  canEditFolderAllSettings: boolean
  setEditingCategory: (list: List | null) => void
  openFolderAllSettings: () => void
  closeTarget: () => void
}) {
  if (!openTarget) return null
  return (
    <div className={`fm-title-bar inactive fm-list-caption${listSearchOpen ? " searching" : ""}`}>
      <div className="fm-title-bar-text" data-testid="fm-inner-caption" title={innerCaption}>
        <span className="fm-list-caption-name">{innerCaption}</span>
      </div>
      {listSearchOpen && listSearchable ? (
        <ListCaptionSearch
          listName={innerCaption}
          query={listSearchQuery}
          onQueryChange={setListSearchQuery}
          allFields={listSearchAllFields}
          onAllFieldsChange={setListSearchAllFields}
          matchCount={listSearchQuery.trim() ? shownCount : null}
          onClose={closeListSearch}
        />
      ) : null}
      <div className="fm-title-bar-controls fm-cap-keys">
        {listSearchable && (
          <button
            type="button"
            data-no95
            className="fm-cap-key"
            title={listSearchOpen ? "Close search" : "Search this list"}
            aria-label={listSearchOpen ? "Close list search" : "Search this list"}
            aria-pressed={listSearchOpen}
            onClick={() => (listSearchOpen ? closeListSearch() : setListSearchOpen(true))}
          >
            <CaptionKeyGlyph kind="search" />
          </button>
        )}
        {listSearchable && (
          <button
            type="button"
            data-no95
            className="fm-cap-key"
            title="Add item"
            aria-label="Add item"
            onClick={() => setAddingTaskToTarget(openTargetKey(openTarget))}
          >
            <CaptionKeyGlyph kind="add" />
          </button>
        )}
        {(openCategory || canEditFolderAllSettings) && (
          <button
            type="button"
            data-no95
            className="fm-cap-key"
            title="List settings"
            aria-label="List settings"
            onClick={() => (openCategory ? setEditingCategory(openCategory) : openFolderAllSettings())}
          >
            <CaptionKeyGlyph kind="settings" />
          </button>
        )}
        <button type="button" data-no95 className="fm-cap-key fm-cap-key-close" title="Close list" aria-label="Close" onClick={closeTarget}>
          <CaptionKeyGlyph kind="close" />
        </button>
      </div>
    </div>
  )
}
