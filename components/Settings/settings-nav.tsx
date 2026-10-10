/**
 * components/Settings/settings-nav.tsx — Find well and section index
 *
 * Presentational. The dialog owns the query and which bay is selected.
 * The body shows that bay only. Narrow windows collapse the rail into a
 * group menu plus a horizontal strip (see settings-chrome.css).
 */
"use client"

import { useEffect, useRef, type RefObject } from "react"
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  groupDomId,
  groupShown,
  sectionMatches,
  type SettingsGroup,
  type SettingsGroupId,
} from "@/components/Settings/settings-index"

export function visibleRailButtons(root: ParentNode | null | undefined): HTMLButtonElement[] {
  if (!root) return []
  return [...root.querySelectorAll<HTMLButtonElement>("button")].filter((button) => {
    if (button.hidden) return false
    return window.getComputedStyle(button).display !== "none"
  })
}

export function SettingsFind({
  query,
  onQueryChange,
  onArrowDown,
  onSubmit,
  inputRef,
}: {
  query: string
  onQueryChange: (query: string) => void
  onArrowDown: () => void
  onSubmit: () => void
  inputRef: RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="set-find">
      <label htmlFor="settings-find">Find</label>
      <input
        id="settings-find"
        ref={inputRef}
        role="searchbox"
        type="text"
        value={query}
        placeholder="Birthday, backup, window gray"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-keyshortcuts="/"
        aria-controls="settings-body"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            onArrowDown()
          } else if (event.key === "Enter") {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
      <span className="set-find-key" aria-hidden>
        /
      </span>
    </div>
  )
}

export function SettingsIndex({
  query,
  activeId,
  onJump,
  onFocusFind,
}: {
  query: string
  activeId: string | null
  onJump: (id: string) => void
  onFocusFind: () => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const activeGroup = SETTINGS_SECTIONS.find((section) => section.id === activeId)?.groupId
  const groups = SETTINGS_GROUPS.filter((group) => groupShown(group.id, query))

  useEffect(() => {
    const list = listRef.current
    if (!list || !activeId) return
    const btn = list.querySelector<HTMLElement>(`[data-index-id="${activeId}"]`)
    if (!btn) return
    const listRect = list.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    if (btnRect.top < listRect.top) list.scrollTop -= listRect.top - btnRect.top + 4
    else if (btnRect.bottom > listRect.bottom) list.scrollTop += btnRect.bottom - listRect.bottom + 4
    if (btnRect.left < listRect.left) list.scrollLeft -= listRect.left - btnRect.left + 4
    else if (btnRect.right > listRect.right) list.scrollLeft += btnRect.right - listRect.right + 4
  }, [activeId, query])

  function onListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft"
    const vertical = event.key === "ArrowDown" || event.key === "ArrowUp"
    if (!horizontal && !vertical && event.key !== "Home" && event.key !== "End") return
    const buttons = visibleRailButtons(event.currentTarget)
    if (buttons.length === 0) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if ((event.key === "ArrowUp" || event.key === "ArrowLeft") && index <= 0) {
      event.preventDefault()
      onFocusFind()
      return
    }
    event.preventDefault()
    let next = index < 0 ? 0 : index
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = Math.min(buttons.length - 1, next + 1)
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = Math.max(0, next - 1)
    else if (event.key === "Home") next = 0
    else next = buttons.length - 1
    const button = buttons[next]
    button?.focus()
    const id = button?.dataset.indexId
    if (id) onJump(id)
  }

  return (
    <nav className="set-rail" aria-label="Settings sections">
      <label className="set-group-select">
        Group
        <select
          aria-label="Settings group"
          value={groups.some((group) => group.id === activeGroup) ? activeGroup : (groups[0]?.id ?? "")}
          onChange={(event) => onJump(groupDomId(event.target.value as SettingsGroupId))}
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.title}
            </option>
          ))}
        </select>
      </label>
      <div className="set-rail-list" ref={listRef} onKeyDown={onListKeyDown}>
        {groups.map((group) => (
          <SettingsIndexGroup
            key={group.id}
            group={group}
            query={query}
            activeId={activeId}
            current={group.id === activeGroup}
            onJump={onJump}
          />
        ))}
      </div>
    </nav>
  )
}

function SettingsIndexGroup({
  group,
  query,
  activeId,
  current,
  onJump,
}: {
  group: SettingsGroup
  query: string
  activeId: string | null
  current: boolean
  onJump: (id: string) => void
}) {
  const sections = SETTINGS_SECTIONS.filter((section) => section.groupId === group.id && sectionMatches(section, query))
  return (
    <div className="set-rail-group">
      <button
        type="button"
        className="set-rail-groupname"
        data-index-id={groupDomId(group.id)}
        data-current={current ? "true" : undefined}
        onClick={() => onJump(groupDomId(group.id))}
      >
        {group.title}
      </button>
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className="set-rail-section"
          data-index-id={section.id}
          aria-current={section.id === activeId ? "location" : undefined}
          onClick={() => onJump(section.id)}
        >
          {section.title}
        </button>
      ))}
    </div>
  )
}

export function SettingsGroupBlock({
  group,
  hidden,
  children,
}: {
  group: SettingsGroup
  hidden: boolean
  children: React.ReactNode
}) {
  const domId = groupDomId(group.id)
  return (
    <section id={domId} className="set-group" hidden={hidden} aria-labelledby={`${domId}-label`}>
      <h2 id={`${domId}-label`} className="set-group-title">
        {group.title}
      </h2>
      {children}
    </section>
  )
}

export function SettingsSectionBlock({
  id,
  hidden,
  children,
}: {
  id: string
  hidden: boolean
  children: React.ReactNode
}) {
  return (
    <div id={id} data-settings-section={id} className="set-section" hidden={hidden}>
      {children}
    </div>
  )
}
