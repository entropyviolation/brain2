/**
 * components/Analytics/relations/GraphInbox.tsx — The shared table (L8.1,
 * L8.2). Export a graph snapshot for any model or agent; import its
 * proposal file; review proposals one by one. Accept on a link proposal
 * writes one link on the source item through `commitItemDraft` (the one
 * write door), with the proposal's origin as the ledger source. Model
 * proposals land `inferred`; imports `recorded`. No "accept all".
 */
"use client"

import { useRef, useState } from "react"
import { useGraphInboxStore } from "@/lib/graph/graph-inbox-store"
import { graphSnapshot } from "@/lib/graph/graph-snapshot"
import { parseProposalFile } from "@/lib/graph/proposal-schema"
import { useItemTypeStore } from "@/lib/item-type-store"
import { itemLinkTypeId } from "@/lib/item-types"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { addLink, relationLabel } from "@/lib/links"
import { commitItemDraft } from "@/lib/commit-item-edit"
import type { Task } from "@/lib/types"
import { allRelations, getRelationDef } from "@/lib/relation-registry"
import { useTaskStore } from "@/lib/task-store"

function acceptLink(source: Task, relation: string, targetId: string, origin: string) {
  commitItemDraft(source, { ...source, links: addLink(source.links, relation, targetId, source.id) }, origin, origin.startsWith("model:") ? "inferred" : "recorded")
}

export function GraphInbox() {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const rules = useItemTypeStore((s) => s.relationRules)
  const proposals = useGraphInboxStore((s) => s.proposals)
  const addProposals = useGraphInboxStore((s) => s.addProposals)
  const setStatus = useGraphInboxStore((s) => s.setStatus)
  const [includePrivate, setIncludePrivate] = useState(false)
  const [line, setLine] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const title = (id?: string) => itemTitleOrUntitled(id ? byId.get(id) : undefined)
  const open = proposals.filter((p) => p.status === "open")

  const exportSnapshot = () => {
    const snap = graphSnapshot({ tasks, relations: allRelations(), rules, title: (t) => itemTitleOrUntitled(t), includePrivate })
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `brain2-graph-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setLine(`Exported ${snap.items.length} items and ${snap.links.length} links. Left out: ${snap.leftOut.privateItems} private items, all notes.`)
  }
  const importFile = async (f: File) => {
    try {
      const { rows, dropped } = parseProposalFile(JSON.parse(await f.text()), {
        hasItem: (id) => byId.has(id),
        getDef: getRelationDef,
        typeOf: (id) => (byId.get(id) ? itemLinkTypeId(byId.get(id)!, lists) : undefined),
        origin: `import:${f.name.replace(/\.json$/i, "")}`,
      })
      const added = addProposals(rows)
      setLine(`Imported ${added} proposal${added === 1 ? "" : "s"}. Dropped ${dropped} malformed row${dropped === 1 ? "" : "s"}.`)
    } catch {
      setLine("That file is not JSON.")
    }
  }

  return (
    <div className="rel-inbox" data-testid="graph-inbox">
      <p className="rel-note">A model works outside the app: it reads the snapshot and hands back a proposal file. Nothing reaches the vault until you accept it.</p>
      <p>
        <label>
          <input type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} /> include private items (cycle, sleep, mood, intake)
        </label>{" "}
        <button type="button" className="an-chip" onClick={exportSnapshot}>
          Export graph snapshot
        </button>{" "}
        <button type="button" className="an-chip" onClick={() => file.current?.click()}>
          Import proposals
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
      </p>
      {line ? <p className="rel-note">{line}</p> : null}
      <h4 className="rel-group-head">Open · {open.length}</h4>
      <ul className="rel-list">
        {open.map((p) => (
          <li key={p.id} className="rel-row rel-inbox-row">
            <span>
              {p.kind === "link" ? `${title(p.sourceId)} ${relationLabel(p.relation!)} ${title(p.targetId)}` : p.kind === "relation" ? `New relation: ${p.relationDraft?.label}` : `New rule: ${p.ruleDraft?.label}`}
            </span>
            <span className="rel-scope" title={p.evidence?.span}>
              {p.reason}
            </span>
            <span className="rel-origin" data-origin="proposed">
              {p.origin}
            </span>
            <span>
              {p.kind === "link" && byId.get(p.sourceId!) ? (
                <button type="button" className="an-chip" onClick={() => { acceptLink(byId.get(p.sourceId!)!, p.relation!, p.targetId!, p.origin); setStatus(p.id, "accepted") }}>
                  Accept
                </button>
              ) : null}{" "}
              <button type="button" className="an-chip" onClick={() => setStatus(p.id, "dismissed")}>
                Dismiss
              </button>
            </span>
          </li>
        ))}
      </ul>
      {open.some((p) => p.kind !== "link") ? <p className="rel-note">Relation and rule proposals: open the sheet or the Rules tab and make them there. Nothing is created quietly.</p> : null}
    </div>
  )
}
