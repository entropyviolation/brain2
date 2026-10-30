"use client"

/**
 * components/Lists/board/lists-address-bar.tsx
 *
 * Address row under the toolbar. The breadcrumb text is computed by the
 * orchestrator and passed in. On the phone, the Address label toggles the
 * folder tree (the desktop left pane). Wide desktop keeps the plain label.
 */
export function ListsAddressBar({
  breadcrumb,
  foldersOpen,
  onToggleFolders,
}: {
  breadcrumb: string
  foldersOpen?: boolean
  onToggleFolders?: () => void
}) {
  return (
    <div className="fm-status-bar">
      <div className="fm-status-field shrink">
        {onToggleFolders ? (
          <button
            type="button"
            className="fm-status-label"
            data-no95
            aria-expanded={foldersOpen === true}
            aria-controls="fm-folder-tree"
            onClick={onToggleFolders}
          >
            Address
          </button>
        ) : (
          <span className="fm-status-label">Address</span>
        )}
      </div>
      <div className="fm-status-field">{breadcrumb}</div>
    </div>
  )
}
