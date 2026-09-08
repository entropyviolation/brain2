/**
 * components/Docs/DocsPanel.tsx — Top-level Docs tab (Brainclip document editor)
 *
 * Windows 95–skinned document workspace: folder sidebar, Google Docs-style
 * folder homepage, and a single-pane WYSIWYG editor. Document HTML is stored
 * in IndexedDB (`lib/doc-persist.ts`) so new notes actually survive refresh.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, FileText, FileUp, Folder, Plus, Trash2, Download } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { APP_NAV_KEYS, writeStoredTab } from "@/lib/app-navigation"
import { exportDocumentAsPdf } from "@/lib/doc-export"
import { listPersistedDocs } from "@/lib/doc-persist"
import { DocumentEditor } from "@/components/Docs/DocumentEditor"
import { DocsHome, docMatchesQuery } from "@/components/Docs/DocsHome"
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
  renameDocument,
  setDocumentBody,
  setDocumentFolder,
  setDocumentFont,
  setDocumentStatus,
} from "./doc-actions"
import "./docs.css"

const ALL_FOLDER = "__all__"
const UNFILED = "__unfiled__"

export function DocsPanel() {
  const tasks = useTaskStore((s) => s.tasks)
  const docs = useMemo(() => listDocuments(tasks), [tasks])
  const folders = useMemo(() => listDocumentFolders(docs), [docs])

  const [folderFilter, setFolderFilter] = useState<string>(() => {
    if (typeof window === "undefined") return ALL_FOLDER
    return localStorage.getItem(APP_NAV_KEYS.docsFolder) || ALL_FOLDER
  })
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(APP_NAV_KEYS.docsDocId)
  })
  const [draft, setDraft] = useState("")
  const [titleDraft, setTitleDraft] = useState("")
  const [folderDraft, setFolderDraft] = useState("")
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved")
  const [query, setQuery] = useState("")
  const [homeBodies, setHomeBodies] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingBody = useRef<string | null>(null)
  const selectedIdRef = useRef<string | null>(selectedId)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  selectedIdRef.current = selectedId

  const selected = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId],
  )

  const visibleDocs = useMemo(() => {
    if (folderFilter === ALL_FOLDER) return docs.filter((d) => documentStatus(d) !== "archived")
    if (folderFilter === UNFILED) {
      return docs.filter((d) => !documentFolder(d) && documentStatus(d) !== "archived")
    }
    return docs.filter((d) => documentFolder(d) === folderFilter && documentStatus(d) !== "archived")
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
    if (selectedId) localStorage.setItem(APP_NAV_KEYS.docsDocId, selectedId)
    else localStorage.removeItem(APP_NAV_KEYS.docsDocId)
  }, [selectedId])

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.docsFolder, folderFilter)
  }, [folderFilter])

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
      pendingBody.current = null
      setSaveState("saved")
      return
    }
    pendingBody.current = null
    setTitleDraft(selected.description)
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
    if (next && next !== selected?.description) renameDocument(selectedId, next)
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
        title: titleDraft.trim() || selected.description || "Untitled document",
        html,
        font: documentFont(selected),
      })
    })()
  }

  const folderChoices = useMemo(() => {
    const keys = [
      { id: ALL_FOLDER, label: "All documents" },
      { id: UNFILED, label: "Unfiled" },
      ...folders.map((f) => ({ id: f, label: f })),
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
    const stored = localStorage.getItem(APP_NAV_KEYS.docsFolder)
    if (!stored) return
    if (stored === ALL_FOLDER || stored === UNFILED || folders.includes(stored)) {
      setFolderFilter(stored)
    }
  }, [folders])

  const saveLabel = busy ?? (saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved")

  return (
    <div className="docs95">
      <div className="docs-window">
        <div className="docs-title-bar">
          <FileText className="docs-title-icon" aria-hidden />
          <h2>Brainclip Docs — Document Editor</h2>
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
              <ul className="docs-doc-list">
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
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      <span className="truncate">{d.description || "Untitled"}</span>
                      <span className="docs-doc-meta">{documentStatus(d)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="docs-main" aria-label={selected ? "Editor" : "Documents"}>
            {!selected ? (
              <DocsHome
                folderLabel={folderLabel}
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
                    className="docs-field"
                    value={folderDraft}
                    onChange={(e) => setFolderDraft(e.target.value)}
                    onBlur={handleFolderBlur}
                    list="docs-folder-suggestions"
                    placeholder="Folder"
                    aria-label="Folder"
                    style={{ width: 140 }}
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
                </div>

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
          <span>
            {docs.length} document{docs.length === 1 ? "" : "s"}
            {folders.length ? ` · ${folders.length} folder${folders.length === 1 ? "" : "s"}` : ""}
          </span>
          <span>Auto-save · Click image to resize · Export PDF</span>
        </div>
      </div>
    </div>
  )
}
