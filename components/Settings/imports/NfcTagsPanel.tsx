/**
 * components/Settings/imports/NfcTagsPanel.tsx — Settings → NFC tags
 *
 * Each tag is a sticker id. A scan sends `nfc:{id}` or `nfc:{id} 2`.
 * The list lives on the ingest store. Pairing and Simulate stay in Message ingest.
 * A saved tag’s download button signs a shortcut for that id into Downloads.
 */
"use client"

import { useState, type ReactNode } from "react"
import { Download, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useHabitsStore } from "@/lib/habits-store"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { nfcLine, nfcQuantity, nfcSlug, type NfcHabitCredit, type NfcTagKind } from "@/lib/ingest/nfc-tag"

const fieldClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  )
}

interface NfcShortcutBridge {
  saveNfcShortcut?: (spec: { id: string; name: string; askQuantity: boolean }) => Promise<{
    ok?: boolean
    filename?: string
    error?: string
  }>
}

interface NfcDraft {
  id: string
  name: string
  kind: NfcTagKind
  title: string
  intakeClass: "" | "food" | "drink" | "drug"
  minutes: string
  quantity: string
  leftTitle: string
  backTitle: string
  habitId: string
  habitCredit: NfcHabitCredit
}

function emptyNfcDraft(): NfcDraft {
  return {
    id: "",
    name: "",
    kind: "instant",
    title: "",
    intakeClass: "",
    minutes: "",
    quantity: "1",
    leftTitle: "left",
    backTitle: "back",
    habitId: "",
    habitCredit: "done",
  }
}

