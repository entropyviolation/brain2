/**
 * components/Settings/InstagramImportPanel.tsx — Import from Instagram data
 *
 * Global settings holds the full download steps. The file control calls
 * `importInstagramExportTexts`, the same writer as list settings on the two
 * Instagram lists. Instagram login is stated here and does not ask for a password.
 */
"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { importInstagramExportTexts, readInstagramFiles } from "@/lib/instagram-lists"

export function InstagramImportPanel() {
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    setStatus("Reading the files…")
    try {
      const report = importInstagramExportTexts(await readInstagramFiles([...list]))
      setStatus(report.message)
    } catch {
      setStatus("That file could not be read.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="space-y-3 rounded-lg border border-dashed p-4"
      data-ui-name="Import from Instagram data"
      data-ui-docs="components/Settings/README.md"
      data-testid="instagram-import-settings"
    >
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4" />
        <h3 className="font-semibold">Import from Instagram data</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        This fills <strong>People I follow on Instagram</strong> and <strong>People who follow me on Instagram</strong>.
        One username is one person and can sit on both lists.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          On Instagram, open <strong>Settings and activity</strong>, then <strong>Your activity</strong>, then{" "}
          <strong>Download your information</strong>.
        </li>
        <li>
          Request <strong>Followers and following</strong>. When that screen offers a format, choose JSON.
        </li>
        <li>
          Wait for Instagram’s email, then download the archive. Unzip it on your computer. This app does not unzip.
        </li>
        <li>
          Choose <strong>following.json</strong> and every <strong>followers_1.json</strong>,{" "}
          <strong>followers_2.json</strong>, and any further parts. They sit in{" "}
          <strong>connections/followers_and_following/</strong>. An older download keeps those same files in{" "}
          <strong>followers_and_following/</strong>. Choosing all of them in one upload is what makes Follows me back
          and I follow them back accurate. One file that already contains both lists is enough. HTML from that same
          download is read too.
        </li>
        <li>
          Follower count is not in the official file. That column stays blank until you type a number, and a number you
          type is kept. A row missing from a partial file stays.
        </li>
      </ol>
      <p className="text-sm text-muted-foreground">
        Instagram’s login does not hand over who you follow, who follows you, or their follower counts. Instagram Login
        and the Graph API do not return those lists for a personal account. This import does not ask for a password.
      </p>
      <div className="space-y-2">
        <Label htmlFor="instagram-import-files">Instagram files</Label>
        <Input
          id="instagram-import-files"
          type="file"
          accept=".json,.html,.htm,application/json,text/html"
          multiple
          disabled={busy}
          data-testid="instagram-import-files"
          onChange={(event) => {
            void onFiles(event.target.files)
            event.target.value = ""
          }}
        />
      </div>
      {status ? (
        <p className="text-sm text-muted-foreground" data-testid="instagram-import-result">
          {status}
        </p>
      ) : null}
    </div>
  )
}
