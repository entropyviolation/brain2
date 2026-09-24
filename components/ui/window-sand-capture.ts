/**
 * Snapshot a window into pixels while it is still on screen, so the sand
 * can be the color of those pixels. The clone is taken synchronously; the
 * decode may finish a moment later.
 *
 * The SVG is a data URL. A blob URL paints, then taints the canvas, and
 * getImageData throws — the sand would keep the flat fallback colors.
 */

function copyControls(src: Element, dst: Element) {
  if (src instanceof HTMLInputElement && dst instanceof HTMLInputElement) {
    dst.setAttribute("value", src.value)
    dst.checked = src.checked
  } else if (src instanceof HTMLTextAreaElement && dst instanceof HTMLTextAreaElement) {
    dst.textContent = src.value
  } else if (src instanceof HTMLSelectElement && dst instanceof HTMLSelectElement) {
    dst.value = src.value
  }
  const sc = src.children
  const dc = dst.children
  for (let i = 0; i < sc.length; i++) {
    const a = sc[i]
    const b = dc[i]
    if (a && b) copyControls(a, b)
  }
}

function inlineStyles(src: HTMLElement, dst: HTMLElement) {
  const cs = getComputedStyle(src)
  let css = ""
  for (let i = 0; i < cs.length; i++) {
    const prop = cs.item(i)
    css += `${prop}:${cs.getPropertyValue(prop)};`
  }
  dst.style.cssText = css
  const sc = src.children
  const dc = dst.children
  for (let i = 0; i < sc.length; i++) {
    const a = sc[i]
    const b = dc[i]
    if (a instanceof HTMLElement && b instanceof HTMLElement) inlineStyles(a, b)
  }
}

/** A hide class must not be baked into the picture. */
function reveal(el: HTMLElement) {
  if (el.style.visibility === "hidden") el.style.visibility = "visible"
  if (el.style.opacity === "0") el.style.opacity = "1"
  for (const child of el.children) {
    if (child instanceof HTMLElement) reveal(child)
  }
}

function inlineImages(src: ParentNode, dst: ParentNode) {
  const sources = src.querySelectorAll("img")
  const clones = dst.querySelectorAll("img")
  for (let i = 0; i < sources.length; i++) {
    const from = sources[i]
    const to = clones[i]
    if (!(from instanceof HTMLImageElement) || !(to instanceof HTMLImageElement)) continue
    const w = from.naturalWidth
    const h = from.naturalHeight
    if (!w || !h) {
      to.removeAttribute("src")
      continue
    }
    try {
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        to.removeAttribute("src")
        continue
      }
      ctx.drawImage(from, 0, 0)
      to.src = canvas.toDataURL("image/png")
    } catch {
      to.removeAttribute("src")
    }
  }
}

function placeClone(clone: HTMLElement, w: number, h: number) {
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml")
  clone.style.transform = "none"
  clone.style.translate = "none"
  clone.style.position = "relative"
  clone.style.left = "0"
  clone.style.top = "0"
  clone.style.right = "auto"
  clone.style.bottom = "auto"
  clone.style.margin = "0"
  clone.style.animation = "none"
  clone.style.transition = "none"
  clone.style.visibility = "visible"
  clone.style.opacity = "1"
  clone.style.width = `${w}px`
  clone.style.height = `${h}px`
}

/** Clone immediately (call before hiding the source). Resolves with pixels, or null. */
export function captureWindow(el: HTMLElement): Promise<ImageData | null> {
  try {
    const rect = el.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    const clone = el.cloneNode(true) as HTMLElement
    copyControls(el, clone)
    inlineStyles(el, clone)
    reveal(clone)
    inlineImages(el, clone)
    clone.querySelectorAll("script, iframe, link").forEach((node) => node.remove())
    placeClone(clone, w, h)

    const sandbox = document.createElement("div")
    sandbox.setAttribute("aria-hidden", "true")
    sandbox.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;"
    sandbox.appendChild(clone)
    document.body.appendChild(sandbox)
    const serialized = new XMLSerializer().serializeToString(clone)
    sandbox.remove()

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${serialized}</foreignObject></svg>`
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

    return new Promise((resolve) => {
      const img = new Image()
      const finish = (data: ImageData | null) => resolve(data)
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          const dpr = Math.min(2, window.devicePixelRatio || 1)
          canvas.width = Math.max(1, Math.round(w * dpr))
          canvas.height = Math.max(1, Math.round(h * dpr))
          const ctx = canvas.getContext("2d", { willReadFrequently: true })
          if (!ctx) {
            finish(null)
            return
          }
          ctx.scale(dpr, dpr)
          ctx.drawImage(img, 0, 0, w, h)
          finish(ctx.getImageData(0, 0, canvas.width, canvas.height))
        } catch {
          finish(null)
        }
      }
      img.onerror = () => finish(null)
      img.src = url
    })
  } catch {
    return Promise.resolve(null)
  }
}
