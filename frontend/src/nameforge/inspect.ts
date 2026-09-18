import type { Pattern, Slot } from "./types";

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
