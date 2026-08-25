import { describe, it, expect, beforeEach } from "vitest"
import {
  ATTACHMENT_URI_PREFIX,
  attachmentUri,
  clearAllAttachments,
  dataUrlToBlob,
  exportAllAttachments,
  getAttachment,
  getAttachmentDataUrl,
  isAttachmentRef,
  migrateFileValue,
  migrateTaskFileValues,
  putAttachment,
  replaceAllAttachments,
} from "@/lib/attachments"
import type { FileValue, Task } from "@/lib/types"

function textDataUrl(text: string, mime = "text/plain"): string {
  return `data:${mime};base64,${Buffer.from(text, "utf-8").toString("base64")}`
}

describe("attachments", () => {
  beforeEach(async () => {
    await clearAllAttachments()
  })

  it("stores bytes out of band and resolves them by idb: uri", async () => {
    const blob = new Blob(["hello pdf"], { type: "application/pdf" })
    const uri = await putAttachment("file_1", blob, { name: "a.pdf", mime: "application/pdf" })
    expect(uri).toBe(`${ATTACHMENT_URI_PREFIX}file_1`)
    expect(isAttachmentRef(uri)).toBe(true)

    const rec = await getAttachment(uri)
    expect(rec?.name).toBe("a.pdf")
    expect(await rec?.blob.text()).toBe("hello pdf")
    expect(await getAttachmentDataUrl(uri)).toMatch(/^data:/)
  })

  it("migrates a data-URL FileValue onto an attachment ref", async () => {
    const file: FileValue = {
      id: "f1",
      name: "notes.txt",
      mime: "text/plain",
      uri: textDataUrl("keep me"),
    }
    const { file: next, migrated } = await migrateFileValue(file)
    expect(migrated).toBe(true)
    expect(isAttachmentRef(next.uri)).toBe(true)
    expect(await getAttachmentDataUrl(next.uri)).toContain(Buffer.from("keep me", "utf-8").toString("base64"))
  })

  it("migrates FileValue attributes on tasks", async () => {
    const tasks: Task[] = [
      {
        id: "t1",
        description: "Has file",
        stage: "list",
        createdAt: new Date(),
        completed: false,
        lists: [],
        attributes: {
          doc: {
            id: "f2",
            name: "doc.txt",
            mime: "text/plain",
            uri: textDataUrl("body"),
          },
        },
      },
    ]
    const result = await migrateTaskFileValues(tasks)
    expect(result.migrated).toBe(1)
    const uri = (result.tasks[0].attributes?.doc as FileValue).uri
    expect(isAttachmentRef(uri)).toBe(true)
  })

  it("round-trips the attachment export map", async () => {
    await putAttachment("file_x", dataUrlToBlob(textDataUrl("payload")), {
      name: "x.txt",
      mime: "text/plain",
    })
    const dumped = await exportAllAttachments()
    expect(dumped.file_x?.name).toBe("x.txt")
    await replaceAllAttachments({
      file_y: { name: "y.txt", mime: "text/plain", dataUrl: textDataUrl("other") },
    })
    expect(await getAttachment(attachmentUri("file_x"))).toBeNull()
    expect(await (await getAttachment(attachmentUri("file_y")))?.blob.text()).toBe("other")
  })
})
