# Graph — Relationship & knowledge visualization

Graph surfaces over the unified item model and its typed `links` (spec §5 —
second-brain navigation). All geometry is computed by the pure, deterministic
`lib/graph-layout.ts` helpers so the views are reproducible and SSR-safe.

## Components

- **`KnowledgeGraph.tsx`** — Typed-links knowledge graph. A force-directed
  spatial graph over **all linked items** (optionally all items via a "Show all"
  toggle). Nodes are items read from `useTaskStore`; edges are each item's typed
  `links`, labelled via `relationLabel` (`lib/links.ts`) and colored by the
  link's `stance` (support → green, refute → red). Clicking a node opens it in
  the `TaskDetailPopup`. Layout comes from `forceishLayout` + `boundingBox`.

  **Default export, reads the store itself** — mount with no props:

  ```tsx
  import KnowledgeGraph from "@/components/Graph/KnowledgeGraph"
  <KnowledgeGraph />
  ```

- **`LinkGraph.tsx`** — Focus-centered relationship graph for a **single** item.
  A lightweight, dependency-free SVG view: it reads items from `taskRepository`,
  builds a focus-centered subgraph with `buildLinkGraph` (`lib/link-graph.ts`),
  and lays neighbors out radially around the focus with labelled edges. Clicking
  a node calls `onOpenItem(id)`. Intended as a companion to `RelatedItemsPanel`
  in the item-detail view.

  ```tsx
  import { LinkGraph } from "@/components/Graph/LinkGraph"
  <LinkGraph focusId={item.id} onOpenItem={openItem} depth={1} size={360} />
  ```

  Props: `focusId` (required), `onOpenItem` (required), `depth` (hop radius,
  default 1), `size` (square viewport px, default 360).

## Pure libraries

- `lib/graph-layout.ts` — deterministic layout helpers: `topologicalRanks` +
  `layeredLayout` (Sugiyama-lite columns/rows), `circularLayout`, the seeded
  `forceishLayout` (repulsion + edge-attraction relaxation, no `Math.random`),
  and `boundingBox`. Fully unit-tested.
- `lib/link-graph.ts` — `buildLinkGraph(items, { focusId?, depth? })`: turns a
  flat item list with typed `links` into a deduplicated node/edge graph; with a
  `focusId` it returns the subgraph within `depth` hops (forward links and
  backlinks both count as a hop). Pure and deterministic.
- `lib/links.ts` — the relation catalog (`RELATIONS`) and pure link/tag/stance
  helpers: `relationLabel`, `inverseRelation`, `addLink`/`removeLink`,
  `normalizeTag`, and the support↔refute stance weighting used by the
  knowledge-graph edge colors and `lib/belief-strength.ts`.

## Related (Scheduler)

The Gantt + dependency-graph project views live under `components/Scheduler/`
(`GanttView.tsx`, `DependencyGraph.tsx`, `project-network.ts`) and reuse the same
`lib/graph-layout.ts` helpers plus `lib/critical-path.ts` (CPM/PERT).
