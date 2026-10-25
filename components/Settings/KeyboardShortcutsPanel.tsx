/**
 * components/Settings/KeyboardShortcutsPanel.tsx — Help: every keyboard shortcut
 *
 * A static list. Chords come from `hooks/useQuickCaptureHotkey.ts`,
 * `hooks/useUndoHotkey.ts`, `components/Search/useGlobalSearchHotkey.ts`,
 * `lib/inbox-batch.ts` (INBOX_CHORDS) and `components/Focus/JustStartMode.tsx`.
 */

type Shortcut = { keys: string; does: string }

const MOD = "Cmd/Ctrl"

const GROUPS: readonly { title: string; rows: readonly Shortcut[] }[] = [
  {
    title: "Anywhere",
    rows: [
      { keys: `${MOD}-K`, does: "Search" },
      { keys: `${MOD}-Shift-A`, does: "Quick Add" },
      { keys: `${MOD}-Z`, does: "Undo last Home/Tracking action" },
      { keys: `${MOD}-Shift-Z or ${MOD}-Y`, does: "Redo" },
    ],
  },
  {
    title: "Inbox list",
    rows: [
      { keys: "J / Down", does: "Next idea" },
      { keys: "K / Up", does: "Previous idea" },
      { keys: "X or Space", does: "Select or unselect" },
      { keys: "A", does: "Select all" },
      { keys: "U", does: "Unselect all" },
      { keys: "C or Enter", does: "Clarify" },
      { keys: "W", does: "Walk" },
      { keys: "L", does: "Apply list" },
      { keys: "D", does: "Apply deadline" },
      { keys: "M", does: "Merge" },
      { keys: "Y", does: "Mark clarified" },
      { keys: "# / Backspace / Delete", does: "Delete selection" },
      { keys: `${MOD}-Enter`, does: "Save in the capture field" },
    ],
  },
  {
    title: "Just Start",
    rows: [
      { keys: "Up / Down", does: "Move between rows" },
      { keys: "Enter or Space", does: "Pick the row" },
      { keys: "P", does: "Pull another" },
      { keys: "Esc", does: "Leave" },
    ],
  },
]

export function KeyboardShortcutsPanel() {
  return (
    <div className="space-y-4">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="mb-1 font-semibold">{group.title}</h3>
          <dl className="grid grid-cols-[minmax(0,14rem)_1fr] gap-x-4 gap-y-1 text-sm">
            {group.rows.map((row) => (
              <div key={row.keys} className="contents">
                <dt>
                  <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">{row.keys}</kbd>
                </dt>
                <dd className="text-muted-foreground">{row.does}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
