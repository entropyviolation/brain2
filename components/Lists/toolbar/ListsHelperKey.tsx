"use client"

/**
 * components/Lists/toolbar/ListsHelperKey.tsx — The Lists helper, one key away
 *
 * A toolbar key that opens the helper chat (`components/Lab/ListsHelper/`) over the window. It starts in the open
 * list, so "add Dune" lands there. The chat is the same one as `/lab/lists-helper/`; closing it keeps the conversation.
 */
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { MessageSquare } from "lucide-react"
import { ListsHelperChat } from "@/components/Lab/ListsHelper/ListsHelperChat"

export function ListsHelperKey({ listId }: { listId?: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <button type="button" className="fm-btn fm-btn-sm fm-cap-cornflower" onClick={() => setOpen(true)} aria-label="BIMBY" title="Find duplicates and make bulk changes, with a plan to approve first">
        BIMBY
        <MessageSquare size={12} aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="lh-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
              <div className="lh-embed" role="dialog" aria-label="Lists helper">
                <ListsHelperChat initialListId={listId} onClose={() => setOpen(false)} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
