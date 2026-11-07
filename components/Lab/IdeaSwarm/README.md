# components/Lab/IdeaSwarm

_Last mapped: 2026-11-03_

The **Idea Lab** at `/lab/idea-swarm` (`app/lab/idea-swarm/page.tsx`). It tests whether a swarm of weak local models, clustered by embedding and written up by a strong model, extracts better ideas from a passage than one careful call, judged against answers the player wrote by hand. The engine is `lib/idea-swarm/` and `lib/keyphrase/`; this folder is only the room.

## What it does

1. **Key phrases** (no model): RAKE, TextRank, YAKE side by side. A free baseline, and the topics for the next node.
2. **Insight on topics** (optional): key phrases plus the passage to a model: what insight does the passage give onto each topic?
3. **Readers**: one weak model per lens (twelve by default: claims, terms, objections, examples, what's new, contrasts, topics, insight on topics, teach a child, implications, hidden assumptions, how it argues), in parallel. Each lens can have its own model and temperature; you can reword, switch off or add lenses.
4. **Embed + cluster**: each idea is embedded (`nomic-embed-text`), then grouped by average-linkage cosine similarity at a threshold. Ideas matching nobody are **lone**.
5. **Cards**: a strong model reads every member of a cluster and writes one idea card. The lab records how close the card sits to the cluster's centre against the **medoid** (the nearest real answer): can a model write the point nobody wrote?
6. **Lone gems** (optional): a strong model hunts for hidden gems among the lone ideas whose quote is really in the passage.
7. **One careful call**: the single-call comparison.

Layout (restyled 2026-11-03): a full-window workbench. Top bar with the view tabs and setup save/load; a foldable left rail (passage, runs; starts folded under 1500px); a dotted node canvas where nodes drag (positions saved in `localStorage` `brain2:idea-swarm:layout:v1`, ↺ resets) and that pans, zooms and fits itself; the node inspector docked on the right; a floating run dock (note, Run, Re-run without readers, Stop). Nodes are colour-coded by kind (no model, weak model, embedding, strong model, control, output). Dark with the system, with a light twin.

Tabs: **Book** (see below), **Pipeline** (canvas, click a node for its knobs, prompt and output), **Map** (PCA scatter of every idea, cluster hulls, medoids, centres, cards, gems, with each cluster's card and fidelity), **Gold** (versions of acceptable answers, step by step, fillable from a run), **Scores** (every output against gold, and a runs matrix).

**Re-run without the readers** keeps the shown run's reader answers and redoes the rest, so threshold, card model or temperature can be tuned without twelve new calls.

## Book tab

Upload a PDF or text, cut it at paragraph breaks into chunks (`lib/idea-swarm/book.ts`), and process the whole book: per chunk a weak model answers yes/no "any useful ideas in this chunk?" (the **gate**, which drops contents, index, bibliography), then `runPipeline` with the current setup, several chunks at once. A strip of squares shows every chunk's state; click one for its gate answer, nodes, cards and gems, or run it again. Totals sit above. Book-level passes (optional) pool every card and gem and cluster them into themes (named by the card model), pull TextRank / YAKE phrases, and write a summary loop (batches of twelve, level by level, to one). Chunks are saved after every change (`books`, `chunks` stores); a refresh resumes the unfinished chunks (a chunk interrupted mid-way restarts whole). The single-passage pipeline is untouched.

Runs and refresh: the Pipeline tab saves a run when it starts, after every node and after every reader call (`status: running`); a refresh resumes it, skipping finished readers. Stopped runs stay as `partial`. Passage, run, tab, node and rail state persist in `localStorage` `brain2:idea-swarm:ui:v1`. **＋ Add node** adds a node that reads any other node's output (`Config.extra`), runs after the built-ins and is saved in `Run.extras`.

## Storage

IndexedDB `brain2-idea-swarm` v2 (`lib/idea-swarm/store.ts`): `passages`, `golds`, `runs`, `configs`, `books`, `chunks`. The working config is autosaved to `localStorage` key `brain2:idea-swarm:draft:v1`. Nothing is written to the vault. A run keeps the config as it was, every node's output and prompt, the clusters and map points.

## Files

- `IdeaSwarmLab.tsx` — state, passage and runs, tabs.
- `PipelineGraph.tsx` — the node canvas: SVG wires and ports, HTML cards in `foreignObject`, pan / zoom / fit.
- `NodeInspector.tsx` — knobs, prompt, lens editor, outputs and score chips per node.
- `BookLab.tsx` — the Book tab.
- `ClusterMap.tsx` — the map and cluster list.
- `GoldEditor.tsx`, `ScoreTable.tsx`, `file-text.ts` (PDF / text to words), `idea-swarm.css`.

## Planned

- A gold step for clustering itself (which readers' ideas belong together) and for each reader.
- A BIM-flow canvas node for key phrases (`lib/keyphrase/` is pure and ready; the BIM node kinds in `lib/bim-flow/` do not have it yet) and a node in the Agent bench.
- A critic pass for wrong ideas; a stronger reranker than embedding similarity for scoring; running the winner as the baby game's overnight "deep read".
- Mixing model families across lenses; a sweep over reader count.
