import type { Bank, GeneratedName, Pattern, Rng, Slot, SyllableChain, Theme } from "./types";

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Picks a pattern proportional to its weight (default 1 when unset) rather
// than uniformly — the mechanism behind marking a pattern rare/exotic.
function pickPattern(patterns: readonly Pattern[], rng: Rng): Pattern {
  const total = patterns.reduce((sum, p) => sum + (p.weight ?? 1), 0);
  let roll = rng() * total;
  for (const p of patterns) {
    roll -= p.weight ?? 1;
    if (roll < 0) return p;
  }
  return patterns[patterns.length - 1];
}

// A flat bank picks one word uniformly. A categorized bank picks a category
// uniformly first, then a word uniformly within it — two draws instead of
// one, so a large category never dominates a small one.
function pickFromBank(bank: Bank, rng: Rng): string {
  if ("categories" in bank) return pick(pick(bank.categories, rng).words, rng);
  return pick(bank, rng);
}

// Concatenating syllables regularly lands the same letter on both sides of a
// join — "Dill" + "ly" -> "Dillly", "Sess" + "sha" -> "Sesssha", "Zar" +
// "aa" + "aal" -> "Zaraaaal". Doubles read as deliberate; triples and longer
// read as typos, so any run of 3+ identical letters collapses back to 2.
// Boundary syllables survive intact (a run only ever shrinks to two), so a
// chain still starts with one of its start syllables and ends with one of
// its end syllables.
function collapseLetterRuns(s: string): string {
  return s.replace(/(.)\1{2,}/gi, "$1$1");
}

// Drawing the same syllable twice in a row stutters — "Ghyl"+"uun"+"uun"+
// "uun", "Kriv"+"iss"+"iss". Excluding the previous syllable from the pool
// costs no extra rng() draws (one pick either way) and never starves: the
// filter is skipped if it would empty the pool.
function pickAvoiding(pool: readonly string[], previous: string | null, rng: Rng): string {
  const options = previous === null ? pool : pool.filter((s) => s !== previous);
  return pick(options.length > 0 ? options : pool, rng);
}

function renderSyllableChain(chain: SyllableChain, rng: Rng): string {
  const min = chain.minMiddle ?? 0;
  const max = chain.maxMiddle ?? 1;
  const count = min + Math.floor(rng() * (max - min + 1));
  let s = pick(chain.start, rng);
  let previous: string | null = null;
  for (let i = 0; i < count; i++) {
    previous = pickAvoiding(chain.middle, previous, rng);
    s += previous;
  }
  s += pickAvoiding(chain.end, previous, rng);
  return collapseLetterRuns(s);
}

function renderSlot(slot: Slot, rng: Rng): string {
  switch (slot.type) {
    case "literal":
      return slot.text;
    case "bank":
      return pickFromBank(slot.bank, rng);
    case "syllableChain":
      return renderSyllableChain(slot.chain, rng);
  }
}

function renderPattern(themeId: string, pattern: Pattern, rng: Rng): GeneratedName {
  const parts = pattern.slots.map((slot) => renderSlot(slot, rng));
  return { themeId, patternId: pattern.id, parts, text: parts.join("") };
}

function findPattern(theme: Theme, patternId: string): Pattern | undefined {
  return theme.patterns.find((p) => p.id === patternId);
}

// Picks a random pattern from the theme and renders every slot — a brand new
// name, structure included.
export function generateName(theme: Theme, rng: Rng = Math.random): GeneratedName {
  return renderPattern(theme.id, pickPattern(theme.patterns, rng), rng);
}

// Generates from a specific, caller-chosen pattern rather than a random one —
// the mechanism a caller needs to deliberately exercise/compare one exact
// pattern (e.g. a name-generator test/calibration tool) instead of always
// getting whatever generateName happens to roll.
export function generateFromPattern(theme: Theme, patternId: string, rng: Rng = Math.random): GeneratedName {
  const pattern = findPattern(theme, patternId);
  if (!pattern) throw new Error(`Theme "${theme.id}" has no pattern "${patternId}"`);
  return renderPattern(theme.id, pattern, rng);
}

// Keeps the same pattern (same "shape") as an existing generated name, but
// redraws every slot — same style, new words.
export function regenerate(theme: Theme, generated: GeneratedName, rng: Rng = Math.random): GeneratedName {
  const pattern = findPattern(theme, generated.patternId) ?? pickPattern(theme.patterns, rng);
  return renderPattern(theme.id, pattern, rng);
}

// Redraws exactly one slot of an existing generated name, leaving every other
// part untouched — the "reroll just this piece" hook.
export function rerollSlot(theme: Theme, generated: GeneratedName, slotIndex: number, rng: Rng = Math.random): GeneratedName {
  const pattern = findPattern(theme, generated.patternId);
  if (!pattern || slotIndex < 0 || slotIndex >= pattern.slots.length) return generated;
  const parts = [...generated.parts];
  parts[slotIndex] = renderSlot(pattern.slots[slotIndex], rng);
  return { ...generated, parts, text: parts.join("") };
}
