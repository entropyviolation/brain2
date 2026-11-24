/**
 * lib/graph-bimby/target.ts — Which nodes the GRAPH tab's Tell key named
 *
 * The key writes "Tell BIM about Linda Gibbins Croft: " in the compose well and keeps the ids here, so the
 * line finds the exact items even when two share a name. A typed lead with no kept ids is matched by name.
 */
import { create } from "zustand"

export interface TellTarget {
  id: string
  name: string
}

type State = {
  targets: TellTarget[]
  set: (targets: TellTarget[]) => void
  clear: () => void
}

export const useGraphTellTarget = create<State>((set) => ({
  targets: [],
  set: (targets) => set({ targets }),
  clear: () => set({ targets: [] }),
}))
