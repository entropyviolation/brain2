"use client"

/**
 * components/Lists/board/lists-status-bar.tsx
 *
 * Bottom status bar. This folder and Tree counts, the Smart lists checkbox,
 * and in global All the Show to do / done / undone checkbox.
 */
export function ListsStatusBar({
  hereCount,
  treeCount,
  showSmartLists,
  setShowSmartLists,
  isAll,
  showPeriodLedgerListsInAll,
  setShowPeriodLedgerListsInAll,
}: {
  hereCount: string
  treeCount: string
  showSmartLists: boolean
  setShowSmartLists: (value: boolean) => void
  isAll: boolean
  showPeriodLedgerListsInAll: boolean
  setShowPeriodLedgerListsInAll: (value: boolean) => void
}) {
  return (
    <div className="fm-status-bar">
      <div className="fm-status-field" data-testid="fm-status-here">
        <span className="fm-status-label">This folder:</span>
        <span className="fm-crt-count">{hereCount}</span>
      </div>
      <div className="fm-status-field shrink" style={{ minWidth: 180 }} data-testid="fm-status-tree">
        <span className="fm-status-label">Tree:</span>
        <span className="fm-crt-count">{treeCount}</span>
      </div>
      <div className="fm-status-field shrink" style={{ minWidth: 90 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={showSmartLists} onChange={(e) => setShowSmartLists(e.target.checked)} />
          Smart lists
        </label>
      </div>
      {isAll ? (
        <div className="fm-status-field shrink" style={{ minWidth: 160 }} data-testid="fm-status-period-ledgers">
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showPeriodLedgerListsInAll}
              onChange={(e) => setShowPeriodLedgerListsInAll(e.target.checked)}
            />
            Show to do / done / undone
          </label>
        </div>
      ) : null}
    </div>
  )
}
