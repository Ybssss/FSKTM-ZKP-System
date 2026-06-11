import test from "node:test";
import assert from "node:assert/strict";
import { buildPanelSessionOutcome } from "./sessionOutcome.js";

const quantitativeRubric = {
  criteria: [{ key: "crit-1", type: "quantitative", weight: 100, maxScore: 5 }],
};

const qualitativeRubric = {
  criteria: [{ key: "prog-1", type: "qualitative" }],
};

test("buildPanelSessionOutcome returns text-only feedback for qualitative sessions", () => {
  const result = buildPanelSessionOutcome([
    {
      status: "COMPLETED",
      totalMarks: 0,
      rubricId: qualitativeRubric,
    },
  ]);

  assert.deepEqual(result, {
    isScoredSession: false,
    completedCount: 0,
    expectedEvaluatorCount: 3,
    isFinal: false,
    average: null,
    outcome: "Text-only feedback",
  });
});

test("buildPanelSessionOutcome stays pending until all three evaluators complete", () => {
  const result = buildPanelSessionOutcome([
    {
      status: "COMPLETED",
      totalMarks: 80,
      rubricId: quantitativeRubric,
    },
    {
      status: "COMPLETED",
      totalMarks: 70,
      rubricId: quantitativeRubric,
    },
    {
      status: "PENDING",
      totalMarks: 0,
      rubricId: quantitativeRubric,
    },
  ]);

  assert.equal(result.completedCount, 2);
  assert.equal(result.expectedEvaluatorCount, 3);
  assert.equal(result.isFinal, false);
  assert.equal(result.outcome, "Pending evaluator submissions");
});

test("buildPanelSessionOutcome returns PASS when average meets threshold", () => {
  const result = buildPanelSessionOutcome([
    {
      status: "COMPLETED",
      totalMarks: 80,
      rubricId: quantitativeRubric,
    },
    {
      status: "COMPLETED",
      totalMarks: 75,
      rubricId: quantitativeRubric,
    },
    {
      status: "COMPLETED",
      totalMarks: 70,
      rubricId: quantitativeRubric,
    },
  ]);

  assert.equal(result.isFinal, true);
  assert.equal(result.average, 75);
  assert.equal(result.outcome, "PASS");
});

test("buildPanelSessionOutcome returns FAIL when average is below threshold", () => {
  const result = buildPanelSessionOutcome([
    {
      status: "COMPLETED",
      totalMarks: 60,
      rubricId: quantitativeRubric,
    },
    {
      status: "COMPLETED",
      totalMarks: 55,
      rubricId: quantitativeRubric,
    },
    {
      status: "COMPLETED",
      totalMarks: 50,
      rubricId: quantitativeRubric,
    },
  ]);

  assert.equal(result.isFinal, true);
  assert.equal(result.average, 55);
  assert.equal(result.outcome, "FAIL");
});
