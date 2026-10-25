/**
 * components/Home/Tracking/pen-chain-visual.tsx — Counts-as color chain
 *
 * If Home counts as Ocean Beach counts as San Diego, show that chain with
 * colors and arrows. Each node opens that pen's settings. On a parent, also
 * show every pen that rolls up to it as a branching diagram. The current pen
 * is marked. Collapsed by default when the pen is a lonely root with no kids.
 */
"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ancestorChains, childrenOf } from "@/lib/pen-tree"
import type { TrackPen } from "@/lib/time-tracking-store"
import "./tracking-chrome.css"

function Node({
  pen,
  current,
  onOpen,
}: {
  pen: TrackPen
  current: boolean
  onOpen: (id: string) => void
}) {
  return (
    <button
      type="button"
      className="trk-chain-node"
      data-current={current ? "true" : undefined}
      title={current ? `${pen.name} (this pen)` : `Open ${pen.name} settings`}
      onClick={() => onOpen(pen.id)}
    >
      <span className="trk-chain-bead" style={{ background: pen.color }} aria-hidden />
      <span className="truncate">{pen.name}</span>
      {current ? <span className="text-[9px]">this</span> : null}
    </button>
  )
}

function Branch({
  pens,
  parentId,
  currentId,
  onOpen,
  seen,
}: {
  pens: TrackPen[]
  parentId: string
  currentId: string
  onOpen: (id: string) => void
  /**
   * Ancestors already drawn on this path. `wouldCycle` keeps the user from
   * building a loop, but an imported or half-migrated vault can still hold one,
   * and `ancestorChain` tolerates that rather than throwing — walking the tree
   * downward has to be just as forgiving or one bad `parentId` is a blank page.
   */
  seen?: Set<string>
}) {
  if (seen?.has(parentId)) return null
  const walked = new Set(seen).add(parentId)
  const kids = (childrenOf(pens, parentId) as TrackPen[]).filter((kid) => !walked.has(kid.id))
  if (!kids.length) return null
  return (
    <div className="trk-chain-branch">
      {kids.map((kid) => (
        <div key={kid.id} className="space-y-1">
          <Node pen={kid} current={kid.id === currentId} onOpen={onOpen} />
          <Branch pens={pens} parentId={kid.id} currentId={currentId} onOpen={onOpen} seen={walked} />
        </div>
      ))}
    </div>
  )
}

function RowNode({
  pen,
  current,
  onOpen,
  extra,
}: {
  pen: TrackPen
  current: boolean
  onOpen: (id: string) => void
  extra?: ReactNode
}) {
  return (
    <span className="trk-chain-node" data-current={current ? "true" : undefined}>
      <button
        type="button"
        className="trk-chain-open"
        title={current ? `${pen.name} (this pen)` : `Open ${pen.name} settings`}
        onClick={() => onOpen(pen.id)}
      >
        <span className="trk-chain-bead" style={{ background: pen.color }} aria-hidden />
        <span className="truncate">{pen.name}</span>
        {current ? <span className="text-[9px]">this</span> : null}
      </button>
      {extra}
    </span>
  )
}

export function PenChainVisual({
  pens,
  penId,
  onOpenPen,
  variant = "nest",
  linkedIds,
  onUnlink,
  onMakeClock,
}: {
  pens: TrackPen[]
  penId: string
  onOpenPen: (id: string) => void
  /** `row` is only the horizontal counts-as lines. No hide toggle, no descendant dump. */
  variant?: "nest" | "row"
  /** Pens actually stored on the task. An implied parent is not in this set. */
  linkedIds?: ReadonlySet<string>
  onUnlink?: (penId: string) => void
  onMakeClock?: (penId: string) => void
}) {
  const chains = ancestorChains(pens, penId) as TrackPen[][]
  const chain = chains[0] ?? []
  const descendants = (childrenOf(pens, penId) as TrackPen[]).length
  const hasChain = chains.some((path) => path.length > 1) || descendants > 0
  const [open, setOpen] = useState(hasChain)

  // Assigning a parent turns a lonely root into a chain while the dialog is
  // open. Without this the nest the user just built comes up collapsed, because
  // the initial state was captured back when there was nothing to show.
  useEffect(() => {
    if (hasChain) setOpen(true)
  }, [hasChain])

  if (variant === "row") {
    const rows = chains.filter((path) => path.length > 1)
    if (!rows.length) return null
    return (
      <div className="trk-chain-rows">
        {rows.map((path, index) => (
          <div key={path.map((pen) => pen.id).join("-") || index} className="trk-chain" aria-label="Counts-as chain">
            {[...path].reverse().map((pen, i) => (
              <span key={pen.id} className="contents">
                {i > 0 ? (
                  <span className="trk-chain-arrow" aria-hidden>
                    →
                  </span>
                ) : null}
                <RowNode
                  pen={pen}
                  current={pen.id === penId}
                  onOpen={onOpenPen}
                  extra={
                    <>
                      {pen.id === penId && onMakeClock ? (
                        <button
                          type="button"
                          className="ipt-clock"
                          aria-pressed="true"
                          aria-label={`Clock pen ${pen.name}`}
                          title="Play paints with this pen"
                          onClick={() => onMakeClock(pen.id)}
                        >
                          clock
                        </button>
                      ) : null}
                      {onUnlink && linkedIds?.has(pen.id) ? (
                        <button type="button" className="ipt-x" aria-label={`Unlink ${pen.name}`} onClick={() => onUnlink(pen.id)}>
                          ×
                        </button>
                      ) : null}
                    </>
                  }
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (!hasChain) {
    return (
      <p className="trk-help">
        No nest yet. This pen is a root and nothing counts as it. Assign a parent above, or nest other
        pens under this one from their settings.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <button type="button" className="text-left text-[11px] underline" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide" : "Show"} color chain
      </button>
      {open && (
        <div className="space-y-2">
          {chains.map((path, index) => (
            <div key={path.map((pen) => pen.id).join("-") || index} className="trk-chain" aria-label="Counts-as chain">
              {[...path].reverse().map((pen, i) => (
                <span key={pen.id} className="contents">
                  {i > 0 ? (
                    <span className="trk-chain-arrow" aria-hidden>
                      →
                    </span>
                  ) : null}
                  <Node pen={pen} current={pen.id === penId} onOpen={onOpenPen} />
                </span>
              ))}
            </div>
          ))}
          {descendants > 0 && (
            <div>
              <p className="trk-help mb-1">Pens that count as {chain[chain.length - 1]?.name}:</p>
              <Branch pens={pens} parentId={penId} currentId={penId} onOpen={onOpenPen} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
