/**
 * components/Inventory/phone/inventory-phone.tsx — Phone Inventory
 *
 * Own switcher. Bookshelf is a cover browser. Closet is the cutout grid.
 * Kitchen stays `KitchenPhone` — the room list, not the diorama.
 * Shopping is four vault lists, not the kitchen store.
 * Gems and Trinkets is the earned-loot bag.
 */
"use client"

import { KitchenPhone } from "../kitchen/kitchen-phone"
import { useBookshelfListId, useInventoryScene, INVENTORY_SCENES, type InventorySceneId } from "../inventory-scenes"
import { BookshelfPhone } from "./bookshelf-phone"
import { ClosetPhone } from "./closet-phone"
import { ShoppingPhone } from "../shopping/shopping-phone"
import { GemsScene } from "../gems/gems-scene"
import "./inventory-phone.css"

export function InventoryPhone({
  scene,
  onScene,
  listId,
  onListId,
}: {
  scene: InventorySceneId
  onScene: (id: InventorySceneId) => void
  listId: string | null
  onListId: (id: string | null) => void
}) {
  return (
    <div className="inv-phone" data-testid="inventory-phone" data-ui-name="Inventory">
      <div className="inv-phone-scenes" role="tablist" aria-label="Inventory scene">
        {INVENTORY_SCENES.map((row) => (
          <button
            key={row.id}
            type="button"
            role="tab"
            aria-selected={scene === row.id}
            onClick={() => onScene(row.id)}
          >
            {row.label}
          </button>
        ))}
      </div>
      {scene === "bookshelf" ? <BookshelfPhone listId={listId} onListId={onListId} /> : null}
      {scene === "closet" ? <ClosetPhone /> : null}
      {scene === "kitchen" ? <KitchenPhone /> : null}
      {scene === "shopping" ? <ShoppingPhone /> : null}
      {scene === "gems" ? <GemsScene surface="phone" /> : null}
    </div>
  )
}

/** Capacitor shell. Same phone room as the 767px gate, with the desk's persisted scene and shelf list. */
export function InventoryPhoneScreen() {
  const [scene, setScene] = useInventoryScene()
  const [listId, setListId] = useBookshelfListId()
  return <InventoryPhone scene={scene} onScene={setScene} listId={listId} onListId={setListId} />
}
