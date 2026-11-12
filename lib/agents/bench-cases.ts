/**
 * lib/agents/bench-cases.ts — Hand-labelled lines for the bench, and the person's own
 *
 * `LISTS_CASES` is the Lists BIMBY's "which tool is this line?" set. Add a line as it turns up in real use; a line
 * the person corrected in the chat is the best case there is (`docs/BIMBY_IDEAS.md` §1 step 5). Tags say what makes
 * a line hard, so the scorecard can show where a variant breaks.
 */

import type { BenchCase } from "./bench"

export const LISTS_CASES: BenchCase[] = [
  { id: "ex-1", input: "Book items that are also Task items shouldn't be Task", expect: "exclusive-type", tags: ["negation"] },
  { id: "dup-1", input: "help me find and merge duplicate items", expect: "find-duplicates", tags: ["two verbs"] },
  { id: "retype-1", input: "change all Note items to Book", expect: "retype-items", tags: ["plain"] },
  { id: "find-1", input: "how many Book items lack an author?", expect: "find-items", tags: ["question"] },
  { id: "lookup-1", input: "what is the list id for the All Items list of Next actions folder?", expect: "lookup-id", tags: ["question", "names"] },
  { id: "shopping-1", input: "Help me find all the things I need to get or want or need to buy (create a consolidated nov 8th shopping list). it must have at least modafinil, brow bleach, hair dye", expect: "shopping-list", tags: ["free form", "must-haves"] },
  { id: "collect-1", input: "add all task items due from now until Dec 25 to list Soon", expect: "collect-items", tags: ["dates", "two verbs"] },
  { id: "dup-2", input: "are there any items I saved twice?", expect: "find-duplicates", tags: ["no jargon", "question"] },
  { id: "mergel-1", input: "combine my Reading and Books lists into one", expect: "merge-lists", tags: ["plain"] },
  { id: "add-1", input: "put milk, eggs and bread on the Groceries list", expect: "add-items", tags: ["plain"] },
  { id: "copy-1", input: "give every Movie item the same fields as Dune", expect: "copy-attributes", tags: ["names"] },
  { id: "find-2", input: "show me tasks mentioning taxes", expect: "find-items", tags: ["plain"] },
  { id: "retype-2", input: "make everything on the Podcasts list a Show", expect: "retype-items", tags: ["no jargon"] },
  { id: "ex-2", input: "stop my Recipes from also being Notes", expect: "exclusive-type", tags: ["negation", "no jargon"] },
  { id: "merge-2", input: "these three are the same thing, fold them together", expect: "merge-items", tags: ["no jargon"] },
]
