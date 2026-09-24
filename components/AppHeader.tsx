/**
 * components/AppHeader.tsx — Pinned mill title bar
 *
 * Full-width fascia at the top of the viewport: navy **BRAIN2** caption with a
 * Tek POWER lamp, today's-friend jewel in a Friend key-well (click for a Stardew
 * Next Action bubble), and Review / System / now / Capture as milled silver
 * key-wells of chunky press keys (Y2K handheld / TENO). The **now** well
 * appears only while an Operations or pen-color work timer is live. System is
 * Settings | Tracking | Names so a later Help / Inspect key can sit beside
 * Names. The Names key stays **Names** and latches (`aria-pressed`); the
 * tooltip reads **Stop naming** while on. Nested bevels from IRIX/TENO — not a
 * cockpit restyle and not a SaaS navbar.
 *
 * Spec: §8.2 (dashboard top bar / global quick actions).
 */
"use client"

import { APP_NAME } from "@/lib/app-brand"
import { QuickAdd } from "@/components/quick-add"
import { EnhancedBulkAdd } from "@/components/enhanced-bulk-add"
import { NotesIngest } from "@/components/notes-ingest"
import { IphoneNotesStore } from "@/components/iphone-notes-store"
import { CognitiveState } from "@/components/cognitive-state"
import { Inbox } from "@/components/inbox"
import { IngestLogDialog } from "@/components/ingest-log-dialog"
import { Reviews } from "@/components/Reviews/reviews"
import { MetricLoggerButton } from "@/components/Tracking/MetricLogger"
import { BabyAnimalNest } from "@/components/baby-animal-nest"
import { SettingsDialog } from "@/components/Settings/SettingsDialog"
import { HeaderNowBox } from "@/components/header-now-box"
import { Button } from "@/components/ui/button"
import { useUiNamesStore } from "@/lib/ui-names-store"
import "./shell-chrome.css"

function NamesModeButton() {
  const mode = useUiNamesStore((s) => s.mode)
  const toggle = useUiNamesStore((s) => s.toggle)
  const on = mode === "names"
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={on}
      aria-label="Names"
      title={on ? "Stop naming" : "Show names of UI"}
      onClick={() => toggle("names")}
    >
      Names
    </Button>
  )
}

export function AppHeader({
  onTaskSelect,
  captureOpen,
  onCaptureOpenChange,
}: {
  onTaskSelect: (taskId: string) => void
  captureOpen?: boolean
  onCaptureOpenChange?: (open: boolean) => void
}) {
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
        <fieldset className="b2-shell-brand">
          <legend>Friend</legend>
          <BabyAnimalNest />
        </fieldset>
        <div className="b2-shell-rail" role="toolbar" aria-label="Global actions">
          <fieldset className="b2-shell-group">
            <legend>Review</legend>
            <div className="b2-shell-keys">
              <Reviews />
            </div>
          </fieldset>
          <div className="b2-shell-sep" role="separator" />
          <fieldset className="b2-shell-group">
            <legend>System</legend>
            <div className="b2-shell-keys">
              <SettingsDialog />
              <CognitiveState />
              <NamesModeButton />
            </div>
          </fieldset>
          <div className="b2-shell-sep" role="separator" />
          <HeaderNowBox />
          <fieldset
            className="b2-shell-group b2-shell-capture"
            data-ui-name="Capture"
            data-ui-help="Inbox, ingest, metrics, From Notes, Phone Notes, and quick capture doors."
            data-ui-docs="components/README.md"
          >
            <legend>Capture</legend>
            <div className="b2-shell-keys">
              <Inbox onTaskSelect={onTaskSelect} />
              <IngestLogDialog />
              <MetricLoggerButton />
              <EnhancedBulkAdd />
              <NotesIngest />
              <IphoneNotesStore />
              <QuickAdd open={captureOpen} onOpenChange={onCaptureOpenChange} />
            </div>
          </fieldset>
        </div>
      </div>
      <div className="b2-shell-shelf" aria-hidden="true" />
    </header>
  )
}
