/**
 * components/steps/StepTree.tsx — One step tree for every host (Phase 9)
 *
 * The To Do lid (`TodoBreakdown`) and item detail → Subtasks both draw steps
 * with this. One row per step: fold chevron and count, tick, a dot to drag,
 * the name, then the host's own columns (`columns`). Hairline guides show the
 * depth. No blank lines wait unasked: each open branch ends in one quiet
 * **+ step**, each row has a hover **+** for a child, and an empty tree shows
 * **Add the first step**.
 *
 * Composer keys: Enter commits and goes one level deeper, empty Enter steps
 * out, Shift+Enter stays at this depth, Esc closes, a multi-line paste makes
 * one step per line.
 *
 * Moving steps like files: click selects, Shift-click a visible range,
 * Cmd/Ctrl-click toggles. Drag the dot (it takes the whole selection, children
 * come along): the top or bottom edge of a row drops before or after it, the
 * middle nests inside. A step cannot go into itself. With focus on a row:
 * ↑/↓ move focus, ←/→ fold, Alt+↑/↓ reorder, Tab nests, Shift+Tab lifts,
 * Enter renames. Every key pressed inside the tree stays in the tree, so the
 * ledger's D / M / P / R never fire from here; Esc clears a selection first
 * and only then reaches the host (which closes the lid).
 *
 * Hide locked and Show next only are view switches (`step-tree-view.ts`); the
 * calm line names what they hide and peeks at it.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ClipboardEvent, DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react"
import type { Subtask } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { iconFor, orbFor } from "@/components/Icons/Icon"
import {
  addNestedStep,
  flattenSteps,
  moveSteps,
  stepParentId,
  stepSiblings,
  topMostSelected,
  updateNestedStep,
  type StepMoveTarget,
} from "@/lib/todo-steps"
import { buildStepView, type StepViewRow } from "./step-tree-view"
import { toggleStepFold, useStepFolds } from "./step-folds"
import { WaitingLine } from "./WaitingLine"
import { StepTierMarks } from "./StepTierMarks"
import type { StepTier } from "@/lib/types"
import "./step-tree.css"

export interface StepRowInfo {
  depth: number
  hasKids: boolean
  /** Waiting on an open prerequisite (`lib/prereqs.ts`). */
  locked: boolean
  /** Tier filter on and this step is only a container (Phase 10). */
  greyed?: boolean
}

export interface StepTreeProps {
  steps: readonly Subtask[] | undefined
  onChange: (next: Subtask[]) => void
  /** The host's columns after the name (▶, minutes, chips, delete…). */
  columns?: (step: Subtask, info: StepRowInfo) => ReactNode
  /** Extra classes on a row (live, linking…). */
  rowClassName?: (step: Subtask) => string | undefined
  hideLocked?: boolean
  /** Skip completed steps. An open parent stays; a completed parent takes its subtree. */
  hideCompleted?: boolean
  nextOnly?: boolean
  /** Tier filter (Phase 10): only that level's view, other steps greyed or hidden. */
  tier?: StepTier
  /** Show each step's B · G · E tag and spark mark (Phase 10, UI-7). Click cycles or toggles. */
  tierTags?: boolean
  /**
   * Phase 11: open this step's item on top (`lib/step-item-stack.ts`). Set, a
   * click on the dot opens it (dragging still moves) and each row gets ↗.
   */
  onOpenStep?: (step: Subtask) => void
  /** The row checkbox selects the step (multi-select) instead of ticking it done. */
  checkboxSelects?: boolean
  /** Called once before a move writes, so the host can push one undo step. */
  onBeforeMove?: (label: string) => void
  /** Shown under **Add the first step** while the tree is empty. */
  emptyExtra?: ReactNode
  /** Show the minutes box in the composer (default on). */
  composerMinutes?: boolean
  label?: string
  /** Controlled selection (the task card's mass edit, Phase 12). Omit to keep it inside the tree. */
  selected?: ReadonlySet<string>
  onSelectedChange?: (next: ReadonlySet<string>) => void
  /** Told the visible step ids, in order, whenever they change (Chain, Select all). */
  onVisibleIds?: (ids: string[]) => void
  /** Locks from outside the tree (awaited events, other tasks). */
  extraLock?: (step: Subtask) => boolean
}

