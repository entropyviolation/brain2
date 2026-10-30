"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-dish-sheet.tsx — A dish photo or a printed recipe photo
 *
 * The photo is read on this device. The person edits the name before search.
 * Search is USDA, then Open Food Facts. Nutritionix runs only when a key is
 * already configured. Nothing is added until the confirm key.
 */

import { useState } from "react"
import { ocrImage } from "@/lib/ingest/ocr"
import { dishQueryFromOcr, searchDish } from "@/lib/kitchen-dish"
import type { FoodHit } from "@/lib/kitchen-search"

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("unreadable"))
    reader.readAsDataURL(file)
  })
}

export function FoodDishSheet({ onUse }: { onUse: (hit: FoodHit) => void }) {
  const [name, setName] = useState("")
  const [status, setStatus] = useState("")
  const [hits, setHits] = useState<FoodHit[]>([])
  const [picked, setPicked] = useState<FoodHit | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setStatus("Reading the photo…")
    setHits([])
    setPicked(null)
    try {
      const text = await ocrImage(await fileToDataUrl(file), "page")
      const line = dishQueryFromOcr(text)
      if (line) setName(line)
      setStatus(line ? "Edit the name, then search. A photo does not name the food." : "That photo had no readable name. Type one.")
    } catch {
      setStatus("That photo could not be read. Type a name.")
    }
  }

  const search = async () => {
    const query = name.trim()
    if (query.length < 2) {
      setStatus("Type a name first.")
      return
    }
    setStatus("Searching USDA FoodData Central…")
    setPicked(null)
    const found = await searchDish(query)
    setHits(found)
    setStatus(found.length ? "Choose a row, then confirm." : "Nothing matched that name.")
  }

  return (
    <div className="trk-food-dish">
      <label>
        Dish or recipe photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Dish or recipe photo"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            void onFile(file)
          }}
        />
      </label>
      <label>
        Dish name
        <input aria-label="Dish name" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="trk-food-caps">
        <button type="button" data-no95="" className="trk-keycap" onClick={() => void search()}>
          Search
        </button>
      </div>
      {status ? <p className="trk-food-status">{status}</p> : null}
      {hits.length ? (
        <ul aria-label="Dish matches">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" aria-pressed={picked?.id === hit.id} onClick={() => setPicked(hit)}>
                {hit.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {picked ? (
        <div className="trk-food-caps">
          <button
            type="button"
            data-no95=""
            className="trk-keycap"
            onClick={() => {
              onUse(picked)
              setPicked(null)
              setHits([])
              setStatus("")
            }}
          >
            Confirm
          </button>
        </div>
      ) : null}
    </div>
  )
}
