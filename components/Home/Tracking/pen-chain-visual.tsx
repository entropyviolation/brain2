/**
 * components/Home/Tracking/pen-chain-visual.tsx — Counts-as color chain
 *
 * If Home counts as Ocean Beach counts as San Diego, show that chain with
 * colors and arrows. Each node opens that pen's settings. On a parent, also
 * show every pen that rolls up to it as a branching diagram. The current pen
 * is marked. Collapsed by default when the pen is a lonely root with no kids.
 */
"use client"

import { useEffect, useState } from "react"
import { ancestorChain, childrenOf } from "@/lib/pen-tree"
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

export function PenChainVisual({
  pens,
  penId,
  onOpenPen,
}: {
  pens: TrackPen[]
  penId: string
  onOpenPen: (id: string) => void
}) {
  const chain = ancestorChain(pens, penId) as TrackPen[]
  const descendants = (childrenOf(pens, penId) as TrackPen[]).length
  const hasChain = chain.length > 1 || descendants > 0
  const [open, setOpen] = useState(hasChain)

  // Assigning a parent turns a lonely root into a chain while the dialog is
  // open. Without this the nest the user just built comes up collapsed, because
  // the initial state was captured back when there was nothing to show.
  useEffect(() => {
    if (hasChain) setOpen(true)
  }, [hasChain])

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
          <div className="trk-chain" aria-label="Counts-as chain">
            {[...chain].reverse().map((pen, i) => (
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
