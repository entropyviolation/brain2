/**
 * components/Lists/dialogs/list-properties/MembershipRulesEditor.tsx — List Settings → Rules
 *
 * Auto-add rules on the draft list (`List.membershipRules`, saved with Save
 * Changes). Each rule is a set of conditions joined by All / Any; items that
 * match any enabled rule join the list. A live preview shows what the draft
 * would pick up right now. The engine is `lib/list-membership-rules.ts`.
 */
"use client"

import { useMemo } from "react"
import { Plus, Trash2, X } from "lucide-react"
import type {
  AttributeDefinition,
  ItemTypeDefinition,
  List,
  ListMembershipRule,
  MembershipCondition,
} from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import {
  DATE_FIELD_LABELS,
  describeCondition,
  newMembershipRule,
  previewMembershipRules,
} from "@/lib/list-membership-rules"
import { HabitBarRocker } from "@/components/Home/Habits/habit-led-switch"
import { NativeSelect } from "@/components/ui/native-select"
import { allRelations } from "@/lib/relation-registry"

type Kind = MembershipCondition["kind"]

const KIND_LABELS: Record<Kind, string> = {
  type: "Item type",
  onLists: "On other lists",
  dateWithin: "Date within",
  attribute: "Attribute",
  tag: "Tag",
  done: "Done",
  link: "Link",
}

function blankCondition(kind: Kind): MembershipCondition {
  switch (kind) {
    case "type":
      return { kind, typeIds: [] }
    case "onLists":
      return { kind, listIds: [], mode: "any" }
    case "dateWithin":
      return { kind, field: "deadline", direction: "next", days: 7 }
    case "attribute":
      return { kind, attributeId: "", op: "is", value: "" }
    case "tag":
      return { kind, tags: [], mode: "any" }
    case "done":
      return { kind, done: false }
    case "link":
      return { kind, relation: "related", mode: "has" }
  }
}

/** Starting points a person could also have built by hand. */
const PRESETS: { label: string; build: () => ListMembershipRule }[] = [
  {
    label: "Due within a week",
    build: () => ({ ...newMembershipRule(), conditions: [{ kind: "dateWithin", field: "deadline", direction: "next", days: 7 }, { kind: "done", done: false }] }),
  },
  { label: "Every item of a type", build: () => ({ ...newMembershipRule(), conditions: [{ kind: "type", typeIds: [] }] }) },
  { label: "Everything on another list", build: () => ({ ...newMembershipRule(), conditions: [{ kind: "onLists", listIds: [], mode: "any" }] }) },
  { label: "Has a tag", build: () => ({ ...newMembershipRule(), conditions: [{ kind: "tag", tags: [], mode: "any" }] }) },
]

