import { describe, expect, it } from "vitest";
import { eventToSymbolState } from "./index.js";

describe("eventToSymbolState", () => {
  it("maps motion events to render states", () => {
    expect(eventToSymbolState("reel_drop")).toBe("spin");
    expect(eventToSymbolState("symbol_land")).toBe("land");
    expect(eventToSymbolState("win_detected")).toBe("win");
    expect(eventToSymbolState("cluster_highlight")).toBe("win");
    expect(eventToSymbolState("cluster_remove")).toBe("disabled");
  });

  it("falls back to static for events without a dedicated state", () => {
    expect(eventToSymbolState("spin_start")).toBe("static");
    expect(eventToSymbolState("big_win_start")).toBe("static");
  });
});
