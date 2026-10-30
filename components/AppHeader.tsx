/**
 * components/AppHeader.tsx — Pinned mill title bar
 *
 * Full-width fascia at the top of the viewport: navy **BRAIN2** caption with a
 * Tek POWER lamp, leading **Nav** Back/Forward keycaps (in-app screen
 * history), today's-friend jewel in a Friend key-well (click for a Stardew
 * Next Action bubble), and Rituals / System / Capture as pale silver
 * keycaps (same skirt as `.todo-cap`). Clusters share one
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
 * the shell scrolls inside its bay. On a viewport 520px or narrower the
 * mill gives way to a phone bar: Back/Forward sit on the far left, then
 * BRAIN2, then a Quick Add keycap (+) and Menu. Go is the section switcher.
 * Friend, Rituals, System, and Capture open in a sheet. Refresh is the left key of
 * that sheet and reloads the page; Close stays on the right. A live now well stays on
 * the bar so a running clock is still on screen. A wider window keeps the
 * one-row mill. Keys do not flex-shrink, and phosphor
 * counts stay on them. Nav and Go go black with a green legend on focus; Go’s current tab stays that CRT. A press is the old 1px milled sink. System is a gear (Settings), a question mark (Names
 * help mode), a magnifying glass (Search), and a bell (current reminders).
 * The question mark latches (`aria-pressed`) and gains a diagonal strike while
 * Names is on. While Names is on, a **CODE DOCUMENTATION** key appears beside
 * it. Opening that reader turns Names off, so the page uses a normal cursor
 * and ordinary clicks, with no nameplates. The key hides with Names. The
 * reader stays open until it is closed. Icon keys show engraved glyphs; word
 * keys stay words.
 * The Friend nameplate matches Nav, Go, and Rituals. Its fold is a hairline
 * with a centered bar. Header letters have no white shadow. The Rituals
 * count sits in the middle of its key.
 * Nested bevels from IRIX/TENO — not a cockpit restyle and not a SaaS navbar.
 *
 * Spec: §8.2 (dashboard top bar / global quick actions).
 */
"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { APP_NAME } from "@/lib/app-brand"
import { CognitiveState } from "@/components/cognitive-state"
import { BabyAnimalNest } from "@/components/baby-animal-nest"
import { InboxKey, QuickAddKey, RitualsKey, SettingsKey } from "@/components/header-doors"
import { HeaderNowBox } from "@/components/header-now-box"
import { HeaderNavButtons } from "@/components/header-nav-buttons"
import { HeaderReminderBell } from "@/components/header-reminder-bell"
import { Button } from "@/components/ui/button"
import { CodeDocsViewer } from "@/components/CodeDocs/CodeDocsViewer"
import { useUiNamesStore } from "@/lib/ui-names-store"
import { Search } from "lucide-react"
import "./shell-chrome.css"

function NamesModeButton() {
  const mode = useUiNamesStore((s) => s.mode)
  const toggle = useUiNamesStore((s) => s.toggle)
  const setMode = useUiNamesStore((s) => s.setMode)
  const on = mode === "names"
  const [docsOpen, setDocsOpen] = useState(false)
  useEffect(() => {
    if (docsOpen && mode === "names") setMode("off")
  }, [docsOpen, mode, setMode])
  return (
    <>
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
    {on ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="b2-code-docs-key"
        data-ui-name="Code documentation"
        data-ui-help="Opens the docs folder: markdown, screenshots, and the other files."
        data-ui-docs="components/CodeDocs/README.md"
        onClick={() => {
          setDocsOpen(true)
          setMode("off")
        }}
      >
        CODE DOCUMENTATION
      </Button>
    ) : null}
    {docsOpen ? <CodeDocsViewer open={docsOpen} onOpenChange={setDocsOpen} /> : null}
    </>
  )
}

/** A cluster's fold state, remembered per viewer. */
function useFold(key: string) {
  const [folded, setFolded] = useState(false)
  useEffect(() => {
    try {
      setFolded(localStorage.getItem(key) === "1")
    } catch {}
  }, [key])
  const toggle = () =>
    setFolded((v) => {
      try {
        localStorage.setItem(key, v ? "0" : "1")
      } catch {}
      return !v
    })
  return [folded, toggle] as const
}

