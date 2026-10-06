/**
 * lib/period-arc.ts — One reflection shape for week, month, season, and year
 *
 * Day / night keeps its own short ritual. These prompts are the longer look.
 * Every answer is optional. A section counts for points only when it has words,
 * or — for inspiration — a photo with no caption. Fear and its reframe are one
 * section. Stats are not questions.
 */
import type { FileValue, PeriodArcReflection, ReviewPeriod } from "@/lib/types"

export interface PeriodWords {
  past: string
  next: string
  noun: string
}

export function periodWords(period: ReviewPeriod): PeriodWords | null {
  switch (period) {
    case "week":
      return { past: "this past week", next: "next week", noun: "week" }
    case "month":
      return { past: "this past month", next: "next month", noun: "month" }
    case "quarter":
      return { past: "this season", next: "next season", noun: "season" }
    case "year":
      return { past: "this past year", next: "next year", noun: "year" }
    default:
      return null
  }
}

export interface ArcPrompt {
  id: keyof PeriodArcReflection
  /** Section id for points. Fear's two beats share one. */
  sectionId: string
  group: string
  label: string
  question: string
  /** Second beat, stored separately, same section. */
  reframe?: { id: "fearReframe"; question: string }
  photos?: boolean
}

export function arcPrompts(period: ReviewPeriod): ArcPrompt[] {
  const words = periodWords(period)
  if (!words) return []
  const { past, next } = words
  return [
    {
      id: "wins",
      sectionId: "arc:wins",
      group: "Growth and Accomplishments",
      label: "Wins and Progress",
      question: `What was the best thing that happened ${past}, and what goals did I actually achieve?`,
    },
    {
      id: "lessons",
      sectionId: "arc:lessons",
      group: "Growth and Accomplishments",
      label: "Lessons Learned",
      question: "What mistakes did I make, and what is the biggest lesson I can take away from them?",
    },
    {
      id: "timeManagement",
      sectionId: "arc:timeManagement",
      group: "Growth and Accomplishments",
      label: "Time Management",
      question: `How did I spend my time ${past}, and what did I spend too little or too much time on?`,
    },
    {
      id: "energyStress",
      sectionId: "arc:energyStress",
      group: "Health and Well-Being",
      label: "Energy and Stress",
      question: "What is making me feel stressed lately, and what drains my energy the most?",
    },
    {
      id: "physical",
      sectionId: "arc:physical",
      group: "Health and Well-Being",
      label: "Physical Check-in",
      question: "How do I feel in my physical body, and did I maintain healthy routines for sleep, movement, or nutrition?",
    },
    {
      id: "joyBalance",
      sectionId: "arc:joyBalance",
      group: "Health and Well-Being",
      label: "Joy and Balance",
      question: `When did I feel the most joy ${past}, and what do I need more of (rest, fun, creativity, or connection)?`,
    },
    {
      id: "social",
      sectionId: "arc:social",
      group: "Relationships and Support",
      label: "Social Circle",
      question: `Do I feel truly supported by the people around me, and who do I want to spend more time with ${next}?`,
    },
    {
      id: "boundaries",
      sectionId: "arc:boundaries",
      group: "Relationships and Support",
      label: "Boundaries",
      question: "Is there anyone or anything in my life right now that consistently makes me feel bad about myself?",
    },
    {
      id: "primaryFocus",
      sectionId: "arc:primaryFocus",
      group: "Planning for the Next Period",
      label: "Primary Focus",
      question: `What is the one main area I want to focus on ${next} to move my life or work forward?`,
    },
    {
      id: "obstacles",
      sectionId: "arc:obstacles",
      group: "Planning for the Next Period",
      label: "Upcoming Obstacles",
      question: "What potential challenges, travel, or busy periods do I need to anticipate and plan for?",
    },
    {
      id: "anticipate",
      sectionId: "arc:anticipate",
      group: "Planning for the Next Period",
      label: "Something to Anticipate",
      question: "What is one fun event, project, or small moment I can schedule to look forward to?",
    },
    {
      id: "inspired",
      sectionId: "arc:inspired",
      group: "Also",
      label: "Things that inspired me",
      question: "Things that inspired me",
      photos: true,
    },
    {
      id: "joy",
      sectionId: "arc:joy",
      group: "Also",
      label: "Things that brought me joy",
      question: "Things that brought me joy",
    },
    {
      id: "fear",
      sectionId: "arc:fear",
      group: "Also",
      label: "Fears, and reframe them",
      question: "What am I afraid of?",
      reframe: { id: "fearReframe", question: "How can I reframe that?" },
    },
    {
      id: "bestWorst",
      sectionId: "arc:bestWorst",
      group: "Also",
      label: "Best and worst",
      question: `Best and worst things that happened ${past}`,
    },
    {
      id: "idealNext",
      sectionId: "arc:idealNext",
      group: "Also",
      label: "An ideal next period",
      question: `What an ideal ${next} would look like`,
    },
  ]
}

export const ARC_GROUPS = [
  "Growth and Accomplishments",
  "Health and Well-Being",
  "Relationships and Support",
  "Planning for the Next Period",
  "Also",
] as const

function filled(value: string | undefined): boolean {
  return !!value?.trim()
}

/** Section ids that have an answer. Inspiration counts with a photo and no text. Fear is one section. */
export function filledArcSectionIds(arc: PeriodArcReflection | undefined): string[] {
  if (!arc) return []
  const ids: string[] = []
  const text: [keyof PeriodArcReflection, string][] = [
    ["wins", "arc:wins"],
    ["lessons", "arc:lessons"],
    ["timeManagement", "arc:timeManagement"],
    ["energyStress", "arc:energyStress"],
    ["physical", "arc:physical"],
    ["joyBalance", "arc:joyBalance"],
    ["social", "arc:social"],
    ["boundaries", "arc:boundaries"],
    ["primaryFocus", "arc:primaryFocus"],
    ["obstacles", "arc:obstacles"],
    ["anticipate", "arc:anticipate"],
    ["joy", "arc:joy"],
    ["bestWorst", "arc:bestWorst"],
    ["idealNext", "arc:idealNext"],
  ]
  for (const [key, id] of text) {
    const value = arc[key]
    if (typeof value === "string" && filled(value)) ids.push(id)
  }
  if (filled(arc.inspired) || (arc.inspiredPhotos?.length ?? 0) > 0) ids.push("arc:inspired")
  if (filled(arc.fear) || filled(arc.fearReframe)) ids.push("arc:fear")
  return ids
}

/** Drop blank strings and empty photo lists so a draft does not store noise. */
export function cleanArc(arc: PeriodArcReflection | undefined): PeriodArcReflection | undefined {
  if (!arc) return undefined
  const next: PeriodArcReflection = {}
  const textKeys: (keyof PeriodArcReflection)[] = [
    "wins",
    "lessons",
    "timeManagement",
    "energyStress",
    "physical",
    "joyBalance",
    "social",
    "boundaries",
    "primaryFocus",
    "obstacles",
    "anticipate",
    "inspired",
    "joy",
    "fear",
    "fearReframe",
    "bestWorst",
    "idealNext",
  ]
  for (const key of textKeys) {
    const value = arc[key]
    if (typeof value === "string" && value.trim()) {
      ;(next as Record<string, string>)[key] = value.trim()
    }
  }
  const photos = (arc.inspiredPhotos ?? []).filter((photo) => photo?.uri)
  if (photos.length) next.inspiredPhotos = photos
  return Object.keys(next).length ? next : undefined
}

export function arcPhoto(photo: FileValue): boolean {
  return !!photo?.uri
}
