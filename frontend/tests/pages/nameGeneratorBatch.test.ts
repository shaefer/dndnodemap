import { describe, expect, it } from "vitest";
import { ALL_THEMES } from "../../src/nameforge";
import { generateBatch, RANDOM_PATTERN, reproduceResult } from "../../src/pages/nameGeneratorBatch";

const theme = ALL_THEMES.find((t) => t.id === "settlementMedieval")!;

describe("generateBatch", () => {
  it("assigns each result its own seed (baseSeed + index)", () => {
    const batch = generateBatch(theme, RANDOM_PATTERN, 100, 5);
    expect(batch.map((r) => r.seed)).toEqual([100, 101, 102, 103, 104]);
    expect(batch.map((r) => r.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("is fully reproducible — regenerating the same batch gives identical text", () => {
    const a = generateBatch(theme, RANDOM_PATTERN, 4242, 10);
    const b = generateBatch(theme, RANDOM_PATTERN, 4242, 10);
    expect(a.map((r) => r.text)).toEqual(b.map((r) => r.text));
    expect(a.map((r) => r.patternId)).toEqual(b.map((r) => r.patternId));
  });

  it("in random-pattern mode, each individual result is reproducible from only its own recorded metadata", () => {
    // Regression test for a real bug: reproducing a "random pattern" result by
    // calling generateFromPattern(patternId, makeRng(seed)) directly skips the
    // rng() draw generateName uses to pick the pattern, silently desyncing the
    // rest of the sequence and producing different text even though patternId
    // matches. reproduceResult must dispatch through generateName again for
    // any row where patternForced is false.
    const batch = generateBatch(theme, RANDOM_PATTERN, 100, 8);
    for (const row of batch) {
      expect(row.patternForced).toBe(false);
      const reproduced = reproduceResult(theme, row);
      expect(reproduced.text).toBe(row.text);
      expect(reproduced.patternId).toBe(row.patternId);
    }
  });

  it("in forced-pattern mode, every result uses exactly the requested pattern and is reproducible", () => {
    const patternId = theme.patterns[0].id;
    const batch = generateBatch(theme, patternId, 500, 6);
    for (const row of batch) {
      expect(row.patternForced).toBe(true);
      expect(row.patternId).toBe(patternId);
      const reproduced = reproduceResult(theme, row);
      expect(reproduced.text).toBe(row.text);
    }
  });

  it("produces non-empty text for every registered theme", () => {
    for (const t of ALL_THEMES) {
      const batch = generateBatch(t, RANDOM_PATTERN, 1, 3);
      for (const row of batch) expect(row.text.length).toBeGreaterThan(0);
    }
  });
});
