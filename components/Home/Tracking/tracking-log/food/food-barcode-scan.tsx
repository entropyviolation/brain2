"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-barcode-scan.tsx — Camera or typed barcode
 *
 * Chromium uses BarcodeDetector. Other browsers use ZXing on the same camera
 * preview. The Capacitor plugin runs only inside the native shell, and only
 * at the 2.x release whose peer is Capacitor 7. A miss opens the label form
 * with the code kept.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { LabelCapture, openLabelForBarcode } from "@/components/Home/Tracking/tracking-log/food/food-label-paste"
import { normalizeBarcode, rememberBarcode, resolveBarcode } from "@/lib/kitchen-barcode"
import type { FoodHit } from "@/lib/kitchen-search"
import { useKitchenStore } from "@/lib/kitchen-store"
import type { Nutrients } from "@/lib/kitchen-nutrients"
import "./food-capture.css"

interface DetectedBarcode {
  rawValue?: string
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]

function detectorCtor(): BarcodeDetectorCtor | null {
  const host = globalThis as { BarcodeDetector?: BarcodeDetectorCtor }
  return typeof host.BarcodeDetector === "function" ? host.BarcodeDetector : null
}

function stopStream(video: HTMLVideoElement) {
  const stream = video.srcObject
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) track.stop()
  }
  video.srcObject = null
}

async function startDetector(video: HTMLVideoElement, onCode: (code: string) => void): Promise<(() => void) | null> {
  const Detector = detectorCtor()
  if (!Detector || !navigator.mediaDevices?.getUserMedia) return null
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()
  let detector: { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
  try {
    detector = new Detector({ formats: FORMATS })
  } catch {
    detector = new Detector()
  }
  let dead = false
  let frame = 0
  const tick = () => {
    if (dead) return
    frame = window.requestAnimationFrame(() => {
      void detector.detect(video).then((codes) => {
        const raw = codes.find((code) => code.rawValue)?.rawValue
        if (raw && !dead) {
          dead = true
          stopStream(video)
          onCode(raw)
          return
        }
        tick()
      }).catch(() => {
        if (!dead) tick()
      })
    })
  }
  tick()
  return () => {
    dead = true
    window.cancelAnimationFrame(frame)
    stopStream(video)
  }
}

async function startZxing(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  const { BrowserMultiFormatReader } = await import("@zxing/browser")
  const reader = new BrowserMultiFormatReader()
  let dead = false
  const controls = await reader.decodeFromConstraints(
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    video,
    (result) => {
      if (dead || !result) return
      dead = true
      controls.stop()
      onCode(result.getText())
    },
  )
  return () => {
    dead = true
    controls.stop()
    stopStream(video)
  }
}

/** Native shell only. `null` is a cancel. `undefined` means the web camera should open. */
async function scanNative(): Promise<string | null | undefined> {
  const { Capacitor } = await import("@capacitor/core")
  if (!Capacitor.isNativePlatform()) return undefined
  try {
    const plugin = await import("@capacitor/barcode-scanner")
    const result = await plugin.CapacitorBarcodeScanner.scanBarcode({
      hint: plugin.CapacitorBarcodeScannerTypeHint.ALL,
    })
    return result.ScanResult?.trim() || null
  } catch {
    return undefined
  }
}

export async function openBarcodeCamera(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  const detected = await startDetector(video, onCode).catch(() => null)
  if (detected) return detected
  return startZxing(video, onCode)
}

export function FoodBarcodeScan({ onPick }: { onPick: (hit: FoodHit) => void }) {
  const [code, setCode] = useState("")
  const [status, setStatus] = useState("")
  const [live, setLive] = useState(false)
  const [miss, setMiss] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!live) return
    const video = videoRef.current
    if (!video) return
    let stop = () => {}
    let dead = false
    void openBarcodeCamera(video, (raw) => {
      if (dead) return
      setLive(false)
      void lookup(raw)
    }).then((end) => {
      if (dead) end()
      else stop = end
    }).catch(() => {
      if (dead) return
      setLive(false)
      setStatus("No camera on this device.")
    })
    return () => {
      dead = true
      stop()
    }
  }, [live])

  const lookup = async (raw: string) => {
    const digits = normalizeBarcode(raw)
    setCode(digits)
    if (!digits) {
      setStatus("No barcode.")
      setMiss("")
      return
    }
    setStatus("Searching Open Food Facts…")
    setMiss("")
    const result = await resolveBarcode(digits, useKitchenStore.getState().foods)
    if (result.found) {
      onPick(result.hit)
      rememberBarcode(digits, result.hit.id)
      setStatus("")
      return
    }
    setStatus("No Open Food Facts product for this code.")
    setMiss(digits)
  }

  const onScan = async () => {
    setStatus("")
    const native = await scanNative()
    if (typeof native === "string") {
      await lookup(native)
      return
    }
    if (native === null) return
    setLive(true)
  }

  const acceptLabel = (draft: { name: string; per100g: Nutrients; grams: number }) => {
    const id = `label_${miss}`
    onPick({
      id,
      name: draft.name,
      per100g: draft.per100g,
      gramsPerUnit: draft.grams,
      source: "label",
    })
    rememberBarcode(miss, id)
    setMiss("")
    setStatus("")
  }

  return (
    <div className="trk-food-capture">
      <label>
        Barcode
        <input
          aria-label="Barcode"
          inputMode="numeric"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            void lookup(code)
          }}
        />
      </label>
      <div className="trk-span-switch trk-food-scan-actions" role="group" aria-label="Barcode lookup">
        <button type="button" onClick={() => void lookup(code)}>
          Look up
        </button>
        <button type="button" onClick={() => (live ? setLive(false) : void onScan())}>
          {live ? "Stop" : "Scan"}
        </button>
      </div>
      {status ? <p className="trk-food-status">{status}</p> : null}
      {live ? <video ref={videoRef} muted playsInline aria-label="Barcode camera" /> : null}
      {miss ? <LabelCapture showPhoto={false} barcode={miss} onUse={acceptLabel} /> : null}
    </div>
  )
}
