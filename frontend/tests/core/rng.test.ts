import { describe, expect, it } from "vitest";
import { makeRng, randInt, randPick, shuffle } from "../../src/core/rng";

describe("makeRng", () => {
  it("produces identical sequences for the same seed", () => {
    const rngA = makeRng(12345);
    const rngB = makeRng(12345);
    const seqA = Array.from({ length: 1000 }, () => rngA());
    const seqB = Array.from({ length: 1000 }, () => rngB());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const rngA = makeRng(1);
    const rngB = makeRng(2);
    const seqA = Array.from({ length: 1000 }, () => rngA());
    const seqB = Array.from({ length: 1000 }, () => rngB());
    expect(seqA).not.toEqual(seqB);
  });

  it("always returns values in [0, 1)", () => {
    const rng = makeRng(42);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("randInt", () => {
  it("always returns a value in [min, max] inclusive", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 10000; i++) {
      const value = randInt(rng, 3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("can return a single-value range", () => {
    const rng = makeRng(7);
    expect(randInt(rng, 5, 5)).toBe(5);
  });
});

describe("randPick", () => {
  it("only ever returns elements from the input array", () => {
    const rng = makeRng(99);
    const arr = ["a", "b", "c", "d"];
    for (let i = 0; i < 500; i++) {
      expect(arr).toContain(randPick(rng, arr));
    }
  });
});

describe("shuffle", () => {
  it("produces the expected permutation for a known seed (pinned)", () => {
    const rng = makeRng(1234);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    shuffle(rng, arr);
    // Pinned against the actual seedrandom(1234) + Fisher-Yates output.
    expect(arr).toEqual([7, 4, 1, 2, 5, 6, 8, 3]);
  });

  it("mutates in place and preserves the same elements", () => {
    const rng = makeRng(55);
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffle(rng, arr);
    expect(arr).toHaveLength(original.length);
    expect(new Set(arr)).toEqual(new Set(original));
  });
});
