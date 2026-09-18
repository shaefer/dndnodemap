import type { GeneratedName, Pattern, Rng, Slot, SyllableChain, Theme } from "./types";

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

function renderSyllableChain(chain: SyllableChain, rng: Rng): string {
  const min = chain.minMiddle ?? 0;
  const max = chain.maxMiddle ?? 1;
  const count = min + Math.floor(rng() * (max - min + 1));
  let s = pick(chain.start, rng);
  for (let i = 0; i < count; i++) s += pick(chain.middle, rng);
  s += pick(chain.end, rng);
  return s;
}

function renderSlot(slot: Slot, rng: Rng): string {
  switch (slot.type) {
    case "literal":
      return slot.text;
    case "bank":
      return pick(slot.bank, rng);
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
  return renderPattern(theme.id, pick(theme.patterns, rng), rng);
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
  const pattern = findPattern(theme, generated.patternId) ?? pick(theme.patterns, rng);
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
