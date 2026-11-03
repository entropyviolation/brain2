/**
 * lib/code-docs-client.ts — Load the `docs/` catalog and a file's text.
 *
 * The dev server (and the production window server) answer `/api/code-docs`.
 * A packaged window on `app://` has no such route, so the same catalog is
 * read through `window.desktop.codeDocs` when the HTTP call does not answer.
 */
import { codeDocRawUrl } from "@/lib/code-docs-path"

export type CodeDocKind = "markdown" | "text" | "image" | "html" | "binary"

export type CodeDocFile = {
  path: string
  name: string
  dir: string
  kind: CodeDocKind
  bytes: number
}

export type CodeDocTransport = "http" | "desktop"

export type CodeDocIndex = {
  transport: CodeDocTransport
  missing: boolean
  files: CodeDocFile[]
}

type DesktopRead =
  | { ok: true; mime: string; encoding: "utf8"; text: string; bytes: number }
  | { ok: true; mime: string; encoding: "base64"; data: string; bytes: number }
  | { ok: false; error?: string }

type DesktopBridge = {
  list: () => Promise<{ ok?: boolean; missing?: boolean; files?: CodeDocFile[] }>
  read: (rel: string) => Promise<DesktopRead>
}

function bridge(): DesktopBridge | null {
  const desktop = (window as unknown as { desktop?: { codeDocs?: DesktopBridge } }).desktop
  return desktop?.codeDocs ?? null
}

export async function loadCodeDocIndex(): Promise<CodeDocIndex> {
  try {
    const res = await fetch("/api/code-docs")
    if (res.ok) {
      const body = (await res.json()) as { ok?: boolean; missing?: boolean; files?: CodeDocFile[] }
      if (body?.ok && Array.isArray(body.files)) {
        return { transport: "http", missing: body.missing === true, files: body.files }
      }
    }
  } catch {
    /* fall through to the desktop bridge */
  }
  const desktop = bridge()
  if (desktop) {
    const body = await desktop.list()
    if (body?.ok && Array.isArray(body.files)) {
      return { transport: "desktop", missing: body.missing === true, files: body.files }
    }
  }
  throw new Error("The docs reader is not available. Quit Brain2 and start it again so the app can read the docs folder.")
}

export async function loadCodeDocText(rel: string, transport: CodeDocTransport): Promise<string> {
  if (transport === "http") {
    const res = await fetch(codeDocRawUrl(rel))
    if (!res.ok) throw new Error("That file is not in docs.")
    return res.text()
  }
  const desktop = bridge()
  if (!desktop) throw new Error("That file is not in docs.")
  const body = await desktop.read(rel)
  if (!body.ok || body.encoding !== "utf8") throw new Error("That file is not in docs.")
  return body.text
}

export async function loadCodeDocObjectUrl(rel: string, transport: CodeDocTransport): Promise<string> {
  if (transport === "http") return codeDocRawUrl(rel)
  const desktop = bridge()
  if (!desktop) throw new Error("That file is not in docs.")
  const body = await desktop.read(rel)
  if (!body.ok || body.encoding !== "base64") throw new Error("That file is not in docs.")
  const bin = Uint8Array.from(atob(body.data), (c) => c.charCodeAt(0))
  return URL.createObjectURL(new Blob([bin], { type: body.mime || "application/octet-stream" }))
}
