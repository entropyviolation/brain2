/**
 * components/PeriodSummary/period-summary-fields.tsx — The period summary, edited
 *
 * The fields the ritual summary step adds under the written summary: the
 * period's playlist (a pasted link, and pasted songs with a note on each),
 * a palette, symbols, and a cover photo. Each field saves as you go into
 * `lib/period-summary-store.ts`, which Data → Summary reads.
 */
"use client"

import { useEffect, useState } from "react"
import { itemTitle } from "@/lib/item-utils"
import {
  defaultPlaylistName,
  MAX_PALETTE,
  mergePastedSongs,
  normalizeHex,
  parseSymbols,
  type SummaryPeriodWindow,
} from "@/lib/period-summary"
import { usePeriodSummary, usePeriodSummaryStore } from "@/lib/period-summary-store"
import { usePhotosInRange } from "./period-summary-plates"
import "./period-summary.css"

export function PeriodSummaryFields({ window, dateKeys }: { window: SummaryPeriodWindow; dateKeys: string[] }) {
  const record = usePeriodSummary(window.key)
  const patch = usePeriodSummaryStore((s) => s.patch)
  const set = (change: Parameters<typeof patch>[1]) => patch(window.key, change)
  const photos = usePhotosInRange(dateKeys)

  const [paste, setPaste] = useState("")
  const [color, setColor] = useState("#6b7a8f")
  const [symbols, setSymbols] = useState(record.symbols.join(", "))
  useEffect(() => setSymbols(record.symbols.join(", ")), [record.symbols])

  const addSongs = () => {
    if (!paste.trim()) return
    set({ songs: mergePastedSongs(record.songs, paste) })
    setPaste("")
  }

  return (
    <div className="ps-fields" aria-label={`Edit ${window.label} summary`}>
      <fieldset className="ps-field">
        <legend>Playlist</legend>
        <label className="ps-label">
          <span>Name</span>
          <input
            type="text"
            value={record.playlistName ?? ""}
            placeholder={defaultPlaylistName(window)}
            onChange={(e) => set({ playlistName: e.target.value })}
          />
        </label>
        <label className="ps-label">
          <span>Link</span>
          <input
            type="url"
            inputMode="url"
            value={record.playlistUrl ?? ""}
            placeholder="Paste a Spotify or other playlist link"
            onChange={(e) => set({ playlistUrl: e.target.value })}
          />
        </label>
        <label className="ps-label">
          <span>Songs</span>
          <textarea
            rows={3}
            value={paste}
            placeholder={"Paste songs, one per line: Title — Artist\nA Spotify track link works too."}
            onChange={(e) => setPaste(e.target.value)}
          />
        </label>
        <button type="button" className="ps-key" onClick={addSongs} disabled={!paste.trim()}>
          Add songs
        </button>
        {record.songs.length ? (
          <ol className="ps-song-edit">
            {record.songs.map((song, i) => (
              <li key={`${song.title}-${i}`}>
                <div className="ps-song-head">
                  <span className="ps-song-title">{song.title}</span>
                  {song.artist ? <span className="ps-song-artist"> · {song.artist}</span> : null}
                  <button
                    type="button"
                    className="ps-x"
                    aria-label={`Remove ${song.title}`}
                    onClick={() => set({ songs: record.songs.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </div>
                <textarea
                  rows={2}
                  aria-label={`Note on ${song.title}`}
                  placeholder="What you like about it, how it makes you feel"
                  value={song.note ?? ""}
                  onChange={(e) =>
                    set({ songs: record.songs.map((s, j) => (j === i ? { ...s, note: e.target.value } : s)) })
                  }
                />
              </li>
            ))}
          </ol>
        ) : null}
      </fieldset>

      <fieldset className="ps-field">
        <legend>Palette</legend>
        <div className="ps-palette">
          {record.palette.map((hex) => (
            <button
              key={hex}
              type="button"
              className="ps-chip"
              style={{ background: hex }}
              title={`Remove ${hex}`}
              aria-label={`Remove ${hex}`}
              onClick={() => set({ palette: record.palette.filter((h) => h !== hex) })}
            />
          ))}
          {record.palette.length < MAX_PALETTE ? (
            <>
              <input type="color" aria-label="Pick a color" value={color} onChange={(e) => setColor(e.target.value)} />
              <button
                type="button"
                className="ps-key"
                onClick={() => {
                  const hex = normalizeHex(color)
                  if (hex && !record.palette.includes(hex)) set({ palette: [...record.palette, hex] })
                }}
              >
                Add color
              </button>
            </>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="ps-field">
        <legend>Symbols</legend>
        <input
          type="text"
          aria-label="Symbols"
          value={symbols}
          placeholder="Words or phrases you noticed, separated by commas"
          onChange={(e) => setSymbols(e.target.value)}
          onBlur={() => set({ symbols: parseSymbols(symbols) })}
        />
      </fieldset>

      {photos.length ? (
        <fieldset className="ps-field">
          <legend>Cover photo</legend>
          <select
            aria-label="Cover photo"
            value={record.coverPhotoId ?? ""}
            onChange={(e) => set({ coverPhotoId: e.target.value || undefined })}
          >
            <option value="">None</option>
            {photos.map((photo) => (
              <option key={photo.id} value={photo.id}>
                {itemTitle(photo)}
              </option>
            ))}
          </select>
        </fieldset>
      ) : null}
    </div>
  )
}
