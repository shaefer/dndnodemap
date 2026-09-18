import type { Pattern, Slot, Theme } from "./types";

// Plain-text introspection of a pattern's slot sequence — for tooling that
// wants to show a human what a pattern is actually built from (word bank
// sizes, fixed connectors, syllable-chain pool sizes) without dumping the
// full word lists.
export function describeSlot(slot: Slot): string {
  switch (slot.type) {
    case "literal":
      return `literal(${JSON.stringify(slot.text)})`;
    case "bank":
      return `bank(${slot.bank.length} words)`;
    case "syllableChain": {
      const { start, middle, end } = slot.chain;
      return `syllableChain(start:${start.length}, middle:${middle.length}, end:${end.length})`;
    }
  }
}

export function describePattern(pattern: Pattern): string {
  return pattern.slots.map(describeSlot).join(" + ");
}

export interface NamedWordList {
  name: string;
  words: readonly string[];
}

// Every distinct named word list a theme draws from — for reviewing list
// size/variance directly (M4.13.1), not for generation itself. Dedupes by
// name (not array identity): several themes derive a second, differently
// -cased copy of the same bank for a different pattern (e.g. a capitalized
// "suffixes" for the two-word form and a lowercased twin for the compound
// form) — those are the same category to a human reviewer, so only the first
// occurrence is kept, not both.
export function listWordLists(theme: Theme): NamedWordList[] {
  const byName = new Map<string, NamedWordList>();
  let unnamed = 0;
  for (const pattern of theme.patterns) {
    for (const slot of pattern.slots) {
      if (slot.type === "bank") {
        const name = slot.name ?? `words ${++unnamed}`;
        if (!byName.has(name)) byName.set(name, { name, words: slot.bank });
      } else if (slot.type === "syllableChain") {
        const { start, middle, end } = slot.chain;
        for (const [name, words] of [
          ["start", start],
          ["middle", middle],
          ["end", end],
        ] as const) {
          if (!byName.has(name)) byName.set(name, { name, words });
        }
      }
    }
  }
  return [...byName.values()];
}
