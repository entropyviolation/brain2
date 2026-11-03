/**
 * SweepView — caches, logs, Xcode leftovers, Trash, and duplicate files.
 *
 * One instrument, two modes on the rail. The disk walk is the Electron app
 * (`electron/sweep.js`). The browser build only says where the scan lives.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getFileLinkBridge } from "@/lib/resource-links"
import {
  formatSweepBytes,
  pathBase,
  previewKindForPath,
  SWEEP_CATEGORIES,
  type SweepPreviewKind,
} from "@/lib/sweep-rules"
import {
  getSweepBridge,
  type SweepDuplicateGroup,
  type SweepGroup,
  type SweepProgress,
} from "@/lib/sweep-bridge"
import "./sweep.css"

type Phase = "idle" | "run" | "ready" | "confirm" | "clean"
type Where = "pending" | "desktop" | "browser"

interface DupRoot {
  path: string
  on: boolean
  added: boolean
}

function Key({
  children,
  onClick,
  disabled,
  tone,
  pressed,
}: {
  children: string
  onClick?: () => void
  disabled?: boolean
  tone?: "primary" | "mod"
  pressed?: boolean
}) {
  const cls = ["todo-cap", tone === "primary" ? "is-primary" : "", tone === "mod" ? "is-mod" : ""].filter(Boolean).join(" ")
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
    >
      {children}
    </button>
  )
}

function formatWhen(ms: number): string {
  if (!ms) return ""
  try {
    return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return ""
  }
}

export function SweepView() {
  const [where, setWhere] = useState<Where>("pending")
  const [mode, setMode] = useState<"scan" | "duplicates">("scan")
  const [scanPhase, setScanPhase] = useState<Phase>("idle")
  const [dupPhase, setDupPhase] = useState<Phase>("idle")
  const [groups, setGroups] = useState<SweepGroup[]>([])
  const [scanId, setScanId] = useState("")
  const [truncated, setTruncated] = useState(false)
  const [dupGroups, setDupGroups] = useState<SweepDuplicateGroup[]>([])
  const [resultId, setResultId] = useState("")
  const [dupTruncated, setDupTruncated] = useState(false)
  const [checkedDup, setCheckedDup] = useState<Set<string>>(() => new Set())
  const [roots, setRoots] = useState<DupRoot[]>([])
  const [selected, setSelected] = useState("")
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewHead, setPreviewHead] = useState("")
  const [progress, setProgress] = useState<SweepProgress | null>(null)
  const [note, setNote] = useState("")
  const runId = useRef(0)

  useEffect(() => {
    const bridge = getSweepBridge()
    setWhere(bridge ? "desktop" : "browser")
    if (!bridge) return
    let live = true
    void bridge.defaults().then((d) => {
      if (!live || !Array.isArray(d?.roots)) return
      setRoots(d.roots.map((path) => ({ path, on: true, added: false })))
    }).catch(() => {})
    const off = bridge.onProgress((next) => {
      if (live) setProgress(next)
    })
    return () => {
      live = false
      off()
    }
  }, [])

  const selectedFile = useMemo(() => {
    for (const group of dupGroups) {
      const file = group.files.find((item) => item.path === selected)
      if (file) return { file, keep: group.keepPath === file.path }
    }
    return null
  }, [dupGroups, selected])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("")
      setPreviewHead("")
      return
    }
    const kind = previewKindForPath(selectedFile.file.path)
    let cancel = false
    setPreviewUrl("")
    setPreviewHead("")
    void (async () => {
      const bridge = getSweepBridge()
      const links = getFileLinkBridge()
      if (kind === "image" || kind === "video" || kind === "audio") {
        const url = links ? await links.previewUrl(selectedFile.file.path) : ""
        if (!cancel) setPreviewUrl(url || "")
      }
      if (kind === "text" && bridge) {
        const head = await bridge.textHead(selectedFile.file.path)
        if (!cancel) setPreviewHead(head || "")
      }
    })()
    return () => {
      cancel = true
    }
  }, [selectedFile])

  const checkedBytes = useMemo(
    () => groups.reduce((sum, group) => sum + (group.checked ? group.bytes : 0), 0),
    [groups],
  )
  const checkedCount = groups.filter((group) => group.checked).length
  const running = scanPhase === "run" || scanPhase === "clean" || dupPhase === "run" || dupPhase === "clean"

  function stop() {
    runId.current += 1
    getSweepBridge()?.cancel()
    if (scanPhase === "run") setScanPhase("idle")
    if (dupPhase === "run") setDupPhase("idle")
    setNote("Stopped.")
  }

  async function runScan() {
    const bridge = getSweepBridge()
    if (!bridge) return
    const id = ++runId.current
    setNote("")
    setGroups([])
    setScanId("")
    setTruncated(false)
    setProgress(null)
    setScanPhase("run")
    try {
      const res = await bridge.scan()
      if (id !== runId.current) return
      if (res.cancelled) {
        setScanPhase("idle")
        setNote("Scan stopped.")
        return
      }
      if (!res.ok || !res.scanId) {
        setScanPhase("idle")
        setNote(res.error || "The scan stopped.")
        return
      }
      setScanId(res.scanId)
      setGroups(res.groups || [])
      setTruncated(!!res.truncated)
      setScanPhase("ready")
      if (!(res.groups || []).length) setNote("Nothing to clean in those folders.")
    } catch {
      if (id !== runId.current) return
      setScanPhase("idle")
      setNote("The desktop app did not answer.")
    }
  }

  async function commitClean(confirmPermanent: boolean) {
    const bridge = getSweepBridge()
    if (!bridge || !scanId) return
    const id = ++runId.current
    const chosen = groups.filter((group) => group.checked)
    setScanPhase("clean")
    setNote("")
    try {
      const res = await bridge.clean({ scanId, paths: chosen.map((group) => group.path), confirmPermanent })
      if (id !== runId.current) return
      const gone = new Set(res.removed || [])
      setGroups((rows) => rows.filter((group) => !gone.has(group.path)))
      setScanPhase("ready")
      const removedGroups = chosen.filter((group) => gone.has(group.path))
      const bits: string[] = []
      if (removedGroups.some((group) => group.permanent)) bits.push("Deleted from the Trash.")
      if (removedGroups.some((group) => !group.permanent)) bits.push("Moved to the Trash.")
      if ((res.skipped || []).length) bits.push("Left some in place.")
      setNote(bits.join(" ") || res.error || "")
    } catch {
      if (id !== runId.current) return
      setScanPhase("ready")
      setNote("The desktop app did not answer.")
    }
  }

  async function addFolder() {
    const links = getFileLinkBridge()
    if (!links) return
    const picked = await links.pick({ folders: true })
    const path = picked.find((item) => item.isDir)?.path
    if (!path) return
    setRoots((rows) => (rows.some((row) => row.path === path) ? rows : [...rows, { path, on: true, added: true }]))
  }

  async function runDuplicates() {
    const bridge = getSweepBridge()
    if (!bridge) return
    const chosen = roots.filter((row) => row.on).map((row) => row.path)
    if (!chosen.length) {
      setNote("Pick a folder.")
      return
    }
    const id = ++runId.current
    setNote("")
    setDupGroups([])
    setResultId("")
    setCheckedDup(new Set())
    setSelected("")
    setDupTruncated(false)
    setProgress(null)
    setDupPhase("run")
    try {
      const res = await bridge.duplicates(chosen)
      if (id !== runId.current) return
      if (res.cancelled) {
        setDupPhase("idle")
        setNote("Search stopped.")
        return
      }
      if (!res.ok || !res.resultId) {
        setDupPhase("idle")
        setNote(res.error || "The search stopped.")
        return
      }
      setResultId(res.resultId)
      setDupGroups(res.groups || [])
      setDupTruncated(!!res.truncated)
      setDupPhase("ready")
      const refused = (res.refusedRoots || []).map((p) => pathBase(p)).filter(Boolean)
      const bits: string[] = []
      if (!(res.groups || []).length) bits.push("No duplicate files in those folders.")
      if (refused.length) bits.push("Some folders stay out of duplicate search.")
      setNote(bits.join(" "))
    } catch {
      if (id !== runId.current) return
      setDupPhase("idle")
      setNote("The desktop app did not answer.")
    }
  }

  async function cleanDuplicates() {
    const bridge = getSweepBridge()
    if (!bridge || !resultId || checkedDup.size === 0) return
    const id = ++runId.current
    const paths = Array.from(checkedDup)
    setDupPhase("clean")
    setNote("")
    try {
      const res = await bridge.cleanDuplicates({ resultId, paths })
      if (id !== runId.current) return
      const gone = new Set(res.removed || [])
      setDupGroups((rows) =>
        rows
          .map((group) => ({ ...group, files: group.files.filter((file) => !gone.has(file.path)) }))
          .filter((group) => group.files.length > 1),
      )
      setCheckedDup(new Set())
      if (gone.has(selected)) setSelected("")
      setDupPhase("ready")
      const bits: string[] = []
      if ((res.removed || []).length) bits.push("Moved to the Trash.")
      if ((res.skipped || []).length) bits.push("Left some in place.")
      setNote(bits.join(" ") || res.error || "")
    } catch {
      if (id !== runId.current) return
      setDupPhase("ready")
      setNote("The desktop app did not answer.")
    }
  }

  const status = running && progress
    ? `${progress.folder || "Reading"} · ${formatSweepBytes(progress.bytes)}`
    : note

  return (
    <div className="sweep">
      <nav className="sweep-rail" aria-label="Sweep">
        <Key pressed={mode === "scan"} onClick={() => setMode("scan")} disabled={running}>Scan</Key>
        <Key pressed={mode === "duplicates"} onClick={() => setMode("duplicates")} disabled={running}>Duplicates</Key>
      </nav>
      <div className="sweep-main">
        {where === "browser" ? (
          <p className="sweep-lead">Sweep scans this Mac from the desktop app.</p>
        ) : null}
        {where === "desktop" && mode === "scan" ? (
          <ScanPane
            phase={scanPhase}
            groups={groups}
            status={status}
            truncated={truncated}
            checkedCount={checkedCount}
            checkedBytes={checkedBytes}
            onScan={() => void runScan()}
            onStop={stop}
            onToggle={(path) => setGroups((rows) => rows.map((group) => group.path === path ? { ...group, checked: !group.checked } : group))}
            onClean={() => {
              const chosen = groups.filter((group) => group.checked)
              if (!chosen.length) return
              if (chosen.some((group) => group.permanent)) setScanPhase("confirm")
              else void commitClean(false)
            }}
            onConfirm={() => void commitClean(true)}
            onBack={() => setScanPhase("ready")}
            permanentToo={groups.some((group) => group.checked && group.permanent)}
            movableToo={groups.some((group) => group.checked && !group.permanent)}
          />
        ) : null}
        {where === "desktop" && mode === "duplicates" ? (
          <DupPane
            phase={dupPhase}
            roots={roots}
            groups={dupGroups}
            status={status}
            truncated={dupTruncated}
            selected={selected}
            checked={checkedDup}
            previewUrl={previewUrl}
            previewHead={previewHead}
            previewKind={selectedFile ? previewKindForPath(selectedFile.file.path) : "file"}
            file={selectedFile?.file || null}
            kept={!!selectedFile?.keep}
            onToggleRoot={(path) => setRoots((rows) => rows.map((row) => row.path === path ? { ...row, on: !row.on } : row))}
            onRemoveRoot={(path) => setRoots((rows) => rows.filter((row) => row.path !== path))}
            onAdd={() => void addFolder()}
            onFind={() => void runDuplicates()}
            onStop={stop}
            onSelect={setSelected}
            onCheck={(path) => {
              setCheckedDup((prev) => {
                const next = new Set(prev)
                if (next.has(path)) next.delete(path)
                else next.add(path)
                return next
              })
            }}
            onClean={() => void cleanDuplicates()}
          />
        ) : null}
      </div>
    </div>
  )
}

function ScanPane({
  phase,
  groups,
  status,
  truncated,
  checkedCount,
  checkedBytes,
  permanentToo,
  movableToo,
  onScan,
  onStop,
  onToggle,
  onClean,
  onConfirm,
  onBack,
}: {
  phase: Phase
  groups: SweepGroup[]
  status: string
  truncated: boolean
  checkedCount: number
  checkedBytes: number
  permanentToo: boolean
  movableToo: boolean
  onScan: () => void
  onStop: () => void
  onToggle: (path: string) => void
  onClean: () => void
  onConfirm: () => void
  onBack: () => void
}) {
  const byCategory = SWEEP_CATEGORIES.map((category) => ({
    ...category,
    rows: groups.filter((group) => group.categoryId === category.id),
  })).filter((category) => category.rows.length > 0)

  return (
    <>
      <div className="sweep-head">
        <p className="sweep-status" aria-live="polite">{status}</p>
        <div className="sweep-keys">
          {phase === "idle" ? <Key tone="primary" onClick={onScan}>Scan</Key> : null}
          {phase === "run" ? <Key onClick={onStop}>Stop</Key> : null}
          {phase === "ready" || phase === "clean" ? (
            <>
              <Key tone="mod" onClick={onScan} disabled={phase === "clean"}>Scan</Key>
              <Key tone="primary" onClick={onClean} disabled={phase === "clean" || checkedCount === 0}>Clean</Key>
            </>
          ) : null}
          {phase === "confirm" ? (
            <>
              <Key tone="mod" onClick={onBack}>Back</Key>
              <Key tone="primary" onClick={onConfirm}>Delete permanently</Key>
            </>
          ) : null}
        </div>
      </div>
      {phase === "idle" ? (
        <p className="sweep-lead">Caches, logs, DerivedData, Trash, and orphan preferences.</p>
      ) : null}
      {phase === "confirm" ? (
        <p className="sweep-lead">
          Emptying the Trash deletes those files permanently.
          {movableToo && permanentToo ? " The other checked rows move to the Trash." : ""}
        </p>
      ) : null}
      {phase === "ready" || phase === "clean" || phase === "confirm" ? (
        <>
          {checkedCount > 0 ? <p className="sweep-total">{formatSweepBytes(checkedBytes)} checked</p> : null}
          {truncated ? <p className="sweep-quiet">The walk stopped early.</p> : null}
          <div className="sweep-list">
            {byCategory.map((category) => (
              <section key={category.id}>
                <h3>
                  {category.label}
                  {category.permanent ? <span>Deletes permanently</span> : null}
                </h3>
                {category.rows.map((group) => (
                  <label key={group.id} className="sweep-row">
                    <input
                      type="checkbox"
                      checked={group.checked}
                      onChange={() => onToggle(group.path)}
                      disabled={phase === "clean"}
                    />
                    <span className="sweep-name">{group.label}</span>
                    <span className="sweep-size">
                      {formatSweepBytes(group.bytes)}
                      {group.partial ? " partial" : ""}
                    </span>
                  </label>
                ))}
              </section>
            ))}
          </div>
        </>
      ) : null}
      {phase === "run" ? <p className="sweep-lead">Reading folders on this Mac.</p> : null}
    </>
  )
}

function DupPane({
  phase,
  roots,
  groups,
  status,
  truncated,
  selected,
  checked,
  previewUrl,
  previewHead,
  previewKind,
  file,
  kept,
  onToggleRoot,
  onRemoveRoot,
  onAdd,
  onFind,
  onStop,
  onSelect,
  onCheck,
  onClean,
}: {
  phase: Phase
  roots: DupRoot[]
  groups: SweepDuplicateGroup[]
  status: string
  truncated: boolean
  selected: string
  checked: Set<string>
  previewUrl: string
  previewHead: string
  previewKind: SweepPreviewKind
  file: { name: string; path: string; size: number; mtimeMs: number } | null
  kept: boolean
  onToggleRoot: (path: string) => void
  onRemoveRoot: (path: string) => void
  onAdd: () => void
  onFind: () => void
  onStop: () => void
  onSelect: (path: string) => void
  onCheck: (path: string) => void
  onClean: () => void
}) {
  return (
    <>
      <div className="sweep-head">
        <p className="sweep-status" aria-live="polite">{status}</p>
        <div className="sweep-keys">
          <Key tone="mod" onClick={onAdd} disabled={phase === "run" || phase === "clean"}>Add folder</Key>
          {phase === "run" ? <Key onClick={onStop}>Stop</Key> : (
            <Key tone="primary" onClick={onFind} disabled={phase === "clean"}>Find</Key>
          )}
          {phase === "ready" || phase === "clean" ? (
            <Key tone="primary" onClick={onClean} disabled={phase === "clean" || checked.size === 0}>Clean</Key>
          ) : null}
        </div>
      </div>
      <ul className="sweep-roots">
        {roots.map((root) => (
          <li key={root.path}>
            <label>
              <input type="checkbox" checked={root.on} onChange={() => onToggleRoot(root.path)} disabled={phase === "run" || phase === "clean"} />
              <span>{pathBase(root.path)}</span>
            </label>
            {root.added ? <Key tone="mod" onClick={() => onRemoveRoot(root.path)} disabled={phase === "run" || phase === "clean"}>Remove</Key> : null}
          </li>
        ))}
      </ul>
      {truncated ? <p className="sweep-quiet">The walk stopped early.</p> : null}
      {phase === "ready" || phase === "clean" ? (
        <div className="sweep-split">
          <div className="sweep-list">
            {groups.map((group) => (
              <section key={group.hash}>
                <h3>{group.files.length} copies</h3>
                {group.files.map((item) => {
                  const isKept = item.path === group.keepPath
                  return (
                    <div key={item.path} className={item.path === selected ? "sweep-row is-on" : "sweep-row"}>
                      {isKept ? <span className="sweep-kept">Kept</span> : (
                        <input
                          type="checkbox"
                          checked={checked.has(item.path)}
                          onChange={() => onCheck(item.path)}
                          disabled={phase === "clean"}
                          aria-label={`Clean ${item.name}`}
                        />
                      )}
                      <button type="button" className="sweep-file" onClick={() => onSelect(item.path)}>
                        <span className="sweep-name">{item.name}</span>
                        <span className="sweep-path">{item.path}</span>
                      </button>
                      <span className="sweep-size">{formatSweepBytes(item.size)}</span>
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
          <aside className="sweep-preview">
            {file ? (
              <>
                {previewKind === "image" && previewUrl ? <img src={previewUrl} alt={file.name} /> : null}
                {previewKind === "video" && previewUrl ? <video src={previewUrl} controls playsInline /> : null}
                {previewKind === "audio" && previewUrl ? <audio src={previewUrl} controls /> : null}
                {previewKind === "text" && previewHead ? <pre>{previewHead}</pre> : null}
                <dl>
                  <div><dt>Name</dt><dd>{file.name}</dd></div>
                  <div><dt>Path</dt><dd>{file.path}</dd></div>
                  <div><dt>Size</dt><dd>{formatSweepBytes(file.size)}</dd></div>
                  <div><dt>Modified</dt><dd>{formatWhen(file.mtimeMs)}</dd></div>
                  {kept ? <div><dt>Copy</dt><dd>Kept</dd></div> : null}
                </dl>
              </>
            ) : (
              <p className="sweep-quiet">Select a copy.</p>
            )}
          </aside>
        </div>
      ) : phase === "idle" ? (
        <p className="sweep-lead">Desktop, Documents, Downloads, Pictures, Movies, and Music.</p>
      ) : null}
    </>
  )
}
