/**
 * components/Home/Tracking/mood-stretch-card.tsx — This stretch
 *
 * Mood blocks only. Three parts, every field optional: the body, the water,
 * and the heaps. The name is any word. Existing pens sit under it as equal
 * chips. A lighter map is offered only when the shorthand is an identity or
 * a forever, and only when it is not already about this stretch.
 */
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { inkOnFill } from "@/components/Home/Tracking/trk-instrument"
import {
  RANK_LABEL,
  identityRewrite,
  lighterMap,
  moodSentence,
  normalizeWord,
  type MoodRankKey,
  type MoodReading,
  type MoodTone,
} from "@/lib/mood-reading"

const GUIDE = [
  "Name the stretch with any word. Great, Good, Meh, and Low are pens you may use or ignore. A new word becomes its own color.",
  "Write the body before you trust the word. Energy and tension describe the nervous system. Loop is how much the word then tightens the body.",
  "Mark only what you can feel. A blank is not a zero, and the marks are not a grade.",
  "Write the vibe — the climate the next hours swim in — and the shorthand the mind is offering. If a lighter map appears, take it only when it is more accurate. Do not invent a pleasanter body.",
  "Set the tone, the enjoyment that is actually there, the leaning (grasping), and how clearly the heaps are seen. In About that, a kindness counts only if you feel it.",
  "Save. Later, Analytics → Time → Mood field keeps the same word on different hours apart, lists the water, and averages only the marks you set.",
] as const

const EVENT_RANKS: { key: MoodRankKey; prompt: string }[] = [
  {
    key: "energy",
    prompt:
      "How lit the nervous system is — the current, not the story about the current. A low reading is exhaustion or quiet. It is not hopelessness until a word says so.",
  },
  {
    key: "tension",
    prompt: "How braced the body is. Grip is an event in muscle. It is not yet a mood.",
  },
  {
    key: "loop",
    prompt:
      "Once a word is on it: how much does that word tighten or exhaust the body further? A high mark means the label has joined the territory. Seeing that is already a break in the loop.",
  },
]

const WATER_RANKS: { key: MoodRankKey; prompt: string }[] = [
  {
    key: "sociability",
    prompt: "Inclination toward other people, as a setting of this hour. Low is not a character.",
  },
  {
    key: "initiative",
    prompt: "Readiness to begin or to move toward something. The hour raises or lowers the threshold. The threshold is not you.",
  },
  {
    key: "cast",
    prompt:
      "How readily attention selects the downcast cue — threat, loss, the old hurt. This is a bias of the hour. Naming it lets the next cue be a cue, not the world.",
  },
]

const HEAP_RANKS: { key: MoodRankKey; prompt: string }[] = [
  {
    key: "enjoyment",
    prompt: "How much pleasure is actually in the contact. If the tone is unpleasant, a low mark is exact. Do not raise it to look well.",
  },
  {
    key: "grasping",
    prompt:
      "The leaning: clinging to what is pleasant, pushing off what is unpleasant, or spinning a story about either. Often the leaning outweighs the tone. A lower mark is not achieved by force. Force is more leaning.",
  },
  {
    key: "knowing",
    prompt:
      "How clearly this is known as a passing process rather than as who you are. A high mark is not a performance. It is only that the heaps are being seen as heaps.",
  },
]

const TONES: { tone: MoodTone; label: string }[] = [
  { tone: "pleasant", label: "Pleasant" },
  { tone: "unpleasant", label: "Unpleasant" },
  { tone: "neutral", label: "Neither" },
]

