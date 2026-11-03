/**
 * components/Lab/ListsHelper/ListsHelperLab.tsx — Chat with the Lists helper, and see how it works
 *
 * Left: its flow (read → plan → approve → apply → undo, lit where the conversation is) and its tools. Right: the
 * chat. A plan shows counts, real rows, and what is left alone before anything is written; a duplicate shows its
 * items side by side. The engine is `lib/lists-helper/`; this file only draws it and calls `step`.
 */
"use client"

import { useState } from "react"
import { listsHelperBlueprint, LISTS_HELPER_STAGES } from "@/lib/agents/adapters/lists-helper"
import { builtinBlueprints } from "@/lib/agents/registry"
import { TOOLS } from "@/lib/lists-helper/tools"
import { ListsHelperChat, type Phase } from "./ListsHelperChat"
import { AgentRail } from "../Agents/AgentRail"
import { agentLabHref } from "../Agents/agent-href"
import "../BimFlow/bim-flow.css"
import "./lists-helper-lab.css"

const AGENTS = builtinBlueprints()
const BLUEPRINT = listsHelperBlueprint()

const EXAMPLES: Record<string, string> = {
  "find-items": "how many Book items lack an author?",
  "find-duplicates": "help me find duplicates in <list>, or of item type <type>",
  "merge-items": "(from a duplicate card: Merge)",
  "exclusive-type": "remove the Task item type from all Book type items",
  "copy-attributes": "make all Book items have at least the attributes item id <id> has",
  "retype-items": "change all Note items to Book",
  "add-items": "add Dune, Emma to list <id> with attributes author: Frank Herbert",
  "lookup-id": "what is the list id for the All Items list of Next actions folder?",
  "collect-items": "add all task items due from now until Dec 25 to new list called \"Soon\" in Home folder",
}

export function ListsHelperLab() {
  const [phase, setPhase] = useState<Phase>("read")
  const [example, setExample] = useState<string | undefined>()
  return (
    <div className="bf-lab lh-lab">
      <header className="bf-top">
        <button type="button" data-no95 className="bf-cap" onClick={() => (window.location.href = "/")}>
          ← Brain2
        </button>
        <b className="bf-title">LISTS · HELPER</b>
        <span className="bf-k">rev {BLUEPRINT.rev}</span>
        <span className="bf-lamp is-on" title="Runs on this machine with no model" />
        <span className="bf-k">no model · changes only after you approve</span>
        <span className="bf-sep" />
        <button type="button" data-no95 className="bf-cap" onClick={() => (window.location.href = "/lab/bim-flow")}>
          BIM flow lab
        </button>
      </header>

      <AgentRail
        agents={AGENTS}
        activeId={BLUEPRINT.id}
        onPick={(a) => {
          if (a.id === BLUEPRINT.id) return
          window.location.href = agentLabHref(a) ?? "/lab/bim-flow"
        }}
      />

      <div className="bf-main lh-main">
        <aside className="lh-side" aria-label="Flow and tools">
          <section>
            <h2 className="bf-k">Flow</h2>
            <ol className="lh-flow">
              {LISTS_HELPER_STAGES.map((s, i) => (
                <li key={s.id} className={s.id === phase ? "is-on" : ""}>
                  <span className="lh-dot">{i + 1}</span>
                  <div>
                    <b>{s.label}</b>
                    <small>{s.does}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h2 className="bf-k">Tools · {TOOLS.length}</h2>
            <ul className="lh-tools">
              {TOOLS.map((t) => (
                <li key={t.name}>
                  <button type="button" data-no95 className="lh-tool" title="Put an example in the box" onClick={() => setExample(EXAMPLES[t.name] ?? "")}>
                    <span className="lh-tool-head">
                      <b>{t.label}</b>
                      <span className={`lh-rw ${t.writes ? "is-w" : "is-r"}`}>{t.writes ? "needs approval" : "read only"}</span>
                    </span>
                    <small>{t.does}</small>
                    <span className="lh-params">{t.params.join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <ListsHelperChat onPhase={setPhase} example={example} />
      </div>
    </div>
  )
}
