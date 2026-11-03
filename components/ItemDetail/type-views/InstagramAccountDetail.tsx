/**
 * components/ItemDetail/type-views/InstagramAccountDetail.tsx — Instagram Account desk
 *
 * Two keys for an item of the Instagram Account type. Visit profile opens the
 * account's https profile page; in the iOS app it opens the Instagram app by
 * `instagram://` and falls back to the page (`openInstagramProfile` in
 * `lib/instagram-profile-link.ts`). Attach to person writes the
 * handle onto a Person (`lib/instagram-person-links.ts`): search the people you
 * know, or make a new one from this account. An account belongs to one person,
 * so attaching takes it off anyone else. The link lives on the Person, not on
 * this item, so nothing here touches the draft.
 */
"use client"

import { ExternalLink } from "lucide-react"
import { useMemo, useState } from "react"
import { createPersonFromInstagram, linkInstagramToPerson, personForInstagram, unlinkInstagramFromPerson } from "@/lib/instagram-person-links"
import { instagramProfileUrl, instagramUsernameOf, openInstagramProfile } from "@/lib/instagram-profile-link"
import { IG_DISPLAY_NAME } from "@/lib/instagram-analysis"
import { personRecords } from "@/lib/people-i-know"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

const nameOf = (p: Task) => p.title || p.description || p.id

export function InstagramAccountDetail({ task }: { task: Task }) {
  const handle = instagramUsernameOf(task)
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState("")
  const people = useMemo(() => personRecords(tasks, lists).filter((p) => !p.personProfile?.self), [tasks, lists])
  const linked = handle ? personForInstagram(people, handle) : null
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people
      .filter((p) => !q || nameOf(p).toLowerCase().includes(q))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
      .slice(0, 8)
  }, [people, query])
  const display = typeof task.attributes?.[IG_DISPLAY_NAME] === "string" ? (task.attributes[IG_DISPLAY_NAME] as string) : ""

  if (!handle) {
    return (
      <section className="id-bay" aria-label="Instagram account">
        <p>This item has no Instagram username yet. Fill in Username below.</p>
      </section>
    )
  }

  const done = () => {
    setSearching(false)
    setQuery("")
  }

  return (
    <section className="id-bay" aria-label="Instagram account" data-testid="instagram-account-detail">
      <header className="id-attrs-head">
        <span className="id-attrs-plate">@{handle}</span>
        <a
          className="id-keycap"
          href={instagramProfileUrl(handle)}
          target="_blank"
          rel="noreferrer"
          data-testid="instagram-visit-profile"
          onClick={(e) => openInstagramProfile(handle, e)}
          aria-label={`Visit @${handle} on Instagram`}
        >
          <ExternalLink aria-hidden size={13} /> Visit profile
        </a>
        {linked ? (
          <>
            <button type="button" className="id-keycap" onClick={() => openItemDetailPopup(linked.id)}>
              Person: {nameOf(linked)}
            </button>
            <button type="button" className="id-keycap" onClick={() => unlinkInstagramFromPerson(linked.id, handle)}>
              Detach
            </button>
          </>
        ) : (
          <button type="button" className="id-keycap" aria-expanded={searching} onClick={() => setSearching((v) => !v)}>
            Attach to person
          </button>
        )}
      </header>
      {!linked && searching ? (
        <div className="id-ig-attach" role="group" aria-label="Attach to person">
          <input
            type="search"
            value={query}
            autoFocus
            placeholder="Search people"
            aria-label="Search people"
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul>
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="id-keycap"
                  onClick={() => {
                    linkInstagramToPerson(p.id, handle)
                    done()
                  }}
                >
                  {nameOf(p)}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="id-keycap"
            onClick={() => {
              createPersonFromInstagram(handle, query.trim() || display || handle)
              done()
            }}
          >
            Create person “{query.trim() || display || handle}”
          </button>
        </div>
      ) : null}
    </section>
  )
}
