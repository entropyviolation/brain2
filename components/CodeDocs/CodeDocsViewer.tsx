/**
 * components/CodeDocs/CodeDocsViewer.tsx — In-app reader for `docs/`.
 *
 * Opens from the header **CODE DOCUMENTATION** key while Names is on.
 * The index is every file under `docs/`. Markdown is rendered. A folder of
 * pictures (the screenshot set) is a gallery. HTML mockups open in a frame.
 * Names mode itself is unchanged.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  loadCodeDocIndex,
  loadCodeDocObjectUrl,
  loadCodeDocText,
  type CodeDocFile,
  type CodeDocIndex,
  type CodeDocTransport,
} from "@/lib/code-docs-client"
import { codeDocRawUrl } from "@/lib/code-docs-path"
import { renderCodeDocMarkdown } from "@/lib/code-docs-render"
import "./code-docs.css"

type Sel = { kind: "file" | "dir"; path: string; hash?: string }

type TreeNode = {
  name: string
  path: string
  file?: CodeDocFile
  dirs: TreeNode[]
  files: TreeNode[]
}

function buildTree(files: CodeDocFile[]): TreeNode {
  const root: TreeNode = { name: "docs", path: "", dirs: [], files: [] }
  const dirs = new Map<string, TreeNode>([["", root]])
  const ensure = (dir: string): TreeNode => {
    const hit = dirs.get(dir)
    if (hit) return hit
    const slash = dir.lastIndexOf("/")
    const parent = slash >= 0 ? dir.slice(0, slash) : ""
    const name = slash >= 0 ? dir.slice(slash + 1) : dir
    const node: TreeNode = { name, path: dir, dirs: [], files: [] }
    ensure(parent).dirs.push(node)
    dirs.set(dir, node)
    return node
  }
  for (const file of files) ensure(file.dir).files.push({ name: file.name, path: file.path, file, dirs: [], files: [] })
  const sortNode = (node: TreeNode) => {
    node.dirs.sort((a, b) => a.name.localeCompare(b.name))
    node.files.sort((a, b) => a.name.localeCompare(b.name))
    node.dirs.forEach(sortNode)
  }
  sortNode(root)
  return root
}

function parentDirs(path: string): string[] {
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""
  if (!dir) return []
  const parts = dir.split("/")
  const out: string[] = []
  for (let i = 0; i < parts.length; i++) out.push(parts.slice(0, i + 1).join("/"))
  return out
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function CodeDocsViewer({ open, onOpenChange }: { open: boolean; onOpenChange: (next: boolean) => void }) {
  const [index, setIndex] = useState<CodeDocIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [stack, setStack] = useState<Sel[]>([{ kind: "file", path: "README.md" }])
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => new Set())
  const sel = stack[stack.length - 1] ?? { kind: "file" as const, path: "README.md" }

  useEffect(() => {
    if (!open) return
    let cancel = false
    setError(null)
    loadCodeDocIndex()
      .then((next) => {
        if (cancel) return
        setIndex(next)
        const hasReadme = next.files.some((file) => file.path === "README.md")
        if (!hasReadme) {
          const first = next.files.find((file) => file.kind === "markdown") ?? next.files[0]
          if (first) setStack([{ kind: "file", path: first.path }])
        }
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : "The docs folder could not be read.")
      })
    return () => {
      cancel = true
    }
  }, [open])

  useEffect(() => {
    const extra = sel.kind === "dir" ? [sel.path, ...parentDirs(sel.path)] : parentDirs(sel.path)
    if (extra.length === 0) return
    setOpenDirs((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const dir of extra) {
        if (!next.has(dir)) {
          next.add(dir)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [sel])

  const tree = useMemo(() => (index ? buildTree(index.files) : null), [index])
  const byPath = useMemo(() => {
    const map = new Map<string, CodeDocFile>()
    for (const file of index?.files ?? []) map.set(file.path, file)
    return map
  }, [index])

  const go = (next: Sel) => {
    setStack((prev) => {
      const cur = prev[prev.length - 1]
      if (cur && cur.kind === next.kind && cur.path === next.path && (cur.hash || "") === (next.hash || "")) return prev
      return [...prev, next]
    })
  }

  const needle = query.trim().toLowerCase()
  const matches = needle ? (index?.files ?? []).filter((file) => file.path.toLowerCase().includes(needle)).slice(0, 80) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="code-docs-dialog max-w-none gap-0 p-0 sm:max-w-none"
        data-testid="code-docs-viewer"
        data-ui-name="Code documentation"
        data-ui-help="The docs folder: markdown, screenshots, and the other files."
        data-ui-docs="components/CodeDocs/README.md"
      >
        <header className="code-docs-caption">
          <span className="code-docs-lamp" aria-hidden="true" />
          <DialogTitle className="code-docs-title">CODE DOCUMENTATION</DialogTitle>
          <DialogDescription className="code-docs-count">
            {index ? `${index.files.length} files in docs` : "docs"}
          </DialogDescription>
        </header>
        <div className="code-docs-body">
          <aside className="code-docs-index" aria-label="Docs files">
            <label className="code-docs-find">
              <span className="sr-only">Find a document</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a document"
                autoComplete="off"
              />
            </label>
            <div className="code-docs-pins">
              <button type="button" data-no95 onClick={() => go({ kind: "file", path: "README.md" })}>
                Docs index
              </button>
              <button type="button" data-no95 onClick={() => go({ kind: "dir", path: "screenshots" })}>
                Screenshots
              </button>
            </div>
            <div className="code-docs-tree">
              {needle
                ? matches.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      data-no95
                      className="code-docs-row"
                      aria-current={sel.kind === "file" && sel.path === file.path ? "page" : undefined}
                      onClick={() => go({ kind: "file", path: file.path })}
                    >
                      {file.path}
                    </button>
                  ))
                : tree
                  ? tree.files
                      .map((file) => <FileRow key={file.path} node={file} depth={0} sel={sel} onOpen={go} />)
                      .concat(
                        tree.dirs.map((dir) => (
                          <DirBranch
                            key={dir.path}
                            node={dir}
                            depth={0}
                            sel={sel}
                            openDirs={openDirs}
                            onToggle={(path) =>
                              setOpenDirs((prev) => {
                                const next = new Set(prev)
                                if (next.has(path)) next.delete(path)
                                else next.add(path)
                                return next
                              })
                            }
                            onOpen={go}
                          />
                        )),
                      )
                  : null}
              {needle && matches.length === 0 ? <p className="code-docs-empty">No file with that name.</p> : null}
            </div>
          </aside>
          <section className="code-docs-stage" aria-label="Document">
            <div className="code-docs-crumb">
              <button type="button" data-no95 disabled={stack.length < 2} onClick={() => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}>
                Back
              </button>
              <span>{sel.path || "docs"}</span>
            </div>
            {error ? <p className="code-docs-status">{error}</p> : null}
            {!error && index?.missing ? (
              <p className="code-docs-status">No docs folder was found next to this app.</p>
            ) : null}
            {!error && index && !index.missing ? (
              <DocPage sel={sel} files={index.files} byPath={byPath} transport={index.transport} onOpen={go} />
            ) : null}
            {!error && !index ? <p className="code-docs-status">Reading the docs folder…</p> : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DirBranch({
  node,
  depth,
  sel,
  openDirs,
  onToggle,
  onOpen,
}: {
  node: TreeNode
  depth: number
  sel: Sel
  openDirs: Set<string>
  onToggle: (path: string) => void
  onOpen: (sel: Sel) => void
}) {
  const open = openDirs.has(node.path)
  const current = sel.kind === "dir" && sel.path === node.path
  return (
    <div>
      <div className="code-docs-dir" style={{ paddingLeft: 8 + depth * 14 }}>
        <button type="button" data-no95 className="code-docs-twist" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`} onClick={() => onToggle(node.path)}>
          {open ? "–" : "+"}
        </button>
        <button
          type="button"
          data-no95
          className="code-docs-row"
          aria-current={current ? "page" : undefined}
          onClick={() => onOpen({ kind: "dir", path: node.path })}
        >
          {node.name}
        </button>
      </div>
      {open ? (
        <>
          {node.dirs.map((dir) => (
            <DirBranch key={dir.path} node={dir} depth={depth + 1} sel={sel} openDirs={openDirs} onToggle={onToggle} onOpen={onOpen} />
          ))}
          {node.files.map((file) => (
            <FileRow key={file.path} node={file} depth={depth + 1} sel={sel} onOpen={onOpen} />
          ))}
        </>
      ) : null}
    </div>
  )
}

function FileRow({ node, depth, sel, onOpen }: { node: TreeNode; depth: number; sel: Sel; onOpen: (sel: Sel) => void }) {
  const current = sel.kind === "file" && sel.path === node.path
  return (
    <button
      type="button"
      data-no95
      className="code-docs-row"
      style={{ paddingLeft: 28 + depth * 14 }}
      aria-current={current ? "page" : undefined}
      onClick={() => onOpen({ kind: "file", path: node.path })}
    >
      {node.name}
    </button>
  )
}

function DocPage({
  sel,
  files,
  byPath,
  transport,
  onOpen,
}: {
  sel: Sel
  files: CodeDocFile[]
  byPath: Map<string, CodeDocFile>
  transport: CodeDocTransport
  onOpen: (sel: Sel) => void
}) {
  if (sel.kind === "dir") {
    return <DirPage dir={sel.path} files={files} transport={transport} onOpen={onOpen} />
  }
  const file = byPath.get(sel.path)
  if (!file) return <p className="code-docs-status">That file is not in docs.</p>
  if (file.kind === "image") return <ImagePage file={file} byPath={byPath} transport={transport} hash={sel.hash} onOpen={onOpen} />
  if (file.kind === "html") return <HtmlPage file={file} transport={transport} />
  if (file.kind === "binary") {
    return (
      <div className="code-docs-page">
        <p>
          {file.name} · {formatBytes(file.bytes)}
        </p>
        {transport === "http" ? (
          <p>
            <a href={codeDocRawUrl(file.path)}>Open {file.name}</a>
          </p>
        ) : (
          <p>This file is in the docs folder. Open the app from the dev server to download it.</p>
        )}
      </div>
    )
  }
  return <TextPage file={file} hash={sel.hash} onOpen={onOpen} transport={transport} />
}

function TextPage({
  file,
  hash,
  onOpen,
  transport,
  bare,
}: {
  file: CodeDocFile
  hash?: string
  onOpen: (sel: Sel) => void
  transport: CodeDocTransport
  bare?: boolean
}) {
  const [body, setBody] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancel = false
    setBody(null)
    setFailed(false)
    loadCodeDocText(file.path, transport)
      .then((text) => {
        if (!cancel) setBody(text)
      })
      .catch(() => {
        if (!cancel) setFailed(true)
      })
    return () => {
      cancel = true
    }
  }, [file.path, transport])

  const asSource = file.kind === "text" && /\.(json|js|mjs|cjs|css|sh|yml|yaml|toml|xml|csv)$/i.test(file.name)
  const html = useMemo(() => {
    if (body == null || asSource) return ""
    return renderCodeDocMarkdown(body, file.path)
  }, [asSource, body, file.path])

  useEffect(() => {
    if (!hash || !pageRef.current) return
    const id = decodeURIComponent(hash.replace(/^#/, ""))
    if (!id) return
    pageRef.current.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: "start" })
  }, [hash, html, body])

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest("a[data-doc-path], a[data-doc-outside]")
    if (!link) return
    event.preventDefault()
    if (link.hasAttribute("data-doc-outside")) return
    const path = link.getAttribute("data-doc-path") || ""
    const nextHash = link.getAttribute("data-doc-hash") || ""
    if (path) onOpen({ kind: "file", path, hash: nextHash })
  }

  const inner = (
    <>
      {failed ? <p className="code-docs-status">That file could not be read.</p> : null}
      {body == null && !failed ? <p className="code-docs-status">Opening…</p> : null}
      {html ? <article className="code-docs-prose" dangerouslySetInnerHTML={{ __html: html }} /> : null}
      {asSource && body != null ? <pre className="code-docs-source">{body}</pre> : null}
    </>
  )
  if (bare) {
    return (
      <div ref={pageRef} onClick={onClick}>
        {inner}
      </div>
    )
  }
  return (
    <div className="code-docs-page" ref={pageRef} onClick={onClick}>
      {inner}
    </div>
  )
}

function ImagePage({
  file,
  byPath,
  transport,
  hash,
  onOpen,
}: {
  file: CodeDocFile
  byPath: Map<string, CodeDocFile>
  transport: CodeDocTransport
  hash?: string
  onOpen: (sel: Sel) => void
}) {
  const sidecarPath = file.path.replace(/\.[^.]+$/, ".txt")
  const sidecar = sidecarPath !== file.path ? byPath.get(sidecarPath) : undefined
  return (
    <div className="code-docs-page">
      <figure className="code-docs-shot">
        <DocImage file={file} transport={transport} />
        <figcaption>
          {file.path} · {formatBytes(file.bytes)}
        </figcaption>
      </figure>
      {sidecar ? <TextPage file={sidecar} hash={hash} onOpen={onOpen} transport={transport} bare /> : null}
    </div>
  )
}

function DocImage({ file, transport }: { file: CodeDocFile; transport: CodeDocTransport }) {
  const [src, setSrc] = useState<string | null>(transport === "http" ? codeDocRawUrl(file.path) : null)
  useEffect(() => {
    if (transport === "http") {
      setSrc(codeDocRawUrl(file.path))
      return
    }
    let url = ""
    let cancel = false
    loadCodeDocObjectUrl(file.path, transport)
      .then((next) => {
        if (cancel) URL.revokeObjectURL(next)
        else {
          url = next
          setSrc(next)
        }
      })
      .catch(() => {
        if (!cancel) setSrc(null)
      })
    return () => {
      cancel = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file.path, transport])
  if (!src) return <p className="code-docs-status">Opening…</p>
  return <img src={src} alt={file.name} />
}

function HtmlPage({ file, transport }: { file: CodeDocFile; transport: CodeDocTransport }) {
  const [srcDoc, setSrcDoc] = useState<string | null>(null)
  useEffect(() => {
    if (transport === "http") return
    let cancel = false
    loadCodeDocText(file.path, transport)
      .then((text) => {
        if (!cancel) setSrcDoc(text)
      })
      .catch(() => {
        if (!cancel) setSrcDoc("")
      })
    return () => {
      cancel = true
    }
  }, [file.path, transport])
  if (transport === "http") {
    return <iframe className="code-docs-frame" title={file.name} src={codeDocRawUrl(file.path)} sandbox="allow-scripts allow-forms allow-popups" />
  }
  if (srcDoc == null) return <p className="code-docs-status">Opening…</p>
  return <iframe className="code-docs-frame" title={file.name} srcDoc={srcDoc} sandbox="allow-scripts" />
}

function DirPage({
  dir,
  files,
  transport,
  onOpen,
}: {
  dir: string
  files: CodeDocFile[]
  transport: CodeDocTransport
  onOpen: (sel: Sel) => void
}) {
  const direct = files.filter((file) => file.dir === dir)
  const images = direct.filter((file) => file.kind === "image")
  const rest = direct.filter((file) => file.kind !== "image")
  const readme = rest.find((file) => file.name.toLowerCase() === "readme.md")
  const others = rest.filter((file) => file !== readme)
  return (
    <div className="code-docs-page">
      <h1 className="code-docs-folder-title">{dir || "docs"}</h1>
      {readme ? <TextPage file={readme} onOpen={onOpen} transport={transport} bare /> : null}
      {images.length > 0 && transport === "http" ? (
        <div className="code-docs-gallery">
          {images.map((file) => (
            <button key={file.path} type="button" data-no95 className="code-docs-thumb" onClick={() => onOpen({ kind: "file", path: file.path })}>
              <img src={codeDocRawUrl(file.path)} alt="" loading="lazy" decoding="async" />
              <span>{file.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      {images.length > 0 && transport !== "http" ? (
        <ul className="code-docs-list">
          {images.map((file) => (
            <li key={file.path}>
              <button type="button" data-no95 onClick={() => onOpen({ kind: "file", path: file.path })}>
                {file.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {others.length > 0 ? (
        <ul className="code-docs-list">
          {others.map((file) => (
            <li key={file.path}>
              <button type="button" data-no95 onClick={() => onOpen({ kind: "file", path: file.path })}>
                {file.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {direct.length === 0 ? <p className="code-docs-status">This folder has no files of its own. Open a folder inside it.</p> : null}
    </div>
  )
}
