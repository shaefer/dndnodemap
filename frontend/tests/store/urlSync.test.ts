import { afterEach, describe, expect, it, vi } from "vitest";

// mapStore.ts's window/location/history access is best-effort (undefined in
// vitest's "node" test environment, per CLAUDE.md) — every other test file
// relies on that no-op fallback. This file specifically stubs a minimal
// browser-like `window` *before* importing the store, to verify the one
// behavior that only shows up when those globals actually exist: the first
// page load populating the address bar with the current map's share code,
// not just a subsequent generate()/loadMap() call.

declare global {
  // eslint-disable-next-line no-var
  var window: any;
}

afterEach(() => {
  delete (globalThis as any).window;
  vi.resetModules();
});

describe("initial load URL sync", () => {
  it("writes a share code to the address bar on first module load, without any generate()/loadMap() call", async () => {
    const replaceState = vi.fn();
    globalThis.window = {
      location: { href: "http://localhost/", search: "" },
      history: { replaceState },
    };

    vi.resetModules();
    await import("../../src/store/mapStore");

    expect(replaceState).toHaveBeenCalledTimes(1);
    const [, , urlArg] = replaceState.mock.calls[0];
    expect(String(urlArg)).toMatch(/[?&]map=[^&]+/);
  });

  it("re-encodes an old-version share code from the URL into the current codec, without looping", async () => {
    // A v1 (pre-M4.7.2) code for seed=12345/targetNodeCount=49/gridCols=10/
    // gridRows=8, hand-built the same way shareCode.test.ts's v1 regression
    // test does. Loading it should decode fine, generate the map, and
    // rewrite the bar with the *current* codec version's encoding of those
    // same decoded params — a single replaceState call, not a loop.
    const v1Bytes = new Uint8Array(15);
    v1Bytes[0] = 1;
    v1Bytes[3] = 0x30;
    v1Bytes[4] = 0x39; // seed = 12345
    v1Bytes[5] = 49;
    v1Bytes[6] = (10 & 0x0f) | ((8 & 0x0f) << 4);
    v1Bytes[7] = Math.round(0.2 * 255);
    v1Bytes[8] = Math.round(0.55 * 255);
    v1Bytes[9] = 50;
    v1Bytes[10] = 25;
    v1Bytes[11] = 70;
    v1Bytes[12] = 15;
    v1Bytes[13] = 25;
    v1Bytes[14] = 0;
    let binary = "";
    for (const b of v1Bytes) binary += String.fromCharCode(b);
    const v1Code = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const replaceState = vi.fn();
    globalThis.window = {
      location: { href: `http://localhost/?map=${v1Code}`, search: `?map=${v1Code}` },
      history: { replaceState },
    };

    vi.resetModules();
    await import("../../src/store/mapStore");

    expect(replaceState).toHaveBeenCalledTimes(1);
    const [, , urlArg] = replaceState.mock.calls[0];
    const rewritten = new URL(String(urlArg)).searchParams.get("map");
    expect(rewritten).not.toBe(v1Code); // upgraded to the current codec version's encoding
    expect(rewritten).toBeTruthy();
  });
});
