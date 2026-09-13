import seedrandom from "seedrandom";

// RngFn is the callable type returned by seedrandom — () => number in [0, 1)
export type RngFn = () => number;

// Create a seeded RNG from a numeric seed.
// Converts the number to a string — seedrandom accepts any string as a seed.
// Same seed always produces the same sequence.
export function makeRng(seed: number): RngFn {
  return seedrandom(String(seed));
}

// Integer in [min, max] inclusive
export function randInt(rng: RngFn, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Pick a random element from an array — array must be non-empty
export function randPick<T>(rng: RngFn, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Shuffle array in-place using Fisher-Yates — mutates, returns void
export function shuffle<T>(rng: RngFn, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
