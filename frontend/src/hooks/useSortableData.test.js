import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSortValue, sortItems } from "./useSortableData.js";

test("normalizeSortValue folds whitespace and case for text values", () => {
  assert.equal(normalizeSortValue("  Alice   Tan "), "alice tan");
  assert.equal(normalizeSortValue(null), "");
});

test("sortItems sorts strings alphabetically in ascending order", () => {
  const items = [
    { name: "zeta" },
    { name: " Alpha" },
    { name: "beta" },
  ];

  const sorted = sortItems(
    items,
    { name: (item) => item.name },
    { key: "name", direction: "asc" },
  );

  assert.deepEqual(sorted.map((item) => item.name), [" Alpha", "beta", "zeta"]);
});

test("sortItems sorts dates in descending order", () => {
  const items = [
    { date: new Date("2026-06-01T10:00:00Z") },
    { date: new Date("2026-06-03T10:00:00Z") },
    { date: new Date("2026-06-02T10:00:00Z") },
  ];

  const sorted = sortItems(
    items,
    { date: (item) => item.date },
    { key: "date", direction: "desc" },
  );

  assert.deepEqual(
    sorted.map((item) => item.date.toISOString()),
    [
      "2026-06-03T10:00:00.000Z",
      "2026-06-02T10:00:00.000Z",
      "2026-06-01T10:00:00.000Z",
    ],
  );
});

test("sortItems returns the original array when no accessor exists for the requested key", () => {
  const items = [{ name: "A" }, { name: "B" }];
  const sorted = sortItems(items, {}, { key: "name", direction: "asc" });
  assert.equal(sorted, items);
});
