# Commands BIMBY

_Last mapped: 2026-11-21_

Remembers how to run your programs and says the command back when you ask. In BIM chat and in Terminal (`bim`). Code only, no model.

| You say | BIM does |
|---------|----------|
| "what is the command to launch the llm server or whatever?" | Says `brew services restart ollama`, with what it does |
| "how do I reboot brain2 mobile?" | Says the iPhone reinstall command |
| "remember this command which is to autodownload a folder of mp3s" | "Paste the command as your next message". The next line is kept word for word (``` fences and a leading `$ ` are stripped). "cancel" stops the wait; a question that is not a shell line goes on to the other lanes |
| "remember this command for playlistlab: cd ~/spotifydownloader && npm start" | Kept at once. Also: the command on the next line, in backticks, or "the command to X is Y" |
| "remember this command: brew services restart ollama" | Asks what it is for; the next line names it |
| "list my commands" / "forget the command for playlistlab" | Lists them all / hides one |

A question with a run word ("command", "run", "launch", "start", "open", "reboot", "restart", "reinstall") is answered here only when a known command matches. Otherwise it goes on: a general terminal question ("what's the command to unzip a file?") still reaches the chat lane.

**Matching.** The question's words, less "how do I run the command for", score 3 on a command's name, 2 on its extra words, 1 on what it does. Only a hit on the name or extra words counts. A tie lists every tied command ("how do I run brain2" names the desktop app, the browser server and the iPhone reinstall).

**Shipped commands** (`SEED_COMMANDS`): Brain2 desktop (`npm run electron:dev`), Brain2 in the browser (`npm run dev`), the iPhone reinstall, restart the Mac hub (`launchctl kickstart -k gui/$(id -u)/com.brain2.hub`), restart Ollama, PlaylistLab (`~/spotifydownloader`, port 3003), the baby animal game (`~/baby-animal-game`, port 5188). A saved command with the same id replaces a shipped one.

## Terminal

`scripts/bim.mjs`. Install once: `ln -sf ~/brain2/scripts/bim.mjs /opt/homebrew/bin/bim`.

```
bim                       every command
bim llm server            the best match
bim run brain2 mobile     print it, ask y/N, run it in zsh
bim copy playlistlab      to the clipboard
bim add autodownload a folder of mp3s    then paste and press Ctrl-D
bim forget playlistlab
```

It reads the vault from the hub on this Mac (port 8787, else the app on 3000), else `data/shared-persist.json`. `add` and `forget` write through the hub's `/api/persist` PUT, built on the hub's current copy. `BIM_HUB=<url>` points it at another hub (tests). The store is last write wins: an app that saves a command before it has pulled a CLI add would drop that add.

## Files

| File | Role |
|------|------|
| `commands.mjs` | Pure, plain JS so node and the app share it. `SEED_COMMANDS`, `mergeCommands`, `matchCommands`, `bestCommands`, `commandId` |
| `read.ts` | Pure. `readCommandAsk` (save, save-unnamed, recall, list, forget), `looksLikeShell`, `cleanPaste` |
| `store.ts` | `useCommandsStore`, in the vault as `brain2-commands`. Forget writes a `gone` row. `knownCommands()` |
| `run.ts` | `tryCommands`, the chat lane body, with the paste wait in memory (`PASTE_TTL_MS`, 15 min) |
| `commands-bimby.test.ts` | Matching, the shapes, the paste wait, forget, and the lane in `sendToBim` |

Lane: `commands` in `CHAT_LANES` (`lib/ingest/bim-lanes.ts`), second, after `handoff`, so a pasted command is never read as a log line. Blueprint: `lib/agents/adapters/commands-bimby.ts`.

## Planned

- **Planned:** run a saved command from chat on the Mac hub, after a confirm.
- **Planned:** a Commands page in Settings to edit the list by hand.
