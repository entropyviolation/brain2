/**
 * components/Settings/SettingsDialog.tsx — App settings entry point
 *
 * A header-launched dialog that hosts cross-cutting app utilities that don't
 * belong to a single tab:
 *  - Home location (city) for Plan day sunrise/sunset lines (default San Diego).
 *  - Full app backup / restore (JSON export/import — spec §3.2).
 *  - Manual mobile hub push/pull (`MobileSyncPanel`). Continuous live sync is
 *    parked until a dedicated semi-mobile live sync component lands.
 *  - "Set up Second Brain" — seeds the Source + Belief item types
 *    (Brain2 research→source→belief model).
 *
 * Wired into the global header in app/page.tsx. The dialog is a full-viewport
 * (90vh) panel with a sticky title and a scrollable body so sections are not
 * clipped.
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
import { BackupRestore } from "@/components/Settings/BackupRestore"
import { HomeLocationField } from "@/components/Settings/HomeLocationField"
import { MobileSyncPanel } from "@/components/Settings/MobileSyncPanel"
import { ItemTypeList } from "@/components/ItemTypes/ItemTypeList"
import { useItemTypeStore } from "@/lib/item-type-store"

export function SettingsDialog() {
  const seedSecondBrainTypes = useItemTypeStore((s) => s.seedSecondBrainTypes)
  const types = useItemTypeStore((s) => s.types)
  const [seeded, setSeeded] = useState(false)
  const [typesOpen, setTypesOpen] = useState(false)

  const hasSecondBrain = types.some((t) => t.id === "source" || t.id === "belief")

  const handleSeed = () => {
    seedSecondBrainTypes()
    setSeeded(true)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="!flex h-[90vh] max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 py-5 pr-12">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Home location, data backup, and optional knowledge-base setup.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="space-y-6">
            <HomeLocationField />

            <BackupRestore />

            <MobileSyncPanel />

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
                <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Item Types</DialogTitle>
                    <DialogDescription>Create, edit, and delete the item types in your workspace.</DialogDescription>
                  </DialogHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
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
  )
}
