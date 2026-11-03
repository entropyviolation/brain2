"use client"

/**
 * components/Home/Tracking/tracking-log/budget-panel.tsx — The Budget tab of the Spending dialog.
 *
 * One month of money in and out from every source. Spending comes from the
 * Tracking log (edits write back to those entries); earnings and hand-added
 * lines come from `lib/budget-store.ts`. Filter by source, sort, edit in place.
 */
import { useMemo, useState } from "react"
import { addMonths, format, subMonths } from "date-fns"
import { useBudgetStore } from "@/lib/budget-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { formatSpendAmount, isSpendEntry, parseSpendAmount, spendAmountInput } from "@/lib/spend"
import { breakdown, budgetRows, monthTotals, type BudgetRow } from "@/lib/budget-math"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

type Row = BudgetRow
type When = "both" | "past" | "ahead"
type SortKey = "date" | "amount" | "source" | "name"

const SORTS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount" },
  { key: "source", label: "Source" },
  { key: "name", label: "Name" },
]

function mood(net: number, earned: number): { face: string; line: string } {
  if (earned === 0 && net === 0) return { face: "🐷", line: "Nothing in the piggy bank yet." }
  if (net > 0) return { face: "🐽", line: "Piggy is happy. More came in than went out." }
  if (net === 0) return { face: "🐷", line: "Dead even this month." }
  return { face: "🥺", line: "Piggy is nervous. More went out than came in." }
}

