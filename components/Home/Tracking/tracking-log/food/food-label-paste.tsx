"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-label-paste.tsx — Label photo, pasted text, confirm
 *
 * A photo or a block of label text fills the same form. Nothing is saved until
 * the name, the serving grams, and the numbers are accepted. A missed line
 * stays blank or zero, and it stays editable.
 */

import { useEffect, useState } from "react"
import { ocrImage } from "@/lib/ingest/ocr"
import * as kitchenLabel from "@/lib/kitchen-label"
import { labelDraftPer100g, type LabelBasis, type LabelNutrients } from "@/lib/kitchen-label"
import { NUTRIENT_FACE, NUTRIENT_KEYS, type NutrientKey, type Nutrients } from "@/lib/kitchen-nutrients"
import "./food-capture.css"

export interface LabelForm {
  name: string
  grams: string
  lines: Record<NutrientKey, string>
  barcode: string
  basis: LabelBasis
}

export function blankLabelForm(barcode = ""): LabelForm {
  const lines = {} as Record<NutrientKey, string>
  for (const key of NUTRIENT_KEYS) lines[key] = ""
  return { name: "", grams: "", lines, barcode, basis: "serving" }
}

function linesFromRow(row: Partial<Record<NutrientKey, unknown>> | null | undefined): Record<NutrientKey, string> {
  const lines = blankLabelForm().lines
  if (!row) return lines
  for (const key of NUTRIENT_KEYS) {
    const value = row[key]
    if (value == null || value === "") continue
    const n = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(n) || n < 0) continue
    lines[key] = String(n)
  }
  return lines
}

function formFromDraft(draft: unknown, barcode: string): LabelForm | null {
  if (!draft || typeof draft !== "object") return null
  const row = draft as {
    name?: unknown
    servingG?: unknown
    servingGrams?: unknown
    basis?: unknown
    perServing?: Partial<Record<NutrientKey, unknown>> | null
    nutrients?: Partial<Record<NutrientKey, unknown>> | null
  }
  const source = row.nutrients ?? row.perServing
  const gramsRaw = row.servingGrams ?? row.servingG
  const grams = typeof gramsRaw === "number" && gramsRaw > 0 ? String(gramsRaw) : ""
  const name = typeof row.name === "string" ? row.name : ""
  const basis: LabelBasis = row.basis === "100g" || row.basis === "container" || row.basis === "serving" ? row.basis : "serving"
  if (!source && !grams && !name) return null
  return { name, grams, lines: linesFromRow(source), barcode, basis }
}

/** Prefer `parseLabelDraft` when the label module exports it. Missing lines stay blank. */
export function formFromLabelText(text: string, barcode = ""): LabelForm | null {
  const parseDraft = (kitchenLabel as { parseLabelDraft?: (raw: string) => unknown }).parseLabelDraft
  if (typeof parseDraft === "function") return formFromDraft(parseDraft(text), barcode)
  const parsed = kitchenLabel.parseNutritionLabel(text)
  if (!parsed) return null
  return {
    name: "",
    grams: parsed.servingG ? String(parsed.servingG) : "",
    lines: linesFromRow(parsed.perServing),
    barcode,
    basis: "serving",
  }
}

function nutrientsFromForm(form: LabelForm): LabelNutrients {
  const nutrients: LabelNutrients = {}
  for (const key of NUTRIENT_KEYS) {
    const raw = form.lines[key].trim()
    if (!raw) continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) continue
    nutrients[key] = n
  }
  return nutrients
}

export function commitLabelForm(form: LabelForm): { name: string; per100g: Nutrients; grams: number; barcode?: string } | null {
  const name = form.name.trim()
  const grams = Number(form.grams)
  const servingGrams = Number.isFinite(grams) && grams > 0 ? grams : null
  const per100g = labelDraftPer100g({
    name: name || null,
    servingLabel: "",
    servingGrams,
    nutrients: nutrientsFromForm(form),
    basis: form.basis,
  })
  if (!per100g || !name || servingGrams == null) return null
  return { name, per100g, grams: servingGrams, ...(form.barcode ? { barcode: form.barcode } : {}) }
}

