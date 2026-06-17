import test from "node:test";
import assert from "node:assert/strict";
import {
  getScoreBadgeClass,
  getScoreBadgeLabel,
  scoreLabel,
} from "./historicalFeedback.js";

test("qualitative-only completed evaluations render as text only", () => {
  const evaluation = {
    status: "COMPLETED",
    totalMarks: 0,
    rubricId: {
      criteria: [{ key: "prog_1", type: "qualitative", title: "Summary" }],
    },
    scores: {},
  };

  assert.equal(getScoreBadgeLabel(evaluation), "Text Only");
  assert.equal(getScoreBadgeClass(evaluation), "text-blue-700 bg-blue-100");
});

test("completed scored evaluations without submitted scores render as not marked", () => {
  const evaluation = {
    status: "COMPLETED",
    totalMarks: 0,
    rubricId: {
      criteria: [{ key: "crit_a", type: "quantitative", title: "Criterion A" }],
    },
    scores: {},
  };

  assert.equal(getScoreBadgeLabel(evaluation), "Not Marked");
});

test("pending scored evaluations render as pending", () => {
  const evaluation = {
    status: "PENDING",
    totalMarks: 85,
    rubricId: {
      criteria: [{ key: "crit_a", type: "quantitative", title: "Criterion A" }],
    },
    scores: { crit_a: 4 },
  };

  assert.equal(getScoreBadgeLabel(evaluation), "Pending");
  assert.equal(getScoreBadgeClass(evaluation), "text-amber-700 bg-amber-100");
});

test("completed scored evaluations with submitted marks render the percentage", () => {
  const evaluation = {
    status: "COMPLETED",
    totalMarks: 82.5,
    rubricId: {
      criteria: [{ key: "crit_a", type: "quantitative", title: "Criterion A" }],
    },
    scores: { crit_a: 4 },
  };

  assert.equal(getScoreBadgeLabel(evaluation), "82.5%");
  assert.equal(getScoreBadgeClass(evaluation), "text-green-700 bg-green-100");
});

test("scoreLabel maps rubric scale values", () => {
  assert.equal(scoreLabel(5), "5 marks");
  assert.equal(scoreLabel(4), "4 marks");
  assert.equal(scoreLabel(3), "3 marks");
  assert.equal(scoreLabel(2), "2 marks");
  assert.equal(scoreLabel(1), "1 mark");
  assert.equal(scoreLabel(0), "0 marks");
});
