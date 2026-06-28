import { describe, expect, it } from "vitest";
import { parseProject, loadProject, SymbolState, ALL_SYMBOL_STATES } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

describe("SymbolState schema", () => {
  it("defines the five canonical states", () => {
    expect(SymbolState.options).toEqual(["static", "spin", "land", "win", "disabled"]);
    expect(ALL_SYMBOL_STATES).toHaveLength(5);
  });

  it("parses a symbol that carries per-state asset slots", () => {
    const base = loadProject(golden);
    const withStates = {
      ...base,
      symbols: base.symbols.map((s, i) =>
        i === 0 ? { ...s, states: { static: "ace_static.png", win: "ace_win.png" } } : s,
      ),
    };
    const res = parseProject(withStates);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.project.symbols[0]!.states?.static).toBe("ace_static.png");
      expect(res.project.symbols[0]!.states?.win).toBe("ace_win.png");
      // Unset optional states stay undefined, not blank.
      expect(res.project.symbols[0]!.states?.spin).toBeUndefined();
    }
  });

  it("rejects a wrong-typed state asset", () => {
    const base = loadProject(golden);
    const bad = { ...base, symbols: [{ ...base.symbols[0], states: { static: 123 } }] };
    expect(parseProject(bad).ok).toBe(false);
  });
});
