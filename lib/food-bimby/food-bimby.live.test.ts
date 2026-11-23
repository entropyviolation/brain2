/**
 * Live: the real local model and the real USDA / Open Food Facts. Skipped unless FOOD_LIVE=1.
 * `FOOD_LIVE=1 npx vitest run lib/food-bimby/food-bimby.live.test.ts`
 */
import { describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { searchFoodsOnline } from "@/lib/kitchen-search"
import { useKitchenStore } from "@/lib/kitchen-store"
import { tryFood } from "./run"

const LINE =
  "everything I've eaten today yesterday and the day before. soup which was 1 can of corn 3 smallish medium yukon gold potatoes, a splish or two of heavy whipping cream, chicken broth (maybe like half a boxy little container), 4 thick strips of bacon, some water. (turned out really good would make again maybe save the recipe and create a recipe card). Ate the whole thing over several sittings as well as a BIG container of POM juice 100% pomegranate juice maybe look up the calorie and nutrition info for that. next day had a whole container of pumpkin goat cheese ravioli from target in sauce with shredded cheddar cheese, olive oil (from garlic confit), and splish heavy cream. Also had 2 apple redbulls and 2 mexican cokes (150 calorie ones). Now the plan with this rice is eat it with some fishwife tinned fish, kewpie, sauce. PLEASE LOG ALL THIS FOOD IN FOOD TRACKING INCLUDING RESEARCHING AND LOGGING ALL NUTRITIONAL INFO!!!!"

describe.skipIf(!process.env.FOOD_LIVE)("Food BIMBY, live", () => {
  it("reads, researches and files the pasted day", async () => {
    resetAllStores()
    useKitchenStore.setState({ foods: [], recipes: [], plates: [], stock: [] })
    // searchFoodsOnline refuses under Vitest; the live run calls the network itself.
    const vitest = process.env.VITEST
    delete process.env.VITEST
    try {
      const reply = await tryFood(LINE, new Date(), { call: ollamaCall("qwen2.5:14b-instruct"), search: searchFoodsOnline })
      console.log(reply?.route + "\n" + reply?.text)
      expect(reply?.route).toBe("FOOD · logged · model")
    } finally {
      process.env.VITEST = vitest
    }
  }, 400_000)
})
