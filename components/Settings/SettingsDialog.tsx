/**
 * components/Settings/SettingsDialog.tsx — App settings entry point
 *
 * A header-launched dialog that hosts cross-cutting app utilities that don't
 * belong to a single tab:
 *  - **Data profile** (Live vs Demo stock vault) — first control, reloads on switch.
 *  - Window gray (`ChromeFaceField`) — gunmetal set-point for every Win95 face.
 *  - Desktop (`PcbBackdropField`) — teal field or a photographed plate behind the UI.
 *  - Baby animal friend gallery (photographs + cute names on the CRT nest).
 *  - Home location (city) for Plan day sunrise/sunset lines (default San Diego).
 *  - Default time of day (`DayAnchorField`) — the finish time assumed for work
 *    logged against a day that is already over (default 9:00 PM).
 *  - Full app backup / restore (JSON export + per-store preview restore — spec §3.2).
 *  - Manual mobile hub push/pull (`MobileSyncPanel`). Continuous live sync is
 *    parked until a dedicated semi-mobile live sync component lands.
 *  - Message ingest (`MessageIngestPanel`) — Telegram pairing, cheat-sheet,
 *    simulate. See docs/MESSAGE_INGEST.md.
 *  - Screen Time (`ScreenTimePanel`) — ActivityWatch URL, lookback, Sync now.
 *  - "Set up Second Brain" — seeds the Source + Belief item types
 *    (Brain2 research→source→belief model).
 *
 * Wired into the global header in app/page.tsx. The dialog is a full-viewport
 * (90vh) milled fascia panel (`.set95` / `settings-chrome.css`) with a CRT
 * title, brushed section bays, and a scrollable body so sections are not
 * clipped. Looks only — same fields and actions.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Settings as SettingsIcon, BrainCircuit, CheckCircle2, Shapes } from "lucide-react"
import { DataProfileField } from "@/components/Settings/DataProfileField"
import { BackupRestore } from "@/components/Settings/BackupRestore"
import { ChromeFaceField } from "@/components/Settings/ChromeFaceField"
import { PcbBackdropField } from "@/components/Settings/PcbBackdropField"
import { BabyAnimalFriendField } from "@/components/Settings/BabyAnimalFriendField"
import { HomeLocationField } from "@/components/Settings/HomeLocationField"
import { DayAnchorField } from "@/components/Settings/DayAnchorField"
import { MobileSyncPanel } from "@/components/Settings/MobileSyncPanel"
import { MessageIngestPanel } from "@/components/Settings/MessageIngestPanel"
import { ScreenTimePanel } from "@/components/Settings/ScreenTimePanel"
import { ItemTypeList } from "@/components/ItemTypes/ItemTypeList"
import { useItemTypeStore } from "@/lib/item-type-store"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"

export function SettingsDialog() {
  const seedSecondBrainTypes = useItemTypeStore((s) => s.seedSecondBrainTypes)
  const types = useItemTypeStore((s) => s.types)
  const [seeded, setSeeded] = useState(false)
  const [typesOpen, setTypesOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const guard = useUnsavedGuard({
    open,
    onOpenChange: setOpen,
    isDirty: false,
  })

  const hasSecondBrain = types.some((t) => t.id === "source" || t.id === "belief")

  const handleSeed = () => {
    seedSecondBrainTypes()
    setSeeded(true)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="set95 set95-dialog !flex h-[90vh] max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" data-ui-name="Settings" data-ui-docs="components/Settings/README.md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader className="set-caption">
          <div className="set-caption-mark">
            <span className="set-power-lamp" aria-hidden />
            <DialogTitle>Settings</DialogTitle>
          </div>
          <DialogDescription className="set-caption-lead">
            Window gray, desktop PCB, data profile (Live vs Demo), baby animal friend, home location, assumed time of day, data backup, phone ingest, Screen Time
            (ActivityWatch), and optional knowledge-base setup.
          </DialogDescription>
        </DialogHeader>

        <div className="set-body">
          <div className="space-y-6">
            <DataProfileField />

            <ChromeFaceField />

            <PcbBackdropField />

            <BabyAnimalFriendField />

            <HomeLocationField />

            <DayAnchorField />

            <BackupRestore />

            <MobileSyncPanel />

            <MessageIngestPanel />

            <ScreenTimePanel />

            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <div className="flex items-center gap-2">
                <Shapes className="h-4 w-4" />
                <h3 className="font-semibold">Item Types</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Create and edit your own item types — define their attributes, behaviors, and rules. Types are
                the building blocks of the flexible module platform.
              </p>
              <Dialog open={typesOpen} onOpenChange={setTypesOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Shapes className="mr-2 h-4 w-4" />
                    Manage Item Types
                  </Button>
                </DialogTrigger>
                <DialogContent className="set95 set95-dialog flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
                  <DialogHeader className="set-caption">
                    <div className="set-caption-mark">
                      <span className="set-power-lamp" aria-hidden />
                      <DialogTitle>Item Types</DialogTitle>
                    </div>
                    <DialogDescription className="set-caption-lead">Create, edit, and delete the item types in your workspace.</DialogDescription>
                  </DialogHeader>
                  <div className="set-body min-h-0 flex-1 overflow-y-auto pr-1">
                    <ItemTypeList />
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4" />
                <h3 className="font-semibold">Second Brain</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Add the <strong>Source</strong> and <strong>Belief</strong> item types — a research knowledge
                base where sources carry a trust score and beliefs derive their strength from supporting vs.
                refuting sources.
              </p>
              <Button
                onClick={handleSeed}
                variant="outline"
                className="w-full"
                disabled={hasSecondBrain || seeded}
              >
                {hasSecondBrain || seeded ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                    Second Brain types added
                  </>
                ) : (
                  <>
                    <BrainCircuit className="mr-2 h-4 w-4" />
                    Set up Second Brain
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
