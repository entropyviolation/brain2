/**
 * components/PeriodSummary/period-summary-plates.tsx — The period summary, read
 *
 * A stack of plates over one period or a custom range: playlist, photos,
 * events, places, activity, company, palette and symbols. A plate shows only
 * when it has rows. Data → Summary and the ritual summary step both mount
 * this, so they show the same thing. Plan: `docs/PERIOD_SUMMARY_PLAN.md`.
 */
"use client"

import { useMemo, type ReactNode } from "react"
import { format } from "date-fns"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import { photoIdsForDay, useDayPhotosStore } from "@/lib/day-photos-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useEventStore } from "@/lib/event-store"
import { itemTitle } from "@/lib/item-utils"
import { defaultPlaylistName, spotifyEmbedUrl, type PeriodSummaryRecord, type SummaryPeriodWindow } from "@/lib/period-summary"
import { PHOTO_ATTR, PHOTO_TYPE_ID, photoDayKey } from "@/lib/photo-types"
import { useTaskStore } from "@/lib/task-store"
import { formatDuration } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { entriesInRange, penTotals, type TrackingSlice } from "@/lib/tracking-summary"
import type { FileValue, Task } from "@/lib/types"
import "./period-summary.css"

const TOP = 6

function Plate({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ps-plate" aria-label={title}>
      <h4 className="ps-plate-title">{title}</h4>
      {children}
    </section>
  )
}

function photoUri(task: Task): string | undefined {
  const v = task.attributes?.[PHOTO_ATTR.image]
  const first = Array.isArray(v) ? v[0] : v
  return first && typeof first === "object" ? (first as FileValue).uri : undefined
}

export function PhotoThumb({ task, size = 96, cover }: { task: Task; size?: number; cover?: boolean }) {
  const src = useAttachmentSrc(photoUri(task))
  return (
    <span className="ps-photo" data-cover={cover || undefined} title={itemTitle(task)} style={{ width: size, height: size }}>
      {src ? <img src={src} alt={itemTitle(task)} /> : <span>{itemTitle(task)}</span>}
    </span>
  )
}

/** Photo items on any day of the range: attached by hand plus `takenAt`. Oldest day first. */
export function usePhotosInRange(dateKeys: string[]): Task[] {
  const tasks = useTaskStore((s) => s.tasks)
  const byDay = useDayPhotosStore((s) => s.byDay)
  return useMemo(() => {
    const photos = tasks.filter((t) => t.type === PHOTO_TYPE_ID)
    const dated = photos.map((p) => ({ id: p.id, takenDayKey: photoDayKey(p.attributes?.[PHOTO_ATTR.takenAt]) }))
    const ids: string[] = []
    for (const key of dateKeys) for (const id of photoIdsForDay(key, byDay, dated)) if (!ids.includes(id)) ids.push(id)
    return ids.flatMap((id) => photos.find((p) => p.id === id) ?? [])
  }, [tasks, byDay, dateKeys])
}

function SliceRows({ slices }: { slices: TrackingSlice[] }) {
  return (
    <ol className="ps-rows">
      {slices.slice(0, TOP).map((slice) => (
        <li key={slice.id}>
          <span className="ps-swatch" style={{ background: slice.color }} aria-hidden />
          <span className="ps-row-name">{slice.name}</span>
          <span className="ps-row-value">
            {formatDuration(slice.minutes)} · {Math.round(slice.percentOfTracked)}%
          </span>
        </li>
      ))}
    </ol>
  )
}

