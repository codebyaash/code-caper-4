import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSecret, isWinningGuess, scoreGuess } from "./engine.ts";

describe("scoreGuess", () => {
  it("marks digits that match in the exact position", () => {
    assert.deepEqual(scoreGuess("4821", "4821"), ["exact", "exact", "exact", "exact"]);
  });

  it("marks present digits in the wrong positions", () => {
    assert.deepEqual(scoreGuess("1234", "4321"), ["misplaced", "misplaced", "misplaced", "misplaced"]);
  });

  it("marks absent digits as misses", () => {
    assert.deepEqual(scoreGuess("1234", "5678"), ["miss", "miss", "miss", "miss"]);
  });

  it("uses each repeated secret digit at most once", () => {
    assert.deepEqual(scoreGuess("1122", "2211"), ["misplaced", "misplaced", "misplaced", "misplaced"]);
    assert.deepEqual(scoreGuess("1123", "1111"), ["exact", "exact", "miss", "miss"]);
  });

  it("prioritizes exact matches before misplaced matches", () => {
    assert.deepEqual(scoreGuess("1212", "1222"), ["exact", "exact", "miss", "exact"]);
  });
});

describe("game helpers", () => {
  it("recognizes only a four-position exact match as a win", () => {
    assert.equal(isWinningGuess(["exact", "exact", "exact", "exact"]), true);
    assert.equal(isWinningGuess(["exact", "exact", "exact", "misplaced"]), false);
  });

  it("generates a four-digit secret, including leading zeroes", () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.match(createSecret(), /^\d{4}$/);
    }
  });
});
