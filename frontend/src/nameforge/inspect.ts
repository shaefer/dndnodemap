import type { Bank, Pattern, Slot, Theme } from "./types";

function bankWordCount(bank: Bank): number {
  return "categories" in bank ? bank.categories.reduce((sum, c) => sum + c.words.length, 0) : bank.length;
}

// Plain-text introspection of a pattern's slot sequence — for tooling that
// wants to show a human what a pattern is actually built from (word bank
// sizes, fixed connectors, syllable-chain pool sizes) without dumping the
// full word lists.
export function describeSlot(slot: Slot): string {
  switch (slot.type) {
    case "literal":
      return `literal(${JSON.stringify(slot.text)})`;
    case "bank":
      return "categories" in slot.bank
        ? `bank(${slot.bank.categories.length} categories, ${bankWordCount(slot.bank)} words)`
        : `bank(${slot.bank.length} words)`;
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
  // Set on a sub-category entry, naming the aggregate bank it belongs to
  // (e.g. "colors" -> parent "roots") — lets review UI group a category
  // underneath its aggregate table instead of showing a flat, unordered list.
  parent?: string;
}

// Every distinct named word list a theme draws from — for reviewing list
// size/variance directly (M4.13.1/M4.14), not for generation itself. For a
// categorized bank, emits both the flattened aggregate (under the bank's own
// name) and one entry per category (parented to the bank's name), so a
// reviewer sees "roots" as a whole table plus "colors"/"gems"/etc. as their
// own tables underneath it. Dedupes by name (not array identity): several
// themes derive a second, differently-cased copy of the same bank for a
// different pattern (e.g. a capitalized "suffixes" for the two-word form and
// a lowercased twin for the compound form), and a category can be referenced
// both inside an aggregate and directly by another slot (regionName's nested
// pattern) — all of these are the same category to a human reviewer, so only
// the first occurrence is kept.
export function listWordLists(theme: Theme): NamedWordList[] {
  const byName = new Map<string, NamedWordList>();
  let unnamed = 0;
  for (const pattern of theme.patterns) {
    for (const slot of pattern.slots) {
      if (slot.type === "bank") {
        const name = slot.name ?? `words ${++unnamed}`;
        if ("categories" in slot.bank) {
          if (!byName.has(name)) {
            byName.set(name, { name, words: slot.bank.categories.flatMap((c) => c.words) });
          }
          for (const category of slot.bank.categories) {
            if (!byName.has(category.name)) {
              byName.set(category.name, { name: category.name, words: category.words, parent: name });
            }
          }
        } else {
          if (!byName.has(name)) byName.set(name, { name, words: slot.bank });
        }
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
