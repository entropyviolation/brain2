/**
 * components/Settings/BabyAnimalFriendField.tsx — Settings section for the friend
 */
"use client"

import { BabyAnimalFriendGallery } from "@/components/baby-animal-gallery"

export function BabyAnimalFriendField() {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <h3 className="font-semibold">Baby animal friend</h3>
      <p className="text-sm text-muted-foreground">
        The CRT nest beside the BRAIN2 title. The worn friend stays until Monday (or until you
        shuffle / pick a card). Upload, find another picture, or request a name — cutouts persist
        in the friend picture vault. Click the photograph for this friend’s details (history,
        mission journal, personality). The chat button above Gallery asks them to speak. Click
        the bubble for the mission: the task opens item detail on top, Accept runs until the
        end of the day, and Decline asks about smaller tasks, then a first step, then a reason.
      </p>
      <BabyAnimalFriendGallery />
    </div>
  )
}
