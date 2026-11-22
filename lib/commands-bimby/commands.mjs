/**
 * lib/commands-bimby/commands.mjs — The Commands BIMBY's list and its matcher, shared by BIM chat and the `bim` CLI
 *
 * Plain JS on purpose: `scripts/bim.mjs` imports this file with plain node, and the app imports it from TypeScript
 * (as `lib/ingest/telegram-ui.mjs` is). Pure: no stores, no files, no network.
 *
 * A command is a name, what it does, the shell text, and extra words people use for it ("llm server" for Ollama).
 * The shipped ones (`SEED_COMMANDS`) are the programs on this Mac. Saved ones live in the vault (`brain2-commands`,
 * `store.ts`). A saved command with a seed's id replaces it; `gone` hides one (a tombstone, so a vault union keeps it hidden).
 */

/**
 * @typedef {{ id: string, name: string, does?: string, command: string, words?: string[], at?: string, source?: "seed" | "you", gone?: boolean }} SavedCommand
 */

/** @type {SavedCommand[]} */
export const SEED_COMMANDS = [
  {
    id: "brain2-desktop",
    name: "Brain2 desktop app",
    does: "Starts Brain2 as the desktop app (Next on port 3000, then Electron).",
    command: "cd ~/brain2 && npm run electron:dev",
    words: ["brain2", "brain", "desktop", "electron", "app", "cogs", "mac"],
  },
  {
    id: "brain2-web",
    name: "Brain2 in the browser",
    does: "Starts the Brain2 dev server only. Open http://localhost:3000.",
    command: "cd ~/brain2 && npm run dev",
    words: ["brain2", "brain", "web", "browser", "dev", "server", "localhost", "3000"],
  },
  {
    id: "brain2-ios",
    name: "Brain2 iPhone reinstall",
    does: "Builds Brain2 and puts it on the iPhone. The phone must be unlocked, on the same Wi-Fi or plugged in. Wait for “[ios-reinstall] … installed”.",
    command: "cd ~/brain2 && BRAIN2_IOS_TEAM_ID=25YWDVDMKT npm run ios:reinstall -- --force",
    words: ["brain2", "mobile", "iphone", "phone", "ios", "reboot", "reinstall", "install", "update", "app"],
  },
  {
    id: "phone-hub",
    name: "Restart the Mac hub",
    does: "Restarts the phone hub (texts, sync and models for the iPhone). It runs under launchd as com.brain2.hub.",
    command: "launchctl kickstart -k gui/$(id -u)/com.brain2.hub",
    words: ["hub", "phone", "mac", "texts", "sync", "launchd", "8787"],
  },
  {
    id: "ollama",
    name: "Restart the local LLM server (Ollama)",
    does: "Restarts Ollama, the local model server BIM uses. Check it with: curl -s http://127.0.0.1:11434/api/tags",
    command: "brew services restart ollama",
    words: ["llm", "ollama", "model", "models", "server", "ai", "qwen", "local", "11434"],
  },
  {
    id: "playlistlab",
    name: "PlaylistLab",
    does: "Starts PlaylistLab (Spotify playlists to MP3 ZIPs, Analyzer, EveryNoise). Open http://localhost:3003.",
    command: "cd ~/spotifydownloader && npm start",
    words: ["playlistlab", "playlist", "playlists", "spotify", "mp3", "mp3s", "download", "zip", "music", "everynoise"],
  },
  {
    id: "baby-animal-game",
    name: "Baby animal game",
    does: "Starts the baby animal game. Open http://127.0.0.1:5188.",
    command: "cd ~/baby-animal-game && npm run dev",
    words: ["baby", "animal", "animals", "game", "village", "5188"],
  },
]

/** Words that ask for a command but say nothing about which one. */
const ASKING = new Set(
  "a an the to of for in on at by with and or my me i is it its what whats what's how do does can could you your tell give show remind which command commands cmd line terminal shell run running launch launching start starting open opening boot reboot restart get use type again or whatever thing stuff that this again please".split(" "),
)

/** Lowercase words, apostrophes kept. */
export function wordsOf(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^a-z0-9']+/)
    .filter(Boolean)
}

/** `downloads` → `download`, `launching` → `launch`. Enough to meet a name's words. */
export function stemWord(w) {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3)
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1)
  return w
}

/** Seeds and saved commands as one list: a saved one replaces a seed with its id, `gone` hides it. Newest saved last. */
export function mergeCommands(seeds, saved) {
  /** @type {Map<string, SavedCommand>} */
  const byId = new Map()
  for (const s of seeds) byId.set(s.id, { ...s, source: "seed" })
  for (const s of saved ?? []) {
    if (!s || typeof s.id !== "string") continue
    if (s.gone) byId.delete(s.id)
    else if (typeof s.command === "string" && s.command.trim()) byId.set(s.id, { ...s, source: s.source ?? "you" })
  }
  return [...byId.values()]
}

/** The words a command is known by, stemmed: its name, what it does, its extra words. */
function termsOf(c) {
  const name = new Set(wordsOf(c.name).map(stemWord))
  const extra = new Set((c.words ?? []).flatMap(wordsOf).map(stemWord))
  const does = new Set(wordsOf(c.does).map(stemWord))
  return { name, extra, does }
}

/**
 * The commands a question means, best first, each with a score. The question's words (less "how do I run the
 * command for") score 3 each on the name, 2 on the extra words, 1 on what it does. Only commands that score
 * on the name or the extra words come back: "does" alone is too loose to answer from.
 * @returns {{ command: SavedCommand, score: number, hits: string[] }[]}
 */
export function matchCommands(list, question) {
  const asked = [...new Set(wordsOf(question).filter((w) => !ASKING.has(w)).map(stemWord))]
  if (!asked.length) return []
  const out = []
  for (const c of list) {
    const t = termsOf(c)
    let score = 0
    let strong = 0
    const hits = []
    for (const w of asked) {
      const s = t.name.has(w) ? 3 : t.extra.has(w) ? 2 : t.does.has(w) ? 1 : 0
      if (s) hits.push(w)
      if (s >= 2) strong++
      score += s
    }
    if (strong) out.push({ command: c, score, hits })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** The one command a question means, or the tied best when two are equally likely. Empty: none. */
export function bestCommands(list, question) {
  const hits = matchCommands(list, question)
  if (!hits.length) return []
  const top = hits[0].score
  return hits.filter((h) => h.score === top).map((h) => h.command)
}

/** A short id from a name: "Autodownload a folder of mp3s" → `autodownload-folder-mp3s`. */
export function commandId(name) {
  const slug = wordsOf(name)
    .filter((w) => !["a", "an", "the", "of", "to", "my", "for"].includes(w))
    .slice(0, 5)
    .join("-")
  return slug || `command-${Date.now().toString(36)}`
}