function FoldKey({ folded, onToggle, what }: { folded: boolean; onToggle: () => void; what: string }) {
  return (
    <button
      type="button"
      className="b2-shell-fold"
      aria-expanded={!folded}
      aria-label={folded ? `Expand ${what}` : `Collapse ${what}`}
      title={folded ? `Expand ${what}` : `Collapse ${what}`}
      onClick={onToggle}
    >
      {folded ? "+" : "–"}
    </button>
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
  tabs,
}: {
  onTaskSelect: (taskId: string) => void
  captureOpen?: boolean
  onCaptureOpenChange?: (open: boolean) => void
  /** Highlighted text from Cmd/Ctrl-Shift-A, applied when Quick Add opens. */
  captureSeed?: string
  /** Opens the existing Cmd/Ctrl-K search palette. */
  onOpenSearch?: () => void
  /** App tab strip (a Radix `TabsList`), seated beside Nav. */
  tabs?: ReactNode
}) {
  const [friendFolded, toggleFriend] = useFold("brain2-shell-friend-folded")
  const [toolsOpen, setToolsOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    performance.mark("brain2-shell-ready")
  }, [])

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const mq = window.matchMedia("(max-width: 520px)")
    const onChange = () => {
      if (!mq.matches) setToolsOpen(false)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    if (!toolsOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setToolsOpen(false)
    }
    window.addEventListener("keydown", onKey)
    sheetRef.current?.focus()
    return () => window.removeEventListener("keydown", onKey)
  }, [toolsOpen])

  /* Phone Go strip scrolls. Keep the current tab in view. A wide shell
     does not overflow, and a test render has no width, so both return. */
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-testid="app-header"]')
    const list = header?.querySelector<HTMLElement>('[data-ui-name="App tabs"]')
    if (!header || !list) return
    const reveal = () => {
      if (window.innerWidth > 520 || header.clientWidth < 200) return
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
      if (!active) return
      const left = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2
      list.scrollTo({ left: Math.max(0, left) })
    }
    reveal()
    const obs = new MutationObserver(reveal)
    obs.observe(list, { attributes: true, subtree: true, attributeFilter: ["data-state"] })
    return () => obs.disconnect()
  }, [])

  return (
    <header
      className="b2-shell"
      data-testid="app-header"
      data-pin="viewport"
      data-tools={toolsOpen ? "open" : "closed"}
      data-ui-name="App header"
      data-ui-docs="components/README.md"
      data-ui-docs-anchor="top-level-files"
    >
      <button
        type="button"
        className="b2-shell-scrim"
        aria-label="Close menu"
        tabIndex={toolsOpen ? 0 : -1}
        onClick={() => setToolsOpen(false)}
      />
      <div className="b2-shell-caption">
        <span className="b2-shell-power" title="Power" aria-hidden="true" />
        <h1 className="brain2-mark">{APP_NAME}</h1>
        <span className="b2-shell-caption-mill" aria-hidden="true" />
      </div>
      <div className="b2-shell-body">
        <HeaderNavButtons />
        <div className="b2-shell-phone-tools">
          <button
            type="button"
            className="b2-shell-plus"
            aria-label="Quick Add"
            onClick={() => {
              setToolsOpen(false)
              onCaptureOpenChange?.(true)
            }}
          >
            <span className="b2-shell-plus-mark" aria-hidden="true">
              +
            </span>
          </button>
          <button
            type="button"
            className="b2-shell-menu"
            aria-expanded={toolsOpen}
            aria-controls="b2-shell-tools"
            aria-label={toolsOpen ? "Close menu" : "Menu"}
            onClick={() => setToolsOpen((open) => !open)}
          >
            <span className="b2-shell-menu-bars" aria-hidden="true" />
          </button>
        </div>
        {tabs ? (
          <fieldset
            className="b2-shell-group b2-shell-tabs"
            onClick={(event) => {
              const target = event.target
              if (target instanceof Element && target.closest('[role="tab"]')) setToolsOpen(false)
            }}
          >
            <legend>Go</legend>
            {tabs}
          </fieldset>
        ) : null}
        <div
          id="b2-shell-tools"
          className="b2-shell-stage"
          ref={sheetRef}
          role={toolsOpen ? "dialog" : undefined}
          aria-modal={toolsOpen ? true : undefined}
          aria-label={toolsOpen ? "Menu" : undefined}
          tabIndex={toolsOpen ? -1 : undefined}
          onClick={(event) => {
            const target = event.target
            if (!(target instanceof Element)) return
            if (target.closest(".b2-shell-sheet-close, .b2-shell-sheet-refresh")) return
            if (target.closest("button, a")) setToolsOpen(false)
          }}
        >
          <div className="b2-shell-sheet-bar">
            <button type="button" className="b2-shell-sheet-refresh" onClick={() => window.location.reload()}>
              Refresh
            </button>
            <button type="button" className="b2-shell-sheet-close" onClick={() => setToolsOpen(false)}>
              Close
            </button>
          </div>
        <fieldset className={`b2-shell-brand${friendFolded ? " is-folded" : ""}`}>
          <legend>
            Friend
            <FoldKey folded={friendFolded} onToggle={toggleFriend} what="Friend" />
          </legend>
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
