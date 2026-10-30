/**
 * components/Lab/BimFlow/flow-inspector.tsx — Edit one node, and read what it did
 *
 * The question text is the node's instruction; editing it is how the flow
 * gets better. Under it, the selected message's step at this node: the exact
 * prompt the model saw and its answer. On a gate, YES / NO teaches it: the
 * message is kept as a labelled example the gate shows the model next time.
 */
"use client"

import type { ExtractField, Flow, FlowNode, ProposeAction, SearchSource, TraceStep } from "@/lib/bim-flow/types"

const SOURCES: SearchSource[] = ["items", "lists", "habits", "pens", "people"]
const ACTIONS: ProposeAction[] = ["add-to-list", "habit-done", "intake", "mood", "person-mention", "idea", "todo", "dream", "body"]

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
  const searchNodes = props.flow.nodes.filter((n) => n.kind === "search")

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
