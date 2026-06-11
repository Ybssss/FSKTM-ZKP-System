export const PASS_THRESHOLD = 65;
export const REQUIRED_EVALUATOR_COUNT = 3;

export const buildPanelSessionOutcome = (
  evaluations = [],
  {
    passThreshold = PASS_THRESHOLD,
    requiredEvaluatorCount = REQUIRED_EVALUATOR_COUNT,
  } = {},
) => {
  const quantitativeEvaluations = evaluations.filter((evaluation) =>
    (evaluation.rubricId?.criteria || []).some(
      (criterion) => criterion.type === "quantitative",
    ),
  );

  const expectedEvaluatorCount = Math.max(
    evaluations.length || 0,
    requiredEvaluatorCount,
  );

  if (!quantitativeEvaluations.length) {
    return {
      isScoredSession: false,
      completedCount: 0,
      expectedEvaluatorCount,
      isFinal: false,
      average: null,
      outcome: "Text-only feedback",
    };
  }

  const completedQuantitativeEvaluations = quantitativeEvaluations.filter(
    (evaluation) =>
      evaluation.status === "COMPLETED" &&
      Number.isFinite(Number(evaluation.totalMarks)),
  );

  if (!completedQuantitativeEvaluations.length) {
    return {
      isScoredSession: true,
      completedCount: 0,
      expectedEvaluatorCount,
      isFinal: false,
      average: null,
      outcome: "Pending evaluator submissions",
    };
  }

  const average =
    completedQuantitativeEvaluations.reduce(
      (sum, evaluation) => sum + Number(evaluation.totalMarks || 0),
      0,
    ) / completedQuantitativeEvaluations.length;

  const isFinal =
    completedQuantitativeEvaluations.length >= expectedEvaluatorCount;

  return {
    isScoredSession: true,
    completedCount: completedQuantitativeEvaluations.length,
    expectedEvaluatorCount,
    isFinal,
    average,
    outcome: isFinal
      ? average >= passThreshold
        ? "PASS"
        : "FAIL"
      : "Pending evaluator submissions",
  };
};
