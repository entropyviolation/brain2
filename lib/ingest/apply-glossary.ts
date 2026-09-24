/**
 * lib/ingest/apply-glossary.ts — info / {prefix} info / commands / all commands
 *
 * Small seam so the executor can answer manuals without rewriting the command
 * switch. Unknown prefixes get a gentle hint listing known families.
 */
import { BIM_MAIN_INFO, ALL_COMMANDS, glossaryCommandsFor, glossaryInfoFor, knownGlossaryPrefixes } from "./command-glossary"
import type { ApplyResult } from "./types"

function ok(kind: ApplyResult["kind"], reply: string, summary: string): ApplyResult {
  return { status: "ok", kind, reply, summary }
}

export function applyMainInfo(): ApplyResult {
  return ok("info", BIM_MAIN_INFO, "Info")
}

export function applyAllCommands(): ApplyResult {
  return ok("info", ALL_COMMANDS, "All commands")
}

export function applyPrefixInfo(prefix: string): ApplyResult {
  const body = glossaryInfoFor(prefix)
  if (!body) {
    return ok(
      "info",
      `No manual for "${prefix}". Try one of: ${knownGlossaryPrefixes().join(", ")}.\nOr send info / all commands.`,
      "Unknown prefix info",
    )
  }
  return ok("info", body, `${prefix} info`)
}

export function applyPrefixCommands(prefix: string): ApplyResult {
  const body = glossaryCommandsFor(prefix)
  if (!body) {
    return ok(
      "info",
      `No command list for "${prefix}". Try one of: ${knownGlossaryPrefixes().join(", ")}.\nOr send all commands.`,
      "Unknown prefix commands",
    )
  }
  return ok("info", body, `${prefix} commands`)
}

/**
 * Match `all commands`, `{prefix} info`, `{prefix} commands` before the verb
 * parser treats them as grocery/log payloads. Returns null when not a glossary ask.
 */
export function tryApplyGlossary(raw: string): ApplyResult | null {
  const text = String(raw ?? "").replace(/^\uFEFF/, "").trim()
  if (!text) return null
  const lower = text.toLowerCase()

  if (lower === "all commands" || lower === "all cmds" || lower === "all command") {
    return applyAllCommands()
  }

  // Bare info / help / manual stay on the normal verb path (applyMainInfo / help).
  if (
    lower === "info" ||
    lower === "/info" ||
    lower === "help" ||
    lower === "/help" ||
    lower === "manual" ||
    lower === "instructions" ||
    lower === "cmds" ||
    lower === "commands"
  ) {
    return null
  }

  const infoHit = /^(.*?)\s+info$/i.exec(text)
  if (infoHit) {
    const prefix = infoHit[1]!.trim()
    if (prefix) return applyPrefixInfo(prefix)
  }

  const cmdsHit = /^(.*?)\s+(commands|command|cmds)$/i.exec(text)
  if (cmdsHit) {
    const prefix = cmdsHit[1]!.trim()
    if (prefix && prefix.toLowerCase() !== "all") return applyPrefixCommands(prefix)
  }

  return null
}
