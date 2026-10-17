import { describe, expect, it } from "vitest"
import { bestVoice, neuralSpeechUrl, scoreVoice, speechChunks } from "@/lib/vocab-speech"

function voice(name: string, lang: string, extra: Partial<SpeechSynthesisVoice> = {}): SpeechSynthesisVoice {
  return { name, lang, default: false, localService: true, voiceURI: name, ...extra } as SpeechSynthesisVoice
}

describe("vocab speech", () => {
  it("never picks Apple's Eloquence or novelty voices", () => {
    expect(scoreVoice(voice("Eddy (French (France))", "fr-FR"), "fr-FR")).toBeNull()
    expect(scoreVoice(voice("Grandma (Japanese (Japan))", "ja-JP"), "ja-JP")).toBeNull()
    expect(scoreVoice(voice("Zarvox", "en-US"), "en-US")).toBeNull()
  })

  it("prefers Premium, then Enhanced, then a plain voice in the right region", () => {
    const voices = [
      voice("Eddy (French (France))", "fr-FR"),
      voice("Amélie", "fr-CA"),
      voice("Thomas", "fr-FR"),
      voice("Thomas (Enhanced)", "fr-FR"),
      voice("Audrey (Premium)", "fr-FR"),
      voice("Anna", "de-DE"),
    ]
    expect(bestVoice(voices, "fr-FR")?.name).toBe("Audrey (Premium)")
    expect(bestVoice(voices.slice(0, 4), "fr-FR")?.name).toBe("Thomas (Enhanced)")
    expect(bestVoice(voices.slice(0, 3), "fr-FR")?.name).toBe("Thomas")
    expect(bestVoice([voice("Eddy (German (Germany))", "de-DE")], "de-DE")).toBeNull()
  })

  it("cuts long text at sentence and comma breaks under the neural limit", () => {
    const text = "Un mot. ".repeat(30) + "Une phrase très longue, avec des virgules, qui continue encore et encore sans point final"
    const chunks = speechChunks(text, 60)
    expect(chunks.every((c) => c.length <= 60)).toBe(true)
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " ").trim())
    expect(speechChunks("  ")).toEqual([])
  })

  it("asks the neural voice for the right language", () => {
    const url = new URL(neuralSpeechUrl("你好", "zh-CN"))
    expect(url.searchParams.get("tl")).toBe("zh-CN")
    expect(url.searchParams.get("q")).toBe("你好")
    expect(new URL(neuralSpeechUrl("bonjour", "fr-FR", 0, 1, true)).searchParams.get("ttsspeed")).toBe("0.3")
  })
})
