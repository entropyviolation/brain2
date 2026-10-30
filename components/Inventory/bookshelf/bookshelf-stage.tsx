/**
 * components/Inventory/bookshelf/bookshelf-stage.tsx — Desktop shelf host
 *
 * Three mounts in an effect and remounts when the book signature changes.
 * Search and cover urls update the live shelf without rebuilding it.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import type { ShelfBook } from "./shelf-books"

export function BookshelfStage({
  books,
  matchIds,
  pulledId,
  onSelect,
}: {
  books: readonly ShelfBook[]
  matchIds: readonly string[]
  pulledId: string | null
  onSelect: (id: string | null) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const booksRef = useRef(books)
  const onSelectRef = useRef(onSelect)
  const live = useRef({ matchIds: [] as readonly string[], pulledId: null as string | null, covers: {} as Record<string, string> })
  booksRef.current = books
  onSelectRef.current = onSelect
  live.current.matchIds = matchIds
  live.current.pulledId = pulledId

  const [covers, setCovers] = useState<Record<string, string>>({})
  live.current.covers = covers
  const onSrc = useCallback((id: string, src: string) => {
    setCovers((prev) => (prev[id] === src ? prev : { ...prev, [id]: src }))
  }, [])

  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  const signature = books
    .map((book) => `${book.id}\t${book.title}\t${book.coverUri ?? ""}\t${book.heightCm ?? ""}\t${book.widthCm ?? ""}\t${book.thicknessCm ?? ""}`)
    .join("\n")

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cleanup = () => {}
    let dead = false
    const reducedMotion = reduced
    void import("./shelf-diorama")
      .then(({ mountBookshelf }) => {
        if (dead || !hostRef.current) return
        cleanup = mountBookshelf(hostRef.current, {
          books: booksRef.current,
          reducedMotion,
          getMatchIds: () => live.current.matchIds,
          getPulledId: () => live.current.pulledId,
          getCoverSrcs: () => live.current.covers,
          onSelect: (id) => onSelectRef.current(id),
        })
      })
      .catch(() => {})
    return () => {
      dead = true
      cleanup()
    }
  }, [signature, reduced])

  const matchKey = matchIds.join("\n")
  const coverKey = books.map((book) => covers[book.id] ?? "").join("\n")
  useEffect(() => {
    hostRef.current?.dispatchEvent(new Event("shelf-poke"))
  }, [matchKey, coverKey, signature, pulledId])

  return (
    <>
      {books.map((book) =>
        book.coverUri ? <CoverSrc key={`${book.id}:${book.coverUri}`} id={book.id} uri={book.coverUri} onSrc={onSrc} /> : null,
      )}
      <div ref={hostRef} className="inv-shelf-host" data-testid="bookshelf-host" />
    </>
  )
}

function CoverSrc({ id, uri, onSrc }: { id: string; uri: string; onSrc: (id: string, src: string) => void }) {
  const src = useAttachmentSrc(uri)
  useEffect(() => {
    onSrc(id, src)
  }, [id, onSrc, src])
  return null
}
