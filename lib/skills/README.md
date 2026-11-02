# `lib/skills/` — Skills for BIMBIES (from SkillRL)

_Last mapped: 2026-11-02_

A BIMBY learns from what a person does with its proposals. The research and the mapping from the paper are in
[`docs/SKILLRL_RESEARCH.md`](../../docs/SKILLRL_RESEARCH.md). Training (SFT, GRPO) is not taken; the prompt-time
half is, because it needs no weights and keeps the agents local.

**A skill only changes a prompt.** It never writes. The accept door, `lib/lists-helper/guard.ts` and every cap stay as
they were. New skills arrive `proposed` and reach no prompt until a person makes them `active`.

## The loop

1. **Record.** The person accepts, tweaks, dismisses or corrects. `learn.ts` writes an `Experience` (success, or a
   failure with severity 1 to 3 and the better move) and credits `uses` / `wins` to the skills that were in the prompt.
2. **Find the weak spot.** `evolve.ts` counts success per category and keeps categories under 0.8 with at least 3 cases.
3. **Distill.** Failures are sampled round-robin across weak categories, worst first. `distill.ts` turns them into
   failure lessons: in code (`lessonOf`, no model) or with a local model on the ladder (`distillWithModel`).
4. **Review.** Proposals wait as `proposed`. `setStatus` and `editSkill` accept, edit or retire.
5. **Use.** `pickSkills` always takes active general skills and the top K (6) task skills over a floor (0.12, lexical
   overlap; a `Scorer` seam is there for local embeddings). `renderSkills` makes the prompt block, empty when nothing fits.

The bank is capped at 100. Past the cap the weakest learned skill goes (win rate, then uses). Hand-written skills are
never pruned.

## Files

| File | Role |
|------|------|
| `types.ts` | `Skill`, `Experience`, `SkillBank`, `MAX_SKILLS` |
| `bank.ts` | `pickSkills`, `renderSkills`, `addSkill`, `recordUse`, `setStatus`, `editSkill`, `loadBank`/`saveBank` (`skillbank:<agent>`) |
| `experience.ts` | `makeExperience`, `appendExperience`, `loadExperiences`/`saveExperiences` (`skillexp:<agent>`, newest 300) |
| `learn.ts` | `recordReaction`: log plus credit. The only impure seam |
| `distill.ts` | `lessonOf`/`lessonsOf` (no model), `distillWithModel`, `cleanSkills`, the prompt and schema |
| `evolve.ts` | `statsByCategory`, `weakCategories`, `sampleFailures`, `evolve`, `withProposals` |
| `seeds.ts` | Hand-written skills for the Tracking Helper and the Lists helper, carried by `Blueprint.skills` |
| `skills.test.ts` | Pick, upkeep, storage, distill, evolve |

## Where it is used

- **Tracking Helper.** Built end to end, with a review panel in the lab (`components/Lab/TrackingHelper/SkillsPanel.tsx`). See `lib/tracking-helper/README.md` (Skills).
- **Lists BIMBY.** Seeds only (they restate its guard and grammar). It has no model, so nothing is injected yet.
- **BIM flows.** `skills: []`.

## Planned

- Show the experiences behind each proposed skill in the panel (`from` already holds their ids).
- The same panel for the Lists BIMBY lab.
- Experiences from the Lists BIMBY session (plan approved, cancelled, interrupted, undone).
- Local embeddings behind `Scorer`, compared with word overlap on recorded lines.
- A `skills` node for BIM flows (a `remember` step).
- Replay with and without skills as an eval (plan slice 5).
