/**
 * components/Docs/DocsPanel.tsx — Top-level Docs tab (Brain2 document editor)
 *
 * Windows 95–skinned document workspace: folder sidebar, Google Docs-style
 * folder homepage, and a single-pane WYSIWYG editor. Document HTML is stored
 * in IndexedDB (`lib/doc-persist.ts`) so new notes actually survive refresh.
 */
"use client"

import { SecretMark } from "@/components/Secrets/SecretMark"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, FileText, FileUp, Folder, Info, Plus, Trash2, Download } from "lucide-react"
import { orbFor } from "@/components/Icons"
import { useTaskStore } from "@/lib/task-store"
import { APP_NAV_KEYS, writeStoredTab, writeStoredId, readStoredId, DOCS_SIDEBAR_SCROLL_SLOT } from "@/lib/app-navigation"
import { subscribeNavRestore } from "@/lib/screen-location"
import { usePersistedScroll } from "@/lib/use-persisted-scroll"
import { exportDocumentAsPdf } from "@/lib/doc-export"
import { listPersistedDocs } from "@/lib/doc-persist"
import { DocumentEditor } from "@/components/Docs/DocumentEditor"
import { DocsHome, docMatchesQuery } from "@/components/Docs/DocsHome"
import { DocInfoDialog } from "@/components/Docs/DocInfoDialog"
import { itemTitle, itemTitleOrUntitled } from "@/lib/item-utils"
import {
  createDocument,
  createDocumentFromPdf,
  deleteDocument,
  documentFolder,
  documentFont,
  documentStatus,
  hydrateDocumentsFromIdb,
  listDocumentFolders,
  listDocuments,
  loadDocumentBody,
  markDocumentOpened,
  renameDocument,
  setDocumentBody,
  setDocumentFolder,
  setDocumentFont,
  setDocumentStatus,
} from "./doc-actions"
import { DayLogBar, DayLogMaker } from "./day-log-bar"
import { dayLogDateOf } from "@/lib/day-log-bimby/file"
import { DAY_LOG_FOLDER, DAY_LOG_PARENT } from "@/lib/day-log-bimby/render"
import { DAY_LOG_WRITTEN_EVENT } from "@/lib/day-log-bimby/run"
import { WeekLogBar, WeekLogMaker } from "./week-log-bar"
import { WEEK_LOG_FOLDER, weekLogStartOf } from "@/lib/week-log-bimby/week"
import "./docs.css"

const ALL_FOLDER = "__all__"
const UNFILED = "__unfiled__"

/** Folders that always show, even empty. A "/" in a folder label nests it under its parent. */
const BUILTIN_FOLDERS = [DAY_LOG_PARENT, DAY_LOG_FOLDER, WEEK_LOG_FOLDER]

