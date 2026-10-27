/**
 * components/ItemDetail/type-views/ComputerProjectDetail.tsx — Computer Project desk
 *
 * The item-detail face for type Computer Project. Status, repository, next
 * actions, milestones, project notes, and tracked time are the operation's
 * own fields, links, and time — not a separate project record.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { trackedTimeForItems } from "@/lib/tracked-time"
import {
  OPERATION_ATTR,
  OPERATION_STAGES,
  type OperationStage,
} from "@/lib/operation-types"
import {
  evaluatePhase,
  getOperationTaskTree,
  getPhases,
  getParts,
  getResources,
  minutesToHours,
  selectToDoNext,
} from "@/lib/operations"
import { addPart, addPhase } from "@/components/Operations/operation-actions"
import { ItemNotesLog } from "@/components/ItemDetail/tabs/notes/ItemNotesLog"
import { foldOperationHomeNotes } from "@/lib/operations"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { APP_NAV_KEYS, writeStoredId, writeStoredTab } from "@/lib/app-navigation"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"
import { COMPUTER_PROJECT_ATTR } from "@/lib/computer-project-types"
import type { AttributeValue, ItemLink, Task } from "@/lib/types"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { NativeSelect } from "@/components/ui/native-select"

function textAttr(task: Task, id: string): string {
  const value = task.attributes?.[id]
  return typeof value === "string" ? value : ""
}

function listAttr(task: Task, id: string): string[] {
  const value = task.attributes?.[id]
  if (!Array.isArray(value)) return []
  return value.filter((row): row is string => typeof row === "string" && row.trim().length > 0)
}

function formatTracked(minutes: number): string {
  if (minutes <= 0) return "No time logged yet"
  if (minutes < 60) return `${minutes}m tracked`
  const hours = minutesToHours(minutes)
  return `${hours}h tracked`
}

export function ComputerProjectDetail({
  task,
  onLiveAttr,
  onCommitAttr,
  onPatch,
  onOpenItem,
}: {
  task: Task
  onLiveAttr: (id: string, value: AttributeValue) => void
  onCommitAttr: (id: string, value: AttributeValue) => void
  /** Keep an immediate link write inside the open draft so Save does not drop it. */
  onPatch: (patch: Partial<Task>) => void
  onOpenItem?: (id: string) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const entries = useTimeTrackingStore((s) => s.entries)
  const [nextName, setNextName] = useState("")
  const [phaseName, setPhaseName] = useState("")
  const [stackDraft, setStackDraft] = useState<string | null>(null)

  const notes = useMemo(() => foldOperationHomeNotes(task), [task])

  useEffect(() => {
    const stored = useTaskStore.getState().tasks.find((row) => row.id === task.id)
    if (stored) {
      const foldedStore = foldOperationHomeNotes(stored)
      if (foldedStore !== stored) useTaskStore.getState().updateTask(foldedStore)
    }
    if (notes === task) return
    if (stored && (stored === task || snapshotsEqual(stored, task))) return
    onPatch({ noteLog: notes.noteLog, attributes: notes.attributes })
  }, [task, notes, onPatch])

  const phases = useMemo(() => getPhases(task.id, tasks), [task.id, tasks])
  const next = useMemo(() => {
    const phaseIds = new Set(phases.map((row) => row.id))
    const actions = getOperationTaskTree(task.id, tasks).filter((row) => !phaseIds.has(row.id))
    return selectToDoNext(actions, { limit: 6 })
  }, [phases, task.id, tasks])
  const resources = useMemo(() => getResources(task.id, tasks), [task.id, tasks])
  const tracked = useMemo(() => {
    const tree = [task, ...getOperationTaskTree(task.id, tasks)]
    return trackedTimeForItems(tree, entries).total
  }, [task, tasks, entries])

  const stage = (textAttr(task, OPERATION_ATTR.stage) || "planning") as OperationStage
  const repo = textAttr(task, COMPUTER_PROJECT_ATTR.repo)
  const stack = listAttr(task, COMPUTER_PROJECT_ATTR.stack)
  const repoHref = /^https?:\/\//i.test(repo) ? repo : repo ? `https://${repo}` : ""

  const pullLinks = () => {
    const stored = useTaskStore.getState().tasks.find((row) => row.id === task.id)
    if (stored?.links) onPatch({ links: stored.links })
  }

  const addNext = () => {
    const name = nextName.trim()
    if (!name) return
    const child = addPart(task.id, name)
    setNextName("")
    if (child) pullLinks()
  }

  const addMilestone = () => {
    const name = phaseName.trim()
    if (!name) return
    const child = addPhase(task.id, name)
    setPhaseName("")
    if (child) pullLinks()
  }

  const openOperations = () => {
    writeStoredId(APP_NAV_KEYS.opsId, task.id)
    writeStoredTab(APP_NAV_KEYS.appTab, "operations")
    window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
  }

  return (
    <section className="id-bay cp-desk" aria-label="Computer project">
      <header className="id-attrs-head">
        <span className="id-attrs-plate">Computer project</span>
        <button type="button" className="id-keycap" onClick={openOperations}>
          Open in Operations
        </button>
      </header>

      <div className="cp-desk-grid">
        <label className="cp-field">
          <span className="cp-label">Status</span>
          <NativeSelect
            aria-label="Project status"
            value={OPERATION_STAGES.includes(stage) ? stage : "planning"}
            onChange={(event) => onCommitAttr(OPERATION_ATTR.stage, event.target.value)}
          >
            {OPERATION_STAGES.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="cp-field cp-span">
          <span className="cp-label">Mission</span>
          <IsolatedInput
            value={textAttr(task, OPERATION_ATTR.mission)}
            placeholder="What this project is for"
            onLiveChange={(value) => onLiveAttr(OPERATION_ATTR.mission, value)}
            onCommit={(value) => onCommitAttr(OPERATION_ATTR.mission, value)}
          />
        </label>
        <label className="cp-field cp-span">
          <span className="cp-label">Repository</span>
          <IsolatedInput
            value={repo}
            placeholder="https://…"
            onLiveChange={(value) => onLiveAttr(COMPUTER_PROJECT_ATTR.repo, value)}
            onCommit={(value) => onCommitAttr(COMPUTER_PROJECT_ATTR.repo, value)}
          />
          {repoHref ? (
            <a className="cp-link" href={repoHref} target="_blank" rel="noreferrer">
              Open repository
            </a>
          ) : null}
        </label>
        <label className="cp-field">
          <span className="cp-label">Branch</span>
          <IsolatedInput
            value={textAttr(task, COMPUTER_PROJECT_ATTR.branch)}
            placeholder="main"
            onLiveChange={(value) => onLiveAttr(COMPUTER_PROJECT_ATTR.branch, value)}
            onCommit={(value) => onCommitAttr(COMPUTER_PROJECT_ATTR.branch, value)}
          />
        </label>
        <label className="cp-field">
          <span className="cp-label">Local path</span>
          <IsolatedInput
            value={textAttr(task, COMPUTER_PROJECT_ATTR.path)}
            placeholder="/path/to/repo"
            onLiveChange={(value) => onLiveAttr(COMPUTER_PROJECT_ATTR.path, value)}
            onCommit={(value) => onCommitAttr(COMPUTER_PROJECT_ATTR.path, value)}
          />
        </label>
        <label className="cp-field cp-span">
          <span className="cp-label">Stack</span>
          <input
            className="cp-input"
            aria-label="Stack"
            value={stackDraft ?? stack.join(", ")}
            placeholder="TypeScript, …"
            onChange={(event) => setStackDraft(event.target.value)}
            onBlur={() => {
              const raw = stackDraft ?? stack.join(", ")
              const parts = raw
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
              onCommitAttr(COMPUTER_PROJECT_ATTR.stack, parts)
              setStackDraft(null)
            }}
          />
        </label>
        <label className="cp-field cp-span">
          <span className="cp-label">Next milestone</span>
          <IsolatedInput
            value={textAttr(task, COMPUTER_PROJECT_ATTR.next)}
            placeholder="The next thing that ships"
            onLiveChange={(value) => onLiveAttr(COMPUTER_PROJECT_ATTR.next, value)}
            onCommit={(value) => onCommitAttr(COMPUTER_PROJECT_ATTR.next, value)}
          />
        </label>
      </div>

      <div className="cp-block">
        <div className="cp-block-head">
          <span className="cp-label">Next actions</span>
          <span className="cp-quiet">{formatTracked(tracked)}</span>
        </div>
        {next.length === 0 ? <p className="cp-quiet">No open actions linked to this project yet.</p> : null}
        <ul className="cp-rows">
          {next.map((row) => (
            <li key={row.id}>
              <button type="button" className="cp-row" onClick={() => onOpenItem?.(row.id)}>
                {itemTitleOrUntitled(row)}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="cp-add"
          onSubmit={(event) => {
            event.preventDefault()
            addNext()
          }}
        >
          <input
            className="cp-input"
            aria-label="New next action"
            value={nextName}
            placeholder="Add a next action"
            onChange={(event) => setNextName(event.target.value)}
          />
          <button type="submit" className="id-keycap">
            Add action
          </button>
        </form>
      </div>

      <div className="cp-block">
        <span className="cp-label">Milestones</span>
        {phases.length === 0 ? <p className="cp-quiet">No phases yet. A phase is a milestone on this operation.</p> : null}
        <ul className="cp-rows">
          {phases.map((phase) => {
            const progress = evaluatePhase(phase, getParts(phase.id, tasks))
            const label =
              progress.total === 0
                ? phase.completed
                  ? "done"
                  : "open"
                : `${progress.done}/${progress.total}`
            return (
              <li key={phase.id}>
                <button type="button" className="cp-row" onClick={() => onOpenItem?.(phase.id)}>
                  <span>{itemTitleOrUntitled(phase)}</span>
                  <span className="cp-quiet">{label}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <form
          className="cp-add"
          onSubmit={(event) => {
            event.preventDefault()
            addMilestone()
          }}
        >
          <input
            className="cp-input"
            aria-label="New milestone"
            value={phaseName}
            placeholder="Add a milestone"
            onChange={(event) => setPhaseName(event.target.value)}
          />
          <button type="submit" className="id-keycap">
            Add milestone
          </button>
        </form>
      </div>

      {resources.length > 0 ? (
        <div className="cp-block">
          <span className="cp-label">Linked resources</span>
          <ul className="cp-rows">
            {resources.map((row) => (
              <li key={row.id}>
                <button type="button" className="cp-row" onClick={() => onOpenItem?.(row.id)}>
                  {itemTitleOrUntitled(row)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="cp-block">
        <span className="cp-label">Project notes</span>
        <ItemNotesLog
          entries={notes.noteLog}
          standing={notes.notes}
          onChangeEntries={(noteLog) =>
            onPatch(notes === task ? { noteLog } : { noteLog, attributes: notes.attributes })
          }
          onLiveStanding={(text) => onPatch({ notes: text })}
          onChangeStanding={(text) =>
            onPatch(notes === task ? { notes: text } : { notes: text, noteLog: notes.noteLog, attributes: notes.attributes })
          }
        />
      </div>

      <LinkLine links={task.links} onOpenItem={onOpenItem} tasks={tasks} />
    </section>
  )
}

function LinkLine({
  links,
  tasks,
  onOpenItem,
}: {
  links?: ItemLink[]
  tasks: Task[]
  onOpenItem?: (id: string) => void
}) {
  const rows = (links ?? []).filter((link) => link.relation !== "has-phase" && link.relation !== "has-part" && link.relation !== "has-resource")
  if (rows.length === 0) return null
  return (
    <div className="cp-block">
      <span className="cp-label">Other links</span>
      <ul className="cp-rows">
        {rows.map((link) => {
          const other = tasks.find((row) => row.id === link.targetId)
          return (
            <li key={link.id}>
              <button type="button" className="cp-row" onClick={() => onOpenItem?.(link.targetId)}>
                <span>{link.relation}</span>
                <span>{other ? itemTitleOrUntitled(other) : link.targetId}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
