/**
 * components/Analytics/relations/RuleEditor.tsx — Rules sub-tab (L3.5,
 * §9.1). A sentence row: If ?a R1 ?b and ?b R2 ?c then ?a H ?c, unless U.
 * Dry run counts what the rule would derive vault-wide. A rule over 500
 * new edges asks once before saving. Rules derive on read; nothing writes.
 */
"use client"

import { useMemo, useState } from "react"
import { NativeSelect } from "@/components/ui/native-select"
import { useItemTypeStore } from "@/lib/item-type-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { relationLabel } from "@/lib/links"
import { allRelations, getRelationDef } from "@/lib/relation-registry"
import { useTaskStore } from "@/lib/task-store"
import { buildLattice } from "@/lib/graph/relation-lattice"
import { makeRule, ruleSentence, validateRule, type RelationRule } from "@/lib/graph/relation-rules"
import { DRY_RUN_ASK_OVER, dryRunRule, type DryRun } from "@/lib/graph/rule-dry-run"

export function RuleEditor() {
  const relations = useItemTypeStore((s) => s.relations)
  const overrides = useItemTypeStore((s) => s.relationOverrides)
  const rules = useItemTypeStore((s) => s.relationRules)
  const addRule = useItemTypeStore((s) => s.addRule)
  const toggleRule = useItemTypeStore((s) => s.toggleRule)
  const removeRule = useItemTypeStore((s) => s.removeRule)
  const tasks = useTaskStore((s) => s.tasks)
  const defs = useMemo(() => allRelations().filter((d) => !d.archived), [relations, overrides]) // eslint-disable-line react-hooks/exhaustive-deps
  const [label, setLabel] = useState("")
  const [steps, setSteps] = useState<string[]>(["", "", ""])
  const chain = steps.slice(0, steps.indexOf("") === -1 ? 3 : steps.indexOf(""))
  const setStep = (i: number) => (v: string) => setSteps(steps.map((x, j) => (j === i ? v : j > i && !v ? "" : x)))
  const [head, setHead] = useState("")
  const [unless, setUnless] = useState("")
  const [run, setRun] = useState<DryRun | null>(null)

  const draft = { label: label || "Rule", chain, head, unless: unless || undefined }
  const refusal = validateRule(draft, getRelationDef)
  const pick = (value: string, onChange: (v: string) => void, aria: string, blank = "…") => (
    <NativeSelect aria-label={aria} value={value} onChange={(e) => { onChange(e.target.value); setRun(null) }}>
      <option value="">{blank}</option>
      {defs.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label}
        </option>
      ))}
    </NativeSelect>
  )
  const dry = () => setRun(dryRunRule(makeRule(draft), tasks, buildLattice(allRelations())))
  const save = () => {
    const result = run ?? dryRunRule(makeRule(draft), tasks, buildLattice(allRelations()))
    if (result.fresh > DRY_RUN_ASK_OVER && !window.confirm(`This rule derives ${result.fresh} edges. Save it?`)) return
    addRule(makeRule({ ...draft, label: label.trim() || ruleSentence(draft, relationLabel) }))
    setLabel("")
    setSteps(["", "", ""])
    setHead("")
    setUnless("")
    setRun(null)
  }
  const title = (id: string) => itemTitleOrUntitled(tasks.find((t) => t.id === id))

  return (
    <div className="rel-rules" data-testid="rule-editor">
      <ul className="rel-list">
        {rules.map((r: RelationRule) => (
          <li key={r.id} className="rel-row rel-rule-row">
            <label>
              <input type="checkbox" checked={r.enabled} onChange={() => toggleRule(r.id)} aria-label={`Enable ${r.label}`} /> {r.label}
            </label>
            <span className="rel-scope">{ruleSentence(r, relationLabel)}</span>
            <button type="button" className="an-chip" onClick={() => removeRule(r.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="rel-rule-form">
        <input aria-label="Rule name" placeholder="Rule name" value={label} onChange={(e) => setLabel(e.target.value)} />
        <p>
          If ?a {pick(steps[0], setStep(0), "Step 1")} ?b
          {" and ?b "}
          {pick(steps[1], setStep(1), "Step 2", "— (stop)")} ?c
          {steps[1] ? (
            <>
              {" and ?c "}
              {pick(steps[2], setStep(2), "Step 3", "— (stop)")} ?d
            </>
          ) : null}
        </p>
        <p>
          then ?a {pick(head, setHead, "Head")} ?z, unless {pick(unless, setUnless, "Unless", "—")}
        </p>
        <p className="rel-note">
          {refusal ?? (run ? `Dry run: ${run.fresh} new edge${run.fresh === 1 ? "" : "s"} · ${run.known} already linked` : "Ready.")}
        </p>
        {run?.first.length ? (
          <ul className="rel-list">
            {run.first.map((p, i) => (
              <li key={i} className="rel-row rel-row-usage">
                {title(p.from)} {relationLabel(head)} {title(p.to)}
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className="an-chip" disabled={!!refusal} onClick={dry}>
          Dry run
        </button>{" "}
        <button type="button" className="an-chip" disabled={!!refusal} onClick={save}>
          Save rule
        </button>
      </div>
    </div>
  )
}
