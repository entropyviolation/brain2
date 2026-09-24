/**
 * components/baby-animal-gallery.tsx — Gallery + shuffle + request for today’s friend
 *
 * Photograph cutouts in the friend vault. Preapproved pack cards start unnamed
 * so you can name every friend.
 */
"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { requestBabyAnimalFriend, rollBabyAnimalFriend, uploadFriendPicture } from "@/lib/baby-animal-friend"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { sortGalleryPhotos } from "@/lib/friend-pack"
import type { BabyAnimalPhoto } from "@/lib/baby-animal-photos"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import { FriendDetailsPanel } from "@/components/friend-details"

function FriendThumb({ uri, alt, fallback }: { uri: string; alt: string; fallback?: string }) {
  const src = useAttachmentSrc(uri, fallback)
  if (!src) return <span className="baby-friend-empty" />
  return <img src={src} alt={alt} />
}

export function BabyAnimalRequestForm() {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestBabyAnimalFriend(name)
      setName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not name that friend.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="baby-friend-request" onSubmit={(event) => void submit(event)}>
      <label className="baby-friend-request-label">
        <span className="baby-friend-request-caption">Name a baby animal</span>
        <input
          className="fm-input baby-friend-request-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tiny Cute Striped Polecat"
          aria-label="Name a baby animal"
          disabled={busy}
        />
      </label>
      <Button type="submit" className="baby-friend-request-go" size="sm" disabled={busy || !name.trim()}>
        {busy ? "Naming…" : "Name"}
      </Button>
      {error ? <p className="baby-friend-error">{error}</p> : null}
    </form>
  )
}

function FriendCard({
  photo,
  current,
  busy,
  onWear,
  onRemove,
  onRename,
  onReplacePicture,
  onDetails,
}: {
  photo: BabyAnimalPhoto
  current: boolean
  busy: boolean
  onWear: () => void
  onRemove: () => void
  onRename: (name: string) => void
  onReplacePicture: (file: File) => void
  onDetails: () => void
}) {
  const [draft, setDraft] = useState(photo.displayName)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(photo.displayName)
  }, [photo.id, photo.displayName])

  const who = photo.displayName.trim() || "unnamed friend"

  const commitName = () => {
    const next = draft.trim()
    if (next !== photo.displayName) onRename(next)
  }

  return (
    <div className={`baby-friend-card${current ? " is-on" : ""}`} role="listitem">
      <button type="button" className="baby-friend-wear" onClick={onWear} aria-label={`Wear ${who}`}>
        <FriendThumb uri={photo.uri} fallback={photo.sourceUrl} alt="" />
      </button>
      <input
        className="fm-input baby-friend-name"
        aria-label={`Name for ${who}`}
        placeholder="Name this friend"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commitName()
            event.currentTarget.blur()
          }
        }}
      />
      <button
        type="button"
        className="baby-friend-card-btn"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "Cutting out…" : "Change picture"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) onReplacePicture(file)
        }}
      />
      <button type="button" className="baby-friend-card-btn" onClick={onDetails}>
        Details
      </button>
      <button type="button" className="baby-friend-card-btn" onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}

export function BabyAnimalFriendGallery({ onCoverChange }: { onCoverChange?: (open: boolean) => void } = {}) {
  const photos = useBabyAnimalsStore((s) => s.photos)
  const currentPhotoId = useBabyAnimalsStore((s) => s.currentPhotoId)
  const displayName = useBabyAnimalsStore((s) => s.displayName)
  const wearPhoto = useBabyAnimalsStore((s) => s.wearPhoto)
  const removePhoto = useBabyAnimalsStore((s) => s.removePhoto)
  const renamePhoto = useBabyAnimalsStore((s) => s.renamePhoto)
  const importFriendPack = useBabyAnimalsStore((s) => s.importFriendPack)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"roll" | "upload" | string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<BabyAnimalPhoto | null>(null)
  const [detailsPhoto, setDetailsPhoto] = useState<BabyAnimalPhoto | null>(null)

  useEffect(() => {
    importFriendPack()
  }, [importFriendPack])

  const listed = sortGalleryPhotos(photos)

  const run = async (kind: "roll" | "upload" | string, work: () => Promise<unknown>) => {
    setBusy(kind)
    setError(null)
    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the friend.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="baby-friend-gallery">
      <div className="baby-friend-toolbar">
        <Button type="button" size="sm" disabled={!!busy} onClick={() => run("roll", () => rollBabyAnimalFriend({ force: true }))}>
          {busy === "roll" ? "Shuffling…" : "Shuffle friend"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {busy === "upload" ? "Cutting out…" : "Upload photo"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (!file) return
            void run("upload", () => uploadFriendPicture(file))
          }}
        />
      </div>
      <BabyAnimalRequestForm />
      <p className="baby-friend-status">
        Current: <strong>{displayName || "unnamed friend"}</strong>
        {photos.length === 0
          ? " — shuffle to meet the preapproved pack, or upload a photograph."
          : " Every picture comes from the preapproved pack (or your own upload). Type a name on each card; naming above names the next unnamed one."}
      </p>
      {error ? <p className="baby-friend-error">{error}</p> : null}
      <FriendDetailsPanel
        photo={detailsPhoto}
        onClose={() => {
          onCoverChange?.(false)
          setDetailsPhoto(null)
        }}
        onCoverChange={onCoverChange}
      />
      {photos.length > 0 && !detailsPhoto ? (
        <div className="baby-friend-grid-scroll">
          <div className="baby-friend-grid" role="list">
            {listed.map((photo) => (
              <FriendCard
                key={photo.id}
                photo={photo}
                current={photo.id === currentPhotoId}
                busy={busy === photo.id || busy === `find-${photo.id}`}
                onWear={() => wearPhoto(photo.id)}
                onRemove={() => setPendingRemove(photo)}
                onRename={(name) => renamePhoto(photo.id, name)}
                onReplacePicture={(file) => void run(photo.id, () => uploadFriendPicture(file, photo.id))}
                onDetails={() => setDetailsPhoto(photo)}
              />
            ))}
          </div>
        </div>
      ) : null}
      <Dialog open={!!pendingRemove} onOpenChange={(open) => { if (!open) setPendingRemove(null) }}>
        <DialogContent className="fm98-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete friend?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {pendingRemove?.displayName || "this friend"}? They will not come back on
              shuffle or refresh.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingRemove(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingRemove) removePhoto(pendingRemove.id)
                setPendingRemove(null)
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