type LabelOpener = (code: string) => void
let labelOpener: LabelOpener | null = null

/** Opens the photo/paste confirm when that form is on screen. False when it is not. */
export function openLabelForBarcode(code: string): boolean {
  if (!labelOpener) return false
  labelOpener(code)
  return true
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("unreadable"))
    reader.readAsDataURL(file)
  })
}

function setLine(form: LabelForm, key: NutrientKey, value: string): LabelForm {
  return { ...form, lines: { ...form.lines, [key]: value } }
}

export function LabelCapture({
  onUse,
  showPhoto = true,
  barcode = "",
}: {
  onUse: (draft: { name: string; per100g: Nutrients; grams: number; barcode?: string }) => void
  showPhoto?: boolean
  barcode?: string
}) {
  const [paste, setPaste] = useState("")
  const [form, setForm] = useState<LabelForm | null>(barcode ? blankLabelForm(barcode) : null)
  const [status, setStatus] = useState("")

  useEffect(() => {
    if (!showPhoto) return
    labelOpener = (code) => {
      setPaste("")
      setForm(blankLabelForm(code))
      setStatus("No Open Food Facts product for this code.")
    }
    return () => {
      labelOpener = null
    }
  }, [showPhoto])

  const openText = (text: string, emptyNote: string) => {
    const kept = form?.barcode || barcode
    const next = formFromLabelText(text, kept)
    if (!next) {
      setForm(blankLabelForm(kept))
      setStatus(emptyNote)
      return
    }
    setForm(next)
    setStatus(next.lines.kcal ? "Percent daily values are left blank." : emptyNote)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setStatus("Reading the label…")
    try {
      const text = await ocrImage(await fileToDataUrl(file), "receipt")
      openText(text, "No calorie line in that photo.")
    } catch {
      setForm(blankLabelForm(form?.barcode || barcode))
      setStatus("Could not read that photo.")
    }
  }

  const useLabel = () => {
    if (!form) return
    const draft = commitLabelForm(form)
    if (!draft) {
      setStatus("Name and serving grams are still open.")
      return
    }
    onUse(draft)
    setForm(null)
    setPaste("")
    setStatus("")
  }

  const macros = NUTRIENT_FACE.filter((face) => face.group === "macro")
  const micros = NUTRIENT_FACE.filter((face) => face.group === "micro")

  return (
    <div className="trk-food-label trk-food-capture">
      {showPhoto ? (
        <label>
          Nutrition label photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Nutrition label photo"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              void onFile(file)
            }}
          />
        </label>
      ) : null}
      <label>
        Label text
        <textarea aria-label="Label text" value={paste} onChange={(event) => setPaste(event.target.value)} />
      </label>
      <button type="button" onClick={() => openText(paste, "No calorie line in that text.")}>
        Read label
      </button>
      {status ? <p className="trk-food-status">{status}</p> : null}
      {form ? (
        <div className="trk-food-label-check">
          {form.barcode ? <p className="trk-food-status">Barcode {form.barcode}</p> : null}
          <label>
            Name
            <input aria-label="Label food name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Serving grams
            <input
              aria-label="Serving grams"
              inputMode="decimal"
              value={form.grams}
              onChange={(event) => setForm({ ...form, grams: event.target.value })}
            />
          </label>
          <div className="trk-food-nuts">
            <h4>{form.basis === "100g" ? "Per 100 g" : form.basis === "container" ? "Per container" : "Per serving"}</h4>
            {[
              ["Macros", macros],
              ["Micros", micros],
            ].map(([title, faces]) => (
              <section key={String(title)} aria-label={String(title)} className="trk-food-lines">
                <p>{title as string}</p>
                {(faces as typeof NUTRIENT_FACE).map((face) => (
                  <label key={face.key}>
                    {face.label}
                    <input
                      aria-label={face.label}
                      inputMode="decimal"
                      value={form.lines[face.key]}
                      onChange={(event) => setForm(setLine(form, face.key, event.target.value))}
                    />
                  </label>
                ))}
              </section>
            ))}
          </div>
          <button type="button" onClick={useLabel}>
            Use these numbers
          </button>
        </div>
      ) : null}
    </div>
  )
}
