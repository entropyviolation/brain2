/**
 * components/People/detail/person-gift-ideas.tsx — Gift ideas on a person.
 *
 * `GiftIdeasKey` (3.4): one wide metal key at the end of Details,
 * "🎁 {list name} · {n}". With no list it reads "Start gift ideas" and makes
 * one (Close stays as it is). The key opens `GiftIdeasDialog`, a small milled
 * popup: the list's items, a quick add (`addGiftIdeaOnList`, a store write),
 * the quick gift notes (`GiftLog`, on `personProfile.giftIdeas` through the
 * host's draft, so Save covers them), and foot keys Rename and Open list.
 *
 * The list is tied by `List.giftIdeasPersonId`. A name typed with Rename is
 * kept; only the automatic name follows the person (`lib/gift-ideas.ts`).
 * See `docs/PERSON_DETAIL_REDESIGN.md` 3.4.
 */
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  addGiftIdeaOnList,
  ensureGiftIdeasForPerson,
  findGiftIdeasList,
  renameGiftIdeasListByHand,
} from "@/lib/gift-ideas"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import type { PersonGiftIdea } from "@/lib/person-profile"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

export function GiftIdeasKey({
  person,
  gifts,
  onGiftsChange,
  onOpenList,
}: {
  person: Task
  /** Quick gift notes on the draft (`personProfile.giftIdeas`). */
  gifts: PersonGiftIdea[]
  onGiftsChange: (next: PersonGiftIdea[]) => void
  /** The host's guarded list navigation (closes the detail first). */
  onOpenList?: (listId: string) => void
}) {
  const lists = useTaskStore((s) => s.lists)
  const tasks = useTaskStore((s) => s.tasks)
  const list = findGiftIdeasList(lists, person.id)
  const [open, setOpen] = useState(false)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const count = list ? tasks.filter((task) => task.id !== person.id && (task.lists ?? []).includes(list.id)).length : 0

  return (
    <>
      <button
        type="button"
        className="person-key person-gift-key"
        data-testid="gift-ideas-key"
        onClick={(event) => {
          // Inside item detail, portal into that dialog so this one stacks on top.
          const dialog = event.currentTarget.closest('[role="dialog"]')
          setHost(dialog instanceof HTMLElement ? dialog : null)
          if (!list) ensureGiftIdeasForPerson(person)
          setOpen(true)
        }}
      >
        <span aria-hidden>🎁</span>
        {list ? (
          <>
            <span className="person-gift-key-name">{list.name}</span>{" "}
            <span className="person-gift-key-count">· {count}</span>
          </>
        ) : (
          "Start gift ideas"
        )}
      </button>
      {open ? (
        <GiftIdeasDialog
          person={person}
          gifts={gifts}
          onGiftsChange={onGiftsChange}
          onOpenList={onOpenList}
          container={host}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

function newGiftId(): string {
  return `pg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function GiftIdeasDialog({
  person,
  gifts,
  onGiftsChange,
  onOpenList,
  container,
  onClose,
}: {
  person: Task
  gifts: PersonGiftIdea[]
  onGiftsChange: (next: PersonGiftIdea[]) => void
  onOpenList?: (listId: string) => void
  container?: HTMLElement | null
  onClose: () => void
}) {
  const lists = useTaskStore((s) => s.lists)
  const tasks = useTaskStore((s) => s.tasks)
  const list = findGiftIdeasList(lists, person.id)
  const [text, setText] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState("")
  const items = list ? tasks.filter((task) => task.id !== person.id && (task.lists ?? []).includes(list.id)) : []
  const title = list?.name ?? "Gift ideas"

  const finishRename = () => {
    renameGiftIdeasListByHand(person.id, name)
    setRenaming(false)
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        container={container}
        className="id95-dialog person-gift-dialog sm:max-w-md"
        aria-describedby="person-gift-dialog-desc"
      >
        <div className="id-fascia">
          <div className="id-mark">
            <span className="id-power-lamp is-on" aria-hidden />
            <DialogTitle className="id-title">{title}</DialogTitle>
          </div>
        </div>
        <DialogDescription id="person-gift-dialog-desc" className="sr-only">
          Gift ideas list and quick gift notes for {itemTitleOrUntitled(person)}.
        </DialogDescription>

        <section className="person-log" aria-label="Gift ideas">
          {items.length > 0 ? (
            <ul className="person-log-list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="person-log-row"
                  data-testid="gift-ideas-item"
                  data-done={item.completed ? "true" : undefined}
                >
                  <span className="person-log-text">{itemTitleOrUntitled(item, "Gift")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="person-gift-empty">No gift ideas yet.</p>
          )}
          <form
            className="person-log-add"
            onSubmit={(event) => {
              event.preventDefault()
              const trimmed = text.trim()
              if (!trimmed) return
              addGiftIdeaOnList(person.id, trimmed)
              setText("")
            }}
          >
            <label>
              Gift idea
              <input type="text" aria-label="Gift idea" value={text} onChange={(event) => setText(event.target.value)} />
            </label>
            <button type="submit">Add to gift ideas</button>
          </form>
        </section>

        <GiftLog
          gifts={gifts}
          onAdd={(note) => onGiftsChange([...gifts, { id: newGiftId(), text: note }])}
          onRemove={(id) => onGiftsChange(gifts.filter((gift) => gift.id !== id))}
          onGiven={(id, given) =>
            onGiftsChange(
              gifts.map((gift) =>
                gift.id === id ? (given ? { ...gift, given: true } : { id: gift.id, text: gift.text }) : gift,
              ),
            )
          }
        />

        <div className="person-gift-foot">
          {renaming && list ? (
            <form
              className="person-gift-rename"
              onSubmit={(event) => {
                event.preventDefault()
                finishRename()
              }}
            >
              <input
                type="text"
                aria-label="List name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation()
                    setRenaming(false)
                  }
                }}
              />
              <button type="submit" className="person-key">
                Keep name
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="person-key"
              disabled={!list}
              onClick={() => {
                setName(list?.name ?? "")
                setRenaming(true)
              }}
            >
              Rename
            </button>
          )}
          {onOpenList && list ? (
            <button
              type="button"
              className="person-key"
              onClick={() => {
                onClose()
                onOpenList(list.id)
              }}
            >
              Open list
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function GiftLog({
  gifts,
  onAdd,
  onRemove,
  onGiven,
}: {
  gifts: PersonGiftIdea[]
  onAdd: (text: string) => void
  onRemove: (id: string) => void
  onGiven: (id: string, given: boolean) => void
}) {
  const [text, setText] = useState("")
  return (
    <section className="person-log" aria-label="Gift notes">
      <h3 title="Quick notes kept on this person. They are not the Gift ideas list.">Quick notes</h3>
      {gifts.length > 0 ? (
        <ul className="person-log-list">
          {gifts.map((gift) => (
            <li key={gift.id} className="person-log-row">
              <span className="person-log-text">{gift.text}</span>
              <label className="person-check">
                <input
                  type="checkbox"
                  aria-label={`Given ${gift.text}`}
                  checked={gift.given === true}
                  onChange={(event) => onGiven(gift.id, event.target.checked)}
                />
                Given
              </label>
              <button type="button" aria-label={`Remove gift note ${gift.text}`} onClick={() => onRemove(gift.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="person-log-add"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = text.trim()
          if (!trimmed) return
          onAdd(trimmed)
          setText("")
        }}
      >
        <label>
          Gift note
          <input type="text" aria-label="Gift note" value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <button type="submit">Add gift note</button>
      </form>
    </section>
  )
}
