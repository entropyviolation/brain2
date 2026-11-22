import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useBimChatStore, sendToBim } from "@/lib/ingest/bim-chat"
import { bestCommands, matchCommands, mergeCommands, SEED_COMMANDS } from "./commands.mjs"
import { cleanPaste, looksLikeShell, readCommandAsk } from "./read"
import { resetCommandsForTests, tryCommands } from "./run"
import { knownCommands, useCommandsStore } from "./store"

const now = new Date("2026-11-21T02:27:00")
const best = (q: string) => bestCommands(SEED_COMMANDS, q).map((c) => c.id)

describe("matchCommands", () => {
  it("finds the shipped programs by the words people use", () => {
    expect(best("what is the command to launch the llm server or whatever?")).toEqual(["ollama"])
    expect(best("brain2 mobile reboot")).toEqual(["brain2-ios"])
    expect(best("how do i start playlistlab")).toEqual(["playlistlab"])
    expect(best("baby animal game")).toEqual(["baby-animal-game"])
    expect(best("restart the hub")).toEqual(["phone-hub"])
  })
  it("lists a tie instead of guessing, and finds nothing for unrelated words", () => {
    expect(best("how do i run brain2").length).toBeGreaterThan(1)
    expect(matchCommands(SEED_COMMANDS, "what time does the store open")).toEqual([])
  })
  it("lets a saved row replace or hide a shipped one", () => {
    const merged = mergeCommands(SEED_COMMANDS, [{ id: "ollama", name: "Ollama", command: "ollama serve" }, { id: "playlistlab", name: "x", command: "", gone: true }])
    expect(merged.find((c) => c.id === "ollama")?.command).toBe("ollama serve")
    expect(merged.some((c) => c.id === "playlistlab")).toBe(false)
  })
})

describe("readCommandAsk", () => {
  it("reads a save with and without the command in it", () => {
    expect(readCommandAsk("remember this command which is to autodownload a folder of mp3s")).toEqual({ kind: "save", name: "autodownload a folder of mp3s" })
    expect(readCommandAsk("remember this command for playlistlab: cd ~/spotifydownloader && npm start")).toEqual({ kind: "save", name: "playlistlab", command: "cd ~/spotifydownloader && npm start" })
    expect(readCommandAsk("save command to tail the hub log\n$ tail -f ~/brain2/data/hub.log")).toEqual({ kind: "save", name: "tail the hub log", command: "tail -f ~/brain2/data/hub.log" })
    expect(readCommandAsk("the command to start the hub is npm run phone:hub")).toEqual({ kind: "save", name: "start the hub", command: "npm run phone:hub" })
    expect(readCommandAsk("remember this command: brew services restart ollama")).toEqual({ kind: "save-unnamed", command: "brew services restart ollama" })
  })
  it("reads recall, list and forget, and leaves other lines", () => {
    expect(readCommandAsk("what's the command for playlistlab?")?.kind).toBe("recall")
    expect(readCommandAsk("list my commands")).toEqual({ kind: "list" })
    expect(readCommandAsk("forget the command for playlistlab")).toEqual({ kind: "forget", words: "playlistlab" })
    expect(readCommandAsk("played guitar today")).toBeNull()
    expect(readCommandAsk("remember that the gate code is 4412")).toBeNull()
  })
  it("knows a shell line and cleans a paste", () => {
    expect(looksLikeShell("spotdl https://x --output ~/Music")).toBe(true)
    expect(looksLikeShell("BRAIN2_IOS_TEAM_ID=1 npm run ios:reinstall")).toBe(true)
    expect(looksLikeShell("what time is it?")).toBe(false)
    expect(cleanPaste("```bash\n$ cd ~/x\n$ npm start\n```")).toBe("cd ~/x\nnpm start")
  })
})

describe("Commands BIMBY in chat", () => {
  beforeEach(() => {
    resetAllStores()
    resetCommandsForTests()
    useCommandsStore.setState({ saved: [] })
    useBimChatStore.setState({ lines: [], busy: false })
  })

  it("asks for the paste, keeps it word for word, and says it back", () => {
    expect(tryCommands("remember this command which is to autodownload a folder of mp3s", now)?.route).toBe("COMMANDS · waiting · code")
    const saved = tryCommands('spotdl "https://open.spotify.com/playlist/abc" --output ~/Music/{title}', now)
    expect(saved?.route).toBe("COMMANDS · saved · code")
    expect(useCommandsStore.getState().saved[0]).toMatchObject({ id: "autodownload-folder-mp3s", command: 'spotdl "https://open.spotify.com/playlist/abc" --output ~/Music/{title}' })
    expect(tryCommands("what's the command to autodownload mp3s?", now)?.text).toContain('spotdl "https://open.spotify.com/playlist/abc"')
  })

  it("names an unnamed command from the next line, and cancel drops a wait", () => {
    tryCommands("remember this command: brew services restart ollama", now)
    expect(tryCommands("restart ollama quickly", now)?.route).toBe("COMMANDS · saved · code")
    tryCommands("remember this command to back up the vault", now)
    expect(tryCommands("cancel", now)?.text).toBe("Okay, nothing saved.")
    expect(useCommandsStore.getState().saved).toHaveLength(1)
  })

  it("lets a new question through while waiting for a paste", () => {
    tryCommands("remember this command to back up the vault", now)
    expect(tryCommands("what did shelby last say to me?", now)).toBeNull()
  })

  it("forgets one, shipped or saved", () => {
    tryCommands("forget the command for playlistlab", now)
    expect(knownCommands().some((c) => c.id === "playlistlab")).toBe(false)
  })

  it("is the lane that answers in BIM chat, LLM off", async () => {
    const line = await sendToBim("what is the command to launch the llm server or whatever?", now)
    expect(line.route).toBe("COMMANDS · recall · code")
    expect(line.text).toContain("brew services restart ollama")
  })
})
