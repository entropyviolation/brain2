/**
 * components/Settings/SettingsDialog.tsx — App settings entry point
 *
 * A header-launched dialog that hosts cross-cutting app utilities that don't
 * belong to a single tab:
 *  - Full app backup / restore (JSON export/import — spec §3.2).
 *  - "Set up Second Brain" — seeds the Source + Belief item types
 *    (Brain2 research→source→belief model).
 *
 * Wired into the global header in app/page.tsx.
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Data backup and optional knowledge-base setup.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <BackupRestore />

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
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Item Types</DialogTitle>
                  <DialogDescription>Create, edit, and delete the item types in your workspace.</DialogDescription>
                </DialogHeader>
                <ItemTypeList />
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
      </DialogContent>
    </Dialog>
  )
}
