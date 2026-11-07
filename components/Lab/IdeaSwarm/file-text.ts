/**
 * components/Lab/IdeaSwarm/file-text.ts — The words of a dropped PDF, .txt or .md, for the Idea Lab
 *
 * pdfjs loads only when a PDF is dropped. Nothing is stored here; the lab keeps the slice you pick.
 */

export async function textFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist")
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pages: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent()
      pages.push(content.items.map((i) => ("str" in i ? i.str : "")).join(" "))
    }
    return pages.join("\n\n").replace(/[ \t]+/g, " ").trim()
  }
  return (await file.text()).trim()
}