/** Fold motion: the rows under a branch unfold in (staggered spring) or fold out before they unmount. */
type FoldMotion = { kind: "in" | "out"; parent: string; order: Map<string, number> }
const FOLD_OUT_MS = 200
const reducedMotion = () => typeof window === "undefined" || !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches

type Composer = { parentId: string | null }
type DropHint = { id: string; where: "before" | "after" | "inside" } | { where: "end"; parentId: string | null }

function parseMinutes(raw: string): number | undefined {
  const n = Number(raw.trim())
  return raw.trim() && Number.isFinite(n) && n > 0 ? n : undefined
}

function findStep(steps: readonly Subtask[], id: string): Subtask | undefined {
  return flattenSteps(steps).find((s) => s.id === id)
}

function lastChildId(steps: readonly Subtask[], parentId: string | null): string | undefined {
  const list = parentId == null ? steps : findStep(steps, parentId)?.subtasks
  return list?.[list.length - 1]?.id
}

function StepComposer({
  depth,
  minutes,
  label,
  onCommit,
  onStepOut,
  onClose,
  onPasteLines,
}: {
  depth: number
  minutes: boolean
  label: string
  onCommit: (description: string, minutes: number | undefined, stay: boolean) => void
  onStepOut: () => void
  onClose: () => void
  onPasteLines: (lines: string[]) => void
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [mins, setMins] = useState("")
  useEffect(() => {
    nameRef.current?.focus()
  }, [label])

  // A step typed but not yet entered is saved when the composer goes away (navigating to a sub-card, closing).
  const pending = useRef({ name: "", mins: "", onCommit })
  pending.current = { name, mins, onCommit }
  useEffect(
    () => () => {
      const { name: left, mins: m, onCommit: save } = pending.current
      if (left.trim()) save(left.trim(), parseMinutes(m), false)
    },
    [],
  )

  const commit = (stay: boolean) => {
    const description = name.trim()
    if (!description) {
      onStepOut()
      return
    }
    pending.current.name = ""
    onCommit(description, parseMinutes(mins), stay)
    setName("")
    setMins("")
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      commit(e.shiftKey)
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (!text.includes("\n")) return
    e.preventDefault()
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length) onPasteLines(lines)
    setName("")
  }
  return (
    <div className="step-tree-composer" style={{ ["--step-depth" as string]: depth }}>
      <span className="step-tree-dot is-bare" aria-hidden />
      <input
        ref={nameRef}
        className="step-tree-composer-name"
        data-draft=""
        type="text"
        value={name}
        placeholder="Step…"
        aria-label={label}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKey}
        onPaste={onPaste}
      />
      {minutes ? (
        <input
          className="step-tree-composer-min"
          data-draft=""
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          placeholder="min"
          aria-label="Minutes for the new step"
          value={mins}
          onChange={(e) => setMins(e.target.value)}
          onKeyDown={onKey}
        />
      ) : null}
    </div>
  )
}

/** The step's orb: its item's orb in item view (a custom pick, else the item's stable one); a step with no item yet shows the one its item will be born with. */
function StepOrb({ step }: { step: Subtask }) {
  const src = useTaskStore((st) => {
    const item = step.itemId ? st.tasks.find((t) => t.id === step.itemId) : undefined
    return item ? iconFor(item.id, item.icon) : orbFor(step.id)
  })
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" data-orb draggable={false} />
}

