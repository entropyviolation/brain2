/**
 * components/AppHeader.tsx — Pinned mill title bar
 *
 * Full-width fascia at the top of the viewport: navy **BRAIN2** caption with a
 * Tek POWER lamp, leading **Nav** Back/Forward mill keys (in-app screen
 * history), today's-friend jewel in a Friend key-well (click for a Stardew
 * Next Action bubble), and Rituals / System / Capture as milled silver
 * key-wells of chunky press keys (Y2K handheld / TENO). Clusters share one
 * flex line. **Nav** stays the left anchor. Friend, Rituals, System, and
 * Capture are one group centered in the space to the right of Nav — the
 * column gap between those clusters stays tight, and leftover mill is equal
 * on both sides of the group. Capture’s Now, Inbox, and Quick Add keys are
 * content-wide and share one gap; the live **now** well sits beside them
 * only while an Operations or pen-color work timer is live. Inbox, Quick Add,
 * Rituals, and Settings are thin keys (`header-doors.tsx`). Their rooms load
 * the first time they open, so a refresh does not download a closed door.
 * The Now popup loads when that key opens. Narrower than the group, whole
 * clusters wrap onto the full shell; a cluster wider than
 * the shell scrolls inside its bay. Keys do not flex-shrink, and phosphor
 * counts stay on them. System is a gear (Settings), a question mark (Names
 * help mode), a magnifying glass (Search), and a bell (current reminders).
 * The question mark latches (`aria-pressed`) and gains a diagonal strike while
 * Names is on. Icon keys show engraved glyphs; word keys stay words.
 * Nested bevels from IRIX/TENO — not a cockpit restyle and not a SaaS navbar.
 *
 * Spec: §8.2 (dashboard top bar / global quick actions).
 */
"use client"

import { useEffect } from "react"
import { APP_NAME } from "@/lib/app-brand"
import { CognitiveState } from "@/components/cognitive-state"
import { BabyAnimalNest } from "@/components/baby-animal-nest"
import { InboxKey, QuickAddKey, RitualsKey, SettingsKey } from "@/components/header-doors"
import { HeaderNowBox } from "@/components/header-now-box"
import { HeaderNavButtons } from "@/components/header-nav-buttons"
import { HeaderReminderBell } from "@/components/header-reminder-bell"
import { Button } from "@/components/ui/button"
import { useUiNamesStore } from "@/lib/ui-names-store"
import { Search } from "lucide-react"
import "./shell-chrome.css"

function NamesModeButton() {
  const mode = useUiNamesStore((s) => s.mode)
  const toggle = useUiNamesStore((s) => s.toggle)
  const on = mode === "names"
  return (
    <Button
      variant="outline"
      size="sm"
      className="b2-shell-icon"
      aria-pressed={on}
      aria-label="Names help mode"
      title="Names help mode"
      onClick={() => toggle("names")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2.4-3 4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="17.6" r="1" fill="currentColor" stroke="none" />
        {on ? (
          <path
            className="b2-shell-glyph-strike"
            d="M5.5 18.5 L18.5 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
    </Button>
  )
}

function SearchKey({ onOpen }: { onOpen?: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="b2-shell-icon"
      aria-label="Search"
      title="Search"
      onClick={() => onOpen?.()}
    >
      <Search />
    </Button>
  )
}

export function AppHeader({
  onTaskSelect,
  captureOpen,
  onCaptureOpenChange,
  captureSeed,
  onOpenSearch,
}: {
  onTaskSelect: (taskId: string) => void
  captureOpen?: boolean
  onCaptureOpenChange?: (open: boolean) => void
  /** Highlighted text from Cmd/Ctrl-Shift-A, applied when Quick Add opens. */
  captureSeed?: string
  /** Opens the existing Cmd/Ctrl-K search palette. */
  onOpenSearch?: () => void
}) {
  useEffect(() => {
    performance.mark("brain2-shell-ready")
  }, [])

  return (
    <header
      className="b2-shell"
      data-testid="app-header"
      data-pin="viewport"
      data-ui-name="App header"
      data-ui-docs="components/README.md"
      data-ui-docs-anchor="top-level-files"
    >
      <div className="b2-shell-caption">
        <span className="b2-shell-power" title="Power" aria-hidden="true" />
        <h1 className="brain2-mark">{APP_NAME}</h1>
        <span className="b2-shell-caption-mill" aria-hidden="true" />
      </div>
      <div className="b2-shell-body">
        <HeaderNavButtons />
        <div className="b2-shell-stage">
        <fieldset className="b2-shell-brand">
          <legend>Friend</legend>
          <BabyAnimalNest />
        </fieldset>
        <div className="b2-shell-rail" role="toolbar" aria-label="Global actions">
          <fieldset className="b2-shell-group b2-shell-rituals">
            <legend>Rituals</legend>
            <div className="b2-shell-keys">
              <RitualsKey />
            </div>
          </fieldset>
          <div className="b2-shell-sep" role="separator" />
          <fieldset className="b2-shell-group b2-shell-system">
            <legend>System</legend>
            <div className="b2-shell-keys">
              <SettingsKey />
              <NamesModeButton />
              <SearchKey onOpen={onOpenSearch} />
              <HeaderReminderBell onTaskSelect={onTaskSelect} />
            </div>
          </fieldset>
          <div className="b2-shell-sep" role="separator" />
          <fieldset
            className="b2-shell-group b2-shell-capture"
            data-ui-name="Capture"
            data-ui-help="Now, Inbox, and Quick Add. Metrics is on Current moment in Now. Ingest, From Notes, and Phone Notes live in Settings and Lists settings."
            data-ui-docs="components/README.md"
          >
            <legend>Capture</legend>
            <HeaderNowBox />
            <div className="b2-shell-keys">
              <CognitiveState />
              <InboxKey onTaskSelect={onTaskSelect} />
              <QuickAddKey open={captureOpen} onOpenChange={onCaptureOpenChange} seed={captureSeed} />
            </div>
          </fieldset>
        </div>
        </div>
      </div>
      <div className="b2-shell-shelf" aria-hidden="true" />
    </header>
  )
}
