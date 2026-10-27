"use client"

/**
 * components/Lists/board/lists-address-bar.tsx
 *
 * Address row under the toolbar. The breadcrumb text is computed by the
 * orchestrator and passed in.
 */
export function ListsAddressBar({ breadcrumb }: { breadcrumb: string }) {
  return (
    <div className="fm-status-bar">
      <div className="fm-status-field shrink">
        <span className="fm-status-label">Address</span>
      </div>
      <div className="fm-status-field">{breadcrumb}</div>
    </div>
  )
}
