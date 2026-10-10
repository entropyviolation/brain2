/**
 * components/Settings/SettingsDialog.tsx — App settings entry point
 *
 * A header-launched dialog for cross-cutting utilities. Bays sit in six
 * groups (You, Appearance, Points, Data, Imports, Library). The index
 * selection is the only bay in the body. The well scrolls inside that bay.
 * Fields still auto-save (`isDirty: false`).
 *
 * Points stays `<PointAllocationField />` — that bay is the door to the
 * points rules. Looks live in `settings-chrome.css`.
 */
"use client"

import { useEffect, useRef, useState } from "react"
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
import { CaptureDoorButtons } from "@/components/capture-doors"
import { DataProfileField } from "@/components/Settings/DataProfileField"
import { BackupRestore } from "@/components/Settings/BackupRestore"
import { BoubaKikiField } from "@/components/Settings/BoubaKikiField"
import { ChromeFaceField } from "@/components/Settings/ChromeFaceField"
import { PcbBackdropField } from "@/components/Settings/PcbBackdropField"
import { BabyAnimalFriendField } from "@/components/Settings/BabyAnimalFriendField"
import { HomeLocationField } from "@/components/Settings/HomeLocationField"
import { BirthdayField } from "@/components/Settings/BirthdayField"
import { DayAnchorField } from "@/components/Settings/DayAnchorField"
import { PointAllocationField } from "@/components/Settings/PointAllocationField"
import { MobileSyncPanel } from "@/components/Settings/MobileSyncPanel"
import { MessageIngestPanel } from "@/components/Settings/MessageIngestPanel"
import { ScreenTimePanel } from "@/components/Settings/ScreenTimePanel"
import { InstagramImportPanel } from "@/components/Settings/InstagramImportPanel"
import { ItemTypeList } from "@/components/ItemTypes/ItemTypeList"
import { useItemTypeStore } from "@/lib/item-type-store"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  matchingSections,
  resolveSettingsSelection,
  selectedSectionId,
} from "@/components/Settings/settings-index"
import {
  SettingsFind,
  SettingsGroupBlock,
  SettingsIndex,
  SettingsSectionBlock,
  visibleRailButtons,
} from "@/components/Settings/settings-nav"

function groupById(id: (typeof SETTINGS_GROUPS)[number]["id"]) {
  return SETTINGS_GROUPS.find((group) => group.id === id) ?? SETTINGS_GROUPS[0]
}

export function SettingsDialog() {
  const seedSecondBrainTypes = useItemTypeStore((s) => s.seedSecondBrainTypes)
  const types = useItemTypeStore((s) => s.types)
  const [seeded, setSeeded] = useState(false)
  const [typesOpen, setTypesOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState<string | null>(SETTINGS_SECTIONS[0]?.id ?? null)
  const guard = useUnsavedGuard({
    open,
    onOpenChange: setOpen,
    isDirty: false,
  })
  const searchRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const hasSecondBrain = types.some((t) => t.id === "source" || t.id === "belief")
  const matches = matchingSections(query)
  const selectedId = selectedSectionId(activeId, query)
  const selected = SETTINGS_SECTIONS.find((section) => section.id === selectedId)

  const handleSeed = () => {
    seedSecondBrainTypes()
    setSeeded(true)
  }

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  useEffect(() => {
    if (!open || !selectedId || selectedId === activeId) return
    setActiveId(selectedId)
  }, [open, selectedId, activeId])

  useEffect(() => {
    if (!open || !bodyRef.current) return
    bodyRef.current.scrollTop = 0
  }, [open, selectedId])

  function focusFind() {
    const input = searchRef.current
    if (!input) return
    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
  }

  function choose(id: string) {
    const next = resolveSettingsSelection(id, query)
    if (next) setActiveId(next)
  }

  function focusIndex(forward: boolean) {
    const list = document.querySelector<HTMLElement>(".set95-settings .set-rail-list")
    const buttons = visibleRailButtons(list)
    const button = forward ? buttons[0] : buttons[buttons.length - 1]
    if (!button) return
    button.focus()
    const id = button.dataset.indexId
    if (id) choose(id)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="b2-shell-icon" title="Settings" aria-label="Settings">
          <SettingsIcon />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="set95 set95-dialog set95-settings !flex h-[90vh] max-h-[90vh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[940px]"
        data-ui-name="Settings"
        data-ui-docs="components/Settings/README.md"
        {...unsavedDismissProps(guard.requestClose)}
        onEscapeKeyDown={(event) => {
          const search = searchRef.current
          if (search && document.activeElement === search && search.value) {
            event.preventDefault()
            setQuery("")
            return
          }
          event.preventDefault()
          guard.requestClose()
        }}
        onKeyDown={(event) => {
          if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
          const target = event.target as HTMLElement
          const tag = target.tagName
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return
          event.preventDefault()
          focusFind()
        }}
      >
        <DialogHeader className="set-caption">
          <div className="set-caption-mark">
            <span className="set-power-lamp" aria-hidden />
            <DialogTitle>Settings</DialogTitle>
          </div>
          <DialogDescription className="set-caption-lead">
            Find a bay, or choose it from the index.
          </DialogDescription>
        </DialogHeader>

        <SettingsFind
          query={query}
          onQueryChange={setQuery}
          inputRef={searchRef}
          onArrowDown={() => focusIndex(true)}
          onSubmit={() => {
            const first = matches[0]
            if (first) choose(first.id)
          }}
        />

        <div className="set-deck">
          <SettingsIndex query={query} activeId={selectedId} onJump={choose} onFocusFind={focusFind} />
          <div className="set-body" id="settings-body" ref={bodyRef}>
            {selected ? (
              <SettingsGroupBlock group={groupById(selected.groupId)} hidden={false}>
                <SettingsSectionBlock id={selected.id} hidden={false}>
                  {selected.id === "settings-friend" ? <BabyAnimalFriendField /> : null}
                  {selected.id === "settings-home" ? <HomeLocationField /> : null}
                  {selected.id === "settings-birthday" ? <BirthdayField /> : null}
                  {selected.id === "settings-day-anchor" ? <DayAnchorField /> : null}
                  {selected.id === "settings-window-gray" ? <ChromeFaceField /> : null}
                  {selected.id === "settings-desktop" ? <PcbBackdropField /> : null}
                  {selected.id === "settings-bouba" ? <BoubaKikiField /> : null}
                  {selected.id === "settings-points" ? <PointAllocationField /> : null}
                  {selected.id === "settings-profile" ? <DataProfileField /> : null}
                  {selected.id === "settings-backup" ? <BackupRestore /> : null}
                  {selected.id === "settings-mobile" ? <MobileSyncPanel /> : null}
                  {selected.id === "settings-notes" ? (
                    <div className="space-y-3 rounded-lg border border-dashed p-4">
                      <CaptureDoorButtons />
                    </div>
                  ) : null}
                  {selected.id === "settings-messages" ? <MessageIngestPanel /> : null}
                  {selected.id === "settings-screen" ? <ScreenTimePanel /> : null}
                  {selected.id === "settings-instagram" ? <InstagramImportPanel /> : null}
                  {selected.id === "settings-types" ? (
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
                  ) : null}
                  {selected.id === "settings-second-brain" ? (
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
                  ) : null}
                </SettingsSectionBlock>
              </SettingsGroupBlock>
            ) : (
              <p className="set-empty" role="status">
                Nothing matches “{query.trim()}”.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
