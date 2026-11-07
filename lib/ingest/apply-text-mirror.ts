/**
 * lib/ingest/apply-text-mirror.ts — BIM Chat command: mirror long typed text into a Doc
 *
 * "Create a document in Docs called "Allietext" and add any text I type over 70
 * words" makes (or reuses) that Docs note and adds a `typed-text → doc-append` rule
 * (`lib/rules/`). The page listener (`components/Docs/text-mirror-host.tsx`) raises
 * the events; the rules engine delivers them. Chat only.
 * Planned: replace this regex with generic rule tools (create, list, pause, delete).
 */
import { parseMirrorCommand } from "@/lib/text-mirror/text-mirror"
import { ensureDoc } from "@/lib/rules/sink-doc-append"
import { useRulesStore } from "@/lib/rules/rules-store"
import type { TellReply } from "./apply-tell"

export function applyTextMirror(text: string): TellReply | null {
  const cmd = parseMirrorCommand(text)
  if (!cmd) return null
  const store = useRulesStore.getState()

  if (cmd.kind === "disable") {
    const live = store.rules.filter((r) => r.on && r.trigger.kind === "typed-text")
    if (!live.length) return { text: "Nothing is being auto-added right now.", status: "ok", summary: "Text mirror already off" }
    for (const r of live) store.update(r.id, { on: false })
    const names = live.map((r) => `"${r.sink.title}"`).join(", ")
    return { text: `Stopped. Nothing more is added to ${names}. What is already there stays.`, status: "ok", summary: "Text mirror off" }
  }

  const { task, created } = ensureDoc(cmd.title)
  const trigger = { kind: "typed-text" as const, overWords: cmd.overWords }
  const sink = { kind: "doc-append" as const, docId: task.id, title: task.description }
  const same = store.rules.find((r) => r.trigger.kind === "typed-text" && r.sink.title.toLowerCase() === task.description.toLowerCase())
  if (same) store.update(same.id, { on: true, trigger, sink })
  else store.add({ name: `Add typed text to ${task.description}`, trigger, sink })
  return {
    text:
      `${created ? "Made" : "Using"} "${task.description}" in Docs. From now on, anything you type by hand ` +
      `anywhere in the app that runs over ${cmd.overWords} words is added to it, with where and when as a header. ` +
      `Pasted text and text in a Docs page are skipped. Say "stop auto-adding typed text" to turn it off.`,
    status: "ok",
    summary: `Rule → ${task.description}`,
  }
}
