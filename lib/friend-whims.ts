/**
 * lib/friend-whims.ts — Soft missions that are not Items (draw, read, stretch)
 *
 * Species `whimId` picks a favorite. Completing pays friend points via
 * `friend-reward.ts` when the human taps I did it.
 */

export type FriendWhim = {
  id: string
  title: string
  blurb: string
}

export const FRIEND_WHIMS: Record<string, FriendWhim> = {
  doodle: {
    id: "doodle",
    title: "Draw a picture",
    blurb: "Anything counts — a doodle, a map, a tiny comic. Show the page to nobody if you want.",
  },
  read: {
    id: "read",
    title: "Read a little",
    blurb: "A page, a poem, a paragraph. The owl kinds of friends never get tired of this one.",
  },
  walk: {
    id: "walk",
    title: "Take a short walk",
    blurb: "Around the room or around the block. Puppies vote for this a lot.",
  },
  splash: {
    id: "splash",
    title: "Water nearby",
    blurb: "Drink a glass, wash a cup, stand near a sink. Otters invented this mission.",
  },
  stretch: {
    id: "stretch",
    title: "Stretch once",
    blurb: "Shoulders, jaw, or toes. Quiet friends like this as much as habits.",
  },
  nibble: {
    id: "nibble",
    title: "Eat something kind",
    blurb: "A real snack, not a dare. No shame if it is small.",
  },
  soak: {
    id: "soak",
    title: "Sit still a minute",
    blurb: "Capybara energy. No productivity. Just exist.",
  },
  shiny: {
    id: "shiny",
    title: "Put one thing where it belongs",
    blurb: "One object. Crows call it treasure management.",
  },
  hop: {
    id: "hop",
    title: "Hop or skip once",
    blurb: "Silly on purpose. Bunnies keep asking.",
  },
  curl: {
    id: "curl",
    title: "Make a small nest",
    blurb: "Blanket, hoodie, chair. Hedgehogs approve of compact comfort.",
  },
}

export const FRIEND_WHIM_IDS = Object.keys(FRIEND_WHIMS)

export function friendWhim(id: string | undefined): FriendWhim {
  if (id && FRIEND_WHIMS[id]) return FRIEND_WHIMS[id]!
  return FRIEND_WHIMS.doodle!
}
