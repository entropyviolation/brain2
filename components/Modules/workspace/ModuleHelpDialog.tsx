/**
 * components/Modules/workspace/ModuleHelpDialog.tsx — How a module is built
 *
 * Opened from the ? key beside Settings on a workspace. Describes the catalog
 * chooser, the caption keys, views, settings, workflows, and where the data
 * lives. Template blurbs come from `MODULE_TEMPLATES` so they stay the same
 * sentences as the builder.
 */
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MODULE_VIEW_KINDS } from "@/components/Modules/module-helpers"
import { MODULE_TEMPLATES } from "@/lib/module-templates"
import type { ModuleViewKind } from "@/lib/modules-store"

const VIEW_NOTES: Record<ModuleViewKind, string> = {
  spreadsheet: "Rows are items. Columns are attributes. Cells edit in place, including formulas.",
  checklist: "Check items off and add a row. Attribute chips sit on each line.",
  agenda: "Items grouped by a date attribute, with time and cost when those attributes exist.",
  timeline: "One day at a time for dated items, with booked or finalized badges when the attributes exist.",
  "itinerary-doc": "Printable trip days: a date range, city or A→B labels, weather, timed plans, and flight lookup by number.",
  "trip-map": "A map of stays and places, split by city, with walking, driving, and transit distance.",
  "film-dna": "Film DNA Lab: shelves, a likes wall, Watch ranking, and a Letterboxd export import.",
  "house-cleaning": "Tidy: areas, chores, a per-task timer, today’s goal, Stuck mode, and three plan sizes.",
  sweep: "Caches, logs, Xcode leftovers, Trash, and duplicate files. The scan runs in the desktop app.",
  "grad-search": "Search, filter, score, compare, and save graduate programs. The catalog is bundled.",
  html: "An uploaded .html page in a sandbox. It sees only the lists ticked for it. Writes need Allow edits.",
  "package-app": "A downloaded folder (html, css, js, assets) in the same sandbox, with the same list bridge.",
  doc: "The Docs editor, bound to one note.",
  summary: "Group a list by an attribute, and optionally sum a number or currency column.",
  dashboard: "A grid of rollup cards: sum, average, min, or max, with an optional include gate.",
  randomizer: "Draw N open items from a list, with an optional countdown.",
  matcher: "Link each item on one list to the best match on another, and flag the ones with no match.",
  quiz: "Show a snippet from an item and pick the matching title.",
  gallery: "Image cards for items that have an image attribute.",
  "decision-matrix": "Weight numeric criteria and rank the rows. The highest score is marked.",
  kanban: "Columns from a status attribute. Cards are the items.",
  timer: "A focus countdown. On complete it writes a time log, or asks which item to log.",
  stat: "One analytics number.",
  notes: "Free text kept with the module.",
}

const WIDGETS: { name: string; note: string }[] = [
  { name: "List Explorer", note: "Draws items from one list. A pick opens on the same card." },
  { name: "Writing Generator", note: "A writing assignment. A new card keeps its sentence." },
  { name: "List Summary", note: "A list’s completion ratio. A missing or empty list is not shown as 0/0." },
  { name: "Analytics Stat", note: "One headline number. Opening it shows the days behind that total." },
  { name: "Random Task", note: "One open item from this month on the chosen list. The card names that pool." },
  { name: "Rules / Cause→Effect", note: "A comparison on one list. An empty value does not match every row." },
]