export function BudgetPanel({ sources }: { sources: string[] }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const updateEntry = useTimeTrackingStore((s) => s.updateEntry)
  const removeEntry = useTimeTrackingStore((s) => s.removeEntry)
  const lines = useBudgetStore((s) => s.lines)
  const { addLines, updateLine, removeLine } = useBudgetStore.getState()

  const [month, setMonth] = useState(() => new Date())
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [when, setWhen] = useState<When>("both")
  const [openId, setOpenId] = useState<string | null>(null)
  const tasks = useTaskStore((s) => s.tasks)
  const itemTitle = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks])
  const itemByTitle = useMemo(() => new Map(tasks.map((t) => [t.title, t.id])), [tasks])
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [desc, setDesc] = useState(true)
  const [draft, setDraft] = useState({ name: "", amount: "", source: "Account", kind: "earning" as Row["kind"], category: "", expected: false, certainty: "sure" as NonNullable<Row["certainty"]>, date: formatLocalDateKey(new Date()) })

  const monthKey = formatLocalDateKey(month).slice(0, 7)

  const every = useMemo(() => budgetRows(entries, lines), [entries, lines])
  const all = useMemo(() => every.filter((r) => r.date.startsWith(monthKey)), [every, monthKey])
  const months = useMemo(() => {
    const out: { key: string; label: string; earned: number; spent: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(month, i)
      const key = formatLocalDateKey(m).slice(0, 7)
      const t = monthTotals(every, key)
      out.push({ key, label: format(m, "MMM"), earned: t.earned, spent: t.spent })
    }
    return out
  }, [every, month])
  const monthMax = Math.max(1, ...months.flatMap((m) => [m.earned, m.spent]))
  const spendGroups = useMemo(() => breakdown(all, "spend", "category"), [all])
  const earnGroups = useMemo(() => breakdown(all, "earning", "source"), [all])

  const sourceTotals = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>()
    for (const r of all) {
      const t = map.get(r.source) ?? { in: 0, out: 0 }
      if (r.kind === "earning") t.in += r.cents
      else t.out += r.cents
      map.set(r.source, t)
    }
    return [...map.entries()].sort((a, b) => b[1].in + b[1].out - (a[1].in + a[1].out))
  }, [all])

  const shown = useMemo(() => {
    const rows = all.filter((r) => !hidden.has(r.source) && (when === "both" || (when === "ahead") === Boolean(r.expected)))
    const dir = desc ? -1 : 1
    rows.sort((a, b) => {
      const by = sortKey === "amount" ? a.cents - b.cents : sortKey === "date" ? a.date.localeCompare(b.date) : String(a[sortKey]).localeCompare(String(b[sortKey]))
      return by * dir || a.date.localeCompare(b.date)
    })
    return rows
  }, [all, hidden, sortKey, desc, when])

  const got = shown.filter((r) => !r.expected)
  const earned = got.filter((r) => r.kind === "earning").reduce((n, r) => n + r.cents, 0)
  const spent = got.filter((r) => r.kind === "spend").reduce((n, r) => n + r.cents, 0)
  const ahead = shown.filter((r) => r.expected)
  const aheadNet = (sureOnly: boolean) =>
    ahead.filter((r) => !sureOnly || r.certainty === "sure").reduce((n, r) => n + (r.kind === "earning" ? r.cents : -r.cents), 0)
  const net = earned - spent
  const { face, line } = mood(net, earned)
  const share = earned + spent > 0 ? (earned / (earned + spent)) * 100 : 50

  const edit = (row: Row, patch: Partial<Pick<Row, "name" | "cents" | "source" | "kind" | "notes" | "account" | "itemId">>) => {
    if (row.origin === "budget") {
      updateLine(row.id, patch)
      return
    }
    updateEntry(row.id, {
      ...(patch.notes != null ? { notes: patch.notes } : {}),
      ...(patch.name != null ? { spendOn: patch.name, title: patch.name } : {}),
      ...(patch.cents != null ? { spendAmount: patch.cents } : {}),
      ...(patch.source != null ? { spendSource: patch.source } : {}),
    })
  }

  const amountOk = draft.amount.trim() === "" || parseSpendAmount(draft.amount) != null
  const addDraft = () => {
    const cents = parseSpendAmount(draft.amount)
    if (cents == null || !draft.name.trim()) return
    addLines([{ date: draft.expected ? draft.date : formatLocalDateKey(new Date()), name: draft.name, cents, source: draft.source || "Account", kind: draft.kind, category: draft.category, ...(draft.expected ? { status: "expected" as const, certainty: draft.certainty } : {}) }])
    setDraft({ ...draft, name: "", amount: "" })
  }

  const sort = (key: SortKey) => {
    if (key === sortKey) setDesc(!desc)
    else {
      setSortKey(key)
      setDesc(key !== "name" && key !== "source")
    }
  }

  return (
    <section className="trk-budget" aria-label="Budget">
      <div className="trk-budget-nav">
        <button type="button" onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month">‹</button>
        <strong>{format(month, "MMMM yyyy")}</strong>
        <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">›</button>
      </div>

      <div className="trk-budget-sorts" role="toolbar" aria-label="Past or ahead">
        {(["both", "past", "ahead"] as const).map((w) => (
          <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)}>
            {w === "both" ? "Both" : w === "past" ? "Received" : "🔮 Ahead"}
          </button>
        ))}
      </div>

      <div className="trk-budget-hero">
        <span className="trk-budget-face" aria-hidden>{face}</span>
        <div>
          <div className="trk-budget-net" data-neg={net < 0 ? "true" : "false"}>
            {net < 0 ? "-" : "+"}
            {formatSpendAmount(Math.abs(net))}
          </div>
          <p>{line}</p>
        </div>
      </div>
      <div className="trk-budget-bar" role="img" aria-label={`Earned ${formatSpendAmount(earned)}, spent ${formatSpendAmount(spent)}`}>
        <i style={{ width: `${share}%` }} />
      </div>
      <div className="trk-budget-legend">
        <span>🌱 Earned {formatSpendAmount(earned)}</span>
        <span>🍩 Spent {formatSpendAmount(spent)}</span>
      </div>
      {ahead.length > 0 ? (
        <p className="trk-budget-ahead">
          🔮 Ahead: {formatSpendAmount(Math.abs(aheadNet(true)))} {aheadNet(true) < 0 ? "out" : "in"} for sure · with maybes {formatSpendAmount(Math.abs(aheadNet(false)))} {aheadNet(false) < 0 ? "out" : "in"}
        </p>
      ) : null}

      <div className="trk-budget-chips" aria-label="Sources">
        {sourceTotals.map(([source, t]) => (
          <button
            key={source}
            type="button"
            aria-pressed={!hidden.has(source)}
            onClick={() => {
              const next = new Set(hidden)
              if (next.has(source)) next.delete(source)
              else next.add(source)
              setHidden(next)
            }}
          >
            {source}
            <small>
              {t.in ? `+${formatSpendAmount(t.in)} ` : ""}
              {t.out ? `-${formatSpendAmount(t.out)}` : ""}
            </small>
          </button>
        ))}
      </div>

      <div className="trk-budget-months" aria-label="Month by month">
        {months.map((m) => (
          <button key={m.key} type="button" aria-pressed={m.key === monthKey} onClick={() => setMonth(new Date(`${m.key}-15T12:00:00`))} title={`${m.label}: earned ${formatSpendAmount(m.earned)}, spent ${formatSpendAmount(m.spent)}`}>
            <span className="trk-budget-mbars">
              <i data-k="in" style={{ height: `${(m.earned / monthMax) * 100}%` }} />
              <i data-k="out" style={{ height: `${(m.spent / monthMax) * 100}%` }} />
            </span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="trk-budget-breaks">
        {[["Spent by category", spendGroups], ["Earned by source", earnGroups]].map(([title, groups]) => (
          <div key={title as string}>
            <h4>{title as string}</h4>
            {(groups as { label: string; cents: number }[]).slice(0, 5).map((g) => (
              <div key={g.label} className="trk-budget-brk">
                <span>{g.label}</span>
                <i style={{ width: `${(g.cents / (groups as { cents: number }[])[0].cents) * 100}%` }} />
                <b>{formatSpendAmount(g.cents)}</b>
              </div>
            ))}
            {(groups as unknown[]).length === 0 ? <small>Nothing yet.</small> : null}
          </div>
        ))}
      </div>

      <div className="trk-budget-sorts" role="toolbar" aria-label="Sort">
        Sort
        {SORTS.map((s) => (
          <button key={s.key} type="button" aria-pressed={sortKey === s.key} onClick={() => sort(s.key)}>
            {s.label}
            {sortKey === s.key ? (desc ? " ↓" : " ↑") : ""}
          </button>
        ))}
      </div>

      <ul className="trk-budget-rows">
        {shown.length === 0 ? <li className="trk-budget-empty">Nothing here this month. Import a statement or add a line below.</li> : null}
        {shown.map((r) => (
          <li key={r.id} data-kind={r.kind} data-expected={r.expected ? "true" : "false"}>
            <span aria-hidden>{r.expected ? "🔮" : r.kind === "earning" ? "🌱" : "🍩"}</span>
            <span className="trk-spending-date">{r.date.slice(5)}</span>
            <input defaultValue={r.name} aria-label="Name" onBlur={(e) => e.target.value.trim() && e.target.value !== r.name && edit(r, { name: e.target.value })} />
            <input
              className="trk-budget-src"
              list="trk-spending-sources"
              defaultValue={r.source}
              aria-label="Source"
              onBlur={(e) => e.target.value.trim() && e.target.value !== r.source && edit(r, { source: e.target.value })}
            />
            <input
              className="trk-budget-amt"
              defaultValue={spendAmountInput(r.cents)}
              aria-label="Amount"
              onBlur={(e) => {
                const c = parseSpendAmount(e.target.value)
                if (c != null && c !== r.cents) edit(r, { cents: c })
              }}
            />
            {r.origin === "budget" ? (
              <button type="button" title="Flip earning / spending" onClick={() => edit(r, { kind: r.kind === "earning" ? "spend" : "earning" })}>⇅</button>
            ) : (
              <span title="Logged on the Tracking log" aria-hidden>📓</span>
            )}
            <button type="button" title="Notes, account, attach to an item" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)}>⋯</button>
            {r.expected ? (
              <button type="button" title="Got it / paid: move to received today" onClick={() => updateLine(r.id, { status: "received", certainty: undefined, date: formatLocalDateKey(new Date()) })}>✓</button>
            ) : null}
            <button type="button" aria-label={`Delete ${r.name}`} onClick={() => (r.origin === "budget" ? removeLine(r.id) : removeEntry(r.id))}>×</button>
            {openId === r.id ? (
              <div className="trk-budget-more">
                <input defaultValue={r.notes ?? ""} placeholder="Notes" aria-label="Notes" onBlur={(e) => e.target.value !== (r.notes ?? "") && edit(r, { notes: e.target.value })} />
                {r.origin === "budget" ? (
                  <>
                    <input defaultValue={r.category ?? ""} placeholder="Category" aria-label="Category" onBlur={(e) => e.target.value !== (r.category ?? "") && updateLine(r.id, { category: e.target.value })} />
                    <input defaultValue={r.account ?? ""} placeholder="Account" aria-label="Account" list="trk-spending-sources" onBlur={(e) => e.target.value !== (r.account ?? "") && edit(r, { account: e.target.value })} />
                    <input
                      defaultValue={r.itemId ? (itemTitle.get(r.itemId) ?? "") : ""}
                      placeholder="Attach to a project, trip…"
                      aria-label="Attached item"
                      list="trk-budget-items"
                      onBlur={(e) => edit(r, { itemId: itemByTitle.get(e.target.value) ?? "" })}
                    />
                  </>
                ) : (
                  <small>Logged on the Tracking log. Account and attaching come with the budget lines.</small>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="trk-budget-add">
        <button type="button" onClick={() => setDraft({ ...draft, kind: draft.kind === "earning" ? "spend" : "earning" })} title="Earning or spending">
          {draft.kind === "earning" ? "🌱 Earning" : "🍩 Spending"}
        </button>
        <button type="button" aria-pressed={draft.expected} title="Money you expect, not yet received" onClick={() => setDraft({ ...draft, expected: !draft.expected })}>
          🔮 {draft.expected ? "Expected" : "Received"}
        </button>
        {draft.expected ? (
          <select value={draft.certainty} aria-label="How sure" onChange={(e) => setDraft({ ...draft, certainty: e.target.value as typeof draft.certainty })}>
            <option value="sure">sure</option>
            <option value="likely">likely</option>
            <option value="maybe">maybe</option>
          </select>
        ) : null}
        {draft.expected ? <input type="date" value={draft.date} aria-label="Due date" onChange={(e) => setDraft({ ...draft, date: e.target.value })} /> : null}
        <input value={draft.name} placeholder="What" aria-label="New line name" onKeyDown={(e) => e.key === "Enter" && addDraft()} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className="trk-budget-src" value={draft.category} placeholder="Category" aria-label="New line category" onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
        <input className="trk-budget-src" list="trk-spending-sources" value={draft.source} aria-label="New line source" onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
        <input className="trk-budget-amt" value={draft.amount} placeholder="0.00" aria-label="New line amount" onChange={(e) => setDraft({ ...draft, amount: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addDraft()} />
        <button type="button" onClick={addDraft} disabled={parseSpendAmount(draft.amount) == null || !draft.name.trim()}>Add</button>
      </div>
      {!amountOk ? <p className="trk-budget-warn" role="alert">That amount does not fit. Use dollars and cents, up to about $90 trillion.</p> : null}
      <datalist id="trk-budget-items">
        {tasks.slice(0, 300).map((t) => (
          <option key={t.id} value={t.title} />
        ))}
      </datalist>
      <datalist id="trk-spending-sources">
        {sources.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </section>
  )
}
