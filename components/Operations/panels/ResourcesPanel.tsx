/**
 * components/Operations/panels/ResourcesPanel.tsx — Operation resources
 *
 * The same `Task.resources` list as Item Detail → Resources: web links, copied
 * files, and desktop file references (`lib/item-resources.ts`,
 * `lib/resource-links.ts`). `useNote` says what each one is for in this
 * operation. Older `has-resource` child tasks stay on `getResources` for the
 * computer-project desk; this tab does not create more of them.
 */
"use client"

import { useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { ItemResource, Task } from "@/lib/types"
import { fileToFileValue } from "@/components/Lists/attributes/helpers"
import { enrichWithText } from "@/components/Lists/attributes/AttributeValueField"
import {
  isWebLinkResource,
  RESOURCE_KIND_LABEL,
  resourceKind,
  toResource,
  webLinkResource,
} from "@/lib/item-resources"
import { displayPath, getFileLinkBridge, isLinkedResource, linkedResource } from "@/lib/resource-links"
import { IsolatedInput } from "@/components/ui/isolated-text-field"

function writeResources(operationId: string, resources: ItemResource[]) {
  const store = useTaskStore.getState()
  const op = store.tasks.find((t) => t.id === operationId)
  if (!op) return
  store.updateTask({ ...op, resources: resources.length ? resources : undefined })
}

const EMPTY_RESOURCES: ItemResource[] = []

function currentResources(operationId: string): ItemResource[] {
  return useTaskStore.getState().tasks.find((t) => t.id === operationId)?.resources ?? EMPTY_RESOURCES
}

export function ResourcesPanel({ operation }: { operation: Task; onOpenItem?: (id: string) => void }) {
  const resources =
    useTaskStore((s) => s.tasks.find((t) => t.id === operation.id)?.resources) ?? EMPTY_RESOURCES
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addLink = () => {
    const made = webLinkResource(draft)
    if (!made) {
      setError("Enter a web address.")
      return
    }
    setError(null)
    writeResources(operation.id, [...currentResources(operation.id), made])
    setDraft("")
  }

  const attachCopies = async (files: File[]) => {
    if (files.length === 0) return
    setError(null)
    setBusy(true)
    let added: ItemResource[]
    try {
      added = await Promise.all(files.map(async (file) => toResource(await fileToFileValue(file))))
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : "Could not store the file.")
      return
    }
    setBusy(false)
    writeResources(operation.id, [...currentResources(operation.id), ...added])
    void enrichWithText(added).then((enriched) => {
      const byId = new Map(enriched.filter((f) => f.extractedText).map((f) => [f.id, f.extractedText]))
      if (byId.size === 0) return
      writeResources(
        operation.id,
        currentResources(operation.id).map((r) => (byId.has(r.id) ? { ...r, extractedText: byId.get(r.id) } : r)),
      )
    })
  }

  const referenceFile = async () => {
    const bridge = getFileLinkBridge()
    if (!bridge) {
      setError("File references open in the desktop app.")
      return
    }
    setError(null)
    const stats = await bridge.pick({ folders: false }).catch(() => [])
    if (stats.length === 0) return
    const added = stats.map((stat) => linkedResource(stat))
    writeResources(operation.id, [...currentResources(operation.id), ...added])
    for (const resource of added) {
      if (!resource.link) continue
      void bridge
        .extractText(resource.link.path)
        .then((text) => {
          if (!text) return
          writeResources(
            operation.id,
            currentResources(operation.id).map((r) => (r.id === resource.id ? { ...r, extractedText: text } : r)),
          )
        })
        .catch(() => undefined)
    }
  }

  const setUseNote = (id: string, note: string) => {
    writeResources(
      operation.id,
      currentResources(operation.id).map((r) => (r.id === id ? { ...r, useNote: note.trim() || undefined } : r)),
    )
  }

  const remove = (id: string) => {
    writeResources(
      operation.id,
      currentResources(operation.id).filter((r) => r.id !== id),
    )
  }

  return (
    <div className="ops-panel">
      <div className="ops-deck">
        <div className="ops-deck-head">Resources</div>
        {resources.length === 0 ? (
          <p className="ops-hint">
            No resources yet. Add a link, a file from this computer, or a reference to a file that stays where it is.
          </p>
        ) : (
          <ul className="ops-res-list">
            {resources.map((res) => {
              const kind = resourceKind(res)
              const where = isWebLinkResource(res)
                ? res.url
                : isLinkedResource(res)
                  ? displayPath(res.link?.path ?? "")
                  : "Stored on this device"
              return (
                <li key={res.id} className="ops-res">
                  <div className="ops-res-head">
                    <span className="ops-res-kind">{RESOURCE_KIND_LABEL[kind]}</span>
                    <span className="ops-res-name" title={res.name}>
                      {res.url ? (
                        <a href={res.url} target="_blank" rel="noreferrer">
                          {res.name}
                        </a>
                      ) : (
                        res.name
                      )}
                    </span>
                    <button
                      type="button"
                      className="ops-btn ops-icon-btn"
                      title="Remove resource"
                      aria-label={`Remove ${res.name}`}
                      onClick={() => remove(res.id)}
                    >
                      ×
                    </button>
                  </div>
                  {where && <p className="ops-res-where">{where}</p>}
                  <IsolatedInput
                    value={res.useNote ?? ""}
                    onCommit={(note) => setUseNote(res.id, note)}
                    placeholder="What this is for here"
                    aria-label={`What ${res.name} is for here`}
                    className="ops-input"
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="ops-add-row ops-res-add">
        <input
          className="ops-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLink()}
          placeholder="https://…"
          aria-label="Link address"
        />
        <button
          type="button"
          className="ops-btn ops-btn-default ops-keycap is-primary"
          data-no95=""
          onClick={addLink}
          disabled={busy}
        >
          Add link
        </button>
        <button
          type="button"
          className="ops-btn ops-keycap"
          data-no95=""
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Adding…" : "Add file"}
        </button>
        <button type="button" className="ops-btn ops-keycap" data-no95="" onClick={() => void referenceFile()} disabled={busy}>
          Reference file
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          aria-label="Files on this computer"
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            e.target.value = ""
            void attachCopies(files)
          }}
        />
      </div>
      {error && <p className="ops-hint">{error}</p>}
    </div>
  )
}

export default ResourcesPanel
