/**
 * Writes phosphor-field portraits to public/baby-animals/<id>.svg
 * Run: node scripts/write-baby-animal-svgs.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "public", "baby-animals")

const drawings = {
  crow: `
    <ellipse cx="32" cy="40" rx="13" ry="10" fill="#1a1a22"/>
    <ellipse cx="38" cy="28" rx="9" ry="8" fill="#22222c"/>
    <polygon points="46,28 58,30 46,33" fill="#e07a2a"/>
    <circle cx="41" cy="26" r="1.6" fill="#f4f0e4"/>
    <ellipse cx="22" cy="38" rx="8" ry="3" fill="#2a2a36" transform="rotate(-25 22 38)"/>
    <path d="M28 48 Q32 54 36 48" fill="none" stroke="#111" stroke-width="1.4"/>`,
  otter: `
    <ellipse cx="32" cy="38" rx="16" ry="11" fill="#8b5a3c"/>
    <ellipse cx="44" cy="30" rx="9" ry="8" fill="#a56b47"/>
    <ellipse cx="18" cy="42" rx="6" ry="3.5" fill="#6e432c"/>
    <circle cx="47" cy="28" r="1.5" fill="#1a120c"/>
    <circle cx="42" cy="28" r="1.5" fill="#1a120c"/>
    <ellipse cx="50" cy="32" rx="3" ry="1.6" fill="#3a2418"/>
    <path d="M40 34 Q44 36 48 34" stroke="#3a2418" fill="none" stroke-width="0.8"/>
    <rect x="20" y="44" width="4" height="8" rx="1" fill="#c9b48a"/>
    <rect x="28" y="44" width="4" height="8" rx="1" fill="#c9b48a"/>`,
  hedgehog: `
    <polygon points="18,36 22,18 28,32 32,14 38,32 44,16 50,36" fill="#4a3a2a"/>
    <ellipse cx="34" cy="40" rx="16" ry="10" fill="#c4a07a"/>
    <ellipse cx="46" cy="38" rx="7" ry="6" fill="#e0c8a8"/>
    <circle cx="48" cy="36" r="1.3" fill="#1a120c"/>
    <ellipse cx="52" cy="40" rx="2.4" ry="1.4" fill="#c47a8a"/>
    <circle cx="22" cy="42" r="2.2" fill="#8a6a4a"/>
    <circle cx="28" cy="46" r="2" fill="#8a6a4a"/>`,
  fox: `
    <ellipse cx="32" cy="42" rx="14" ry="10" fill="#e07a32"/>
    <polygon points="22,24 26,34 18,34" fill="#e07a32"/>
    <polygon points="42,24 46,34 38,34" fill="#e07a32"/>
    <polygon points="23,26 25,32 21,32" fill="#f4e8d8"/>
    <polygon points="41,26 43,32 39,32" fill="#f4e8d8"/>
    <ellipse cx="32" cy="36" rx="10" ry="8" fill="#e88a42"/>
    <ellipse cx="32" cy="40" rx="5" ry="4" fill="#f4e8d8"/>
    <circle cx="28" cy="34" r="1.4" fill="#1a120c"/>
    <circle cx="36" cy="34" r="1.4" fill="#1a120c"/>
    <ellipse cx="32" cy="38" rx="1.6" ry="1.1" fill="#2a1810"/>
    <path d="M18 44 Q14 50 22 48" fill="#e07a32"/>`,
  owl: `
    <ellipse cx="32" cy="40" rx="14" ry="13" fill="#7a6248"/>
    <circle cx="25" cy="34" r="7" fill="#f0e6c8"/>
    <circle cx="39" cy="34" r="7" fill="#f0e6c8"/>
    <circle cx="25" cy="34" r="3.2" fill="#2a4a2a"/>
    <circle cx="39" cy="34" r="3.2" fill="#2a4a2a"/>
    <circle cx="26" cy="33" r="1" fill="#f4f0e4"/>
    <circle cx="40" cy="33" r="1" fill="#f4f0e4"/>
    <polygon points="32,38 28,44 36,44" fill="#e0a040"/>
    <polygon points="20,26 24,32 18,32" fill="#5a4834"/>
    <polygon points="44,26 46,32 40,32" fill="#5a4834"/>`,
  seal: `
    <ellipse cx="34" cy="38" rx="18" ry="12" fill="#c8d0d6"/>
    <ellipse cx="48" cy="32" rx="9" ry="8" fill="#d8e0e6"/>
    <circle cx="50" cy="30" r="1.5" fill="#1a120c"/>
    <circle cx="45" cy="30" r="1.5" fill="#1a120c"/>
    <ellipse cx="54" cy="34" rx="3.5" ry="2.2" fill="#3a3030"/>
    <ellipse cx="20" cy="36" rx="6" ry="3" fill="#a8b0b8"/>
    <ellipse cx="28" cy="50" rx="5" ry="2.4" fill="#a8b0b8"/>
    <circle cx="46" cy="36" r="1.2" fill="#e8a0b0"/>
    <circle cx="50" cy="36" r="1.2" fill="#e8a0b0"/>`,
  duckling: `
    <ellipse cx="32" cy="40" rx="14" ry="11" fill="#f2d24a"/>
    <circle cx="42" cy="30" r="8" fill="#f6dc62"/>
    <ellipse cx="50" cy="32" rx="5" ry="2.2" fill="#e07a2a"/>
    <circle cx="44" cy="28" r="1.5" fill="#1a120c"/>
    <path d="M18 38 Q12 32 20 34" fill="#f2d24a"/>
    <path d="M28 50 Q32 56 36 50" fill="none" stroke="#e07a2a" stroke-width="1.6"/>
    <ellipse cx="22" cy="42" rx="4" ry="2" fill="#e8c43a"/>`,
  lamb: `
    <circle cx="24" cy="36" r="7" fill="#f4f0e8"/>
    <circle cx="36" cy="32" r="8" fill="#f7f3ec"/>
    <circle cx="40" cy="42" r="7" fill="#efeae0"/>
    <circle cx="28" cy="44" r="6.5" fill="#f4f0e8"/>
    <ellipse cx="46" cy="34" rx="7" ry="6" fill="#f0e6d4"/>
    <circle cx="48" cy="32" r="1.3" fill="#1a120c"/>
    <ellipse cx="52" cy="36" rx="2" ry="1.3" fill="#e8b0c0"/>
    <rect x="24" y="48" width="3" height="7" rx="1" fill="#d8c8a8"/>
    <rect x="34" y="48" width="3" height="7" rx="1" fill="#d8c8a8"/>
    <rect x="29" y="48" width="3" height="7" rx="1" fill="#d8c8a8"/>
    <rect x="39" y="48" width="3" height="7" rx="1" fill="#d8c8a8"/>`,
  fawn: `
    <ellipse cx="32" cy="42" rx="14" ry="10" fill="#c48a4a"/>
    <ellipse cx="42" cy="30" rx="8" ry="7" fill="#d49a58"/>
    <polygon points="36,18 38,28 34,28" fill="#c48a4a"/>
    <polygon points="46,18 48,28 44,28" fill="#c48a4a"/>
    <circle cx="44" cy="28" r="1.3" fill="#1a120c"/>
    <circle cx="38" cy="28" r="1.3" fill="#1a120c"/>
    <circle cx="26" cy="40" r="1.6" fill="#f4ead8"/>
    <circle cx="32" cy="36" r="1.4" fill="#f4ead8"/>
    <circle cx="22" cy="44" r="1.3" fill="#f4ead8"/>
    <ellipse cx="48" cy="32" rx="2.2" ry="1.4" fill="#3a2418"/>
    <rect x="26" y="50" width="3" height="8" fill="#a07038"/>
    <rect x="36" y="50" width="3" height="8" fill="#a07038"/>`,
  chick: `
    <circle cx="32" cy="38" r="14" fill="#f6d84a"/>
    <circle cx="32" cy="24" r="8" fill="#f8e060"/>
    <polygon points="32,24 28,30 36,30" fill="#e07a2a"/>
    <circle cx="29" cy="22" r="1.4" fill="#1a120c"/>
    <circle cx="35" cy="22" r="1.4" fill="#1a120c"/>
    <ellipse cx="22" cy="38" rx="5" ry="3" fill="#efc83a"/>
    <ellipse cx="42" cy="38" rx="5" ry="3" fill="#efc83a"/>
    <path d="M28 50 Q32 54 36 50" fill="none" stroke="#e07a2a" stroke-width="1.5"/>
    <circle cx="38" cy="34" r="2" fill="#f0a0a8"/>`,
  puppy: `
    <ellipse cx="32" cy="42" rx="14" ry="11" fill="#c4a070"/>
    <ellipse cx="32" cy="30" rx="10" ry="9" fill="#d4b080"/>
    <ellipse cx="18" cy="32" rx="6" ry="9" fill="#8a6238"/>
    <ellipse cx="46" cy="34" rx="6" ry="8" fill="#8a6238"/>
    <circle cx="28" cy="28" r="1.6" fill="#1a120c"/>
    <circle cx="36" cy="28" r="1.6" fill="#1a120c"/>
    <ellipse cx="32" cy="34" rx="2.4" ry="1.6" fill="#3a2418"/>
    <ellipse cx="32" cy="38" rx="4" ry="3" fill="#f0d8c0"/>
    <circle cx="24" cy="34" r="1.8" fill="#e8a0b0"/>
    <circle cx="40" cy="34" r="1.8" fill="#e8a0b0"/>`,
  bunny: `
    <ellipse cx="24" cy="18" rx="4" ry="12" fill="#f0e0d0"/>
    <ellipse cx="38" cy="16" rx="4" ry="13" fill="#f0e0d0"/>
    <ellipse cx="24" cy="20" rx="2" ry="8" fill="#f0b0c0"/>
    <ellipse cx="38" cy="18" rx="2" ry="8" fill="#f0b0c0"/>
    <ellipse cx="32" cy="40" rx="13" ry="12" fill="#f4e8dc"/>
    <ellipse cx="32" cy="32" rx="9" ry="8" fill="#f7eee6"/>
    <circle cx="28" cy="30" r="1.4" fill="#1a120c"/>
    <circle cx="36" cy="30" r="1.4" fill="#1a120c"/>
    <ellipse cx="32" cy="35" rx="1.8" ry="1.2" fill="#e8a0b0"/>
    <ellipse cx="26" cy="48" rx="4" ry="3" fill="#f0e0d0"/>`,
  kitten: `
    <polygon points="18,22 24,34 14,36" fill="#d8a858"/>
    <polygon points="46,22 50,36 40,34" fill="#d8a858"/>
    <polygon points="20,26 22,33 17,34" fill="#f0c0c8"/>
    <polygon points="44,26 47,34 42,33" fill="#f0c0c8"/>
    <ellipse cx="32" cy="40" rx="14" ry="12" fill="#e0b468"/>
    <ellipse cx="32" cy="34" rx="10" ry="9" fill="#e8c078"/>
    <circle cx="27" cy="32" r="1.5" fill="#2a4a2a"/>
    <circle cx="37" cy="32" r="1.5" fill="#2a4a2a"/>
    <ellipse cx="32" cy="37" rx="1.6" ry="1.1" fill="#e8a0b0"/>
    <path d="M22 38 H28 M36 38 H42" stroke="#c49050" stroke-width="0.7"/>
    <path d="M18 50 Q32 56 46 50" fill="none" stroke="#d8a858" stroke-width="2"/>`,
  piglet: `
    <ellipse cx="32" cy="40" rx="15" ry="12" fill="#f2b8c4"/>
    <ellipse cx="32" cy="32" rx="11" ry="9" fill="#f6c8d0"/>
    <ellipse cx="18" cy="28" rx="4" ry="6" fill="#f0a8b8"/>
    <ellipse cx="46" cy="28" rx="4" ry="6" fill="#f0a8b8"/>
    <ellipse cx="32" cy="38" rx="5" ry="3.4" fill="#e890a4"/>
    <ellipse cx="30" cy="38" rx="0.9" ry="1.2" fill="#3a2418"/>
    <ellipse cx="34" cy="38" rx="0.9" ry="1.2" fill="#3a2418"/>
    <circle cx="26" cy="30" r="1.4" fill="#1a120c"/>
    <circle cx="38" cy="30" r="1.4" fill="#1a120c"/>
    <circle cx="22" cy="36" r="2" fill="#f0a0b0"/>`,
  penguin: `
    <ellipse cx="32" cy="40" rx="13" ry="16" fill="#1c1c28"/>
    <ellipse cx="32" cy="42" rx="8" ry="12" fill="#f4f0e4"/>
    <circle cx="32" cy="24" r="8" fill="#1c1c28"/>
    <ellipse cx="32" cy="26" rx="5" ry="4" fill="#f4f0e4"/>
    <circle cx="29" cy="24" r="1.3" fill="#f4f0e4"/>
    <circle cx="35" cy="24" r="1.3" fill="#f4f0e4"/>
    <polygon points="32,26 28,30 36,30" fill="#e07a2a"/>
    <ellipse cx="18" cy="40" rx="4" ry="7" fill="#1c1c28"/>
    <ellipse cx="46" cy="40" rx="4" ry="7" fill="#1c1c28"/>
    <path d="M26 54 H38" stroke="#e07a2a" stroke-width="2"/>`,
  capybara: `
    <ellipse cx="32" cy="42" rx="18" ry="11" fill="#8a6a48"/>
    <ellipse cx="42" cy="34" rx="11" ry="9" fill="#9a7a54"/>
    <ellipse cx="22" cy="30" rx="3" ry="4" fill="#7a5a3a"/>
    <ellipse cx="38" cy="28" rx="3" ry="4" fill="#7a5a3a"/>
    <circle cx="46" cy="32" r="1.4" fill="#1a120c"/>
    <circle cx="38" cy="32" r="1.4" fill="#1a120c"/>
    <ellipse cx="48" cy="38" rx="3" ry="2" fill="#5a3a28"/>
    <rect x="24" y="50" width="4" height="7" rx="1" fill="#6a4a30"/>
    <rect x="36" y="50" width="4" height="7" rx="1" fill="#6a4a30"/>`,
  raccoon: `
    <ellipse cx="32" cy="42" rx="14" ry="11" fill="#8a8480"/>
    <ellipse cx="32" cy="32" rx="10" ry="9" fill="#9a948e"/>
    <ellipse cx="20" cy="24" rx="4" ry="7" fill="#6a6460"/>
    <ellipse cx="44" cy="24" rx="4" ry="7" fill="#6a6460"/>
    <ellipse cx="26" cy="32" rx="5" ry="3.5" fill="#1a1a22"/>
    <ellipse cx="38" cy="32" rx="5" ry="3.5" fill="#1a1a22"/>
    <circle cx="26" cy="32" r="1.4" fill="#f4f0e4"/>
    <circle cx="38" cy="32" r="1.4" fill="#f4f0e4"/>
    <ellipse cx="32" cy="38" rx="3" ry="2" fill="#f4f0e4"/>
    <path d="M18 48 Q24 52 22 44" fill="#7a7470"/>
    <rect x="28" y="50" width="3" height="6" fill="#5a5450"/>
    <rect x="34" y="50" width="3" height="6" fill="#5a5450"/>`,
  mouse: `
    <circle cx="18" cy="24" r="7" fill="#f0b0c0"/>
    <circle cx="20" cy="24" r="4" fill="#f8c8d4"/>
    <circle cx="40" cy="22" r="7" fill="#f0b0c0"/>
    <circle cx="38" cy="22" r="4" fill="#f8c8d4"/>
    <ellipse cx="32" cy="40" rx="13" ry="11" fill="#c8c0b8"/>
    <ellipse cx="32" cy="34" rx="8" ry="7" fill="#d8d0c8"/>
    <circle cx="28" cy="32" r="1.3" fill="#1a120c"/>
    <circle cx="36" cy="32" r="1.3" fill="#1a120c"/>
    <ellipse cx="32" cy="36" rx="1.5" ry="1" fill="#e8a0b0"/>
    <path d="M44 44 Q56 36 52 50" fill="none" stroke="#c8c0b8" stroke-width="1.6"/>`,
  goat: `
    <ellipse cx="32" cy="42" rx="14" ry="11" fill="#e8e0d4"/>
    <ellipse cx="34" cy="30" rx="9" ry="8" fill="#f0e8dc"/>
    <rect x="24" y="16" width="2.4" height="12" rx="1" fill="#d8d0c4" transform="rotate(-12 25 22)"/>
    <rect x="38" y="16" width="2.4" height="12" rx="1" fill="#d8d0c4" transform="rotate(12 39 22)"/>
    <circle cx="31" cy="28" r="1.3" fill="#1a120c"/>
    <circle cx="38" cy="28" r="1.3" fill="#1a120c"/>
    <ellipse cx="36" cy="34" rx="3" ry="2" fill="#e8b0c0"/>
    <rect x="24" y="50" width="3" height="8" fill="#c8c0b4"/>
    <rect x="34" y="50" width="3" height="8" fill="#c8c0b4"/>
    <path d="M18 40 Q14 34 20 36" fill="#e8e0d4"/>`,
  axolotl: `
    <ellipse cx="32" cy="40" rx="16" ry="9" fill="#f4b8c8"/>
    <ellipse cx="46" cy="34" rx="8" ry="7" fill="#f6c4d0"/>
    <path d="M18 28 Q12 22 20 32 Q14 26 22 34" fill="#e890b0"/>
    <path d="M22 22 Q18 14 26 28" fill="#e890b0"/>
    <path d="M42 22 Q46 12 40 28" fill="#e890b0"/>
    <path d="M50 26 Q58 20 48 34" fill="#e890b0"/>
    <circle cx="48" cy="32" r="1.5" fill="#1a120c"/>
    <circle cx="42" cy="32" r="1.5" fill="#1a120c"/>
    <ellipse cx="50" cy="36" rx="2.4" ry="1.4" fill="#e07090"/>
    <path d="M16 42 Q10 48 20 46" fill="#f4b8c8"/>`,
  cub: `
    <ellipse cx="32" cy="42" rx="15" ry="12" fill="#8a5a32"/>
    <circle cx="32" cy="30" r="11" fill="#9a6a3e"/>
    <circle cx="20" cy="22" r="5" fill="#8a5a32"/>
    <circle cx="44" cy="22" r="5" fill="#8a5a32"/>
    <circle cx="27" cy="28" r="1.6" fill="#1a120c"/>
    <circle cx="37" cy="28" r="1.6" fill="#1a120c"/>
    <ellipse cx="32" cy="34" rx="2.2" ry="1.6" fill="#3a2418"/>
    <ellipse cx="32" cy="38" rx="4" ry="3" fill="#d4b090"/>
    <circle cx="24" cy="34" r="2" fill="#c08070"/>
    <circle cx="40" cy="34" r="2" fill="#c08070"/>`,
  foal: `
    <ellipse cx="30" cy="40" rx="13" ry="10" fill="#c49058"/>
    <ellipse cx="44" cy="28" rx="8" ry="7" fill="#d4a068"/>
    <rect x="40" y="16" width="2" height="10" fill="#c49058"/>
    <rect x="46" y="16" width="2" height="10" fill="#c49058"/>
    <circle cx="46" cy="26" r="1.3" fill="#1a120c"/>
    <circle cx="41" cy="26" r="1.3" fill="#1a120c"/>
    <ellipse cx="50" cy="30" rx="2.6" ry="1.5" fill="#3a2418"/>
    <rect x="22" y="48" width="3" height="10" fill="#a07040"/>
    <rect x="30" y="48" width="3" height="10" fill="#a07040"/>
    <path d="M18 40 Q12 44 20 46" fill="#c49058"/>
    <path d="M48 36 Q54 42 46 40" fill="#c49058"/>`,
  gosling: `
    <ellipse cx="32" cy="42" rx="14" ry="11" fill="#d8c878"/>
    <circle cx="42" cy="30" r="8" fill="#e0d088"/>
    <ellipse cx="50" cy="32" rx="5" ry="2" fill="#e07a2a"/>
    <circle cx="44" cy="28" r="1.4" fill="#1a120c"/>
    <path d="M18 40 Q12 34 20 36" fill="#c8b868"/>
    <ellipse cx="24" cy="44" rx="5" ry="3" fill="#c8b868"/>
    <path d="M28 52 Q32 56 36 52" fill="none" stroke="#e07a2a" stroke-width="1.5"/>`,
  wolf: `
    <ellipse cx="32" cy="42" rx="14" ry="11" fill="#7a848c"/>
    <polygon points="18,18 24,34 14,34" fill="#6a747c"/>
    <polygon points="46,18 50,34 40,34" fill="#6a747c"/>
    <ellipse cx="32" cy="32" rx="10" ry="9" fill="#8a949c"/>
    <ellipse cx="32" cy="38" rx="5" ry="4" fill="#e8e0d4"/>
    <circle cx="27" cy="30" r="1.5" fill="#1a120c"/>
    <circle cx="37" cy="30" r="1.5" fill="#1a120c"/>
    <ellipse cx="32" cy="35" rx="1.8" ry="1.2" fill="#2a1810"/>
    <path d="M16 46 Q12 52 22 48" fill="#6a747c"/>
    <path d="M22 38 H28 M36 38 H42" stroke="#5a646c" stroke-width="0.7"/>`,
}

function wrap(id, inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${id}">
  <defs>
    <radialGradient id="crt" cx="46%" cy="38%">
      <stop offset="0%" stop-color="#4aa0c8"/>
      <stop offset="55%" stop-color="#1a4a68"/>
      <stop offset="100%" stop-color="#071018"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" fill="url(#crt)"/>
  <rect x="2" y="2" width="60" height="60" fill="none" stroke="#8ec8e0" stroke-opacity="0.18"/>
  ${inner}
</svg>
`
}

mkdirSync(outDir, { recursive: true })
for (const [id, inner] of Object.entries(drawings)) {
  writeFileSync(join(outDir, `${id}.svg`), wrap(id, inner))
}
console.log(`wrote ${Object.keys(drawings).length} portraits to ${outDir}`)
