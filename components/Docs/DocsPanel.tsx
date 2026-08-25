/**
 * components/Docs/DocsPanel.tsx — Top-level Docs tab (Brainclip document editor)
 *
 * Windows 95–skinned document workspace: folder sidebar, document list, and a
 * single-pane WYSIWYG rich-text editor (Notion/Google Docs style) backed by
 * `note` items. Mounted from `app/page.tsx`.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FileText, Folder, Plus, Trash2, Save } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { APP_NAV_KEYS, writeStoredTab } from "@/lib/app-navigation"
import { DocumentEditor } from "@/components/Docs/DocumentEditor"
import {
  createDocument,
  deleteDocument,
  documentFolder,
  documentFont,
  documentStatus,
  listDocumentFolders,
  listDocuments,
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
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingBody = useRef<string | null>(null)

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

  // Keep selection valid when the filtered list changes.
  useEffect(() => {
    if (selectedId && docs.some((d) => d.id === selectedId)) return
    const fallback = visibleDocs[0]?.id ?? docs[0]?.id ?? null
    setSelectedId(fallback)
  }, [docs, visibleDocs, selectedId])

  useEffect(() => {
    if (selectedId) localStorage.setItem(APP_NAV_KEYS.docsDocId, selectedId)
    else localStorage.removeItem(APP_NAV_KEYS.docsDocId)
  }, [selectedId])

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.docsFolder, folderFilter)
  }, [folderFilter])

  // Sync local drafts when the selected document changes (or its remote body).
  useEffect(() => {
    if (!selected) {
      setDraft("")
      setTitleDraft("")
      setFolderDraft("")
      pendingBody.current = null
      setSaveState("saved")
      return
    }
    if (pendingBody.current === null) {
      setDraft(selected.body ?? "")
    }
    setTitleDraft(selected.description)
    setFolderDraft(documentFolder(selected))
  }, [selected?.id, selected?.body, selected?.description, selected?.attributes])

  const flushBody = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!selectedId || pendingBody.current === null) return
    setSaveState("saving")
    setDocumentBody(selectedId, pendingBody.current)
    pendingBody.current = null
    setSaveState("saved")
  }, [selectedId])

  useEffect(() => () => flushBody(), [flushBody])

  const handleBodyChange = useCallback(
    (markdown: string) => {
      setDraft(markdown)
      pendingBody.current = markdown
      setSaveState("dirty")
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flushBody, 450)
    },
    [flushBody],
  )

  const handleCreate = () => {
    flushBody()
    const folder = folderFilter !== ALL_FOLDER && folderFilter !== UNFILED ? folderFilter : ""
    const doc = createDocument("Untitled document", folder)
    setSelectedId(doc.id)
    setSaveState("saved")
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
    if (!selectedId) return
    if (folderDraft.trim() !== documentFolder(selected!)) {
      setDocumentFolder(selectedId, folderDraft)
    }
  }

  const folderChoices = useMemo(() => {
    const keys = [
      { id: ALL_FOLDER, label: "All documents" },
      { id: UNFILED, label: "Unfiled" },
      ...folders.map((f) => ({ id: f, label: f })),
    ]
    return keys
  }, [folders])

  // Allow restoring a persisted custom folder name once folders load.
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = localStorage.getItem(APP_NAV_KEYS.docsFolder)
    if (!stored) return
    if (stored === ALL_FOLDER || stored === UNFILED || folders.includes(stored)) {
      setFolderFilter(stored)
    }
  }, [folders])

  return (
    <div className="docs95">
      <div className="docs-window">
        <div className="docs-title-bar">
          <FileText className="docs-title-icon" aria-hidden />
          <h2>Brainclip Docs — Document Editor</h2>
        </div>

        <div className="docs-menubar" role="menubar">
          <button type="button" className="docs-btn" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
          <button type="button" className="docs-btn" onClick={flushBody} disabled={!selectedId || saveState === "saved"}>
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
          <button
            type="button"
            className="docs-btn docs-btn-danger"
            onClick={handleDelete}
            disabled={!selectedId}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          {selectedId && (
            <button
              type="button"
              className="docs-btn"
              onClick={() => setDocumentStatus(selectedId, "archived")}
              title="Archive document"
            >
              Archive
            </button>
          )}
        </div>

        <div className="docs-body">
          <aside className="docs-sidebar" aria-label="Documents">
            <div className="docs-sidebar-head">Folders</div>
            <ul className="docs-folder-list">
              {folderChoices.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="docs-folder-item"
                    aria-selected={folderFilter === f.id}
                    onClick={() => setFolderFilter(f.id)}
                  >
                    <Folder className="h-3.5 w-3.5" aria-hidden />
                    {f.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="docs-sidebar-head">Documents</div>
            {visibleDocs.length === 0 ? (
              <p className="docs-empty-side">No documents here. Click New to start a plan.</p>
            ) : (
              <ul className="docs-doc-list">
                {visibleDocs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="docs-doc-item"
                      aria-selected={selectedId === d.id}
                      onClick={() => {
                        flushBody()
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

          <section className="docs-main" aria-label="Editor">
            {!selected ? (
              <div className="docs-main-empty">
                <FileText className="h-10 w-10 opacity-40" />
                <p>Select a document or create a new one.</p>
                <button type="button" className="docs-btn" onClick={handleCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  New document
                </button>
              </div>
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
                  <span className={`docs-save-pill${saveState === "dirty" ? " is-dirty" : ""}`}>
                    {saveState === "dirty" ? "Unsaved" : saveState === "saving" ? "Saving…" : "Saved"}
                  </span>
                </div>

                <div className="docs-editor-wrap">
                  <DocumentEditor
                    docId={selected.id}
                    value={draft}
                    onChange={handleBodyChange}
                    onBlur={flushBody}
                    documentFont={documentFont(selected)}
                    onDocumentFontChange={(font) => setDocumentFont(selected.id, font)}
                    placeholder="Start writing your plan…"
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
          <span>Rich text · Google Fonts · Images · PDF ingest · Auto-save</span>
        </div>
      </div>
    </div>
  )
}
