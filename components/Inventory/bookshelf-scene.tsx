/**
 * components/Inventory/bookshelf-scene.tsx — Bookshelf scene slot
 *
 * Desktop mounts the wooden case. A viewport at or under 767px keeps the
 * title list and does not load Three. `listId` null is an empty stage.
 * Membership is `task.lists` (finished items stay). `tasksForList` drops
 * cleared items, so this slot does not use it.
 *
 * The first click pulls one book forward. The second click on that book
 * opens it through `openItemDetailPopup`, the same shell popup Lists uses
 * (`TaskDetailPopup` in `app/page.tsx`). Search dims other titles and does
 * not open anything. Fetch covers runs only from its button.
 */
"use client"

import { useMemo, useRef, useState } from "react"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import { BookshelfStage } from "./bookshelf/bookshelf-stage"
import { shelfBooks, shelfGesture, shelfMatchIds, shelfSearchEnter, tasksForShelf } from "./bookshelf/shelf-books"
import { useShelfCovers } from "./bookshelf/use-shelf-covers"
import { useInventoryPhone } from "./phone/use-inventory-phone"
import "./bookshelf/bookshelf.css"

export function BookshelfScene({ listId }: { listId: string | null }) {
  const phone = useInventoryPhone()
  const tasks = useTaskStore((s) => s.tasks)
  const types = useItemTypeStore((s) => s.types)
  const [query, setQuery] = useState("")
  const [queryFor, setQueryFor] = useState(listId)
  const [pulledId, setPulledId] = useState<string | null>(null)
  const pulledRef = useRef<string | null>(null)
  const { note: coverNote, fetching, fetchCovers } = useShelfCovers(listId)
  if (queryFor !== listId) {
    setQueryFor(listId)
    setQuery("")
    setPulledId(null)
    pulledRef.current = null
  }

  const activate = (id: string | null) => {
    const gesture = shelfGesture(pulledRef.current, id)
    if (gesture.kind === "clear") {
      pulledRef.current = null
      setPulledId(null)
      return
    }
    if (gesture.kind === "pull") {
      pulledRef.current = gesture.id
      setPulledId(gesture.id)
      return
    }
    openItemDetailPopup(gesture.id)
  }

  const shelfTasks = useMemo(() => tasksForShelf(tasks, listId), [tasks, listId])
  const books = useMemo(() => shelfBooks(shelfTasks, types), [shelfTasks, types])
  const matchIds = useMemo(() => shelfMatchIds(shelfTasks, query), [shelfTasks, query])
  const matchSet = useMemo(() => new Set(matchIds), [matchIds])

  if (!listId) {
    return (
      <section className="inv-stage inv-shelf-quiet" aria-label="Bookshelf" data-testid="bookshelf-scene" data-list-id="">
        <p className="inv-stage-count">No list</p>
        <p className="inv-shelf-invite">A list names the books on this shelf.</p>
      </section>
    )
  }

  if (phone) {
    return (
      <section className="inv-stage" aria-label="Bookshelf" data-testid="bookshelf-scene" data-list-id={listId}>
        <p className="inv-stage-count">{itemCount(books.length)}</p>
        {books.length > 0 ? (
          <ul className="inv-stage-titles">
            {books.map((book) => (
              <li key={book.id}>
                <button type="button" onClick={() => openItemDetailPopup(book.id)}>
                  {itemTitleOrUntitled({ title: book.title })}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    )
  }

  return (
    <section
      className="inv-stage inv-shelf-stage"
      aria-label="Bookshelf"
      data-testid="bookshelf-scene"
      data-list-id={listId}
    >
      <div className="inv-shelf-bar">
        <p className="inv-stage-count">{itemCount(books.length)}</p>
        <label className="inv-shelf-search-label">
          <span className="inv-shelf-search-name">Search</span>
          <input
            className="inv-shelf-search"
            type="search"
            value={query}
            placeholder="Titles"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              const gesture = shelfSearchEnter(pulledRef.current, matchIds)
              if (!gesture) return
              event.preventDefault()
              activate(gesture.kind === "clear" ? null : gesture.id)
            }}
          />
        </label>
        <button type="button" className="inv-shelf-fetch" data-testid="fetch-covers" disabled={fetching} onClick={fetchCovers}>
          Fetch covers
        </button>
      </div>
      <p className="inv-shelf-match" aria-live="polite">
        {matchNote(query, matchIds.length)}
        {coverNote ? <span className="inv-shelf-status">{coverNote}</span> : null}
      </p>
      <BookshelfStage books={books} matchIds={matchIds} pulledId={pulledId} onSelect={activate} />
      {books.length > 0 ? (
        <ul className="inv-stage-titles">
          {books.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                data-match={matchSet.has(book.id) ? "true" : "false"}
                data-pulled={pulledId === book.id ? "true" : "false"}
                onClick={() => activate(book.id)}
              >
                {itemTitleOrUntitled({ title: book.title })}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function itemCount(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`
}

function matchNote(query: string, count: number): string {
  if (!query.trim()) return ""
  if (count === 0) return "No title matches."
  return count === 1 ? "1 title matches." : `${count} titles match.`
}
