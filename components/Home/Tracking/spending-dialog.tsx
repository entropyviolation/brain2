"use client"

/**
 * components/Home/Tracking/spending-dialog.tsx — Spending detail, opened from the Spent shelf.
 *
 * Three tabs: This day, Budget (`budget-panel.tsx`, the month across sources), and
 * Import. A statement (PDF, CSV, or text) is read in the browser and previewed:
 * rename, flip earning/spending, untick. Spending is logged on the Tracking log;
 * earnings go to the budget store. Lines already logged start unticked. Imported
 * lines carry the statement date and no clock time.
 */
import { useMemo, useRef, useState, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BudgetPanel } from "@/components/Home/Tracking/budget-panel"
import { useBudgetStore } from "@/lib/budget-store"
import { readStatementFile, type StatementLine } from "@/lib/bank-statement"
import { formatSpendAmount, spendSourceOptions } from "@/lib/spend"
import { submitTrackingLog } from "@/components/Home/Tracking/tracking-log-model"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

interface Draft extends StatementLine {
  id: string
  keep: boolean
  duplicate: boolean
}

export function SpendingDialog({
  open,
  onOpenChange,
  dayLabel,
  ledger,
  list,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dayLabel: string
  /** The day's spend summary bars. */
  ledger: ReactNode
  /** The day's spend rows. */
  list: ReactNode
}) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const sources = useMemo(() => spendSourceOptions(entries), [entries])
  const [source, setSource] = useState("Card")
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<"day" | "budget" | "import">("day")
  const budgetLines = useBudgetStore((s) => s.lines)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const known = useMemo(() => {
    const set = new Set<string>()
    for (const entry of entries) {
      if (typeof entry.spendAmount !== "number") continue
      set.add(`${entry.date}|${entry.spendAmount}|${(entry.spendOn ?? entry.title ?? "").trim().toLowerCase()}`)
    }
    for (const l of budgetLines) set.add(`${l.date}|${l.cents}|${l.name.trim().toLowerCase()}`)
    return set
  }, [entries, budgetLines])

  const load = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setStatus(`Reading ${file.name}…`)
    try {
      const lines = await readStatementFile(file)
      setDrafts(
        lines.map((line, i) => {
          const duplicate = known.has(`${line.date}|${line.cents}|${line.name.trim().toLowerCase()}`)
          return { ...line, id: `${i}`, keep: !duplicate, duplicate }
        }),
      )
      setStatus(lines.length ? `${lines.length} spending lines found in ${file.name}.` : `No spending lines found in ${file.name}.`)
    } catch {
      setDrafts([])
      setStatus(`Could not read ${file.name}.`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const patch = (id: string, next: Partial<Draft>) =>
    setDrafts((rows) => rows.map((row) => (row.id === id ? { ...row, ...next } : row)))

  const chosen = drafts.filter((d) => d.keep && d.name.trim())
  const chosenTotal = chosen.reduce((sum, d) => sum + d.cents, 0)

  const importChosen = () => {
    let added = 0
    const earnings = chosen.filter((d) => d.kind === "earning")
    for (const d of chosen.filter((d) => d.kind === "spend")) {
      const id = submitTrackingLog({
        date: d.date,
        title: d.name,
        mode: "spend",
        clock: "unknown",
        minute: 0,
        spendAmount: d.cents,
        spendOn: d.name,
        spendSource: source,
      })
      if (id) added += 1
    }
    added += useBudgetStore.getState().addLines(earnings.map((d) => ({ date: d.date, name: d.name, cents: d.cents, kind: "earning" as const, source })))
    setDrafts([])
    setStatus(`Imported ${added} ${added === 1 ? "line" : "lines"} as ${source}. See them in Budget.`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="trk95 trk-dialog trk-spending sm:max-w-2xl max-h-[85vh] overflow-y-auto"
        data-ui-name="Spending"
        data-ui-docs="components/Home/Tracking/README.md"
      >
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>Spending</DialogTitle>
          <DialogDescription>{dayLabel}. Spending, earnings, and statements in one place.</DialogDescription>
        </DialogHeader>

        <div className="trk-spending-tabs" role="tablist" aria-label="Spending views">
          {([["day", "This day"], ["budget", "🐷 Budget"], ["import", "Import statement"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "day" ? (
          <section className="trk-spending-day" aria-label="This day">
            {ledger}
            {list}
          </section>
        ) : null}

        {tab === "budget" ? <BudgetPanel sources={sources} /> : null}

        {tab === "import" ? (
        <section className="trk-spending-import" aria-label="Import a statement">
                    <div className="trk-spending-import-bar">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
              aria-label="Bank statement file"
              disabled={busy}
              onChange={(event) => void load(event.target.files?.[0])}
            />
            <label>
              Source
              <input list="trk-spending-sources" value={source} onChange={(event) => setSource(event.target.value)} />
              <datalist id="trk-spending-sources">
                {sources.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
          </div>
          <p className="trk-spending-note" role="status">
            {status || "PDF, CSV, or text. It is read in this browser and never uploaded."}
          </p>

          {drafts.length > 0 ? (
            <>
              <ul className="trk-spending-rows">
                {drafts.map((d) => (
                  <li key={d.id} data-keep={d.keep ? "true" : "false"} title={d.raw}>
                    <input
                      type="checkbox"
                      checked={d.keep}
                      aria-label={`Import ${d.name}`}
                      onChange={(event) => patch(d.id, { keep: event.target.checked })}
                    />
                    <span className="trk-spending-date">{d.date}</span>
                    <input
                      className="trk-spending-name"
                      value={d.name}
                      aria-label="What it was spent on"
                      onChange={(event) => patch(d.id, { name: event.target.value })}
                    />
                    <button
                      type="button"
                      className="trk-spending-kind"
                      title="Flip earning / spending"
                      onClick={() => patch(d.id, { kind: d.kind === "earning" ? "spend" : "earning" })}
                    >
                      {d.kind === "earning" ? "🌱" : "🍩"}
                    </button>
                    <span className="trk-spending-amount">{formatSpendAmount(d.cents)}</span>
                    {d.duplicate ? <em>already logged</em> : null}
                  </li>
                ))}
              </ul>
              <div className="trk-spending-foot">
                <span>
                  {chosen.length} of {drafts.length} selected · {formatSpendAmount(chosenTotal)}
                </span>
                <button type="button" onClick={importChosen} disabled={chosen.length === 0}>
                  Import {chosen.length}
                </button>
              </div>
            </>
          ) : null}
        </section>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
