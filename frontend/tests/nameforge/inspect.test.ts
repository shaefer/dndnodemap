import { describe, expect, it } from "vitest";
import { describePattern, describeSlot } from "../../src/nameforge/inspect";
import { poiFanciful } from "../../src/nameforge/themes/poi";
import { settlementMedieval } from "../../src/nameforge/themes/settlement";
import { elvishSyllable } from "../../src/nameforge/themes/syllable";
import type { Slot } from "../../src/nameforge/types";

describe("describeSlot", () => {
  it("describes a bank slot with its word count", () => {
    const slot: Slot = { type: "bank", bank: ["a", "b", "c"] };
    expect(describeSlot(slot)).toBe("bank(3 words)");
  });

  it("describes a literal slot with its exact text, quoted", () => {
    const slot: Slot = { type: "literal", text: "The " };
    expect(describeSlot(slot)).toBe('literal("The ")');
  });

  it("describes a syllableChain slot with each pool's size", () => {
    const slot: Slot = {
      type: "syllableChain",
      chain: { start: ["a", "b"], middle: ["c"], end: ["d", "e", "f"] },
    };
    expect(describeSlot(slot)).toBe("syllableChain(start:2, middle:1, end:3)");
  });
});

describe("describePattern", () => {
  it("joins every slot's description with ' + '", () => {
    const pattern = settlementMedieval.patterns[0];
    const description = describePattern(pattern);
    expect(description).toContain(" + ");
    expect(description.split(" + ").length).toBe(pattern.slots.length);
  });

  it("produces a non-empty description for every pattern in every theme", () => {
    for (const theme of [settlementMedieval, poiFanciful, elvishSyllable]) {
      for (const pattern of theme.patterns) {
        expect(describePattern(pattern).length).toBeGreaterThan(0);
      }
    }
  });
});