export function StepTree({
  steps,
  onChange,
  columns,
  rowClassName,
  hideLocked = false,
  hideCompleted = false,
  nextOnly = false,
  tier,
  tierTags = false,
  onOpenStep,
  checkboxSelects = false,
  onBeforeMove,
  emptyExtra,
  composerMinutes = true,
  label = "Steps",
  selected: selectedProp,
  onSelectedChange,
  onVisibleIds,
  extraLock,
}: StepTreeProps) {
  const list = useMemo(() => [...(steps ?? [])], [steps])
  const folded = useStepFolds()
  const [openedNext, setOpenedNext] = useState<ReadonlySet<string>>(() => new Set())
  const [peek, setPeek] = useState(false)
  const [ownSelected, setOwnSelected] = useState<ReadonlySet<string>>(() => new Set())
  const selected = selectedProp ?? ownSelected
  const setSelected = (next: ReadonlySet<string>) => (onSelectedChange ? onSelectedChange(next) : setOwnSelected(next))
  const [anchor, setAnchor] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [composer, setComposer] = useState<Composer | null>(null)
  const [drop, setDrop] = useState<DropHint | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const dragIds = useRef<string[] | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [motion, setMotion] = useState<FoldMotion | null>(null)
  const motionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(motionTimer.current), [])
  /** Fold or unfold with motion. `close` forces a direction (keyboard ←/→). */
  const foldStep = (step: Subtask, close?: boolean) => {
    const isFolded = folded.has(step.id)
    const closing = close ?? !isFolded
    if (closing === isFolded) return
    const order = new Map(flattenSteps(step.subtasks).map((s, i) => [s.id, Math.min(i, 12)]))
    clearTimeout(motionTimer.current)
    if (reducedMotion()) return toggleStepFold(step.id, closing)
    if (!closing) {
      toggleStepFold(step.id, false)
      setMotion({ kind: "in", parent: step.id, order })
      motionTimer.current = setTimeout(() => setMotion(null), 700)
    } else {
      setMotion({ kind: "out", parent: step.id, order })
      motionTimer.current = setTimeout(() => {
        toggleStepFold(step.id, true)
        setMotion(null)
      }, FOLD_OUT_MS)
    }
  }
  /** Double-click on a fold: open (or close) every branch under this step. The two clicks cancel out, so act on the state the first one saw. */
  const foldAll = (step: Subtask) => {
    clearTimeout(motionTimer.current)
    setMotion(null)
    const close = !foldWas.current
    const branches = [step, ...flattenSteps(step.subtasks)].filter((s) => s.subtasks?.length)
    for (const b of branches) if (b.id !== step.id || close) toggleStepFold(b.id, close)
    if (!close) toggleStepFold(step.id, false)
  }
  const foldWas = useRef(false)
  const motionOf = (id: string | null, isAdd = false): { className: string; style: Record<string, number> } | null => {
    if (!motion || id == null) return null
    const i = motion.order.get(id)
    if (i == null && !(isAdd && id === motion.parent)) return null
    const n = i ?? motion.order.size
    const last = Math.min(motion.order.size, 12)
    return { className: ` is-fold-${motion.kind}`, style: { ["--fold-i" as string]: motion.kind === "in" ? n : last - Math.min(n, last) } }
  }

  const view = useMemo(
    () => buildStepView(list, { folded, hideLocked, hideCompleted, nextOnly, openedNext, peek, tier, extraLock }),
    [list, folded, hideLocked, hideCompleted, nextOnly, openedNext, peek, tier, extraLock],
  )
  const visibleIds = useMemo(
    () => view.rows.flatMap((r) => (r.kind === "step" ? [r.step.id] : [])),
    [view.rows],
  )

  // Drop selection of steps that are gone.
  useEffect(() => {
    if (![...selected].some((id) => !visibleIds.includes(id))) return
    setSelected(new Set([...selected].filter((id) => visibleIds.includes(id))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds, selected])
  const visibleKey = visibleIds.join("\0")
  useEffect(() => {
    onVisibleIds?.(visibleIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey])

  const focusRow = (id: string) => {
    setFocusId(id)
    requestAnimationFrame(() => {
      const rows = rootRef.current?.querySelectorAll<HTMLElement>("[data-step-id]") ?? []
      Array.from(rows).find((el) => el.dataset.stepId === id)?.focus()
    })
  }

  const move = (ids: Iterable<string>, target: StepMoveTarget, verb: string): boolean => {
    const next = moveSteps(list, ids, target)
    if (next === list) {
      setRefusal("A step cannot go inside itself.")
      return false
    }
    setRefusal(null)
    onBeforeMove?.(verb)
    onChange(next)
    if (target.where === "inside") toggleStepFold(target.id, false)
    return true
  }

  // The orb selects (⌘/Shift add, like a row) and never opens a popup; clicking a selected orb keeps it, with no rename.
  const pickOrb = (e: MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return select(e, id)
    setSelected(new Set([id]))
    setAnchor(id)
    focusRow(id)
  }

  const select = (e: MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setSelected(next)
      setAnchor(id)
    } else if (e.shiftKey && anchor && visibleIds.includes(anchor)) {
      const a = visibleIds.indexOf(anchor)
      const b = visibleIds.indexOf(id)
      setSelected(new Set(visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1)))
    } else if (selected.size === 1 && selected.has(id)) {
      setEditing(id)
      return
    } else {
      setSelected(new Set([id]))
      setAnchor(id)
    }
    focusRow(id)
  }

  const movingIds = (id: string) => (selected.has(id) ? [...selected] : [id])

  const onRowKey = (e: KeyboardEvent<HTMLElement>, id: string) => {
    const ids = movingIds(id)
    const tops = topMostSelected(list, ids)
    const first = tops[0]
    const last = tops[tops.length - 1]
    if (!first) return
    const siblings = stepSiblings(list, first)
    const free = siblings.filter((s) => !tops.includes(s.id))
    const firstAt = siblings.findIndex((s) => s.id === first)
    const lastAt = stepSiblings(list, last).findIndex((s) => s.id === last)
    const prevFree = [...siblings.slice(0, firstAt)].reverse().find((s) => free.includes(s))
    const nextFree = stepSiblings(list, last).slice(lastAt + 1).find((s) => !tops.includes(s.id))
    const at = visibleIds.indexOf(id)
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault()
      if (prevFree) move(tops, { id: prevFree.id, where: "before" }, "move steps up")
    } else if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault()
      if (nextFree) move(tops, { id: nextFree.id, where: "after" }, "move steps down")
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault()
      if (prevFree) move(tops, { id: prevFree.id, where: "inside" }, "nest steps")
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault()
      const parent = stepParentId(list, first)
      if (parent) move(tops, { id: parent, where: "after" }, "lift steps")
    } else if (e.key === "ArrowUp" && at > 0) {
      e.preventDefault()
      focusRow(visibleIds[at - 1])
    } else if (e.key === "ArrowDown" && at < visibleIds.length - 1) {
      e.preventDefault()
      focusRow(visibleIds[at + 1])
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      const step = siblings.find((s) => s.id === id)
      if (step?.subtasks?.length) foldStep(step, e.key === "ArrowLeft")
    } else if (e.key === "Enter") {
      e.preventDefault()
      setEditing(id)
    } else if (e.key === " ") {
      e.preventDefault()
      setSelected(new Set(selected.has(id) ? [...selected].filter((x) => x !== id) : [...selected, id]))
      setAnchor(id)
    }
  }

  const onTreeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const inField = !!target.closest("input, textarea, select, [contenteditable='true']")
    if (e.key === "Escape") {
      if (inField) return
      if (selected.size > 0) {
        e.preventDefault()
        e.stopPropagation()
        setSelected(new Set())
      }
      return
    }
    // Every other key stays in the tree: the ledger's keys act once focus leaves it.
    e.stopPropagation()
    if (inField) return
    const row = target.closest<HTMLElement>("[data-step-id]")
    if (row && row === target) onRowKey(e, row.dataset.stepId!)
  }

  // ---- composer ----
  const addAt = (parentId: string | null, description: string, minutes: number | undefined, stay: boolean) => {
    const next = addNestedStep(list, parentId, { description, estimatedDuration: minutes })
    onChange(next)
    if (parentId) toggleStepFold(parentId, false)
    if (!stay) {
      const made = lastChildId(next, parentId)
      if (made) setComposer({ parentId: made })
    }
  }
  const pasteAt = (parentId: string | null, lines: string[]) => {
    let next: Subtask[] = list
    for (const line of lines) next = addNestedStep(next, parentId, { description: line })
    onChange(next)
  }
  const stepOut = (parentId: string | null) => {
    if (parentId == null) setComposer(null)
    else setComposer({ parentId: stepParentId(list, parentId) ?? null })
  }
  const openComposer = (parentId: string | null) => {
    if (parentId) {
      toggleStepFold(parentId, false)
      setOpenedNext((prev) => new Set(prev).add(parentId))
    }
    setComposer({ parentId })
  }

  // ---- drag ----
  const onDragStart = (e: DragEvent, id: string) => {
    const ids = topMostSelected(list, movingIds(id))
    dragIds.current = ids
    e.dataTransfer?.setData("text/plain", ids.join(","))
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"
  }
  const zoneOf = (e: DragEvent): "before" | "after" | "inside" => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (rect.height <= 0) return "inside"
    const y = (e.clientY - rect.top) / rect.height
    return y < 0.28 ? "before" : y > 0.72 ? "after" : "inside"
  }
  const onDragOverRow = (e: DragEvent, id: string) => {
    if (!dragIds.current) return
    e.preventDefault()
    const where = zoneOf(e)
    if (drop?.where !== where || !("id" in drop) || drop.id !== id) setDrop({ id, where })
  }
  const onDropAt = (e: DragEvent, target: StepMoveTarget) => {
    e.preventDefault()
    const ids = dragIds.current
    dragIds.current = null
    setDrop(null)
    if (ids?.length) move(ids, target, "move steps")
  }
  const endDrag = () => {
    dragIds.current = null
    setDrop(null)
  }

  const renderRow = (row: StepViewRow, index: number): ReactNode => {
    if (row.kind === "more") {
      return (
        <div key={`more-${row.parentId}`} className="step-tree-more" style={{ ["--step-depth" as string]: row.depth }}>
          <button
            type="button"
            data-no95
            className="step-tree-quiet"
            onClick={() => setOpenedNext((prev) => new Set(prev).add(row.parentId))}
          >
            + {row.count} more
          </button>
        </div>
      )
    }
    if (row.kind === "add") {
      if (composer && composer.parentId === row.parentId) return renderComposer(row.parentId, row.depth)
      const hint = drop && drop.where === "end" && drop.parentId === row.parentId
      return (
        <div
          key={`add-${row.parentId ?? "root"}-${index}`}
          className={`step-tree-add${hint ? " is-drop" : ""}${motionOf(row.parentId, true)?.className ?? ""}`}
          style={{ ["--step-depth" as string]: row.depth, ...motionOf(row.parentId, true)?.style }}
          onDragOver={(e) => {
            if (!dragIds.current) return
            e.preventDefault()
            if (!hint) setDrop({ where: "end", parentId: row.parentId })
          }}
          onDrop={(e) => onDropAt(e, { where: "end", parentId: row.parentId })}
        >
          <button type="button" data-no95 className="step-tree-quiet" title="Add a step here (paste many lines to add many)" onClick={() => openComposer(row.parentId)}>
            + step
          </button>
        </div>
      )
    }
    const { step, depth, hasKids, locked, peeked, greyed = false } = row
    const isFolded = folded.has(step.id)
    const isSelected = selected.has(step.id)
    const hint = drop && drop.where !== "end" && drop.id === step.id ? drop.where : null
    const kidCount = step.subtasks?.length ?? 0
    const composerHere = composer?.parentId === step.id && (!hasKids || isFolded)
    const tabbable = focusId ? focusId === step.id : visibleIds[0] === step.id
    return (
      <div key={step.id} className={`step-tree-item${motionOf(step.id)?.className ?? ""}`} style={motionOf(step.id)?.style} role="none">
        <div
          role="treeitem"
          aria-level={depth + 1}
          aria-selected={isSelected}
          aria-expanded={hasKids ? !isFolded : undefined}
          aria-label={step.description}
          tabIndex={tabbable ? 0 : -1}
          data-step-id={step.id}
          className={[
            "step-tree-row",
            step.completed ? "is-done" : "",
            locked ? "is-locked" : "",
            isSelected ? "is-selected" : "",
            peeked ? "is-peek" : "",
            greyed ? "is-greyed" : "",
            hint ? `is-drop-${hint}` : "",
            rowClassName?.(step) ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ ["--step-depth" as string]: depth }}
          onFocus={(e) => {
            if (e.target === e.currentTarget) setFocusId(step.id)
          }}
          onDragOver={(e) => onDragOverRow(e, step.id)}
          onDragLeave={() => setDrop(null)}
          onDrop={(e) => onDropAt(e, { id: step.id, where: hint ?? zoneOf(e) })}
        >
          {hasKids ? (
            <button
              type="button"
              data-no95
              tabIndex={-1}
              className="step-tree-fold"
              aria-expanded={!isFolded}
              aria-label={isFolded ? `Show steps under ${step.description}` : `Hide steps under ${step.description}`}
              title={isFolded ? `Show the ${kidCount} steps inside · double-click: open all` : "Fold these steps away · double-click: fold all"}
              onClick={(e) => {
                if (e.detail < 2) foldWas.current = isFolded
                foldStep(step)
              }}
              onDoubleClick={() => foldAll(step)}
            >
              <span className="step-tree-caret" aria-hidden>▸</span>
              <span className="step-tree-fold-count">{kidCount}</span>
            </button>
          ) : (
            <span className="step-tree-fold is-empty" aria-hidden />
          )}
          <input
            type="checkbox"
            tabIndex={-1}
            aria-label={`${checkboxSelects ? "Select" : "Done"}: ${step.description}`}
            checked={checkboxSelects ? isSelected : step.completed}
            onChange={() => {
              if (!checkboxSelects) return onChange(updateNestedStep(list, step.id, { completed: !step.completed }))
              setSelected(new Set(isSelected ? [...selected].filter((x) => x !== step.id) : [...selected, step.id]))
              setAnchor(step.id)
            }}
          />
          <span
            className={`step-tree-dot${hasKids ? " is-parent" : ""}${step.itemId ? " is-item" : ""}${onOpenStep ? " is-openable" : ""}`}
            draggable
            title="Select · drag to move"
            aria-hidden
            onClick={(e) => pickOrb(e, step.id)}
            onDragStart={(e) => onDragStart(e, step.id)}
            onDragEnd={endDrag}
          >
            <StepOrb step={step} />
          </span>
          {editing === step.id ? (
            <input
              className="step-tree-name-edit"
              data-draft={step.description}
              type="text"
              defaultValue={step.description}
              autoFocus
              aria-label="Step name"
              onBlur={(e) => {
                const v = e.currentTarget.value.trim()
                if (v && v !== step.description) onChange(updateNestedStep(list, step.id, { description: v }))
                setEditing(null)
                focusRow(step.id)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
                if (e.key === "Escape") {
                  e.preventDefault()
                  e.stopPropagation()
                  e.currentTarget.value = step.description
                  e.currentTarget.blur()
                }
              }}
            />
          ) : (
            <button
              type="button"
              data-no95
              tabIndex={-1}
              className={`step-tree-name${step.completed ? " is-done" : ""}`}
              title={isSelected && selected.size === 1 ? "Click again to rename" : undefined}
              onClick={(e) => select(e, step.id)}
            >
              {step.description}
            </button>
          )}
          {tierTags ? <StepTierMarks step={step} steps={list} onChange={onChange} /> : null}
          <span className="step-tree-cols">{columns?.(step, { depth, hasKids, locked, greyed })}</span>
          {onOpenStep ? (
            <button
              type="button"
              data-no95
              tabIndex={-1}
              className="step-tree-open"
              title="Open this step's item on top"
              aria-label={`Open ${step.description}`}
              onClick={() => onOpenStep(step)}
            >
              ↗
            </button>
          ) : null}
          <button
            type="button"
            data-no95
            tabIndex={-1}
            className="step-tree-child"
            title="Add a step inside"
            aria-label={`Add step inside ${step.description}`}
            onClick={() => openComposer(step.id)}
          >
            +
          </button>
        </div>
        {composerHere ? renderComposer(step.id, depth + 1) : null}
      </div>
    )
  }

  const renderComposer = (parentId: string | null, depth: number) => {
    const parent = parentId ? findStep(list, parentId) : undefined
    return (
      <StepComposer
        key="composer"
        depth={depth}
        minutes={composerMinutes}
        label={parent ? `Add step under ${parent.description}` : "Add step"}
        onCommit={(d, m, stay) => addAt(parentId, d, m, stay)}
        onStepOut={() => stepOut(parentId)}
        onClose={() => setComposer(null)}
        onPasteLines={(lines) => pasteAt(parentId, lines)}
      />
    )
  }

  return (
    <div className="step-tree" ref={rootRef} onKeyDown={onTreeKey}>
      {list.length === 0 ? (
        <div className="step-tree-empty">
          {composer ? (
            renderComposer(null, 0)
          ) : (
            <button type="button" data-no95 className="step-tree-quiet is-first" onClick={() => setComposer({ parentId: null })}>
              Add the first step
            </button>
          )}
          {emptyExtra}
        </div>
      ) : (
        <div role="tree" aria-label={label} aria-multiselectable className="step-tree-rows">
          {view.rows.map(renderRow)}
        </div>
      )}
      {refusal ? (
        <p className="step-tree-refusal" role="status">
          {refusal}
        </p>
      ) : null}
      {selected.size > 1 ? (
        <p className="step-tree-selection" aria-live="polite">
          {selected.size} selected · drag a dot to move them · Esc clears
        </p>
      ) : null}
      <WaitingLine hidden={view.hiddenBySwitches} peeking={peek} onPeek={() => setPeek((p) => !p)} />
    </div>
  )
}