/** Every folder in use, the built-in ones, and each nested folder's parents, sorted so a child follows its parent. */
export function folderTree(used: string[]): string[] {
  const set = new Set<string>([...used, ...BUILTIN_FOLDERS])
  for (const f of [...set]) {
    const parts = f.split("/")
    for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join("/"))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** A doc is in a folder when its label is that folder or one nested under it. */
const inFolder = (label: string, folder: string) => label === folder || label.startsWith(`${folder}/`)

export function DocsPanel() {
  const tasks = useTaskStore((s) => s.tasks)
  const docs = useMemo(() => listDocuments(tasks), [tasks])
  const folders = useMemo(() => folderTree(listDocumentFolders(docs)), [docs])

  const [folderFilter, setFolderFilter] = useState<string>(() => readStoredId(APP_NAV_KEYS.docsFolder) || ALL_FOLDER)
  const [selectedId, setSelectedId] = useState<string | null>(() => readStoredId(APP_NAV_KEYS.docsDocId))
  const [draft, setDraft] = useState("")
  const [titleDraft, setTitleDraft] = useState("")
  const [folderDraft, setFolderDraft] = useState("")
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved")
  const [query, setQuery] = useState("")
  const [homeBodies, setHomeBodies] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [openStamp, setOpenStamp] = useState<{ id: string; prev: Date | null; now: Date } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingBody = useRef<string | null>(null)
  const selectedIdRef = useRef<string | null>(selectedId)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const openStampRef = useRef<{ id: string; prev: Date | null; now: Date } | null>(null)
  const sidebarListRef = useRef<HTMLUListElement>(null)

  selectedIdRef.current = selectedId
  usePersistedScroll(DOCS_SIDEBAR_SCROLL_SLOT, sidebarListRef)

  const selected = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId],
  )

  const visibleDocs = useMemo(() => {
    if (folderFilter === ALL_FOLDER) return docs.filter((d) => documentStatus(d) !== "archived")
    if (folderFilter === UNFILED) {
      return docs.filter((d) => !documentFolder(d) && documentStatus(d) !== "archived")
    }
    return docs.filter((d) => inFolder(documentFolder(d), folderFilter) && documentStatus(d) !== "archived")
  }, [docs, folderFilter])

  const searchedDocs = useMemo(
    () => visibleDocs.filter((d) => docMatchesQuery(d, query, homeBodies[d.id])),
    [visibleDocs, query, homeBodies],
  )

  // Drop a stale selection after IDB hydrate; do not auto-open the first document.
  useEffect(() => {
    if (!hydrated) return
    if (!selectedId) return
    if (docs.some((d) => d.id === selectedId)) return
    setSelectedId(null)
  }, [docs, selectedId, hydrated])

  useEffect(() => {
    writeStoredId(APP_NAV_KEYS.docsDocId, selectedId)
  }, [selectedId])

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.docsFolder, folderFilter)
  }, [folderFilter])

  useEffect(() => {
    return subscribeNavRestore(() => {
      setSelectedId(readStoredId(APP_NAV_KEYS.docsDocId))
      setFolderFilter(readStoredId(APP_NAV_KEYS.docsFolder) || ALL_FOLDER)
    })
  }, [])

  useEffect(() => {
    void hydrateDocumentsFromIdb().finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (selected) return
    let cancelled = false
    void listPersistedDocs().then((records) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const rec of records) next[rec.id] = rec.body
      setHomeBodies(next)
    })
    return () => {
      cancelled = true
    }
  }, [selected, docs.length])

  useEffect(() => {
    if (!selected) {
      setDraft("")
      setTitleDraft("")
      setFolderDraft("")
      openStampRef.current = null
      pendingBody.current = null
      setSaveState("saved")
      return
    }
    pendingBody.current = null
    setInfoOpen(false)
    // One stamp per visit (a dev double-run of this effect must not eat "last opened").
    if (openStampRef.current?.id !== selected.id) {
      openStampRef.current = { id: selected.id, prev: markDocumentOpened(selected.id), now: new Date() }
    }
    setOpenStamp(openStampRef.current)
    setTitleDraft(itemTitle(selected))
    setFolderDraft(documentFolder(selected))
    setSaveState("saved")
    setDraft(selected.body ?? "")
    const id = selected.id
    let cancelled = false
    void loadDocumentBody(id, selected.body ?? "").then((html) => {
      if (cancelled || selectedIdRef.current !== id) return
      setDraft(html)
    })
    return () => {
      cancelled = true
    }
  }, [selected?.id])

  // A Day Log or Week Log rebuilt while open: show the new body unless there are unsaved keystrokes.
  useEffect(() => {
    const onWritten = (e: Event) => {
      const id = (e as CustomEvent<{ docId: string }>).detail?.docId
      if (!id || id !== selectedIdRef.current || pendingBody.current !== null) return
      void loadDocumentBody(id, "").then((html) => {
        if (html && selectedIdRef.current === id && pendingBody.current === null) setDraft(html)
      })
    }
    window.addEventListener(DAY_LOG_WRITTEN_EVENT, onWritten)
    return () => window.removeEventListener(DAY_LOG_WRITTEN_EVENT, onWritten)
  }, [])

  const flushBody = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const id = selectedIdRef.current
    const body = pendingBody.current
    if (!id || body === null) return
    setSaveState("saving")
    try {
      const ok = await setDocumentBody(id, body)
      if (pendingBody.current === body) pendingBody.current = null
      if (!ok) {
        setSaveState("error")
        return
      }
      if (pendingBody.current === null) setSaveState("saved")
    } catch {
      setSaveState("error")
    }
  }, [])

  useEffect(() => () => {
    void flushBody()
  }, [flushBody])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "s") return
      const root = document.querySelector(".docs95")
      const active = document.activeElement
      if (!root || !active || !root.contains(active)) return
      e.preventDefault()
      void flushBody()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flushBody])

  useEffect(() => {
    const flush = () => {
      void flushBody()
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("beforeunload", flush)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("beforeunload", flush)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [flushBody])

  const handleBodyChange = useCallback(
    (html: string) => {
      setDraft(html)
      pendingBody.current = html
      if (timer.current) clearTimeout(timer.current)
      setSaveState("saving")
      timer.current = setTimeout(() => {
        void flushBody()
      }, 700)
    },
    [flushBody],
  )

  const handleCreate = () => {
    void flushBody()
    const folder = folderFilter !== ALL_FOLDER && folderFilter !== UNFILED ? folderFilter : ""
    const doc = createDocument("Untitled document", folder)
    setSelectedId(doc.id)
    setDraft("<p><br></p>")
    setSaveState("saved")
  }

  const handleUploadPdf = async (file: File) => {
    setBusy("Reading PDF…")
    try {
      await flushBody()
      const folder = folderFilter !== ALL_FOLDER && folderFilter !== UNFILED ? folderFilter : ""
      const doc = await createDocumentFromPdf(file, folder)
      const html = await loadDocumentBody(doc.id, doc.body ?? "")
      setDraft(html)
      setSelectedId(doc.id)
      setSaveState("saved")
    } catch (err) {
      console.error(err)
      window.alert("Could not read that PDF. It may be encrypted or image-only.")
    } finally {
      setBusy(null)
      if (pdfInputRef.current) pdfInputRef.current.value = ""
    }
  }

  const handleDelete = () => {
    if (!selectedId) return
    if (typeof window !== "undefined" && !window.confirm("Delete this document permanently?")) return
    pendingBody.current = null
    deleteDocument(selectedId)
    setSelectedId(null)
  }

  const handleRenameBlur = () => {
    if (!selectedId) return
    const next = titleDraft.trim()
    if (next && next !== itemTitle(selected)) renameDocument(selectedId, next)
  }

  const handleFolderBlur = () => {
    if (!selectedId || !selected) return
    if (folderDraft.trim() !== documentFolder(selected)) {
      setDocumentFolder(selectedId, folderDraft)
    }
  }

  const handleExportPdf = () => {
    if (!selected) return
    void (async () => {
      await flushBody()
      const html = pendingBody.current ?? draft
      exportDocumentAsPdf({
        title: titleDraft.trim() || itemTitleOrUntitled(selected, "Untitled document"),
        html,
        font: documentFont(selected),
      })
    })()
  }

  const folderChoices = useMemo(() => {
    const keys = [
      { id: ALL_FOLDER, label: "All documents" },
      { id: UNFILED, label: "Unfiled" },
      ...folders.map((f) => ({ id: f, label: f.split("/").pop() ?? f, depth: f.split("/").length - 1 })),
    ]
    return keys
  }, [folders])

  const folderLabel =
    folderFilter === ALL_FOLDER
      ? "All documents"
      : folderFilter === UNFILED
        ? "Unfiled"
        : folderFilter

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = readStoredId(APP_NAV_KEYS.docsFolder)
    if (!stored) return
    if (stored === ALL_FOLDER || stored === UNFILED || folders.includes(stored)) {
      setFolderFilter(stored)
    }
  }, [folders])

  const saveLabel = busy ?? (saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved")

  return (
    <div className="docs95" data-ui-name="Docs" data-ui-docs="components/Docs/README.md">
      <div className="docs-window">
        <div className="docs-title-bar">
          <div className="docs-title-bar-text">
            <FileText className="docs-title-icon" aria-hidden />
            <h2>Brain2 Docs</h2>
          </div>
          <div className="docs-title-bar-controls" aria-hidden="true">
            <span className="docs-title-btn">_</span>
            <span className="docs-title-btn">□</span>
            <span className="docs-title-btn">×</span>
          </div>
        </div>

        <div className="docs-menubar" role="menubar">
          {selected && (
            <button
              type="button"
              className="docs-btn"
              onClick={() => {
                void flushBody()
                setSelectedId(null)
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Folder
            </button>
          )}
          <button type="button" className="docs-btn" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
          <button
            type="button"
            className="docs-btn"
            onClick={() => pdfInputRef.current?.click()}
            disabled={!!busy}
          >
            <FileUp className="h-3.5 w-3.5" />
            Upload
          </button>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="docs-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUploadPdf(f)
            }}
          />
          {selected && (
            <>
              <button type="button" className="docs-btn" onClick={() => void flushBody()}>
                Save
              </button>
              <button type="button" className="docs-btn" onClick={handleExportPdf}>
                <Download className="h-3.5 w-3.5" />
                Export PDF
              </button>
              <button
                type="button"
                className="docs-btn docs-btn-danger"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <SecretMark
                checked={selected.secret === true}
                onChange={(on) => useTaskStore.getState().updateTask({ ...selected, secret: on ? true : undefined })}
              />
              <button
                type="button"
                className="docs-btn"
                onClick={() => setDocumentStatus(selected.id, "archived")}
                title="Archive document"
              >
                Archive
              </button>
            </>
          )}
        </div>

        <div className="docs-body">
          <aside className="docs-sidebar" aria-label="Folders and documents">
            <div className="docs-sidebar-head">Folders</div>
            <ul className="docs-folder-list">
              {folderChoices.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="docs-folder-item"
                    style={"depth" in f && f.depth ? { paddingLeft: 8 + f.depth * 14 } : undefined}
                    title={f.id.startsWith("__") ? undefined : f.id}
                    aria-selected={folderFilter === f.id}
                    onClick={() => {
                      void flushBody()
                      setFolderFilter(f.id)
                      setSelectedId(null)
                      setQuery("")
                    }}
                  >
                    <Folder className="h-3.5 w-3.5" aria-hidden />
                    {f.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="docs-sidebar-head">Recent documents</div>
            {visibleDocs.length === 0 ? (
              <p className="docs-empty-side">No documents here. Click New to start.</p>
            ) : (
              <ul className="docs-doc-list" ref={sidebarListRef}>
                {visibleDocs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="docs-doc-item"
                      aria-selected={selectedId === d.id}
                      onClick={() => {
                        void flushBody()
                        setSelectedId(d.id)
                      }}
                    >
                      <img
                        src={orbFor(d.id)}
                        alt=""
                        className="docs-doc-orb"
                        width={14}
                        height={14}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="truncate">{itemTitleOrUntitled(d)}</span>
                      <span className="docs-doc-meta">{documentStatus(d)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="docs-main" aria-label={selected ? "Editor" : "Documents"}>
            {!selected && folderFilter === DAY_LOG_FOLDER ? (
              <DayLogMaker
                onBuilt={(id) => {
                  void flushBody()
                  setSelectedId(id)
                }}
              />
            ) : null}
            {!selected && folderFilter === WEEK_LOG_FOLDER ? (
              <WeekLogMaker
                onBuilt={(id) => {
                  void flushBody()
                  setSelectedId(id)
                }}
              />
            ) : null}
            {!selected ? (
              <DocsHome
                folderLabel={folderLabel}
                folderId={folderFilter}
                docs={searchedDocs}
                bodies={homeBodies}
                query={query}
                onQueryChange={setQuery}
                onOpen={(id) => {
                  void flushBody()
                  setSelectedId(id)
                }}
                onCreate={handleCreate}
                onUpload={() => pdfInputRef.current?.click()}
              />
            ) : (
              <>
                <div className="docs-meta-row">
                  <input
                    className="docs-title-input"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleRenameBlur}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                    }}
                    aria-label="Document title"
                    placeholder="Document title"
                  />
                  <input
                    className="docs-field docs-folder-field"
                    value={folderDraft}
                    onChange={(e) => setFolderDraft(e.target.value)}
                    onBlur={handleFolderBlur}
                    list="docs-folder-suggestions"
                    placeholder="Folder"
                    aria-label="Folder"
                  />
                  <datalist id="docs-folder-suggestions">
                    {folders.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <span
                    className={`docs-save-pill${saveState === "saving" ? " is-saving" : ""}${saveState === "error" ? " is-error" : ""}`}
                    title={
                      saveState === "error"
                        ? "Could not write this document. Try Save again (⌘/Ctrl+S)."
                        : "Documents save automatically."
                    }
                  >
                    {saveLabel}
                  </span>
                  <button
                    type="button"
                    className="docs-info-btn"
                    onClick={() => setInfoOpen(true)}
                    aria-label="Document info"
                    aria-haspopup="dialog"
                    title="Document info: created, modified, last opened, size"
                  >
                    <Info className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <DocInfoDialog
                  open={infoOpen}
                  doc={selected}
                  html={draft}
                  previousOpenedAt={openStamp?.id === selected.id ? openStamp.prev : null}
                  openedNowAt={openStamp?.id === selected.id ? openStamp.now : null}
                  onClose={() => setInfoOpen(false)}
                />

                {dayLogDateOf(selected) ? <DayLogBar date={dayLogDateOf(selected)!} /> : null}
                {weekLogStartOf(selected) ? <WeekLogBar start={weekLogStartOf(selected)!} /> : null}

                <div className="docs-editor-wrap">
                  <DocumentEditor
                    docId={selected.id}
                    value={draft}
                    onChange={handleBodyChange}
                    onBlur={() => void flushBody()}
                    documentFont={documentFont(selected)}
                    onDocumentFontChange={(font) => setDocumentFont(selected.id, font)}
                    placeholder="Start writing…"
                  />
                </div>
              </>
            )}
          </section>
        </div>

        <div className="docs-statusbar">
          <span className="docs-status-field">
            <span className="docs-crt-count">{docs.length}</span>
            document{docs.length === 1 ? "" : "s"}
            {folders.length ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="docs-crt-count">{folders.length}</span>
                folder{folders.length === 1 ? "" : "s"}
              </>
            ) : null}
          </span>
          <span className="docs-status-hint">Auto-save · Click image to resize · Export PDF</span>
        </div>
      </div>
    </div>
  )
}
