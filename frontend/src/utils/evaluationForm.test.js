import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvaluationSubmitPayload,
  calculateCriterionContribution,
  calculateWeightedTotal,
  formatMark,
  getEvaluationDisplayedTotal,
  getScoreDescription,
  getScoreScale,
} from "./evaluationForm.js";

const scoredEvaluation = {
  _id: "eval-1",
  sessionId: { _id: "session-1" },
  sessionType: "PROPOSAL_DEFENSE",
  rubricId: {
    criteria: [
      {
        key: "crit_a",
        type: "quantitative",
        weight: 40,
        maxScore: 5,
        outstanding: "Strong",
      },
      {
        key: "crit_b",
        type: "quantitative",
        weight: 60,
        maxScore: 5,
        exemplary: "Clear",
      },
      {
        key: "qual_1",
        type: "qualitative",
        title: "Remarks",
      },
    ],
  },
};

const progressEvaluation = {
  _id: "eval-2",
  sessionId: { _id: "session-2" },
  sessionType: "PROGRESS_ASSESSMENT",
  rubricId: {
    criteria: [
      { key: "prog_1_summary", type: "qualitative", title: "Summary" },
      { key: "prog_2_improve", type: "qualitative", title: "Improve" },
      { key: "prog_3_suggest", type: "qualitative", title: "Suggest" },
    ],
  },
};

test("calculateCriterionContribution scales score by weight", () => {
  const value = calculateCriterionContribution(
    scoredEvaluation.rubricId.criteria[0],
    { crit_a: 4 },
  );

  assert.equal(value, 32);
});

test("calculateWeightedTotal sums weighted contributions", () => {
  const total = calculateWeightedTotal(scoredEvaluation, {
    crit_a: 4,
    crit_b: 3,
  });

  assert.equal(total, 68);
});

test("getEvaluationDisplayedTotal prefers live score input over stored total", () => {
  const total = getEvaluationDisplayedTotal(
    { ...scoredEvaluation, totalMarks: 10 },
    { crit_a: 5, crit_b: 5 },
  );

  assert.equal(total, 100);
});

test("getScoreScale respects criterion max score and label ordering", () => {
  const scale = getScoreScale(scoredEvaluation.rubricId.criteria[0]);

  assert.equal(scale[0].value, 5);
  assert.equal(scale.at(-1).value, 0);
});

test("getScoreDescription resolves criterion-specific labels", () => {
  const description = getScoreDescription(scoredEvaluation.rubricId.criteria[1], {
    value: 5,
    descriptionKey: "outstanding",
  });

  assert.equal(description, "Clear");
});

test("buildEvaluationSubmitPayload includes weighted total for scored evaluations", () => {
  const payload = buildEvaluationSubmitPayload(scoredEvaluation, {
    scores: { crit_a: 4, crit_b: 3 },
    qualFeedback: { qual_1: "Well prepared." },
    overallComments: "Good work.",
  });

  assert.deepEqual(payload, {
    evaluationId: "eval-1",
    sessionId: "session-1",
    sessionType: "PROPOSAL_DEFENSE",
    scores: { crit_a: 4, crit_b: 3 },
    totalMarks: 68,
    qualitativeFeedback: { qual_1: "Well prepared." },
    overallComments: "Good work.",
    summaryOfProgress: "Well prepared.",
    commentsForImprovement: "",
    overallSuggestions: "",
  });
});

test("buildEvaluationSubmitPayload maps progress feedback into named fields", () => {
  const payload = buildEvaluationSubmitPayload(progressEvaluation, {
    qualFeedback: {
      prog_1_summary: "Milestones done",
      prog_2_improve: "Tighten analysis",
      prog_3_suggest: "Proceed to next stage",
    },
    overallComments: "On track.",
  });

  assert.deepEqual(payload, {
    evaluationId: "eval-2",
    sessionId: "session-2",
    sessionType: "PROGRESS_ASSESSMENT",
    qualitativeFeedback: {
      prog_1_summary: "Milestones done",
      prog_2_improve: "Tighten analysis",
      prog_3_suggest: "Proceed to next stage",
    },
    overallComments: "On track.",
    summaryOfProgress: "Milestones done",
    commentsForImprovement: "Tighten analysis",
    overallSuggestions: "Proceed to next stage",
  });
});

test("formatMark trims trailing zeros", () => {
  assert.equal(formatMark(68), "68");
  assert.equal(formatMark(68.5), "68.5");
});