export function MembershipRulesEditor({
  list,
  onChange,
  types,
  attributes,
}: {
  list: List
  onChange: (list: List) => void
  types: ItemTypeDefinition[]
  /** Every attribute the vault knows (list schemas + item types), for conditions. */
  attributes: AttributeDefinition[]
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const rules = list.membershipRules ?? []
  const otherLists = useMemo(
    () => lists.filter((l) => l.id !== list.id && !isFolderAllItemsCategoryId(l.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [lists, list.id],
  )
  const preview = useMemo(() => previewMembershipRules(list, tasks, new Date()), [list, tasks])
  const dateAttrs = attributes.filter((a) => a.type === "datetime")
  const names = {
    list: (id: string) => lists.find((l) => l.id === id)?.name ?? id,
    type: (id: string) => types.find((t) => t.id === id)?.name ?? id,
    attr: (id: string) => attributes.find((a) => a.id === id)?.name ?? id,
  }

  const setRules = (next: ListMembershipRule[]) => onChange({ ...list, membershipRules: next.length ? next : undefined })
  const patchRule = (id: string, patch: Partial<ListMembershipRule>) => setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const patchCondition = (rule: ListMembershipRule, i: number, c: MembershipCondition) =>
    patchRule(rule.id, { conditions: rule.conditions.map((x, j) => (j === i ? c : x)) })

  const conditionEditor = (rule: ListMembershipRule, c: MembershipCondition, i: number) => {
    const set = (next: MembershipCondition) => patchCondition(rule, i, next)
    switch (c.kind) {
      case "type":
        return (
          <span className="lp-cond-chips">
            {types.map((t) => {
              const on = c.typeIds.includes(t.id as string)
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`lp-seg-key${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() =>
                    set({ ...c, typeIds: on ? c.typeIds.filter((x) => x !== t.id) : [...c.typeIds, t.id as string] })
                  }
                >
                  {t.name}
                </button>
              )
            })}
          </span>
        )
      case "onLists":
        return (
          <span className="lp-cond-fields">
            <NativeSelect className="lp-field lp-sel" value={c.mode} onChange={(e) => set({ ...c, mode: e.target.value as typeof c.mode })} aria-label="List match">
              <option value="any">is on any of</option>
              <option value="all">is on all of</option>
              <option value="none">is on none of</option>
            </NativeSelect>
            {c.listIds.map((id) => (
              <span key={id} className="lp-cond-chip">
                {names.list(id)}
                <button type="button" aria-label={`Remove ${names.list(id)}`} onClick={() => set({ ...c, listIds: c.listIds.filter((x) => x !== id) })}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <NativeSelect
              className="lp-field lp-sel"
              value=""
              aria-label="Add a list"
              onChange={(e) => e.target.value && set({ ...c, listIds: [...c.listIds, e.target.value] })}
            >
              <option value="">+ list…</option>
              {otherLists
                .filter((l) => !c.listIds.includes(l.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </NativeSelect>
          </span>
        )
      case "dateWithin":
        return (
          <span className="lp-cond-fields">
            <NativeSelect className="lp-field lp-sel" value={c.field} onChange={(e) => set({ ...c, field: e.target.value as typeof c.field })} aria-label="Date field">
              {Object.entries(DATE_FIELD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
              {dateAttrs.map((a) => (
                <option key={a.id} value={`attr:${a.id}`}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect className="lp-field lp-sel" value={c.direction} onChange={(e) => set({ ...c, direction: e.target.value as "next" | "past" })} aria-label="Direction">
              <option value="next">in the next</option>
              <option value="past">in the past</option>
            </NativeSelect>
            <input
              className="lp-field lp-num"
              type="number"
              min={0}
              value={c.days}
              onChange={(e) => set({ ...c, days: Math.max(0, Number(e.target.value) || 0) })}
              aria-label="Days"
            />
            <span className="lp-caption">days</span>
            {c.direction === "next" ? (
              <label className="lp-caption lp-inline">
                <input type="checkbox" checked={c.includeOverdue === true} onChange={(e) => set({ ...c, includeOverdue: e.target.checked || undefined })} />
                or overdue
              </label>
            ) : null}
          </span>
        )
      case "attribute": {
        const needsValue = c.op !== "isSet" && c.op !== "isEmpty"
        const def = attributes.find((a) => a.id === c.attributeId)
        return (
          <span className="lp-cond-fields">
            <NativeSelect className="lp-field lp-sel" value={c.attributeId} onChange={(e) => set({ ...c, attributeId: e.target.value })} aria-label="Attribute">
              <option value="">Choose attribute…</option>
              {attributes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.type}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect className="lp-field lp-sel" value={c.op} onChange={(e) => set({ ...c, op: e.target.value as typeof c.op })} aria-label="Comparison">
              <option value="is">is</option>
              <option value="isNot">is not</option>
              <option value="contains">contains</option>
              <option value="gt">is more than</option>
              <option value="lt">is less than</option>
              <option value="isSet">is set</option>
              <option value="isEmpty">is empty</option>
            </NativeSelect>
            {needsValue ? (
              def?.type === "selection" && def.options?.length ? (
                <NativeSelect className="lp-field lp-sel" value={String(c.value ?? "")} onChange={(e) => set({ ...c, value: e.target.value })} aria-label="Value">
                  <option value="">…</option>
                  {def.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <input
                  className="lp-field lp-val"
                  type={c.op === "gt" || c.op === "lt" ? "number" : "text"}
                  value={String(c.value ?? "")}
                  onChange={(e) => set({ ...c, value: e.target.value })}
                  aria-label="Value"
                  placeholder="value"
                />
              )
            ) : null}
          </span>
        )
      }
      case "tag":
        return (
          <span className="lp-cond-fields">
            <NativeSelect className="lp-field lp-sel" value={c.mode} onChange={(e) => set({ ...c, mode: e.target.value as typeof c.mode })} aria-label="Tag match">
              <option value="any">has any of</option>
              <option value="all">has all of</option>
              <option value="none">has none of</option>
            </NativeSelect>
            <input
              className="lp-field lp-val"
              defaultValue={c.tags.join(", ")}
              onBlur={(e) => set({ ...c, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
              placeholder="tag, another tag"
              aria-label="Tags"
            />
          </span>
        )
      case "done":
        return (
          <NativeSelect className="lp-field lp-sel" value={c.done ? "done" : "open"} onChange={(e) => set({ ...c, done: e.target.value === "done" })} aria-label="Done state">
            <option value="open">is not done</option>
            <option value="done">is done</option>
          </NativeSelect>
        )
      case "link":
        return (
          <span className="lp-cond-chips">
            <NativeSelect className="lp-field lp-sel" value={c.mode} onChange={(e) => set({ ...c, mode: e.target.value as "has" | "hasNot" })} aria-label="Link mode">
              <option value="has">has</option>
              <option value="hasNot">has no</option>
            </NativeSelect>
            <NativeSelect className="lp-field lp-sel" value={c.relation} onChange={(e) => set({ ...c, relation: e.target.value })} aria-label="Link relation">
              {allRelations().filter((d) => !d.archived).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect className="lp-field lp-sel" value={c.targetTypeIds?.[0] ?? ""} onChange={(e) => set({ ...c, targetTypeIds: e.target.value ? [e.target.value] : undefined })} aria-label="Link target type">
              <option value="">to any item</option>
              {types.map((t) => (
                <option key={t.id} value={t.id as string}>
                  to any {t.name}
                </option>
              ))}
            </NativeSelect>
          </span>
        )
    }
  }

  return (
    <div className="lp-mrules" data-testid="membership-rules">
      {rules.length === 0 ? (
        <div className="lp-mrules-empty">
          <p className="lp-caption" style={{ margin: 0 }}>
            No auto-add rules. Items join this list only when you add them, or through a connected list.
          </p>
        </div>
      ) : null}

      {rules.map((rule, ri) => (
        <div key={rule.id} className={`lp-mrule${rule.enabled === false ? " is-off" : ""}`}>
          <div className="lp-mrule-head">
            <HabitBarRocker
              checked={rule.enabled !== false}
              onCheckedChange={(on) => patchRule(rule.id, { enabled: on ? undefined : false })}
              label={`Rule ${ri + 1}`}
            />
            <span className="lp-caption">Add items that match</span>
            <NativeSelect
              className="lp-field lp-sel"
              value={rule.match}
              onChange={(e) => patchRule(rule.id, { match: e.target.value as "all" | "any" })}
              aria-label={`Rule ${ri + 1} match`}
            >
              <option value="all">all</option>
              <option value="any">any</option>
            </NativeSelect>
            <span className="lp-caption">of these:</span>
            <button type="button" className="lp-icon-key" aria-label={`Delete rule ${ri + 1}`} onClick={() => setRules(rules.filter((r) => r.id !== rule.id))}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {rule.conditions.map((c, i) => (
            <div key={i} className="lp-cond">
              <NativeSelect
                className="lp-field lp-sel lp-cond-kind"
                value={c.kind}
                onChange={(e) => patchCondition(rule, i, blankCondition(e.target.value as Kind))}
                aria-label="Condition"
              >
                {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </NativeSelect>
              {conditionEditor(rule, c, i)}
              <button
                type="button"
                className="lp-icon-key"
                aria-label="Remove condition"
                onClick={() => patchRule(rule.id, { conditions: rule.conditions.filter((_, j) => j !== i) })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="lp-mrule-foot">
            <button type="button" className="lp-mini-key" onClick={() => patchRule(rule.id, { conditions: [...rule.conditions, blankCondition("type")] })}>
              + Condition
            </button>
            <span className="lp-caption lp-mrule-reads">
              {rule.conditions.length
                ? rule.conditions.map((c) => describeCondition(c, names)).join(rule.match === "any" ? " · or · " : " · and · ")
                : "No conditions yet — an empty rule adds nothing."}
            </span>
          </div>
        </div>
      ))}

      <div className="lp-mrules-add">
        <button type="button" className="lp-mini-key" onClick={() => setRules([...rules, newMembershipRule()])}>
          <Plus className="inline h-3 w-3" /> Rule
        </button>
        <span className="lp-caption">or start from</span>
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="lp-mini-key is-preset" onClick={() => setRules([...rules, p.build()])}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="lp-beh-row">
        <HabitBarRocker
          checked={list.membershipRulesSync === true}
          onCheckedChange={(on) => onChange({ ...list, membershipRulesSync: on ? true : undefined })}
          label="Remove when it stops matching"
        />
        <p className="lp-caption">
          Off: once an item joins, it stays. On: an item a rule added leaves again when it no longer matches (good
          for “Due within a week”). Items you added by hand never leave this way, and an item you take off is never
          put back.
        </p>
      </div>

      <div className="lp-mpreview" aria-live="polite">
        <span className={`lp-lamp${preview.matching.length ? " is-green" : ""}`} aria-hidden />
        <span>
          <b>{preview.matching.length}</b> item{preview.matching.length === 1 ? "" : "s"} match now · {preview.alreadyOn} already
          here · <b>{preview.willJoin}</b> join on Save
          {preview.excluded ? ` · ${preview.excluded} you took off stay off` : ""}
        </span>
        {preview.matching.length ? (
          <span className="lp-mpreview-names">
            {preview.matching
              .slice(0, 8)
              .map((t) => itemTitleOrUntitled(t))
              .join(" · ")}
            {preview.matching.length > 8 ? ` · +${preview.matching.length - 8} more` : ""}
          </span>
        ) : null}
      </div>
    </div>
  )
}
