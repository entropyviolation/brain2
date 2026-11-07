/**
 * components/Docs/text-mirror-host.tsx — Page-wide listener for the text mirror rule
 *
 * Mounted once in `app/layout.tsx`. While a typed-text rule is on (`lib/rules/`), it
 * watches every text field and contenteditable for real keystrokes. A field is
 * committed when it loses focus, is submitted (Enter or a click that empties it),
 * is removed, or the page hides. If what the person typed is over the word
 * threshold it is added to the rule's Docs note with a source and time header.
 * Skipped: pastes and drops (not typed), password fields, Docs pages themselves
 * (`.docs-editor`, which would re-add the whole page each time), and anything
 * marked `data-text-mirror="off"`.
 */
"use client"

import { useEffect } from "react"
import { sourceLabel } from "@/lib/text-mirror/text-mirror"
import { anyRuleListens, fireRuleEvent } from "@/lib/rules/rules-engine"

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLElement

type Typed = { text: string; startedAt: Date; source: string }

const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "email", "tel", ""])

function isMirrorable(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLElement)) return false
  if (el.closest('[data-text-mirror="off"], .docs-editor')) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has((el.getAttribute("type") ?? "text").toLowerCase())
  return el.isContentEditable
}

function valueOf(el: Field): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value
  return el.innerText
}

function textOf(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60)
}

/** Where the text was typed: the open dialog, then the field's own name. */
function describeSource(el: Field): string {
  const own = el.getAttribute("data-mirror-source")
  const dialog = el.closest('[role="dialog"], dialog, [aria-modal="true"]')
  const dialogName =
    dialog?.getAttribute("aria-label") ||
    textOf(dialog?.querySelector("h1, h2, h3, [class*='title']") ?? null) ||
    undefined
  const id = el.id
  const label = id ? textOf(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : ""
  const field =
    own ||
    el.getAttribute("aria-label") ||
    label ||
    textOf(el.closest("label")) ||
    el.getAttribute("placeholder") ||
    el.getAttribute("name") ||
    ""
  const tab = document.documentElement.getAttribute("data-boot-tab") || undefined
  return sourceLabel({ tab, dialog: dialogName, field: field.slice(0, 80) })
}

export function TextMirrorHost() {
  useEffect(() => {
    // Fields with real typing in them that have not been committed yet.
    const typed = new Map<Field, Typed>()

    const commit = (el: Field) => {
      const entry = typed.get(el)
      typed.delete(el)
      if (!entry) return
      fireRuleEvent({ kind: "typed-text", text: entry.text, source: entry.source, at: entry.startedAt })
    }

    // Commit every pending field that is no longer being edited.
    const sweep = (all = false) => {
      for (const el of [...typed.keys()]) {
        const done = all || !el.isConnected || el !== document.activeElement || valueOf(el).trim() === ""
        if (done) commit(el)
      }
    }

    const onInput = (e: Event) => {
      if (!e.isTrusted || !anyRuleListens("typed-text")) return
      const el = e.target
      if (!isMirrorable(el)) return
      const kind = (e as InputEvent).inputType ?? ""
      const prev = typed.get(el)
      const now = valueOf(el)
      // A paste or drop is not typing. Keep earlier typing; never start a field on a paste.
      if (/^insertFrom(Paste|Drop|Yank)/.test(kind)) {
        if (prev) typed.set(el, { ...prev, text: now })
        return
      }
      if (el instanceof HTMLInputElement && el.type === "password") return
      typed.set(el, { text: now, startedAt: prev?.startedAt ?? new Date(), source: prev?.source ?? describeSource(el) })
    }

    const later = (ms: number) => () => window.setTimeout(() => sweep(), ms)
    const onFocusOut = later(0)
    const onSubmitish = later(80)
    const onHide = () => {
      if (document.visibilityState === "hidden") sweep(true)
    }
    const onPageHide = () => sweep(true)
    const idle = window.setInterval(() => sweep(), 5000)

    document.addEventListener("input", onInput, true)
    document.addEventListener("focusout", onFocusOut, true)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") onSubmitish()
    }
    document.addEventListener("keydown", onKey, true)
    document.addEventListener("click", onSubmitish, true)
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.clearInterval(idle)
      document.removeEventListener("input", onInput, true)
      document.removeEventListener("focusout", onFocusOut, true)
      document.removeEventListener("keydown", onKey, true)
      document.removeEventListener("click", onSubmitish, true)
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [])
  return null
}