export function MoodStretchCard({
  reading,
  onChange,
  pens,
  onUsePen,
  date,
  startLabel,
  endLabel,
}: {
  reading: MoodReading
  onChange: (next: MoodReading) => void
  pens: { id: string; name: string; color: string }[]
  onUsePen: (penId: string) => void
  date: string
  startLabel: string
  endLabel: string
}) {
  const sentence = moodSentence(reading, { date, startLabel, endLabel })
  const offer = lighterMap(reading, date)
  const showOffer = offer !== null && offer !== reading.reframe?.trim()
  const bare = identityRewrite(reading.word ?? "")
  const showBare = Boolean(bare && normalizeWord(bare) !== normalizeWord(reading.word ?? ""))
  const chips = [...pens].sort((a, b) => a.name.localeCompare(b.name))
  const wordKey = normalizeWord(reading.word ?? "")

  const setText = (key: "word" | "sensation" | "vibe" | "narrative" | "about", value: string) => {
    onChange({ ...reading, [key]: value })
  }

  const setRank = (key: MoodRankKey, raw: string) => {
    if (raw.trim() === "") {
      onChange({ ...reading, [key]: undefined })
      return
    }
    const n = Number(raw)
    if (!Number.isInteger(n)) return
    onChange({ ...reading, [key]: n >= 1 && n <= 10 ? n : undefined })
  }

  return (
    <section className="trk-section trk-mood" data-testid="mood-stretch">
      <p className="trk-section-title">This stretch</p>
      <div className="trk-mood-guide">
        <p className="trk-section-title">Using a stretch</p>
        <p className="trk-help">A color alone is a true record. The full record is the three parts, in this order.</p>
        <ol>
          {GUIDE.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="trk-help">
          This is a practice of description, not a treatment. A long heavy stretch is a record to take to a person, not
          a verdict the card can fix.
        </p>
      </div>

      <div className="trk-mood-part">
        <p className="trk-section-title">The event</p>
        <p className="trk-help">
          A mood here is the whole organism answering. The silent body comes first. The word is a map laid on it. A hard
          word can feed the body and keep the hour going.
        </p>
        <Label htmlFor="mood-body">Body</Label>
        <p className="trk-help">
          The territory, under every name. Heat, weight, breath, pulse, hunger, the chest, the jaw. Write the body.
          This layer has no opinion.
        </p>
        <Textarea
          id="mood-body"
          rows={2}
          value={reading.sensation ?? ""}
          onChange={(e) => setText("sensation", e.target.value)}
        />
        {EVENT_RANKS.map((rank) => (
          <RankField
            key={rank.key}
            rank={rank.key}
            prompt={rank.prompt}
            value={reading[rank.key]}
            onChange={(raw) => setRank(rank.key, raw)}
          />
        ))}
      </div>

      <div className="trk-mood-part">
        <p className="trk-section-title">The water</p>
        <p className="trk-help">
          There is no inner dial. What meets you is a story told about the hour’s settings, and the leanings those
          settings leave ready. This is the water the rest of the day swims in.
        </p>
        <Label htmlFor="mood-vibe">Vibe</Label>
        <p className="trk-help">
          A phrase for the climate of the hour, not a verdict on a life. ‘Slightly uphill.’ ‘Thin light.’ ‘Everything at
          a distance.’
        </p>
        <Input id="mood-vibe" value={reading.vibe ?? ""} onChange={(e) => setText("vibe", e.target.value)} />
        <Label htmlFor="mood-shorthand">Shorthand</Label>
        <p className="trk-help">
          The sentence the mind is offering, usually too large: ‘I am in a bad mood,’ ‘nothing works.’ Write it as the
          story. It was composed after the body. It can be revised.
        </p>
        <Textarea
          id="mood-shorthand"
          rows={2}
          value={reading.narrative ?? ""}
          onChange={(e) => setText("narrative", e.target.value)}
        />
        {showOffer && offer && (
          <div className="trk-mood-offer">
            <p className="trk-help">{offer}</p>
            <p className="trk-help">
              A lighter map, still true. Use it only if it is more accurate. A kinder sentence that lies is a worse map.
            </p>
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onChange({ ...reading, reframe: offer })}>
              Accept
            </Button>
          </div>
        )}
        {reading.reframe?.trim() && (
          <div className="trk-mood-offer">
            <p className="trk-help">{reading.reframe.trim()}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => onChange({ ...reading, reframe: undefined })}
            >
              Use the shorthand
            </Button>
          </div>
        )}
        {WATER_RANKS.map((rank) => (
          <RankField
            key={rank.key}
            rank={rank.key}
            prompt={rank.prompt}
            value={reading[rank.key]}
            onChange={(raw) => setRank(rank.key, raw)}
          />
        ))}
      </div>

      <div className="trk-mood-part">
        <p className="trk-section-title">The heaps</p>
        <p className="trk-help">
          Not one object. A body, a tone, a recognition, a leaning, and the knowing of those. Each is conditioned. None
          of them is an owner.
        </p>
        <p className="trk-section-title">Tone</p>
        <p className="trk-help">
          Feeling-tone, before the story. The tone is not the enemy. What hurts is grasping it or refusing it.
        </p>
        <div className="trk-mood-chips" role="group" aria-label="Tone">
          {TONES.map((item) => (
            <button
              key={item.tone}
              type="button"
              className="trk-mood-chip"
              aria-pressed={reading.tone === item.tone}
              onClick={() => onChange({ ...reading, tone: reading.tone === item.tone ? undefined : item.tone })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <RankField
          rank="enjoyment"
          prompt={HEAP_RANKS[0].prompt}
          value={reading.enjoyment}
          onChange={(raw) => setRank("enjoyment", raw)}
        />
        <Label htmlFor="mood-word">Name</Label>
        <p className="trk-help">
          The recognition. Any word, including one never stored here. It matches this stretch to a memory, and the match
          is not the event. This hour is not the other hours this word has named, and the word is not you.
        </p>
        <Input id="mood-word" value={reading.word ?? ""} onChange={(e) => setText("word", e.target.value)} />
        {showBare && bare && (
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onChange({ ...reading, word: bare })}>
            Use the word “{bare}”
          </Button>
        )}
        {chips.length > 0 && (
          <div className="trk-mood-chips" role="group" aria-label="Mood pens">
            {chips.map((pen) => {
              const on = wordKey.length > 0 && normalizeWord(pen.name) === wordKey
              return (
                <button
                  key={pen.id}
                  type="button"
                  className="trk-mood-chip"
                  aria-pressed={on}
                  style={on ? { background: pen.color, color: inkOnFill(pen.color) } : undefined}
                  onClick={() => {
                    onChange({ ...reading, word: pen.name })
                    onUsePen(pen.id)
                  }}
                >
                  {pen.name}
                </button>
              )
            })}
          </div>
        )}
        <RankField
          rank="grasping"
          prompt={HEAP_RANKS[1].prompt}
          value={reading.grasping}
          onChange={(raw) => setRank("grasping", raw)}
        />
        <Label htmlFor="mood-about">About that</Label>
        <p className="trk-help">
          What the mind is doing with the state — keeping it, refusing it, explaining it, becoming it. If a lighter
          doing is honestly available — a little room, a little kindness toward the hour — you may write that beside it.
          Do not write a kindness you do not feel.
        </p>
        <Textarea id="mood-about" rows={2} value={reading.about ?? ""} onChange={(e) => setText("about", e.target.value)} />
        <RankField
          rank="knowing"
          prompt={HEAP_RANKS[2].prompt}
          value={reading.knowing}
          onChange={(raw) => setRank("knowing", raw)}
        />
      </div>

      {sentence ? (
        <p className="trk-mood-sentence" data-testid="mood-sentence">
          {sentence}
        </p>
      ) : null}
      <p className="trk-help">None of this has to be carried past the stretch. The record is a map. etc.</p>
    </section>
  )
}

function RankField({
  rank,
  prompt,
  value,
  onChange,
}: {
  rank: MoodRankKey
  prompt: string
  value: number | undefined
  onChange: (raw: string) => void
}) {
  const id = `mood-${rank}`
  return (
    <div className="trk-mood-rank">
      <Label htmlFor={id}>
        {RANK_LABEL[rank]} <span className="trk-mood-scale">1–10</span>
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        max={10}
        inputMode="numeric"
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="trk-help">{prompt}</p>
    </div>
  )
}
