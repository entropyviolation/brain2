/**
 * components/Modules/workspace/ModuleViewEditor.tsx — Add/edit a workspace view
 *
 * The form for composing one bound view of a workspace module: its kind
 * (spreadsheet / checklist / agenda / summary / randomizer / timer / stat /
 * gallery / notes), title, source list, and kind-specific options (group/sum
 * attributes, date attribute, filter, pick count, timer length, stat). This is
 * what makes modules user-buildable without code.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTaskStore } from "@/lib/task-store"
import type { DashboardCard, DecisionCriterion, ModuleView, ModuleViewKind } from "@/lib/modules-store"
import { MODULE_VIEW_KINDS, STAT_OPTIONS } from "@/components/Modules/module-helpers"
import { isNumericAttribute } from "@/lib/spreadsheet-utils"
import { isKanbanGroupable } from "@/components/Lists/list-content/kanban-utils"

const VIEW_KINDS = MODULE_VIEW_KINDS.map((m) => ({ value: m.kind, label: m.label, needsList: m.needsList }))

export function ModuleViewEditor({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial?: ModuleView
  onClose: () => void
  onSave: (view: ModuleView) => void
}) {
  const categories = useTaskStore((s) => s.lists)

  const [kind, setKind] = useState<ModuleViewKind>(initial?.kind || "spreadsheet")
  const [title, setTitle] = useState(initial?.title || "")
  const [categoryId, setCategoryId] = useState<string | undefined>(initial?.config.categoryId)
  const [groupAttrId, setGroupAttrId] = useState<string | undefined>(initial?.config.groupAttrId)
  const [valueAttrId, setValueAttrId] = useState<string | undefined>(initial?.config.valueAttrId)
  const [dateAttrId, setDateAttrId] = useState<string | undefined>(initial?.config.dateAttrId)
  const [pickCount, setPickCount] = useState(initial?.config.pickCount ?? 3)
  const [timerMinutes, setTimerMinutes] = useState(initial?.config.timerMinutes ?? 25)
  const [stat, setStat] = useState(initial?.config.stat || "points-week")
  const [criteria, setCriteria] = useState<DecisionCriterion[]>(initial?.config.criteria ?? [])
  const [statusAttrId, setStatusAttrId] = useState<string | undefined>(initial?.config.statusAttrId)
  const [timeAttrId, setTimeAttrId] = useState<string | undefined>(initial?.config.timeAttrId)
  const [matchTargetCategoryId, setMatchTargetCategoryId] = useState<string | undefined>(initial?.config.matchTargetCategoryId)
  const [matchTextAttrId, setMatchTextAttrId] = useState<string | undefined>(initial?.config.matchTextAttrId)
  const [linkRelation, setLinkRelation] = useState(initial?.config.linkRelation || "about")
  const [quizSourceCategoryId, setQuizSourceCategoryId] = useState<string | undefined>(initial?.config.quizSourceCategoryId)
  const [fileAttrId, setFileAttrId] = useState<string | undefined>(initial?.config.fileAttrId)
  const [quizChoiceCount, setQuizChoiceCount] = useState(initial?.config.quizChoiceCount ?? 4)
  const [cards, setCards] = useState<DashboardCard[]>(initial?.config.cards ?? [])

  useEffect(() => {
    if (!open) return
    setKind(initial?.kind || "spreadsheet")
    setTitle(initial?.title || "")
    setCategoryId(initial?.config.categoryId)
    setGroupAttrId(initial?.config.groupAttrId)
    setValueAttrId(initial?.config.valueAttrId)
    setDateAttrId(initial?.config.dateAttrId)
    setPickCount(initial?.config.pickCount ?? 3)
    setTimerMinutes(initial?.config.timerMinutes ?? 25)
    setStat(initial?.config.stat || "points-week")
    setCriteria(initial?.config.criteria ?? [])
    setStatusAttrId(initial?.config.statusAttrId)
    setTimeAttrId(initial?.config.timeAttrId)
    setMatchTargetCategoryId(initial?.config.matchTargetCategoryId)
    setMatchTextAttrId(initial?.config.matchTextAttrId)
    setLinkRelation(initial?.config.linkRelation || "about")
    setQuizSourceCategoryId(initial?.config.quizSourceCategoryId)
    setFileAttrId(initial?.config.fileAttrId)
    setQuizChoiceCount(initial?.config.quizChoiceCount ?? 4)
    setCards(initial?.config.cards ?? [])
  }, [open, initial])

  const meta = VIEW_KINDS.find((k) => k.value === kind)!
  const cat = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId])
  const attrs = useMemo(() => cat?.itemAttributes ?? [], [cat])
  const numericAttrs = useMemo(() => attrs.filter(isNumericAttribute), [attrs])
  const kanbanAttrs = useMemo(() => attrs.filter(isKanbanGroupable), [attrs])
  const quizSourceAttrs = useMemo(() => {
    const id = quizSourceCategoryId || categoryId
    return categories.find((c) => c.id === id)?.itemAttributes ?? []
  }, [categories, quizSourceCategoryId, categoryId])

  const toggleCriterion = (attrId: string) =>
    setCriteria((prev) =>
      prev.some((c) => c.attrId === attrId)
        ? prev.filter((c) => c.attrId !== attrId)
        : [...prev, { attrId, weight: 5, benefit: true }],
    )
  const updateCriterion = (attrId: string, patch: Partial<DecisionCriterion>) =>
    setCriteria((prev) => prev.map((c) => (c.attrId === attrId ? { ...c, ...patch } : c)))

  const save = () => {
    const view: ModuleView = {
      id: initial?.id || `view-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      kind,
      title: title.trim() || meta.label,
      config: {
        categoryId: meta.needsList ? categoryId : undefined,
        groupAttrId: kind === "summary" ? groupAttrId : undefined,
        valueAttrId: kind === "summary" ? valueAttrId : undefined,
        pickCount: kind === "randomizer" ? Math.max(1, pickCount) : undefined,
        timerMinutes: kind === "randomizer" || kind === "timer" ? Math.max(1, timerMinutes) : undefined,
        stat: kind === "stat" ? stat : undefined,
        criteria: kind === "decision-matrix" ? criteria.filter((c) => attrs.some((a) => a.id === c.attrId)) : undefined,
        statusAttrId: kind === "kanban" ? statusAttrId : undefined,
        dateAttrId: kind === "agenda" || kind === "timeline" ? dateAttrId : undefined,
        timeAttrId: kind === "timeline" ? timeAttrId : undefined,
        matchTargetCategoryId: kind === "matcher" ? matchTargetCategoryId : undefined,
        matchTextAttrId: kind === "matcher" || kind === "quiz" ? matchTextAttrId || fileAttrId : undefined,
        linkRelation: kind === "matcher" ? linkRelation.trim() || "about" : undefined,
        quizSourceCategoryId: kind === "quiz" ? quizSourceCategoryId : undefined,
        fileAttrId: kind === "quiz" ? fileAttrId : undefined,
        quizChoiceCount: kind === "quiz" ? Math.max(2, quizChoiceCount) : undefined,
        cards: kind === "dashboard" ? cards : undefined,
        notesKey: initial?.config.notesKey,
      },
    }
    onSave(view)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit view" : "Add view"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>View type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ModuleViewKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={meta.label} />
          </div>

          {meta.needsList && (
            <div className="space-y-2">
              <Label>Source list</Label>
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? undefined : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a list</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "summary" && (
            <>
              <AttrSelect label="Group by" attrs={attrs} value={groupAttrId} onChange={setGroupAttrId} />
              <AttrSelect label="Sum (optional)" attrs={attrs} value={valueAttrId} onChange={setValueAttrId} allowNone />
            </>
          )}
          {kind === "agenda" && (
            <AttrSelect label="Date attribute" attrs={attrs} value={dateAttrId} onChange={setDateAttrId} />
          )}
          {kind === "timeline" && (
            <>
              <AttrSelect label="Date attribute" attrs={attrs} value={dateAttrId} onChange={setDateAttrId} />
              <AttrSelect label="Time attribute (optional)" attrs={attrs} value={timeAttrId} onChange={setTimeAttrId} allowNone />
            </>
          )}
          {kind === "matcher" && (
            <>
              <div className="space-y-2">
                <Label>Match against list</Label>
                <Select
                  value={matchTargetCategoryId || "none"}
                  onValueChange={(v) => setMatchTargetCategoryId(v === "none" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a list" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose a list</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <AttrSelect label="Text / file attribute (optional)" attrs={attrs} value={matchTextAttrId} onChange={setMatchTextAttrId} allowNone />
              <div className="space-y-2">
                <Label>Link relation</Label>
                <Input value={linkRelation} onChange={(e) => setLinkRelation(e.target.value)} placeholder="about" />
              </div>
            </>
          )}
          {kind === "quiz" && (
            <>
              <div className="space-y-2">
                <Label>Source list (prompts)</Label>
                <Select
                  value={quizSourceCategoryId || "none"}
                  onValueChange={(v) => setQuizSourceCategoryId(v === "none" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Same as candidates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Same as candidates</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <AttrSelect label="Text / file attribute" attrs={quizSourceAttrs} value={fileAttrId} onChange={setFileAttrId} allowNone />
              <div className="space-y-2">
                <Label>Choices</Label>
                <Input type="number" min={2} value={quizChoiceCount} onChange={(e) => setQuizChoiceCount(Number(e.target.value) || 4)} />
              </div>
            </>
          )}
          {kind === "dashboard" && <DashboardCardsEditor cards={cards} onChange={setCards} />}
          {kind === "kanban" && (
            !categoryId ? (
              <p className="text-xs text-muted-foreground">Choose a source list first.</p>
            ) : kanbanAttrs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                This list has no selection/text attribute to use as columns.
              </p>
            ) : (
              <AttrSelect label="Status attribute (columns)" attrs={kanbanAttrs} value={statusAttrId} onChange={setStatusAttrId} />
            )
          )}
          {kind === "randomizer" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>How many</Label>
                <Input type="number" min={1} value={pickCount} onChange={(e) => setPickCount(Number(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>Timer (min, optional)</Label>
                <Input type="number" min={0} value={timerMinutes} onChange={(e) => setTimerMinutes(Number(e.target.value) || 0)} />
              </div>
            </div>
          )}
          {kind === "timer" && (
            <div className="space-y-2">
              <Label>Minutes</Label>
              <Input type="number" min={1} value={timerMinutes} onChange={(e) => setTimerMinutes(Number(e.target.value) || 1)} />
            </div>
          )}
          {kind === "stat" && (
            <div className="space-y-2">
              <Label>Stat</Label>
              <Select value={stat} onValueChange={setStat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {kind === "decision-matrix" && (
            <div className="space-y-2">
              <Label>Criteria (weighted numeric attributes)</Label>
              {!categoryId ? (
                <p className="text-xs text-muted-foreground">Choose a source list first.</p>
              ) : numericAttrs.length === 0 ? (
                <p className="text-xs text-muted-foreground">This list has no numeric attributes to score on.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {numericAttrs.map((a) => {
                    const c = criteria.find((x) => x.attrId === a.id)
                    return (
                      <div key={a.id} className="rounded border p-2 space-y-1.5">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!c} onChange={() => toggleCriterion(a.id)} />
                          <span className="font-medium">{a.name}</span>
                        </label>
                        {c && (
                          <div className="flex items-center gap-2 pl-6">
                            <span className="text-xs text-muted-foreground w-12">Weight</span>
                            <input
                              type="range"
                              min={0}
                              max={10}
                              step={1}
                              value={c.weight}
                              onChange={(e) => updateCriterion(a.id, { weight: Number(e.target.value) })}
                              className="flex-1 accent-primary"
                            />
                            <span className="w-5 text-right tabular-nums text-xs text-muted-foreground">{c.weight}</span>
                            <Select
                              value={c.benefit === false ? "cost" : "benefit"}
                              onValueChange={(v) => updateCriterion(a.id, { benefit: v === "benefit" })}
                            >
                              <SelectTrigger className="h-7 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="benefit">Higher better</SelectItem>
                                <SelectItem value="cost">Lower better</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={meta.needsList && !categoryId}>
            {initial ? "Save" : "Add view"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Compact editor for a `dashboard` view's rollup cards. */
