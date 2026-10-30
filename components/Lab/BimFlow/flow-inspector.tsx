/**
 * components/Lab/BimFlow/flow-inspector.tsx — Edit one node, and read what it did
 *
 * The question text is the node's instruction; editing it is how the flow
 * gets better. Under it, the selected message's step at this node: the exact
 * prompt the model saw and its answer. On a gate, YES / NO teaches it: the
 * message is kept as a labelled example the gate shows the model next time.
 */
"use client"

import { ENTRIES } from "@/lib/bim-flow/entries"
import { FLOWS } from "@/lib/bim-flow/flows"
import type { AnswerMode, ComputeFn, RouteDef, ExtractField, Flow, FlowNode, ProposeAction, RetrieveKind, SearchSource, TraceStep } from "@/lib/bim-flow/types"

const SOURCES: SearchSource[] = ["items", "lists", "habits", "pens", "people"]
const RETRIEVE_KINDS: RetrieveKind[] = ["entries", "text", "overlap", "day", "texts"]
const MODES: AnswerMode[] = ["answer", "summarize", "check"]
const ACTIONS: ProposeAction[] = ["add-to-list", "habit-done", "intake", "mood", "person-mention", "idea", "todo", "dream", "body", "location", "company", "drive"]

const COMPUTE_FNS: ComputeFn[] = ["count", "minutes", "by-day", "streak", "days-since", "longest-gap", "top-pens", "compare"]