export function PlaylistPlate({ record, window }: { record: PeriodSummaryRecord; window: SummaryPeriodWindow | null }) {
  const embed = spotifyEmbedUrl(record.playlistUrl)
  if (!record.playlistUrl?.trim() && record.songs.length === 0) return null
  const name = record.playlistName?.trim() || (window ? defaultPlaylistName(window) : "Songs")
  return (
    <Plate title={name}>
      {embed ? (
        <iframe className="ps-embed" title={name} src={embed} height={152} loading="lazy" allow="encrypted-media" />
      ) : record.playlistUrl ? (
        <a className="ps-link" href={record.playlistUrl} target="_blank" rel="noreferrer">
          Open playlist
        </a>
      ) : null}
      {record.songs.length ? (
        <ol className="ps-songs">
          {record.songs.map((song, i) => (
            <li key={`${song.title}-${i}`}>
              <span className="ps-song-title">
                {song.url ? (
                  <a href={song.url} target="_blank" rel="noreferrer">
                    {song.title}
                  </a>
                ) : (
                  song.title
                )}
              </span>
              {song.artist ? <span className="ps-song-artist"> · {song.artist}</span> : null}
              {song.note?.trim() ? <p className="ps-song-note">{song.note}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </Plate>
  )
}

export function PaletteSymbolsPlate({ record }: { record: PeriodSummaryRecord }) {
  if (!record.palette.length && !record.symbols.length) return null
  return (
    <Plate title="Palette and symbols">
      {record.palette.length ? (
        <div className="ps-palette" aria-label="Palette">
          {record.palette.map((hex) => (
            <span key={hex} className="ps-chip" style={{ background: hex }} title={hex} />
          ))}
        </div>
      ) : null}
      {record.symbols.length ? (
        <ul className="ps-symbols" aria-label="Symbols">
          {record.symbols.map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ul>
      ) : null}
    </Plate>
  )
}

/**
 * Every plate read from data that already exists, plus the record's playlist,
 * palette, and symbols. The written summary is the caller's, since Data shows
 * it and the ritual edits it.
 */
export function PeriodSummaryPlates({
  dateKeys,
  record,
  window,
}: {
  dateKeys: string[]
  record: PeriodSummaryRecord
  window: SummaryPeriodWindow | null
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const events = useEventStore((s) => s.events)
  const photos = usePhotosInRange(dateKeys)

  const cover = record.coverPhotoId ? photos.find((p) => p.id === record.coverPhotoId) : undefined
  const orderedPhotos = cover ? [cover, ...photos.filter((p) => p.id !== cover.id)] : photos

  const keySet = useMemo(() => new Set(dateKeys), [dateKeys])
  const periodEvents = useMemo(
    () =>
      events
        .filter((e) => e.type === "event" && keySet.has(formatLocalDateKey(new Date(e.date))))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events, keySet],
  )

  const byScope = useMemo(() => {
    const scopeFor = (id: string, name: RegExp) => scopes.find((s) => s.id === id) ?? scopes.find((s) => name.test(s.name))
    const totals = (scope: ReturnType<typeof scopeFor>) =>
      scope ? penTotals(entriesInRange(entries, dateKeys, scope.id), scope, dateKeys).filter((s) => s.minutes > 0) : []
    return {
      places: totals(scopeFor("location", /location/i)),
      activity: totals(scopeFor("activity", /activity/i)),
      company: totals(scopeFor("company", /company/i)),
    }
  }, [scopes, entries, dateKeys])

  return (
    <div className="ps-plates">
      <PlaylistPlate record={record} window={window} />
      {orderedPhotos.length ? (
        <Plate title={`Photos · ${orderedPhotos.length}`}>
          <div className="ps-photos">
            {orderedPhotos.slice(0, 24).map((photo) => (
              <PhotoThumb key={photo.id} task={photo} cover={photo.id === cover?.id} />
            ))}
          </div>
        </Plate>
      ) : null}
      {periodEvents.length ? (
        <Plate title="Events">
          <ol className="ps-rows">
            {periodEvents.slice(0, 20).map((event) => (
              <li key={event.id}>
                <span className="ps-row-value">{format(new Date(event.date), "MMM d")}</span>
                <span className="ps-row-name">{event.title}</span>
                {event.location ? <span className="ps-row-value">{event.location}</span> : null}
              </li>
            ))}
          </ol>
        </Plate>
      ) : null}
      {byScope.places.length ? (
        <Plate title="Places">
          <SliceRows slices={byScope.places} />
        </Plate>
      ) : null}
      {byScope.activity.length ? (
        <Plate title="Activity">
          <SliceRows slices={byScope.activity} />
        </Plate>
      ) : null}
      {byScope.company.length ? (
        <Plate title="Company">
          <SliceRows slices={byScope.company} />
        </Plate>
      ) : null}
      <PaletteSymbolsPlate record={record} />
    </div>
  )
}
