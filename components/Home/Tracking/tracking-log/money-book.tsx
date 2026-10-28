"use client"

/**
 * components/Home/Tracking/tracking-log/money-book.tsx — The money book
 *
 * One composer, then the shelves: the day's spending, the month, accounts,
 * debts, bills, a budget, plans, gigs, and a statement. The Tracking log Spent
 * shelf and the Money widget both open this. Spending still writes the
 * Tracking log. Everything else writes `brain2-budget`.
 */
import { useMemo, useRef, useState, type ReactNode } from "react"
import { BudgetPanel } from "@/components/Home/Tracking/tracking-log/budget-panel"
import { LogShelfRangeBar, useLogShelfRange } from "@/components/Home/Tracking/tracking-log/log-shelf-dialog"
import { entriesForLogShelf, logRowWhenLabel, submitTrackingLog } from "@/components/Home/Tracking/tracking-log-model"
import { budgetRows } from "@/lib/budget-math"
import { useBudgetStore, type AccountKind, type BillCadence, type GigStatus } from "@/lib/budget-store"
import { parseStatementCsv, parseStatementText, readStatementFile, type StatementLine } from "@/lib/bank-statement"
import { formatLocalDateKey } from "@/lib/date-utils"
import { applyMoneyPhrase } from "@/lib/money-apply"
import { envelopeReading, gigExpectedPay, nextBillDate } from "@/lib/money-book"
import { parseMoneyPhrase } from "@/lib/money-parse"
import { formatSpendAmount, parseSpendAmount, spendSourceOptions } from "@/lib/spend"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

type Tab = "day" | "month" | "accounts" | "debts" | "bills" | "budget" | "ahead" | "gigs" | "statement"

const TABS: { id: Tab; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
  { id: "accounts", label: "Accounts" },
  { id: "debts", label: "Debts" },
  { id: "bills", label: "Bills" },
  { id: "budget", label: "Budget" },
  { id: "ahead", label: "Ahead" },
  { id: "gigs", label: "Gigs" },
  { id: "statement", label: "Statement" },
]

interface Draft extends StatementLine {
  id: string
  keep: boolean
  duplicate: boolean
}