export function ModuleHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="mod95-dialog sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Building a module</DialogTitle>
        </DialogHeader>
        <div className="mod-help">
          <section>
            <h3>What a module is</h3>
            <p>
              A workspace is a mini-app: a name, a row of views, and optional print and plan sync.
              A widget is one card on the Modules catalog. The lists, items, and attributes behind
              either one are ordinary Brain2 data, so they also show up in Lists, the Plan, and the
              rest of the house. The module itself stores layout, bindings, and preferences.
            </p>
          </section>

          <section>
            <h3>Build module</h3>
            <p>The Build module key on the catalog opens five ways in.</p>
            <ul>
              <li>
                <strong>Build from scratch.</strong> Name it, bind lists (each with a role and
                optional attribute extensions), add views, then open the workspace. That definition
                can be instantiated again later.
              </li>
              <li>
                <strong>A template.</strong> Mints the lists, attributes, seed items, and views that
                template needs, then opens the workspace.
              </li>
              <li>
                <strong>Upload HTML file.</strong> One .html page (2 MB cap) becomes a workspace
                with a single HTML view. Tick the lists it may see. Allow edits is a separate grant.
                The page cannot read Brain2’s own storage.
              </li>
              <li>
                <strong>Install package.</strong> A .json package. Create-only files and native
                templates install directly. A bind slot matches an existing list and installs only
                on a unique match; otherwise the candidates stay on screen and nothing is written.
              </li>
              <li>
                <strong>Dashboard widget.</strong> A single catalog card, configured onto one list
                or stat.
              </li>
            </ul>
            <ul>
              {MODULE_TEMPLATES.map((template) => (
                <li key={template.id}>
                  <strong>{template.name}.</strong> {template.description}
                </li>
              ))}
            </ul>
            <ul>
              {WIDGETS.map((widget) => (
                <li key={widget.name}>
                  <strong>{widget.name}.</strong> {widget.note}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>The workspace bar</h3>
            <ul>
              <li>
                <strong>Back</strong> returns to the catalog. In a popped-out window it closes that
                window.
              </li>
              <li>
                <strong>The title</strong> is the module name. Click it to rename.
              </li>
              <li>
                <strong>Sync to Plan</strong> appears when plan sync is on. It copies eligible dated
                items onto the matching day plans. The items stay the source.
              </li>
              <li>
                <strong>Print / Export</strong> appears when print is on. It prints the open view.
              </li>
              <li>
                <strong>Workflows</strong> are saved steps for this module: a trigger, optional
                conditions, then actions. Triggers are an item being created, updated, or completed;
                an attribute change; a button; or a schedule. Actions write an attribute, fill a
                default, tag, create an item, link, schedule, sync the plan, chain another workflow,
                or stop the change.
              </li>
              <li>
                <strong>Settings</strong> edits the live module: name, icon, description, the view
                list (add, edit, remove, reorder), the print switch, and plan sync. Bound lists are
                set while the definition is being built, before it becomes a workspace.
              </li>
              <li>
                <strong>?</strong> opens this guide.
              </li>
              <li>
                <strong>Pop out</strong> opens this workspace in its own window. The catalog card
                has the same key.
              </li>
              <li>
                <strong>Add view</strong> adds a tab. Drag a tab to reorder it. The gear on a view
                edits that view: kind, title, source list, and the options that kind needs.
              </li>
            </ul>
          </section>

          <section>
            <h3>Views</h3>
            <p>
              Each tab is one view. Kinds marked as needing a list stay empty until a source list
              is chosen. The others keep their own document, page, or catalog.
            </p>
            <ul>
              {MODULE_VIEW_KINDS.map((kind) => (
                <li key={kind.kind}>
                  <strong>{kind.label}.</strong> {VIEW_NOTES[kind.kind]}
                  {kind.needsList ? " Needs a list." : ""}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Plan sync</h3>
            <p>
              Settings → Sync finalized, dated items to Plan. Pick the source list and the date
              attribute. An optional status attribute and value (for example Finalized) keeps other
              rows off the plan. Sync to Plan on the bar writes one line per eligible item onto
              that item’s day. A second sync does not duplicate lines that are already there.
            </p>
          </section>

          <section>
            <h3>Where the records live</h3>
            <p>
              Removing a view does not delete its list. Removing a module removes the workspace.
              Lists it created remain, because they are ordinary lists. An uploaded HTML file is
              removed with its module. Tidy and the trip still keep a working copy on the module
              and project that copy into Module Lists.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
