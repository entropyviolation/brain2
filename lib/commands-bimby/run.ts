/**
 * lib/commands-bimby/run.ts — The Commands BIMBY in BIM chat: remember a command, say it back when asked
 *
 * Code only, no model. "Remember this command which is to autodownload a folder of mp3s" with no command in it
 * makes BIM ask for the paste; the next line is kept word for word (``` fences and a leading "$ " are stripped).
 * The wait is in memory and lasts `PASTE_TTL_MS`. "cancel" drops it; a question that is not a shell line drops it
 * and goes on to the other lanes.
 */

import { bestCommands, commandId, wordsOf, type SavedCommand } from "./commands.mjs"
import { cleanPaste, looksLikeShell, readCommandAsk, titleOf } from "./read"
import { knownCommands, useCommandsStore } from "./store"

export const PASTE_TTL_MS = 15 * 60 * 1000

type Waiting = { kind: "paste"; name: string; at: number } | { kind: "name"; command: string; at: number }
let waiting: Waiting | null = null

export function resetCommandsForTests(): void {
  waiting = null
}

export interface CommandsReply {
  text: string
  route: string
}

const CLI = "In Terminal, `bim <words>` prints the same (`bim` alone lists them all)."

/** How one command is said back: the name, the command on its own line, then what it does. */
export function sayCommand(c: SavedCommand): string {
  return [`${c.name}:`, c.command, ...(c.does ? [c.does] : [])].join("\n")
}

function keep(name: string, command: string, now: Date): CommandsReply {
  const words = wordsOf(name).filter((w) => w.length > 2)
  const id = commandId(name)
  const was = knownCommands().find((c) => c.id === id)
  useCommandsStore.getState().save({ id, name: titleOf(name), command, words }, now)
  waiting = null
  return {
    text: `${was ? "Updated" : "Saved"}: ${titleOf(name)}.\n${command}\n\nAsk me "what's the command to ${name}?" any time. ${CLI}`,
    route: `COMMANDS · ${was ? "updated" : "saved"} · code`,
  }
}

/** Answer a line, or null when it is not for this BIMBY. Never throws. */
export function tryCommands(text: string, now: Date): CommandsReply | null {
  const held = waiting
  if (held && now.getTime() - held.at > PASTE_TTL_MS) waiting = null
  if (waiting) {
    const t = text.trim()
    if (/^(?:cancel|never\s*mind|nvm|stop|skip|forget it)\.?$/i.test(t)) {
      waiting = null
      return { text: "Okay, nothing saved.", route: "COMMANDS · cancelled · code" }
    }
    if (waiting.kind === "paste") {
      // A new question in place of the paste: let it go on, and stop waiting.
      if (/\?\s*$/.test(t) && !looksLikeShell(t)) {
        waiting = null
      } else {
        const command = cleanPaste(text)
        if (command) return keep(waiting.name, command, now)
      }
    } else if (!looksLikeShell(t) && t.length <= 80) {
      return keep(t.replace(/[.!]+$/, ""), waiting.command, now)
    } else {
      waiting = null
    }
  }

  const ask = readCommandAsk(text)
  if (!ask) return null
  const all = knownCommands()
  switch (ask.kind) {
    case "save": {
      if (ask.command) return keep(ask.name || "untitled command", ask.command, now)
      if (!ask.name) {
        waiting = { kind: "paste", name: "untitled command", at: now.getTime() }
        return { text: "Paste the command and I'll keep it. Next time, say what it is for too (\"remember this command to …\").", route: "COMMANDS · waiting · code" }
      }
      waiting = { kind: "paste", name: ask.name, at: now.getTime() }
      return { text: `Okay: ${titleOf(ask.name)}. Paste the command as your next message and I'll keep it word for word. (cancel to stop)`, route: "COMMANDS · waiting · code" }
    }
    case "save-unnamed":
      waiting = { kind: "name", command: ask.command, at: now.getTime() }
      return { text: `What is it for? A few words, like "autodownload a folder of mp3s".\n${ask.command}`, route: "COMMANDS · waiting · code" }
    case "list":
      return {
        text: [`Commands I know (${all.length}):`, ...all.map((c) => `• ${c.name}: ${c.command}`), "", CLI].join("\n"),
        route: "COMMANDS · list · code",
      }
    case "forget": {
      const hit = bestCommands(all, ask.words)
      if (hit.length !== 1) return { text: hit.length ? `Which one: ${hit.map((c) => c.name).join(" or ")}?` : `I don't have a command for "${ask.words}".`, route: "COMMANDS · forget · code" }
      useCommandsStore.getState().forget(hit[0]!.id, now)
      return { text: `Forgot: ${hit[0]!.name}.`, route: "COMMANDS · forgot · code" }
    }
    case "recall": {
      const hit = bestCommands(all, ask.words)
      if (!hit.length) return null
      if (hit.length === 1) return { text: sayCommand(hit[0]!), route: "COMMANDS · recall · code" }
      return { text: [`A few match:`, ...hit.map((c) => `\n${sayCommand(c)}`)].join("\n"), route: "COMMANDS · recall · code" }
    }
  }
}
