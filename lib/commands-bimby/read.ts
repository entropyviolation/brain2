/**
 * lib/commands-bimby/read.ts — What a BIM chat line asks of the Commands BIMBY, in code
 *
 *   save     "remember this command which is to autodownload a folder of mp3s"   → asks you to paste it next
 *            "remember this command for playlistlab: cd ~/spotifydownloader && npm start"  → kept at once
 *            "the command to start the hub is npm run phone:hub"                  → kept at once
 *   recall   "what is the command to launch the llm server or whatever?"          → the saved command
 *            "how do I reboot brain2 mobile?"
 *   list     "list my commands", "what commands do you know?"
 *   forget   "forget the command for playlistlab"
 *
 * Pure: no stores. A recall is only a recall when a known command matches (`bestCommands`); the caller checks.
 */

export type CommandAsk =
  | { kind: "save"; name: string; command?: string }
  | { kind: "save-unnamed"; command: string }
  | { kind: "recall"; words: string }
  | { kind: "list" }
  | { kind: "forget"; words: string }

/** Text that reads as a shell line: a known program first, a path, or shell punctuation. */
export function looksLikeShell(raw: string): boolean {
  const s = raw.trim().replace(/^\$\s*/, "")
  if (!s) return false
  if (/^(?:cd|ls|npm|npx|node|python3?|pip3?|uv|brew|git|gh|curl|wget|ollama|bash|sh|zsh|open|launchctl|docker|yarn|pnpm|bun|make|ssh|scp|rsync|ffmpeg|yt-dlp|spotdl|tsx|xcrun|xcodebuild|sudo|export|source|kill|pkill|lsof|caffeinate|defaults|osascript|cp|mv|mkdir|rm|chmod|tar|unzip|zip|find|grep|cat|echo|code|cursor|claude|vercel|supabase|prisma|pod|swift|cargo|go|java|ruby|deno|BRAIN2_\w+=)(?:\s|$)/i.test(s)) return true
  if (/^(?:\.{1,2}\/|~\/|\/[\w.-]+\/)/.test(s)) return true
  return /\s&&\s|\s\|\s|\s--?[a-z][\w-]*|^[A-Z_][A-Z0-9_]*=\S/.test(s)
}