export function MoneyBook({
  open,
  anchor = new Date(),
  ledger,
}: {
  open: boolean
  anchor?: Date
  ledger?: ReactNode
}) {
  const date = formatLocalDateKey(anchor)
  const entries = useTimeTrackingStore((s) => s.entries)
  const lines = useBudgetStore((s) => s.lines)
  const accounts = useBudgetStore((s) => s.accounts)
  const debts = useBudgetStore((s) => s.debts)
  const bills = useBudgetStore((s) => s.bills)
  const envelopes = useBudgetStore((s) => s.envelopes)
  const gigs = useBudgetStore((s) => s.gigs)
  const statements = useBudgetStore((s) => s.statements)
  const sources = useMemo(() => spendSourceOptions(entries), [entries])
  const spendRows = useMemo(() => entries.filter((entry) => typeof entry.spendAmount === "number"), [entries])
  const monthKey = date.slice(0, 7)
  const rows = useMemo(() => budgetRows(entries, lines), [entries, lines])
  const [tab, setTab] = useState<Tab>("day")
  const [line, setLine] = useState("")
  const [status, setStatus] = useState("")
  const shelf = useLogShelfRange(open, anchor)
  const shown = entriesForLogShelf(spendRows, shelf.bounds)

  const saveLine = () => {
    const parsed = parseMoneyPhrase(line, date)
    if (!parsed.ok) {
      setStatus(parsed.reason === "blank" ? "" : parsed.reason === "no-name" ? "No name in that line." : "No amount in that line.")
      return
    }
    setStatus(applyMoneyPhrase(parsed.phrase))
    setLine("")
    if (parsed.phrase.type === "debt") setTab("debts")
    else if (parsed.phrase.type === "bill") setTab("bills")
    else if (parsed.phrase.type === "envelope") setTab("budget")
    else if (parsed.phrase.type === "plan") setTab("ahead")
    else if (parsed.phrase.type === "gig") setTab("gigs")
    else if (parsed.phrase.type === "account") setTab("accounts")
    else if (parsed.phrase.type === "earning") setTab("month")
  }

  return (
    <div className="trk-money" data-ui-name="Money book">
      <form
        className="trk-money-line"
        onSubmit={(event) => {
          event.preventDefault()
          saveLine()
        }}
      >
        <label>
          Line
          <input
            aria-label="Money line"
            value={line}
            placeholder="earned $970 cash"
            onChange={(event) => setLine(event.target.value)}
          />
        </label>
        <button type="submit" className="trk-keycap" data-no95>Save</button>
      </form>
      <p className="trk-spending-note" role="status">
        {status}
      </p>
      <div className="trk-money-tabs" role="tablist" aria-label="Money book">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" className="trk-keycap" data-no95 aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "day" ? (
        <section className="trk-spending-day" aria-label="This day">
          <LogShelfRangeBar range={shelf.range} onRange={shelf.setRange} from={shelf.from} to={shelf.to} onFrom={shelf.setFrom} onTo={shelf.setTo} anchor={anchor} />
          {ledger}
          {shown.length === 0 ? (
            <p className="trk-spending-note">{shelf.range === "today" ? "Nothing spent this day." : "Nothing spent in this range."}</p>
          ) : (
            <ul className="trk-spending-rows">
              {shown.map((row) => {
                const when = logRowWhenLabel(row, { showDate: shelf.showDate })
                return (
                  <li key={row.id}>
                    {shelf.showDate ? <span className="trk-spending-date">{when.when || when.badge}</span> : null}
                    <span className="trk-spending-name">{row.spendOn?.trim() || row.title?.trim() || "Untitled"}</span>
                    <span className="trk-spending-date">{row.spendSource?.trim() || ""}</span>
                    <span className="trk-spending-amount">{typeof row.spendAmount === "number" ? formatSpendAmount(row.spendAmount) : ""}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "month" ? <BudgetPanel sources={sources} /> : null}
      {tab === "accounts" ? <AccountsPanel accounts={accounts} /> : null}
      {tab === "debts" ? <DebtsPanel debts={debts} /> : null}
      {tab === "bills" ? <BillsPanel bills={bills} fromKey={date} /> : null}
      {tab === "budget" ? <BudgetLimits envelopes={envelopes} rows={rows} monthKey={monthKey} /> : null}
      {tab === "ahead" ? <AheadPanel lines={lines.filter((row) => row.status === "expected")} date={date} /> : null}
      {tab === "gigs" ? <GigsPanel gigs={gigs} /> : null}
      {tab === "statement" ? <StatementPanel sources={sources} entries={entries} lines={lines} statements={statements} /> : null}
    </div>
  )
}

function AccountsPanel({ accounts }: { accounts: { id: string; name: string; kind: AccountKind }[] }) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<AccountKind>("bank")
  return (
    <section aria-label="Accounts">
      <p className="trk-spending-note">Cash, bank, and card. A person you owe is a debt.</p>
      <form
        className="trk-money-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          useBudgetStore.getState().ensureAccount({ name: name.trim(), kind })
          setName("")
        }}
      >
        <input aria-label="Account name" value={name} onChange={(event) => setName(event.target.value)} />
        <select aria-label="Account kind" value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
          <option value="cash">Cash</option>
          <option value="bank">Bank</option>
          <option value="card">Card</option>
        </select>
        <button type="submit" className="trk-keycap" data-no95>Add account</button>
      </form>
      {accounts.length === 0 ? <p className="trk-spending-note">No accounts yet.</p> : (
        <ul className="trk-spending-rows">
          {accounts.map((account) => (
            <li key={account.id}>
              <span className="trk-spending-name">{account.name}</span>
              <span className="trk-spending-date">{account.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DebtsPanel({ debts }: { debts: { id: string; who: string; direction: "owe" | "owed"; cents: number }[] }) {
  const [who, setWho] = useState("")
  const [amount, setAmount] = useState("")
  const [direction, setDirection] = useState<"owe" | "owed">("owe")
  const cents = parseSpendAmount(amount)
  return (
    <section aria-label="Debts">
      <p className="trk-spending-note">Debts stay off the account list.</p>
      <form
        className="trk-money-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!who.trim() || cents == null) return
          useBudgetStore.getState().addDebt({ who: who.trim(), direction, cents })
          setWho("")
          setAmount("")
        }}
      >
        <input aria-label="Who" value={who} onChange={(event) => setWho(event.target.value)} />
        <input aria-label="Debt amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <select aria-label="Debt direction" value={direction} onChange={(event) => setDirection(event.target.value as "owe" | "owed")}>
          <option value="owe">You owe</option>
          <option value="owed">They owe you</option>
        </select>
        <button type="submit" className="trk-keycap" data-no95>Add debt</button>
      </form>
      {debts.length === 0 ? <p className="trk-spending-note">No debts.</p> : (
        <ul className="trk-spending-rows">
          {debts.map((debt) => (
            <li key={debt.id}>
              <span className="trk-spending-name">{debt.direction === "owe" ? `You owe ${debt.who}` : `${debt.who} owes`}</span>
              <span className="trk-spending-amount">{formatSpendAmount(debt.cents)}</span>
              <button type="button" aria-label={`Remove debt ${debt.who}`} onClick={() => useBudgetStore.getState().removeDebt(debt.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function BillsPanel({
  bills,
  fromKey,
}: {
  bills: { id: string; name: string; cents: number; cadence: BillCadence; day?: number; active: boolean }[]
  fromKey: string
}) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [cadence, setCadence] = useState<BillCadence>("monthly")
  const cents = parseSpendAmount(amount)
  return (
    <section aria-label="Bills">
      <form
        className="trk-money-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim() || cents == null) return
          useBudgetStore.getState().addBill({ name: name.trim(), cents, cadence })
          setName("")
          setAmount("")
        }}
      >
        <input aria-label="Bill name" value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="Bill amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <select aria-label="Bill cadence" value={cadence} onChange={(event) => setCadence(event.target.value as BillCadence)}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <button type="submit" className="trk-keycap" data-no95>Add bill</button>
      </form>
      {bills.length === 0 ? <p className="trk-spending-note">No bills.</p> : (
        <ul className="trk-spending-rows">
          {bills.map((bill) => (
            <li key={bill.id}>
              <span className="trk-spending-name">{bill.name}</span>
              <span className="trk-spending-date">{bill.cadence} · next {nextBillDate(bill, fromKey)}</span>
              <span className="trk-spending-amount">{formatSpendAmount(bill.cents)}</span>
              <button type="button" aria-label={`Remove bill ${bill.name}`} onClick={() => useBudgetStore.getState().removeBill(bill.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function BudgetLimits({
  envelopes,
  rows,
  monthKey,
}: {
  envelopes: { id: string; name: string; cents: number }[]
  rows: ReturnType<typeof budgetRows>
  monthKey: string
}) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const cents = parseSpendAmount(amount)
  return (
    <section aria-label="Budget">
      <p className="trk-spending-note">A monthly cap. Spent is received money that wears this name.</p>
      <form
        className="trk-money-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim() || cents == null) return
          useBudgetStore.getState().addEnvelope({ name: name.trim(), cents })
          setName("")
          setAmount("")
        }}
      >
        <input aria-label="Budget name" value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="Budget amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <button type="submit" className="trk-keycap" data-no95>Add budget</button>
      </form>
      {envelopes.length === 0 ? <p className="trk-spending-note">No budget yet.</p> : (
        <ul className="trk-spending-rows">
          {envelopes.map((envelope) => {
            const reading = envelopeReading(envelope, rows, monthKey)
            return (
              <li key={envelope.id}>
                <span className="trk-spending-name">{envelope.name}</span>
                <span className="trk-spending-date">{formatSpendAmount(reading.spent)} spent · {formatSpendAmount(reading.left)} left</span>
                <span className="trk-spending-amount">{formatSpendAmount(envelope.cents)}</span>
                <button type="button" aria-label={`Remove budget ${envelope.name}`} onClick={() => useBudgetStore.getState().removeEnvelope(envelope.id)}>×</button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function AheadPanel({
  lines,
  date,
}: {
  lines: { id: string; name: string; cents: number; date: string; certainty?: string }[]
  date: string
}) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [when, setWhen] = useState(date)
  const cents = parseSpendAmount(amount)
  return (
    <section aria-label="Ahead">
      <p className="trk-spending-note">A plan stays out of this month's received spent.</p>
      <form
        className="trk-money-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim() || cents == null) return
          useBudgetStore.getState().addLines([{ date: when, name: name.trim(), cents, kind: "spend", source: "Plan", status: "expected", certainty: "sure", category: name.trim() }])
          setName("")
          setAmount("")
        }}
      >
        <input aria-label="Plan name" value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="Plan amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <input aria-label="Plan date" type="date" value={when} onChange={(event) => setWhen(event.target.value)} />
        <button type="submit" className="trk-keycap" data-no95>Add plan</button>
      </form>
      {lines.length === 0 ? <p className="trk-spending-note">Nothing planned ahead.</p> : (
        <ul className="trk-spending-rows">
          {lines.map((row) => (
            <li key={row.id}>
              <span className="trk-spending-name">{row.name}</span>
              <span className="trk-spending-date">{row.date}</span>
              <span className="trk-spending-amount">{formatSpendAmount(row.cents)}</span>
              <button type="button" aria-label={`Remove plan ${row.name}`} onClick={() => useBudgetStore.getState().removeLine(row.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function GigsPanel({ gigs }: { gigs: { id: string; name: string; cents: number; status: GigStatus }[] }) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const cents = parseSpendAmount(amount)
  const due = gigExpectedPay(gigs)
  return (
    <section aria-label="Gigs">
      <p className="trk-spending-note">Pay when the work finishes: {formatSpendAmount(due)} still open.</p>
      <form
        className="trk-money-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim() || cents == null) return
          useBudgetStore.getState().addGig({ name: name.trim(), cents, status: "open" })
          setName("")
          setAmount("")
        }}
      >
        <input aria-label="Gig name" value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="Gig pay" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <button type="submit" className="trk-keycap" data-no95>Add gig</button>
      </form>
      {gigs.length === 0 ? <p className="trk-spending-note">No gigs.</p> : (
        <ul className="trk-spending-rows">
          {gigs.map((gig) => (
            <li key={gig.id}>
              <span className="trk-spending-name">{gig.name}</span>
              <span className="trk-spending-amount">{formatSpendAmount(gig.cents)}</span>
              {(["open", "finished", "paid"] as const).map((status) => (
                <button key={status} type="button" aria-label={`${gig.name} ${status}`} aria-pressed={gig.status === status} onClick={() => useBudgetStore.getState().setGigStatus(gig.id, status)}>
                  {status === "open" ? "Open" : status === "finished" ? "Finished" : "Paid"}
                </button>
              ))}
              <button type="button" aria-label={`Remove gig ${gig.name}`} onClick={() => useBudgetStore.getState().removeGig(gig.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function StatementPanel({
  sources,
  entries,
  lines,
  statements,
}: {
  sources: string[]
  entries: { date: string; spendAmount?: number; spendOn?: string; title?: string }[]
  lines: { date: string; cents: number; name: string }[]
  statements: { id: string; name: string; addedAt: string }[]
}) {
  const [source, setSource] = useState("Card")
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const known = useMemo(() => {
    const set = new Set<string>()
    for (const entry of entries) {
      if (typeof entry.spendAmount !== "number") continue
      set.add(`${entry.date}|${entry.spendAmount}|${(entry.spendOn ?? entry.title ?? "").trim().toLowerCase()}`)
    }
    for (const line of lines) set.add(`${line.date}|${line.cents}|${line.name.trim().toLowerCase()}`)
    return set
  }, [entries, lines])

  const load = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setNote(`Reading ${file.name}…`)
    try {
      const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
      let parsed: StatementLine[]
      if (pdf) parsed = await readStatementFile(file)
      else {
        const text = await file.text()
        useBudgetStore.getState().rememberStatement({ name: file.name, text })
        parsed = /\.csv$/i.test(file.name) || file.type === "text/csv" ? parseStatementCsv(text) : parseStatementText(text)
      }
      setDrafts(parsed.map((row, i) => {
        const duplicate = known.has(`${row.date}|${row.cents}|${row.name.trim().toLowerCase()}`)
        return { ...row, id: `${file.name}-${i}`, keep: !duplicate, duplicate }
      }))
      setNote(parsed.length ? `${parsed.length} lines in ${file.name}.` : `No lines in ${file.name}.`)
    } catch {
      setDrafts([])
      setNote(`Could not read ${file.name}.`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const chosen = drafts.filter((row) => row.keep && row.name.trim())
  const importChosen = () => {
    let added = 0
    for (const row of chosen.filter((item) => item.kind === "spend")) {
      const id = submitTrackingLog({
        date: row.date,
        title: row.name,
        mode: "spend",
        clock: "unknown",
        minute: 0,
        spendAmount: row.cents,
        spendOn: row.name,
        spendSource: source,
        logSource: "statement-import",
      })
      if (id) added += 1
    }
    added += useBudgetStore.getState().addLines(
      chosen.filter((row) => row.kind === "earning").map((row) => ({ date: row.date, name: row.name, cents: row.cents, kind: "earning" as const, source })),
    )
    setDrafts([])
    setNote(`Imported ${added} ${added === 1 ? "line" : "lines"} as ${source}.`)
  }

  return (
    <section className="trk-spending-import" aria-label="Import a statement">
      {statements.length > 0 ? (
        <ul className="trk-spending-rows">
          {statements.map((file) => (
            <li key={file.id}>
              <span className="trk-spending-name">{file.name}</span>
              <span className="trk-spending-date">On this device</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="trk-spending-import-bar">
        <input ref={fileRef} type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain" aria-label="Bank statement file" disabled={busy} onChange={(event) => void load(event.target.files?.[0])} />
        <label>
          Source
          <input list="trk-money-sources" value={source} onChange={(event) => setSource(event.target.value)} />
          <datalist id="trk-money-sources">
            {sources.map((item) => <option key={item} value={item} />)}
          </datalist>
        </label>
      </div>
      <p className="trk-spending-note" role="status">{note || "CSV or text stays on this device. A PDF is read here and not kept."}</p>
      {drafts.length > 0 ? (
        <>
          <ul className="trk-spending-rows">
            {drafts.map((row) => (
              <li key={row.id} data-keep={row.keep ? "true" : "false"} title={row.raw}>
                <input type="checkbox" checked={row.keep} aria-label={`Import ${row.name}`} onChange={(event) => setDrafts((all) => all.map((item) => item.id === row.id ? { ...item, keep: event.target.checked } : item))} />
                <span className="trk-spending-date">{row.date}</span>
                <input className="trk-spending-name" value={row.name} aria-label="What it was spent on" onChange={(event) => setDrafts((all) => all.map((item) => item.id === row.id ? { ...item, name: event.target.value } : item))} />
                <button type="button" className="trk-spending-kind" title="Flip earning / spending" onClick={() => setDrafts((all) => all.map((item) => item.id === row.id ? { ...item, kind: item.kind === "earning" ? "spend" : "earning" } : item))}>
                  {row.kind === "earning" ? "In" : "Out"}
                </button>
                <span className="trk-spending-amount">{formatSpendAmount(row.cents)}</span>
                {row.duplicate ? <em>already logged</em> : null}
              </li>
            ))}
          </ul>
          <div className="trk-spending-foot">
            <span>{chosen.length} of {drafts.length} selected · {formatSpendAmount(chosen.reduce((sum, row) => sum + row.cents, 0))}</span>
            <button type="button" onClick={importChosen} disabled={chosen.length === 0}>Import {chosen.length}</button>
          </div>
        </>
      ) : null}
    </section>
  )
}
