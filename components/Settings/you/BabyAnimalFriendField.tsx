/**
 * components/Settings/you/BabyAnimalFriendField.tsx — Settings section for the friend
 *
 * The same gallery as the header. Details opens that friend's instrument.
 */
"use client"

import { BabyAnimalFriendGallery } from "@/components/baby-animal-gallery"

export function BabyAnimalFriendField() {
  return (
    <section className="baby-friend-settings" aria-label="Baby animal friend">
      <BabyAnimalFriendGallery />
    </section>
  )
}
