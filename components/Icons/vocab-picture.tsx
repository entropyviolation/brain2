/**
 * components/Icons/vocab-picture.tsx — The vector picture for a vocab word
 *
 * `VocabPicture` draws the line icon named in a word's `picture`
 * (`lib/vocab/pictures.ts`). Lucide where it has the thing, house glyphs
 * (`house-glyphs.tsx`) where it does not, and a flat swatch for a color word.
 * An unknown name draws nothing.
 */

import type { LucideIcon, LucideProps } from "lucide-react"
import {
  Apple, Armchair, Backpack, Baby, Banana, BedDouble, BedSingle, Bird, BookOpen, Car, Cat,
  Citrus, Cloud, CloudRain, CloudSun, Coffee, CupSoda, Dog, DoorOpen, Drumstick, Ear, Egg, Eye,
  Fish, Flower2, Footprints, Gift, Hand, House, KeyRound, Laptop, Library, Milk, Moon, Mountain,
  PenLine, PersonStanding, Plane, ScanEye, Shirt, Smartphone, Snowflake, Soup, Speech, Sun,
  ThermometerSnowflake, ThermometerSun, TrainFront, TreeDeciduous, Umbrella, User, Users, UsersRound,
  Watch, Waves, Wind, Croissant, Droplet, Utensils,
} from "lucide-react"
import {
  CheeseGlyph, CowGlyph, HorseGlyph, MotherGlyph, MouthGlyph, NoseGlyph, RiceBowlGlyph, ShoeGlyph,
  TeacupGlyph, WatermelonGlyph, WindowGlyph,
} from "@/components/Icons/house-glyphs"
import { VOCAB_SWATCH_FILL, type VocabPictureName } from "@/lib/vocab/pictures"

type Swatch = `swatch-${string}`

const ICONS: Record<Exclude<VocabPictureName, Swatch>, LucideIcon> = {
  apple: Apple, bread: Croissant, water: Droplet, milk: Milk, cheese: CheeseGlyph, egg: Egg,
  fish: Fish, cat: Cat, dog: Dog, bird: Bird, horse: HorseGlyph, cow: CowGlyph, house: House,
  chair: Armchair, bed: BedDouble, door: DoorOpen, window: WindowGlyph, key: KeyRound,
  book: BookOpen, books: Library, car: Car, hand: Hand, eye: Eye, look: ScanEye, mouth: MouthGlyph,
  foot: Footprints, nose: NoseGlyph, ear: Ear, mother: MotherGlyph, father: User, baby: Baby,
  child: PersonStanding, family: Users, friend: UsersRound, sun: Sun, rain: CloudRain,
  snow: Snowflake, wind: Wind, cloud: Cloud, weather: CloudSun, eat: Utensils, drink: CupSoda,
  sleep: BedSingle, speak: Speech, write: PenLine, run: Footprints, tree: TreeDeciduous,
  flower: Flower2, moon: Moon, coffee: Coffee, tea: TeacupGlyph, rice: RiceBowlGlyph,
  noodles: Soup, meat: Drumstick, banana: Banana, citrus: Citrus, watermelon: WatermelonGlyph,
  mountain: Mountain, river: Waves, train: TrainFront, phone: Smartphone, laptop: Laptop,
  shoe: ShoeGlyph, shirt: Shirt, backpack: Backpack, gift: Gift, umbrella: Umbrella, plane: Plane,
  watch: Watch, cold: ThermometerSnowflake, hot: ThermometerSun,
}

export function VocabPicture({ name, ...props }: { name?: string } & LucideProps) {
  if (!name) return null
  const fill = VOCAB_SWATCH_FILL[name]
  if (fill) {
    const size = props.size ?? 24
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={props.className} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" fill={fill} stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" />
      </svg>
    )
  }
  const Icon = ICONS[name as keyof typeof ICONS]
  if (!Icon) return null
  return <Icon aria-hidden="true" {...props} />
}
