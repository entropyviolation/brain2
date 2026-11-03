/**
 * components/Inventory/phone/bookshelf-phone.tsx — Cover browser
 *
 * No Three.js. Membership, titles, and covers come from `shelf-books`
 * (`task.lists`, including finished items). The picture fills a 2:3 jacket.
 * Fetch covers uses the same lookup as the desk. The first tap eases that
 * cover forward. A second tap on the same cover uses `openItemDetailPopup`,
 * the same event the desk shelf uses. Search marks matches and does not
 * select or open.
 */
"use client"

import { useMemo, useState, type MouseEvent } from "react"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import { SingleListPicker } from "@/components/Lists/list-picker"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import { shelfBooks, shelfMatchIds, tasksForShelf, type ShelfBook } from "../bookshelf/shelf-books"
import { useShelfCovers } from "../bookshelf/use-shelf-covers"

/** Same ease the search-match rule uses, so a chosen cover comes forward. */
const SELECTED_COVER_STYLE = {
  position: "relative" as const,
  zIndex: 1,
  transform: "translateY(-8px) scale(1.04)",
}

export function BookshelfPhone({
  listId,
  onListId,
}: {
  listId: string | null
  onListId: (id: string | null) => void
}) {
  const tasks = useTaskStore((state) => state.tasks)
  const types = useItemTypeStore((state) => state.types)
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [queryFor, setQueryFor] = useState(listId)
  if (queryFor !== listId) {
    setQueryFor(listId)
    setQuery("")
    setSelectedId(null)
  }

  const shelfTasks = useMemo(() => tasksForShelf(tasks, listId), [tasks, listId])
  const books = useMemo(() => shelfBooks(shelfTasks, types), [shelfTasks, types])
  const matchIds = useMemo(() => shelfMatchIds(shelfTasks, query), [shelfTasks, query])
  const matchSet = useMemo(() => new Set(matchIds), [matchIds])
  const searching = query.trim().length > 0
  const { note: coverNote, fetching, fetchCovers } = useShelfCovers(listId)
  if (selectedId && !books.some((book) => book.id === selectedId)) {
    setSelectedId(null)
  }

  function chooseBook(id: string) {
    if (selectedId === id) {
      openItemDetailPopup(id)
      return
    }
    setSelectedId(id)
  }

  function clearIfEmpty(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) setSelectedId(null)
  }

  return (
    <section className="inv-phone-shelf" aria-label="Bookshelf" data-testid="bookshelf-phone" data-list-id={listId ?? ""}>
      <div className="inv-shelf-pick">
        <span className="inv-shelf-label">Shelf list</span>
        <SingleListPicker
          value={listId ?? ""}
          searchLabel="Shelf list"
          onValueChange={(id) => onListId(id || null)}
        />
      </div>
      {!listId ? (
        <div className="inv-phone-empty">
          <p>No list</p>
          <p className="inv-phone-quiet">A list names the books on this shelf.</p>
        </div>
      ) : (
        <>
          <p className="inv-phone-count">{books.length === 1 ? "1 item" : `${books.length} items`}</p>
          {books.length > 0 ? (
            <label className="inv-phone-search">
              <span>Search</span>
              <input
                type="search"
                aria-label="Search titles"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          ) : (
            <p className="inv-phone-quiet">This shelf is empty.</p>
          )}
          <button type="button" className="inv-phone-fetch" data-testid="fetch-covers" disabled={fetching} onClick={fetchCovers}>
            Fetch covers
          </button>
          {coverNote ? (
            <p className="inv-phone-quiet" aria-live="polite">
              {coverNote}
            </p>
          ) : null}
          {searching ? (
            <p className="inv-phone-quiet" aria-live="polite">
              {matchIds.length === 0 ? "No title matches." : matchIds.length === 1 ? "1 title matches." : `${matchIds.length} titles match.`}
            </p>
          ) : null}
          {books.length > 0 ? (
            <div
              className="inv-phone-covers"
              data-searching={searching ? "true" : "false"}
              onClick={clearIfEmpty}
            >
              {books.map((book) => (
                <ShelfCover
                  key={book.id}
                  book={book}
                  match={searching ? (matchSet.has(book.id) ? "true" : "false") : undefined}
                  selected={book.id === selectedId}
                  onChoose={chooseBook}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function ShelfCover({
  book,
  match,
  selected,
  onChoose,
}: {
  book: ShelfBook
  match: "true" | "false" | undefined
  selected: boolean
  onChoose: (id: string) => void
}) {
  const src = useAttachmentSrc(book.coverUri)
  const title = itemTitleOrUntitled({ title: book.title })
  return (
    <button
      type="button"
      className="inv-phone-cover"
      data-match={match}
      data-selected={selected ? "true" : "false"}
      aria-pressed={selected}
      style={selected ? SELECTED_COVER_STYLE : undefined}
      onClick={() => onChoose(book.id)}
    >
      <span className="inv-phone-cover-face">
        {src ? <img src={src} alt="" /> : <span className="inv-phone-cover-blank" aria-hidden="true" />}
      </span>
      <span className="inv-phone-cover-title">{title}</span>
    </button>
  )
}
