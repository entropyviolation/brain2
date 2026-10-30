/**
 * tests/next-font-google-mock.ts — Stand-in for next/font/google under Vitest
 *
 * The real module is a Next webpack loader. Tests alias `next/font/google` here
 * so a screen that loads a face does not try to download it.
 */
function face(variable: string) {
  return () => ({
    className: variable,
    variable,
    style: { fontFamily: variable },
  })
}

export const Karla = face("font-karla")
export const Bricolage_Grotesque = face("font-an-display")
export const Instrument_Sans = face("font-an-text")
export const DotGothic16 = face("font-dotgothic")
export const Fraunces = face("font-fraunces")
export const DM_Mono = face("font-dmmono")
export const Silkscreen = face("font-silkscreen")
