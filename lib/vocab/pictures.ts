/**
 * lib/vocab/pictures.ts — The names a vocab word may use for its picture
 *
 * A concrete word carries one of these names in `picture`. The vector icon
 * for each name is drawn by `components/Icons/vocab-picture.tsx`. Color words
 * use a `swatch-*` name and draw as a flat chip of that color. No emoji:
 * docs/DESIGN_STYLE.md#no-emojis.
 */

export const VOCAB_PICTURE_NAMES = [
  "apple", "bread", "water", "milk", "cheese", "egg", "fish", "cat", "dog", "bird",
  "horse", "cow", "house", "chair", "bed", "door", "window", "key", "book", "books",
  "car", "hand", "eye", "look", "mouth", "foot", "nose", "ear", "mother", "father",
  "baby", "child", "family", "friend", "sun", "rain", "snow", "wind", "cloud", "weather",
  "eat", "drink", "sleep", "speak", "write", "run", "tree", "flower", "moon", "coffee",
  "tea", "rice", "noodles", "meat", "banana", "citrus", "watermelon", "mountain", "river",
  "train", "phone", "laptop", "shoe", "shirt", "backpack", "gift", "umbrella", "plane",
  "watch", "cold", "hot",
  "swatch-red", "swatch-blue", "swatch-green", "swatch-white", "swatch-black",
] as const

export type VocabPictureName = (typeof VOCAB_PICTURE_NAMES)[number]

/** Flat fill for a color word's swatch. */
export const VOCAB_SWATCH_FILL: Record<string, string> = {
  "swatch-red": "#c8402f",
  "swatch-blue": "#3d6fd1",
  "swatch-green": "#3f9a62",
  "swatch-white": "#f4f5f6",
  "swatch-black": "#17181a",
}

export function isVocabPictureName(v: unknown): v is VocabPictureName {
  return typeof v === "string" && (VOCAB_PICTURE_NAMES as readonly string[]).includes(v)
}
