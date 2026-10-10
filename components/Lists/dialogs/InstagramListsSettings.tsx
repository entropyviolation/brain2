"use client"

/**
 * components/Lists/dialogs/InstagramListsSettings.tsx — Import for the Instagram lists
 *
 * Shown only on People I follow on Instagram and People who follow me on
 * Instagram. The file is the person’s own download from Instagram settings.
 * The full steps live in Settings → Import from Instagram data. This control
 * calls the same importer. Instagram login stays on screen and does not ask
 * for a password: that login does not return who you follow, who follows you,
 * or their follower counts.
 */
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { importInstagramExportTexts, readInstagramFiles } from "@/lib/instagram-lists"

const LOGIN_TRUTH =
  "Instagram’s login does not hand over who you follow, who follows you, or their follower counts. Instagram Login and the Graph API do not return those lists for a personal account. This list connects from the settings download. Brain2 does not ask for an Instagram password."

export function InstagramListsSettings() {
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return
    const files = [...list]
    const zipOnly = files.every((file) => file.name.toLowerCase().endsWith(".zip"))
    if (zipOnly) {
      setStatus("Unzip the download, then choose the JSON or HTML inside. This app does not read the zip.")
      return
    }
    setBusy(true)
    try {
      const report = importInstagramExportTexts(await readInstagramFiles(files))
      setStatus(report.message)
    } catch {
      setStatus("That file could not be read.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3" data-testid="instagram-lists-import">
      <div className="space-y-1">
        <Label htmlFor="instagram-export-file">Instagram download</Label>
        <p className="text-xs text-muted-foreground">
          The full steps are in Settings → Import from Instagram data. This is the file from Instagram → Settings and
          activity → Your activity → Download your information → Followers and following. Choose following.json, and
          followers_1.json plus any further followers files, in the same choice. One file that already contains both
          lists is enough. HTML from that same download works too. Unzip the download first — this app reads the JSON
          and the HTML, not the zip. Follower count is not in Instagram’s download. That column stays blank until a
          number is there, and a number you type is kept. Follows me back stays blank until a followers file is
          included. I follow them back stays blank until a following file is included. One username is one person, and
          that person can sit on both lists.
        </p>
        <Input
          id="instagram-export-file"
          type="file"
          accept=".json,.html,.htm,application/json,text/html"
          multiple
          disabled={busy}
          onChange={(event) => {
            void onFiles(event.target.files)
            event.target.value = ""
          }}
        />
      </div>
      <div className="space-y-1">
        <Button type="button" variant="outline" size="sm" onClick={() => setStatus(LOGIN_TRUTH)} data-testid="instagram-login">
          Instagram login
        </Button>
        <p className="text-xs text-muted-foreground" data-testid="instagram-login-note">
          {LOGIN_TRUTH}
        </p>
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  )
}
