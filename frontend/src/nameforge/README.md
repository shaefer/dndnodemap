# nameforge

A tiny, composable random-name generator: word banks + assembly patterns
("themes") produce natural-sounding names with real variance, plus the
ability to reroll a single piece of a generated name without redrawing the
whole thing.

**Standalone by design.** Nothing in this folder imports anything from
outside it — no app types, no framework, no dependencies at all. That's
deliberate: this is meant to be easy to lift out of whatever project it's
vendored into and publish as its own package. To extract it:

1. Copy this folder somewhere new.
2. Add a `package.json` (name, version, `"main"`/`"module"`/`"types"` pointing
   at a built `index.js`/`index.d.ts`).
3. Point a bundler/tsc at `index.ts` as the entry point — nothing else here
   needs to change.

## Concepts

- **Bank** — a plain array of strings (`readonly string[]`).
- **Slot** — one piece of a name: draw from a `bank`, insert a fixed
  `literal` connector (`"'s "`, `"The "`, `" & "`), or draw a `syllableChain`
  (a start/middle/end syllable pool, concatenated with no separator — the
  mechanism for invented-language-style names like elvish).
- **Pattern** — an ordered list of slots (`id` + `slots`).
- **Theme** — a named bundle of patterns (`id` + `patterns`). Themes are
  plain exported constants — no registry, no global state.

## API

```ts
import { generateName, regenerate, rerollSlot, settlementMedieval } from "nameforge";

const name = generateName(settlementMedieval); // { themeId, patternId, parts, text }
console.log(name.text); // e.g. "Ashford"

// Same pattern/shape, new words:
const restyled = regenerate(settlementMedieval, name);

// Redraw just one piece, keep the rest:
const tweaked = rerollSlot(settlementMedieval, name, 1);
```

Every generation function takes an optional `rng: () => number` as its last
argument (defaulting to `Math.random`) — pass a seeded RNG for deterministic,
reproducible output.

## Included themes

`settlementMedieval`, `poiFanciful`, `wildernessForest`/`wildernessSwamp`/
`wildernessDesert`/`wildernessTundra`/`wildernessJungle`/`wildernessPlains`,
`waterFeature`, `regionName`, and 16 race/species themes (`themes/races/`,
each using the `syllableChain` slot type for an invented native-tongue name
alongside common-tongue forms).

`themes/_shared.ts`'s `rootSuffixTheme(id, roots, suffixesCapitalized)` is a
helper for the common "root + suffix" shape — a single "[root] [suffix]" /
"The [root] [suffix]" pattern (the leading "The" is a coin-flip bank pick,
not a separate pattern) — reuse it for a new theme rather than hand-writing
the same shape again. Note this helper deliberately has no glued "compound"
form (M4.16.4) — only use it when the suffix bank is genuinely full
standalone nouns; if a theme's suffixes are real bound place-name suffixes
(like settlementMedieval's "-ford"/"-mere"), hand-write a compound pattern
the way settlement.ts does instead.