export function NfcTagsPanel() {
  const tags = useIngestStore((s) => s.nfcTags)
  const upsertNfcTag = useIngestStore((s) => s.upsertNfcTag)
  const removeNfcTag = useIngestStore((s) => s.removeNfcTag)
  const tasks = useHabitsStore((s) => s.tasks)
  const habits = tasks.filter((task) => !task.frequency || task.frequency === "daily")
  const [draft, setDraft] = useState<NfcDraft>(emptyNfcDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copyNote, setCopyNote] = useState<string | null>(null)
  const [signingId, setSigningId] = useState<string | null>(null)

  const line = nfcLine(draft.id || draft.name)

  const handleSave = () => {
    const minutes = Number(draft.minutes)
    const saved = useIngestStore.getState().nfcTags.find((tag) => tag.id === (editingId ?? nfcSlug(draft.id || draft.name)))
    upsertNfcTag({
      id: draft.id || draft.name,
      name: draft.name || draft.id,
      kind: draft.kind,
      title: draft.title || draft.name || draft.id,
      intakeClass: draft.kind === "instant" && draft.intakeClass ? draft.intakeClass : undefined,
      minutes: draft.kind === "instant" && Number.isFinite(minutes) ? minutes : undefined,
      quantity: draft.kind === "instant" ? nfcQuantity(Number(draft.quantity)) : undefined,
      leftTitle: draft.leftTitle,
      backTitle: draft.backTitle,
      habitId: draft.habitId || undefined,
      habitCredit: draft.habitCredit,
      lastAt: saved?.lastAt,
      lastSide: saved?.lastSide,
    })
    if (editingId && editingId !== nfcSlug(draft.id || draft.name)) removeNfcTag(editingId)
    setDraft(emptyNfcDraft())
    setEditingId(null)
  }

  const handleEdit = (id: string) => {
    const tag = useIngestStore.getState().nfcTags.find((row) => row.id === id)
    if (!tag) return
    setEditingId(tag.id)
    setDraft({
      id: tag.id,
      name: tag.name,
      kind: tag.kind,
      title: tag.title,
      intakeClass: tag.intakeClass ?? "",
      minutes: tag.minutes ? String(tag.minutes) : "",
      quantity: String(nfcQuantity(tag.quantity)),
      leftTitle: tag.leftTitle,
      backTitle: tag.backTitle,
      habitId: tag.habitId ?? "",
      habitCredit: tag.habitCredit,
    })
  }

  const handleDownload = async (id: string) => {
    const tag = useIngestStore.getState().nfcTags.find((row) => row.id === id)
    if (!tag || signingId) return
    const bridge = (window as unknown as { desktop?: NfcShortcutBridge }).desktop
    if (!bridge?.saveNfcShortcut) {
      setCopyNote("Open Brain2 on this Mac to download this shortcut.")
      return
    }
    setSigningId(tag.id)
    try {
      const result = await bridge.saveNfcShortcut({
        id: tag.id,
        name: tag.name,
        askQuantity: tag.kind === "instant" && Boolean(tag.intakeClass),
      })
      setCopyNote(
        result?.ok && result.filename
          ? `Saved ${result.filename} to Downloads.`
          : result?.error || "Could not sign the shortcut.",
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      setCopyNote(
        /no handler registered/i.test(message)
          ? "Restart Brain2, then download the shortcut again."
          : "Could not sign the shortcut.",
      )
    } finally {
      setSigningId(null)
    }
  }

  const handleCopy = async (id: string) => {
    const text = nfcLine(id)
    try {
      await navigator.clipboard.writeText(text)
      setCopyNote(`Copied ${text}`)
    } catch {
      setCopyNote(text)
    }
  }

  return (
    <div className="space-y-2">
      <Label>NFC tags</Label>
      <p className="text-xs text-muted-foreground">
        A sticker sends <code className="text-foreground">{line || "nfc:adderall"}</code>. Add a number when this
        scan is more than the saved quantity: <code className="text-foreground">nfc:adderall 2</code>. A dose title
        is the name without the count (<code className="text-foreground">10 mg adderall</code>). The count is
        written in front, including 1. The same tag within 20 seconds is ignored, so one tap cannot log twice.
        Pair the bot in Message ingest. The download button writes a signed shortcut into Downloads. Nothing is
        written on the sticker. The shortcut opens Telegram with the line already filled in. Tap Send. A dose
        (Drug, Food, or Drink) asks how many first. A door does not ask. Delete any older copy, add this one, then
        Shortcuts → Automation → NFC → scan the blank sticker → run this shortcut immediately. Turn Ask Before
        Running off.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field id="nfc-tag-id" label="Tag id">
          <Input
            id="nfc-tag-id"
            aria-label="NFC tag id"
            placeholder="adderall"
            value={draft.id}
            onChange={(e) => setDraft({ ...draft, id: e.target.value })}
          />
        </Field>
        <Field id="nfc-tag-name" label="Name">
          <Input
            id="nfc-tag-name"
            aria-label="NFC tag name"
            placeholder="Adderall"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field id="nfc-tag-kind" label="Kind">
          <select
            id="nfc-tag-kind"
            aria-label="NFC tag kind"
            className={fieldClass}
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value === "toggle" ? "toggle" : "instant" })}
          >
            <option value="instant">Instant</option>
            <option value="toggle">Door toggle</option>
          </select>
        </Field>
        {draft.kind === "instant" ? (
          <>
            <Field id="nfc-event-title" label="Event title">
              <Input
                id="nfc-event-title"
                aria-label="NFC event title"
                placeholder="10 mg adderall"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field id="nfc-intake" label="Intake">
              <select
                id="nfc-intake"
                aria-label="NFC intake class"
                className={fieldClass}
                value={draft.intakeClass}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    intakeClass: e.target.value === "food" || e.target.value === "drink" || e.target.value === "drug" ? e.target.value : "",
                  })
                }
              >
                <option value="">Event</option>
                <option value="drug">Drug</option>
                <option value="food">Food</option>
                <option value="drink">Drink</option>
              </select>
            </Field>
            <Field id="nfc-quantity" label="Quantity">
              <Input
                id="nfc-quantity"
                aria-label="NFC quantity"
                placeholder="Quantity, default 1"
                inputMode="numeric"
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
              />
            </Field>
            <Field id="nfc-minutes" label="Minutes">
              <Input
                id="nfc-minutes"
                aria-label="NFC duration minutes"
                placeholder="Minutes, optional"
                inputMode="numeric"
                value={draft.minutes}
                onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
              />
            </Field>
          </>
        ) : (
          <>
            <Field id="nfc-left-title" label="Left side">
              <Input
                id="nfc-left-title"
                aria-label="NFC left title"
                placeholder="left"
                value={draft.leftTitle}
                onChange={(e) => setDraft({ ...draft, leftTitle: e.target.value })}
              />
            </Field>
            <Field id="nfc-back-title" label="Back side">
              <Input
                id="nfc-back-title"
                aria-label="NFC back title"
                placeholder="back"
                value={draft.backTitle}
                onChange={(e) => setDraft({ ...draft, backTitle: e.target.value })}
              />
            </Field>
          </>
        )}
        <Field id="nfc-habit" label="Daily habit">
          <select
            id="nfc-habit"
            aria-label="NFC daily habit"
            className={fieldClass}
            value={draft.habitId}
            onChange={(e) => setDraft({ ...draft, habitId: e.target.value })}
          >
            <option value="">No daily habit</option>
            {habits.map((habit) => (
              <option key={habit.id} value={habit.id}>
                {habit.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nfc-habit-credit" label="Habit credit">
          <select
            id="nfc-habit-credit"
            aria-label="NFC habit credit"
            className={fieldClass}
            value={draft.habitCredit}
            onChange={(e) => setDraft({ ...draft, habitCredit: e.target.value === "add" ? "add" : "done" })}
          >
            <option value="done">Mark done</option>
            <option value="add">Add the quantity</option>
          </select>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={handleSave} disabled={!nfcSlug(draft.id || draft.name)}>
          {editingId ? "Update tag" : "Add tag"}
        </Button>
        {editingId ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditingId(null)
              setDraft(emptyNfcDraft())
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      {tags.map((tag) => (
        <div key={tag.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0">
            <code>{nfcLine(tag.id)}</code>
            <span className="text-muted-foreground"> · {tag.name}</span>
            {tag.kind === "instant" && tag.quantity && tag.quantity > 1 ? (
              <span className="text-muted-foreground"> · ×{tag.quantity}</span>
            ) : null}
            {tag.lastAt ? (
              <span className="block text-xs text-muted-foreground">
                Last scan {new Date(tag.lastAt).toLocaleString()}
                {tag.lastSide ? ` · ${tag.lastSide === "out" ? "left" : "back"}` : ""}
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Download shortcut for ${tag.name}`}
              disabled={signingId === tag.id}
              onClick={() => void handleDownload(tag.id)}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void handleCopy(tag.id)}>
              Copy
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => handleEdit(tag.id)}>
              Edit
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove ${tag.name}`}
              onClick={() => removeNfcTag(tag.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </span>
        </div>
      ))}
      {copyNote ? <p className="text-xs text-muted-foreground">{copyNote}</p> : null}
    </div>
  )
}
