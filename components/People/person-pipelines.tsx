/**
 * components/People/person-pipelines.tsx — People I Know pipelines
 *
 * A Company pen is the association. Company time is every Company block
 * painted with that pen, shown on the person and, on a block, as the people
 * joined to its pen. Pen settings are where a person is attached. A stored
 * `company-timeblock` row is still listed so it can be removed; it is not how
 * membership is chosen. A later kind stays on the row.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import {
  COMPANY_SCOPE_ID,
  companyBlocksForPerson,
  createPerson,
  ensurePeopleIKnowList,
  isCompanyPenPipeline,
  isCompanyTimeblockPipeline,
  pipelinesForEntry,
  pipelinesForPen,
  readPersonPipelines,
  withCompanyPen,
  withoutPipeline,
} from "@/lib/people-i-know"
import { useTaskStore } from "@/lib/task-store"
import { minutesToLabel, type TimeEntry } from "@/lib/time-entries"
import { useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"
import type { PersonPipeline, Task } from "@/lib/types"
import "./person-pipelines.css"

type PersonMode = {
  mode: "person"
  person: Task
  onChange: (pipelines: PersonPipeline[]) => void
}

type PenMode = { mode: "pen"; penId: string }
type EntryMode = { mode: "entry"; entryId: string }
type ListMode = { mode: "list" }

export type PersonPipelinesEditorProps = PersonMode | PenMode | EntryMode | ListMode

function blockLabel(entry: TimeEntry, pens: TrackPen[]): string {
  const pen = pens.find((row) => row.id === entry.penId)
  const clock =
    entry.endMin <= entry.startMin
      ? minutesToLabel(entry.startMin)
      : `${minutesToLabel(entry.startMin)}–${minutesToLabel(entry.endMin)}`
  return `${entry.date} ${clock}${pen ? ` ${pen.name}` : ""}`
}

function PipelineRows({
  rows,
  pens,
  entries,
  personName,
  onRemove,
}: {
  rows: { pipeline: PersonPipeline; personName?: string }[]
  pens: TrackPen[]
  entries: TimeEntry[]
  personName?: string
  onRemove: (pipelineId: string) => void
}) {
  if (rows.length === 0) {
    return <p className="person-pipelines-help">No pipelines yet.</p>
  }
  return (
    <ul className="person-pipelines-list">
      {rows.map(({ pipeline, personName: rowName }) => {
        const who = rowName ?? personName
        let detail = pipeline.kind
        let color: string | undefined
        if (isCompanyPenPipeline(pipeline)) {
          const pen = pens.find((row) => row.id === pipeline.penId)
          detail = pen ? pen.name : "This pen is no longer in Company"
          color = pen?.color
        } else if (isCompanyTimeblockPipeline(pipeline)) {
          const entry = entries.find((row) => row.id === pipeline.entryId)
          detail = entry ? blockLabel(entry, pens) : "This timeblock is no longer on the grid"
          color = entry ? pens.find((row) => row.id === entry.penId)?.color : undefined
        }
        const kind =
          pipeline.kind === "company-pen"
            ? "Company pen"
            : pipeline.kind === "company-timeblock"
              ? "Company timeblock"
              : pipeline.kind
        return (
          <li key={pipeline.id} className="person-pipelines-row" data-testid="person-pipeline-row" data-kind={pipeline.kind}>
            {color ? <span className="person-pipelines-swatch" style={{ background: color }} aria-hidden /> : null}
            <span className="person-pipelines-label">
              <span className="person-pipelines-kind">{kind}</span>
              {who ? ` · ${who}` : ""} — {detail}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(pipeline.id)}>
              Remove
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

function useCompanyTracking() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const allEntries = useTimeTrackingStore((s) => s.entries)
  const pens = useMemo(
    () => scopes.find((scope) => scope.id === COMPANY_SCOPE_ID)?.pens ?? [],
    [scopes],
  )
  const entries = useMemo(
    () => allEntries.filter((entry) => entry.scopeId === COMPANY_SCOPE_ID),
    [allEntries],
  )
  return { pens, entries }
}

export function PersonPipelinesEditor(props: PersonPipelinesEditorProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const { pens, entries } = useCompanyTracking()

  useEffect(() => {
    ensurePeopleIKnowList()
  }, [])

  const savePerson = (next: Task) => {
    if (props.mode === "person") {
      props.onChange(readPersonPipelines(next.personPipelines))
      return
    }
    updateTask(next)
  }

  if (props.mode === "person") {
    return (
      <PersonEditor
        person={props.person}
        pens={pens}
        entries={entries}
        onChange={props.onChange}
      />
    )
  }

  if (props.mode === "pen") {
    const hits = pipelinesForPen(tasks, props.penId)
    return (
      <section className="person-pipelines trk-section" data-testid="person-pipelines" aria-label="People">
        <Label className="trk-section-title">People</Label>
        <p className="person-pipelines-help trk-help">
          Attaching a person here is the association. Company blocks painted with this pen are their Company time. The same join is on that person.
        </p>
        <PipelineRows
          rows={hits.map((hit) => ({ pipeline: hit.pipeline, personName: itemTitleOrUntitled(hit.task, "Person") }))}
          pens={pens}
          entries={entries}
          onRemove={(pipelineId) => {
            const hit = hits.find((row) => row.pipeline.id === pipelineId)
            if (hit) savePerson(withoutPipeline(hit.task, pipelineId))
          }}
        />
        <AttachPerson
          tasks={tasks}
          lists={lists}
          excludeIds={hits.map((hit) => hit.task.id)}
          onAttach={(task) => savePerson(withCompanyPen(task, props.penId))}
          onCreate={(name) => {
            const listId = ensurePeopleIKnowList()
            addTask(createPerson(name, listId, [{ id: `pp-${Date.now().toString(36)}`, kind: "company-pen", penId: props.penId }]))
          }}
        />
      </section>
    )
  }

  if (props.mode === "entry") {
    const entry = entries.find((row) => row.id === props.entryId)
    const penPeople = entry ? pipelinesForPen(tasks, entry.penId) : []
    const stored = pipelinesForEntry(tasks, props.entryId)
    const pen = entry ? pens.find((row) => row.id === entry.penId) : undefined
    return (
      <section className="person-pipelines trk-section" data-testid="person-pipelines" aria-label="People">
        <Label className="trk-section-title">People</Label>
        <p className="person-pipelines-help trk-help">
          People on this block are the ones joined to its pen{pen ? ` (${pen.name})` : ""}. Attach a person in that pen&apos;s settings. A second join on the block is not how membership is chosen.
        </p>
        {penPeople.length === 0 ? (
          <p className="person-pipelines-help">No one is joined to this pen yet.</p>
        ) : (
          <ul className="person-pipelines-list">
            {penPeople.map((hit) => (
              <li key={hit.task.id} className="person-pipelines-row" data-testid="company-block-person">
                {pen ? <span className="person-pipelines-swatch" style={{ background: pen.color }} aria-hidden /> : null}
                <span className="person-pipelines-label">{itemTitleOrUntitled(hit.task, "Person")}</span>
              </li>
            ))}
          </ul>
        )}
        {stored.length > 0 ? (
          <>
            <p className="person-pipelines-help">
              Stored block joins are kept so older data is not erased. They do not decide who this block belongs to.
            </p>
            <PipelineRows
              rows={stored.map((hit) => ({ pipeline: hit.pipeline, personName: itemTitleOrUntitled(hit.task, "Person") }))}
              pens={pens}
              entries={entries}
              onRemove={(pipelineId) => {
                const hit = stored.find((row) => row.pipeline.id === pipelineId)
                if (hit) savePerson(withoutPipeline(hit.task, pipelineId))
              }}
            />
          </>
        ) : null}
      </section>
    )
  }

  return (
    <ListEditor tasks={tasks} lists={lists} pens={pens} entries={entries} onSave={savePerson} onCreate={addTask} />
  )
}

function PersonEditor({
  person,
  pens,
  entries,
  onChange,
}: {
  person: Task
  pens: TrackPen[]
  entries: TimeEntry[]
  onChange: (pipelines: PersonPipeline[]) => void
}) {
  const rows = readPersonPipelines(person.personPipelines)
  const [penId, setPenId] = useState("")
  const blocks = useMemo(() => companyBlocksForPerson(person.personPipelines, entries).slice(0, 40), [person.personPipelines, entries])

  return (
    <section className="person-pipelines" data-testid="person-pipelines" aria-label="Pipelines">
      <Label>Pipelines</Label>
      <p className="person-pipelines-help">
        Company time follows the pens joined to this person. A block painted with one of those pens is theirs, without a separate join on the block. Attach the pen here or in pen settings. A stored timeblock row from before is kept and can be removed. It is not how new time is chosen.
      </p>
      <PipelineRows
        rows={rows.map((pipeline) => ({ pipeline }))}
        pens={pens}
        entries={entries}
        onRemove={(pipelineId) => onChange(readPersonPipelines(withoutPipeline(person, pipelineId).personPipelines))}
      />
      <div className="person-pipelines-add">
        <label>
          Company pen
          <select aria-label="Company pen to attach" value={penId} onChange={(event) => setPenId(event.target.value)}>
            <option value="">Choose a pen</option>
            {pens.map((pen) => (
              <option key={pen.id} value={pen.id}>
                {pen.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!penId}
          onClick={() => {
            onChange(readPersonPipelines(withCompanyPen(person, penId).personPipelines))
            setPenId("")
          }}
        >
          Add pen
        </Button>
      </div>
      <div>
        <p className="person-pipelines-kind">Company time</p>
        {blocks.length === 0 ? (
          <p className="person-pipelines-help">No Company blocks painted with this person&apos;s pens yet.</p>
        ) : (
          <ul className="person-pipelines-list">
            {blocks.map((entry) => (
              <li key={entry.id} className="person-pipelines-row" data-testid="person-company-block">
                <span className="person-pipelines-label">{blockLabel(entry, pens)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function AttachPerson({
  tasks,
  lists,
  excludeIds,
  onAttach,
  onCreate,
}: {
  tasks: Task[]
  lists: { id: string; peopleList?: boolean; name: string }[]
  excludeIds: string[]
  onAttach: (task: Task) => void
  onCreate: (name: string) => void
}) {
  const [personId, setPersonId] = useState("")
  const [name, setName] = useState("")
  const people = tasks.filter((task) => {
    if (excludeIds.includes(task.id)) return false
    const listId = lists.find((list) => list.peopleList || list.id === "people-i-know")?.id
    return task.type === "person" || (!!listId && (task.lists ?? []).includes(listId))
  })
  return (
    <div className="person-pipelines-add">
      <label>
        Person
        <select aria-label="Person to attach" value={personId} onChange={(event) => setPersonId(event.target.value)}>
          <option value="">Choose a person</option>
          {people.map((task) => (
            <option key={task.id} value={task.id}>
              {itemTitleOrUntitled(task, "Person")}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!personId}
        onClick={() => {
          const task = tasks.find((row) => row.id === personId)
          if (!task) return
          onAttach(task)
          setPersonId("")
        }}
      >
        Attach
      </Button>
      <label>
        New person
        <input
          type="text"
          aria-label="New person"
          value={name}
          placeholder="Name"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!name.trim()}
        onClick={() => {
          onCreate(name.trim())
          setName("")
        }}
      >
        Add person
      </Button>
    </div>
  )
}

function ListEditor({
  tasks,
  lists,
  pens,
  entries,
  onSave,
  onCreate,
}: {
  tasks: Task[]
  lists: { id: string; peopleList?: boolean; name: string }[]
  pens: TrackPen[]
  entries: TimeEntry[]
  onSave: (task: Task) => void
  onCreate: (task: Task) => void
}) {
  const [personId, setPersonId] = useState("")
  const [targetId, setTargetId] = useState("")
  const [name, setName] = useState("")
  const listId = lists.find((list) => list.peopleList || list.id === "people-i-know")?.id
  const people = tasks.filter(
    (task) => task.type === "person" || (!!listId && (task.lists ?? []).includes(listId)),
  )
  const rows = people.flatMap((task) =>
    readPersonPipelines(task.personPipelines).map((pipeline) => ({
      pipeline,
      personName: itemTitleOrUntitled(task, "Person"),
      task,
    })),
  )

  const add = () => {
    if (!targetId) return
    const existing = people.find((task) => task.id === personId)
    if (existing) {
      onSave(withCompanyPen(existing, targetId))
    } else if (name.trim()) {
      const id = ensurePeopleIKnowList()
      onCreate(
        createPerson(name.trim(), id, [
          { id: `pp-${Date.now().toString(36)}`, kind: "company-pen" as const, penId: targetId },
        ]),
      )
      setName("")
    }
    setTargetId("")
  }

  return (
    <section className="person-pipelines" data-testid="person-pipelines" aria-label="People I Know pipelines">
      <Label>Pipelines</Label>
      <p className="person-pipelines-help">
        Every stored join on this list. Company time is the blocks painted with a joined pen, so new joins here are pens. A stored timeblock row can still be removed. Rename stays. Delete of this list stays off so the joins keep a home.
      </p>
      <PipelineRows
        rows={rows}
        pens={pens}
        entries={entries}
        onRemove={(pipelineId) => {
          const hit = rows.find((row) => row.pipeline.id === pipelineId)
          if (hit) onSave(withoutPipeline(hit.task, pipelineId))
        }}
      />
      <div className="person-pipelines-add">
        <label>
          Person
          <select aria-label="Pipeline person" value={personId} onChange={(event) => setPersonId(event.target.value)}>
            <option value="">Choose a person</option>
            {people.map((task) => (
              <option key={task.id} value={task.id}>
                {itemTitleOrUntitled(task, "Person")}
              </option>
            ))}
          </select>
        </label>
        <label>
          New person
          <input type="text" aria-label="New pipeline person" value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Company pen
          <select aria-label="Pipeline target" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
            <option value="">Choose a pen</option>
            {pens.map((pen) => (
              <option key={pen.id} value={pen.id}>
                {pen.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" size="sm" variant="outline" disabled={!targetId || (!personId && !name.trim())} onClick={add}>
          Add pipeline
        </Button>
      </div>
    </section>
  )
}