function DashboardCardsEditor({ cards, onChange }: { cards: DashboardCard[]; onChange: (cards: DashboardCard[]) => void }) {
  const categories = useTaskStore((s) => s.lists)

  const addCard = () =>
    onChange([
      ...cards,
      { id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, label: "New card", categoryId: "", attrId: "" },
    ])
  const update = (id: string, patch: Partial<DashboardCard>) =>
    onChange(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const remove = (id: string) => onChange(cards.filter((c) => c.id !== id))

  return (
    <div className="space-y-2">
      <Label>Cards</Label>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {cards.map((card) => {
          const cat = categories.find((c) => c.id === card.categoryId)
          const numAttrs = (cat?.itemAttributes ?? []).filter(isNumericAttribute)
          const boolAttrs = (cat?.itemAttributes ?? []).filter((a) => a.type === "boolean")
          return (
            <div key={card.id} className="rounded border p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={card.label}
                  onChange={(e) => update(card.id, { label: e.target.value })}
                  placeholder="Card label"
                  className="h-8"
                />
                <Button variant="ghost" size="sm" onClick={() => remove(card.id)}>
                  Remove
                </Button>
              </div>
              <Select value={card.categoryId || "none"} onValueChange={(v) => update(card.id, { categoryId: v === "none" ? "" : v, attrId: "" })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="List" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a list</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Select value={card.attrId || "none"} onValueChange={(v) => update(card.id, { attrId: v === "none" ? "" : v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Number attr" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Number attr</SelectItem>
                    {numAttrs.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={card.includeAttrId || "none"}
                  onValueChange={(v) => update(card.id, { includeAttrId: v === "none" ? undefined : v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Include toggle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Always include</SelectItem>
                    {boolAttrs.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
      <Button variant="outline" size="sm" onClick={addCard}>
        Add card
      </Button>
    </div>
  )
}

function AttrSelect({
  label,
  attrs,
  value,
  onChange,
  allowNone,
}: {
  label: string
  attrs: { id: string; name: string }[]
  value?: string
  onChange: (v: string | undefined) => void
  allowNone?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? undefined : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Choose attribute" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{allowNone ? "None (count only)" : "Choose attribute"}</SelectItem>
          {attrs.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