export function FlowInspector(props: {
  flow: Flow
  node: FlowNode | null
  step: TraceStep | null
  messageText: string | null
  onChange: (node: FlowNode) => void
  onDelete: (id: string) => void
}) {
  const { node, step } = props
  if (!node) {
    return (
      <div className="bf-inspector is-empty">
        <p>Pick a node to edit it.</p>
        <p>Drag from a right-edge port onto a node to wire them. A gate has a Y and an N port.</p>
      </div>
    )
  }
  const c = node.config
  const set = (patch: Partial<FlowNode["config"]>) => props.onChange({ ...node, config: { ...c, ...patch } })
  const searchNodes = props.flow.nodes.filter((n) => n.kind === "search" || n.kind === "link")
  const readNodes = props.flow.nodes.filter((n) => n.kind === "retrieve")

  const teach = (answer: "yes" | "no") => {
    if (!props.messageText) return
    const examples = (c.examples ?? []).filter((e) => e.text !== props.messageText)
    set({ examples: [...examples, { text: props.messageText, answer }] })
  }

  return (
    <div className="bf-inspector">
      <div className="bf-row">
        <span className="bf-k">{node.kind}</span>
        <input className="bf-input" value={node.label} onChange={(e) => props.onChange({ ...node, label: e.target.value })} />
        {node.kind !== "message" ? (
          <button type="button" data-no95 onClick={() => props.onDelete(node.id)}>
            Delete
          </button>
        ) : null}
      </div>

      {node.kind === "message" ? (
        <label className="bf-field">
          <span>Start node for (which part of the app feeds it)</span>
          <select className="bf-input" value={c.entry ?? ""} onChange={(e) => set({ entry: e.target.value || undefined })}>
            <option value="">any (the default start)</option>
            {ENTRIES.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.surface}{x.built ? "" : " (planned)"}</option>)}
          </select>
        </label>
      ) : null}

      {node.kind === "route" ? (
        <>
          <label className="bf-field">
            <span>Question</span>
            <textarea className="bf-input" rows={2} value={c.question ?? ""} onChange={(e) => set({ question: e.target.value })} />
          </label>
          <label className="bf-field">
            <span>Outputs, one per line: key | label | when to pick it | regex (optional, picked by code with no model)</span>
            <textarea
              className="bf-input"
              rows={7}
              key={node.id}
              defaultValue={(c.routes ?? []).map((r) => [r.key, r.label, r.hint ?? "", r.pattern ?? ""].join(" | ")).join("\n")}
              onBlur={(e) => set({ routes: parseRoutes(e.target.value) })}
            />
          </label>
          <label className="bf-field">
            <span>Most outputs followed (keep 1; several pads the list)</span>
            <input className="bf-input" type="number" min={1} max={3} value={c.maxRoutes ?? 1} onChange={(e) => set({ maxRoutes: Number(e.target.value) })} />
          </label>
        </>
      ) : null}

      {node.kind === "compute" ? (
        <div className="bf-grid">
          <label className="bf-field">
            <span>Count</span>
            <select className="bf-input" value={c.compute?.fn ?? "count"} onChange={(e) => set({ compute: { ...(c.compute ?? { fn: "count" }), fn: e.target.value as ComputeFn } })}>
              {COMPUTE_FNS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="bf-field">
            <span>Days back (a time word in the message wins)</span>
            <input className="bf-input" type="number" min={1} value={c.compute?.days ?? 7} onChange={(e) => set({ compute: { ...(c.compute ?? { fn: "count" }), days: Number(e.target.value) || 7 } })} />
          </label>
        </div>
      ) : null}

      {node.kind === "clarify" ? (
        <label className="bf-field">
          <span>Ask which, when a name fits two</span>
          <select className="bf-input" value={c.clarifyKind ?? "any"} onChange={(e) => set({ clarifyKind: e.target.value as "person" | "topic" | "any" })}>
            <option value="any">any</option>
            <option value="person">people</option>
            <option value="topic">topics</option>
          </select>
        </label>
      ) : null}

      {["gate", "route", "choose", "extract", "related", "answer"].includes(node.kind) ? (
        <label className="bf-field">
          <span>Model for this step only (blank = the run&apos;s plan)</span>
          <input className="bf-input" list="bf-models" value={c.model ?? ""} placeholder="e.g. qwen2.5:3b-instruct" onChange={(e) => set({ model: e.target.value.trim() || undefined })} />
        </label>
      ) : null}

      {node.kind === "handoff" ? (
        <label className="bf-field">
          <span>Hand the message to</span>
          <select className="bf-input" value={c.flowId ?? ""} onChange={(e) => set({ flowId: e.target.value || undefined })}>
            <option value="">—</option>
            {FLOWS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      ) : null}

      {node.kind === "gate" || node.kind === "choose" || node.kind === "extract" ? (
        <label className="bf-field">
          <span>{node.kind === "gate" ? "Yes/no question" : node.kind === "choose" ? "Question" : "What to pull"}</span>
          <textarea className="bf-input" rows={5} value={c.question ?? ""} onChange={(e) => set({ question: e.target.value })} />
        </label>
      ) : null}

      {node.kind === "gate" ? (
        <div className="bf-field">
          <span>Taught answers ({(c.examples ?? []).length})</span>
          <ul className="bf-examples">
            {(c.examples ?? []).map((ex, i) => (
              <li key={i}>
                <b className={`is-${ex.answer}`}>{ex.answer}</b> {ex.text}
                <button type="button" data-no95 onClick={() => set({ examples: (c.examples ?? []).filter((_, j) => j !== i) })}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {node.kind === "search" ? (
        <div className="bf-grid">
          <label className="bf-field">
            <span>Look in</span>
            <select className="bf-input" value={c.source ?? "items"} onChange={(e) => set({ source: e.target.value as SearchSource })}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="bf-field">
            <span>Most hits</span>
            <input className="bf-input" type="number" value={c.limit ?? 12} onChange={(e) => set({ limit: Number(e.target.value) })} />
          </label>
          <label className="bf-field">
            <span>Every one (ignore words)</span>
            <input type="checkbox" checked={!!c.all} onChange={(e) => set({ all: e.target.checked })} />
          </label>
          {c.source === "pens" ? (
            <label className="bf-field">
              <span>Tracking view id</span>
              <input className="bf-input" value={c.scopeId ?? ""} onChange={(e) => set({ scopeId: e.target.value || undefined })} />
            </label>
          ) : null}
        </div>
      ) : null}

      {node.kind === "choose" ? (
        <div className="bf-grid">
          <label className="bf-field">
            <span>Options from</span>
            <select className="bf-input" value={c.fromNodeId ?? ""} onChange={(e) => set({ fromNodeId: e.target.value })}>
              <option value="">—</option>
              {searchNodes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="bf-field">
            <span>Most picks</span>
            <input className="bf-input" type="number" min={1} value={c.max ?? 1} onChange={(e) => set({ max: Number(e.target.value) })} />
          </label>
        </div>
      ) : null}

      {node.kind === "extract" ? (
        <label className="bf-field">
          <span>Fields, one per line: name | type | hint | options</span>
          <textarea
            className="bf-input"
            rows={5}
            defaultValue={(c.fields ?? []).map((f) => [f.name, f.type, f.hint ?? "", (f.options ?? []).join(",")].join(" | ")).join("\n")}
            key={node.id}
            onBlur={(e) => set({ fields: parseFields(e.target.value) })}
          />
        </label>
      ) : null}

      {node.kind === "extract" || node.kind === "related" || node.kind === "answer" || node.kind === "route" ? (
        <label className="bf-field">
          <span>Instructions to the model (empty = built in)</span>
          <textarea className="bf-input" rows={7} value={c.system ?? ""} onChange={(e) => set({ system: e.target.value || undefined })} />
        </label>
      ) : null}

      {node.kind === "answer" ? (
        <label className="bf-field">
          <span>Extra rules for this question type (added after the built-in ones)</span>
          <textarea className="bf-input" rows={6} value={c.extra ?? ""} onChange={(e) => set({ extra: e.target.value || undefined })} />
        </label>
      ) : null}

      {node.kind === "related" ? (
        <label className="bf-field">
          <span>Most words</span>
          <input className="bf-input" type="number" min={1} value={c.max ?? 8} onChange={(e) => set({ max: Number(e.target.value) })} />
        </label>
      ) : null}

      {node.kind === "retrieve" ? (
        <div className="bf-grid">
          <label className="bf-field">
            <span>Reads</span>
            <select className="bf-input" value={c.retrieve?.kind ?? "text"} onChange={(e) => set({ retrieve: { ...c.retrieve, kind: e.target.value as RetrieveKind } })}>
              {RETRIEVE_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="bf-field">
            <span>Most rows</span>
            <input className="bf-input" type="number" min={1} value={c.retrieve?.limit ?? 12} onChange={(e) => set({ retrieve: { kind: "text", ...c.retrieve, limit: Number(e.target.value) } })} />
          </label>
          <label className="bf-field">
            <span>Days back (0 = plan decides)</span>
            <input className="bf-input" type="number" min={0} value={c.retrieve?.days ?? 0} onChange={(e) => set({ retrieve: { kind: "text", ...c.retrieve, days: Number(e.target.value) || undefined } })} />
          </label>
          <label className="bf-field">
            <span>By meaning</span>
            <input type="checkbox" checked={!!c.retrieve?.semantic} onChange={(e) => set({ retrieve: { kind: "text", ...c.retrieve, semantic: e.target.checked } })} />
          </label>
          <label className="bf-field">
            <span>Tracking views (ids, comma)</span>
            <input className="bf-input" value={(c.retrieve?.scopeIds ?? []).join(",")} onChange={(e) => set({ retrieve: { kind: "text", ...c.retrieve, scopeIds: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} />
          </label>
        </div>
      ) : null}

      {node.kind === "answer" ? (
        <div className="bf-grid">
          <label className="bf-field">
            <span>Mode</span>
            <select className="bf-input" value={c.mode ?? "answer"} onChange={(e) => set({ mode: e.target.value as AnswerMode })}>
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="bf-field">
            <span>Evidence from (comma ids; empty = whole path)</span>
            <input className="bf-input" value={(c.fromNodeIds ?? []).join(",")} onChange={(e) => set({ fromNodeIds: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
          </label>
          <span className="bf-k">{readNodes.map((r) => r.id).join(", ")}</span>
        </div>
      ) : null}

      {node.kind === "propose" ? (
        <label className="bf-field">
          <span>Would write</span>
          <select className="bf-input" value={c.action ?? "idea"} onChange={(e) => set({ action: e.target.value as ProposeAction })}>
            {ACTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      ) : null}

      {step ? (
        <div className="bf-step">
          <div className="bf-row">
            <span className="bf-k">This message here</span>
            <span>{step.ms}ms</span>
            {node.kind === "gate" && props.messageText ? (
              <>
                <button type="button" data-no95 className="is-yes" onClick={() => teach("yes")}>Should be YES</button>
                <button type="button" data-no95 className="is-no" onClick={() => teach("no")}>Should be NO</button>
              </>
            ) : null}
          </div>
          {step.error ? <pre className="bf-pre is-error">{step.error}</pre> : null}
          <pre className="bf-pre">{JSON.stringify(step.output, null, 1)}</pre>
          {step.prompt ? (
            <details>
              <summary>Prompt the model saw</summary>
              <pre className="bf-pre">{step.prompt}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function parseFields(text: string): ExtractField[] {
  return text
    .split("\n")
    .map((line) => line.split("|").map((s) => s.trim()))
    .filter(([name]) => name)
    .map(([name, type, hint, options]) => ({
      name: name!,
      type: (["string", "number", "boolean", "clock", "enum"].includes(type ?? "") ? type : "string") as ExtractField["type"],
      hint: hint || undefined,
      options: options ? options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
    }))
}

function parseRoutes(text: string): RouteDef[] {
  return text
    .split("\n")
    .map((line) => line.split("|").map((x) => x.trim()))
    .filter(([key]) => key)
    .map(([key, label, hint, pattern]) => ({ key: key!.replace(/[^a-z0-9_-]/gi, ""), label: label || key!, hint: hint || undefined, pattern: pattern || undefined }))
}