/** Strip ``` fences and a leading "$ " from a pasted command. Inner lines are kept as pasted. */
export function cleanPaste(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n").trim()
  const fence = /^```[\w-]*\n?([\s\S]*?)\n?```$/.exec(s)
  if (fence) s = fence[1]!.trim()
  const tick = /^`([^`]+)`$/.exec(s)
  if (tick) s = tick[1]!.trim()
  return s
    .split("\n")
    .map((l) => l.replace(/^\$\s+/, ""))
    .join("\n")
    .trim()
}

/** "which is to autodownload a folder of mp3s" → "autodownload a folder of mp3s". */
function purposeOf(raw: string): string {
  return raw
    .trim()
    .replace(/^[:,\-–—\s]+/, "")
    .replace(/^(?:(?:which|that)\s+(?:is\s+)?(?:(?:used\s+)?(?:to|for)\s+|will\s+|does\s+|lets?\s+(?:me|you)\s+)?|(?:is\s+)?(?:to|for)\s+|(?:called|named)\s+)/i, "")
    .replace(/^(?:how\s+)?to\s+/i, "")
    .replace(/[.!\s]+$/, "")
    .trim()
}

const SAVE = /^(?:(?:ok(?:ay)?|hey|bim|please)[,\s]+)*(?:can\s+you\s+|could\s+you\s+)?(?:remember|save|store|keep|add|note)\s+(?:this|the|a|my|that|new|one\s+more)?\s*(?:new\s+)?(?:terminal\s+|shell\s+|cli\s+|command[-\s]line\s+)?(?:command|cmd)\b([\s\S]*)$/i
const THE_COMMAND_IS = /^(?:the\s+)?(?:command|cmd)\s+(?:to|for)\s+(.{2,80}?)\s+is\s*:?\s+([\s\S]+)$/i
const LIST = /^(?:(?:list|show)(?:\s+me)?\s+(?:all\s+)?(?:my|the|your|all|saved)?\s*(?:saved\s+)?commands|what\s+commands\s+(?:do\s+(?:you|i)\s+(?:know|have)|are\s+(?:there|saved))|(?:my|saved)\s+commands|commands)\s*\??$/i
const FORGET = /^(?:please\s+)?(?:forget|delete|remove|drop)\s+(?:the\s+|my\s+|that\s+)?(?:saved\s+)?(?:command|cmd)\s+(?:for\s+|to\s+|called\s+)?(.{2,80}?)[.!]?$/i

/** A question shape that asks how to run something. */
const ASKS =
  /^(?:what(?:'s|s| is| was)?|how(?:'s| is| do| does| did| can| to| would)?|which|remind\s+me|tell\s+me|give\s+me|show\s+me|where(?:'s| is)?|can\s+you|could\s+you|again|i\s+(?:forgot|forget|need)|wait)\b|\?\s*$/i
const RUN_WORDS = /\b(?:command|commands|cmd|run|launch|start|open|boot|reboot|restart|reinstall|relaunch|kick\s*start|spin\s+up|fire\s+up|turn\s+on|bring\s+up|update)\b/i

/** Read one line, or null when it is not for the Commands BIMBY. */
export function readCommandAsk(raw: string): CommandAsk | null {
  const text = raw.replace(/\r\n/g, "\n").trim()
  if (!text || text.length > 4000) return null

  const save = SAVE.exec(text)
  if (save) {
    const rest = save[1] ?? ""
    const nl = rest.indexOf("\n")
    if (nl >= 0) {
      const name = purposeOf(rest.slice(0, nl).replace(/:\s*$/, ""))
      const command = cleanPaste(rest.slice(nl + 1))
      if (command) return name ? { kind: "save", name, command } : { kind: "save-unnamed", command }
    }
    const tick = /`{1,3}([^`]+)`{1,3}/.exec(rest)
    if (tick) {
      const name = purposeOf(rest.slice(0, tick.index).replace(/\s*(?:is|:)\s*$/i, ""))
      return name ? { kind: "save", name, command: tick[1]!.trim() } : { kind: "save-unnamed", command: tick[1]!.trim() }
    }
    const colon = rest.indexOf(":")
    if (colon >= 0 && looksLikeShell(rest.slice(colon + 1))) {
      const name = purposeOf(rest.slice(0, colon))
      const command = cleanPaste(rest.slice(colon + 1))
      return name ? { kind: "save", name, command } : { kind: "save-unnamed", command }
    }
    const is = /\s(?:is|=|->|→)\s+/.exec(rest)
    if (is && looksLikeShell(rest.slice(is.index + is[0].length))) {
      const name = purposeOf(rest.slice(0, is.index))
      const command = cleanPaste(rest.slice(is.index + is[0].length))
      return name ? { kind: "save", name, command } : { kind: "save-unnamed", command }
    }
    const name = purposeOf(rest)
    return { kind: "save", name }
  }

  const told = THE_COMMAND_IS.exec(text)
  if (told && looksLikeShell(told[2]!)) return { kind: "save", name: purposeOf(told[1]!), command: cleanPaste(told[2]!) }

  if (text.includes("\n")) return null
  if (LIST.test(text)) return { kind: "list" }
  const forget = FORGET.exec(text)
  if (forget) return { kind: "forget", words: forget[1]! }
  if (ASKS.test(text) && RUN_WORDS.test(text)) return { kind: "recall", words: text }
  return null
}

/** "autodownload a folder of mp3s" → "Autodownload a folder of mp3s". */
export const titleOf = (name: string) => (name ? name[0]!.toUpperCase() + name.slice(1) : name)
