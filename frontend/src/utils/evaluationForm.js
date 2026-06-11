export const DEFAULT_MAX_SCORE = 5;
export const SCORE_LABELS = {
  5: { label: "Outstanding", descriptionKey: "outstanding" },
  4: { label: "Exemplary", descriptionKey: "exemplary" },
  3: { label: "Proficient", descriptionKey: "proficient" },
  2: { label: "Satisfactory", descriptionKey: "satisfactory" },
  1: { label: "Foundational", descriptionKey: "foundational" },
  0: { label: "Novice", descriptionKey: "novice" },
};

export const getCriteria = (evaluation) => evaluation?.rubricId?.criteria || [];
export const getQuantitativeCriteria = (evaluation) =>
  getCriteria(evaluation).filter((criterion) => criterion.type === "quantitative");
export const getQualitativeCriteria = (evaluation) =>
  getCriteria(evaluation).filter((criterion) => criterion.type === "qualitative");
export const hasQuantitativeCriteria = (evaluation) =>
  getQuantitativeCriteria(evaluation).length > 0;

export const legacyProgressFeedback = (evaluation) => ({
  prog_1_summary: evaluation?.summaryOfProgress || "",
  prog_2_improve: evaluation?.commentsForImprovement || "",
  prog_3_suggest: evaluation?.overallSuggestions || "",
});

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const formatMark = (value) =>
  toNumber(value, 0)
    .toFixed(2)
    .replace(/\.?0+$/, "");

export const formatMarkLabel = (value) =>
  `${value} ${value === 1 ? "mark" : "marks"}`;

export const hasScoreEntries = (scoreValues = {}) =>
  Boolean(scoreValues && Object.keys(scoreValues).length > 0);

export const getCriterionWeight = (criterion) =>
  Math.max(toNumber(criterion?.weight, 0), 0);

export const getCriterionMaxScore = (criterion) => {
  const maxScore = Math.floor(toNumber(criterion?.maxScore, DEFAULT_MAX_SCORE));
  return maxScore > 0 ? maxScore : DEFAULT_MAX_SCORE;
};

export const getScoreScale = (criterion) =>
  Array.from({ length: getCriterionMaxScore(criterion) + 1 }, (_, index) => {
    const value = getCriterionMaxScore(criterion) - index;
    const scoreLabel = SCORE_LABELS[value] || {
      label: `Score ${value}`,
      descriptionKey: "",
    };

    return { value, ...scoreLabel };
  });

export const getScoreDescription = (criterion, score) => {
  if (score.descriptionKey && criterion?.[score.descriptionKey]) {
    return criterion[score.descriptionKey];
  }

  if (score.value === getCriterionMaxScore(criterion) && criterion?.exemplary) {
    return criterion.exemplary;
  }

  return "No description provided.";
};

export const getScoreValue = (criterion, scoreValues = {}) =>
  toNumber(scoreValues?.[criterion?.key], 0);

export const calculateCriterionContribution = (criterion, scoreValues = {}) => {
  const weight = getCriterionWeight(criterion);
  const maxScore = getCriterionMaxScore(criterion);
  const score = clamp(getScoreValue(criterion, scoreValues), 0, maxScore);

  return maxScore > 0 ? (score / maxScore) * weight : 0;
};

export const calculateWeightedTotal = (evaluation, scoreValues = {}) =>
  getQuantitativeCriteria(evaluation).reduce(
    (total, criterion) =>
      total + calculateCriterionContribution(criterion, scoreValues),
    0,
  );

export const getRubricWeightTotal = (evaluation) =>
  getQuantitativeCriteria(evaluation).reduce(
    (total, criterion) => total + getCriterionWeight(criterion),
    0,
  );

export const getEvaluationDisplayedTotal = (evaluation, scoreValues) => {
  const scoresToUse = scoreValues || evaluation?.scores || {};

  if (hasScoreEntries(scoresToUse)) {
    return calculateWeightedTotal(evaluation, scoresToUse);
  }

  return toNumber(evaluation?.totalMarks, 0);
};

export const getEvaluationRoleLabel = (evaluation) =>
  evaluation?.formFiller === "Supervisor"
    ? "Supervisor Evaluation"
    : "Panel Evaluation";

export const getEvaluationRoleBadgeClass = (evaluation) =>
  evaluation?.formFiller === "Supervisor"
    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
    : "bg-indigo-50 text-indigo-700 border-indigo-100";

export const findMissingQuantitativeCriterion = (evaluation, scoreValues = {}) =>
  getQuantitativeCriteria(evaluation).find(
    (criterion) =>
      !Object.prototype.hasOwnProperty.call(scoreValues, criterion.key),
  );

export const buildEvaluationSubmitPayload = (
  evaluation,
  { scores = {}, qualFeedback = {}, overallComments = "" } = {},
) => {
  const quantitativeCriteria = getQuantitativeCriteria(evaluation);
  const qualitativeCriteria = getQualitativeCriteria(evaluation);
  const isScored = quantitativeCriteria.length > 0;
  const payload = {
    evaluationId: evaluation._id,
    sessionId: evaluation.sessionId?._id || evaluation.sessionId,
    sessionType: evaluation.sessionType,
    qualitativeFeedback: qualFeedback,
    overallComments,
    summaryOfProgress:
      qualFeedback.prog_1_summary ||
      qualFeedback[qualitativeCriteria[0]?.key] ||
      "",
    commentsForImprovement:
      qualFeedback.prog_2_improve ||
      qualFeedback[qualitativeCriteria[1]?.key] ||
      "",
    overallSuggestions:
      qualFeedback.prog_3_suggest ||
      qualFeedback[qualitativeCriteria[2]?.key] ||
      "",
  };

  if (isScored) {
    payload.scores = scores;
    payload.totalMarks = Number(calculateWeightedTotal(evaluation, scores).toFixed(2));
  }

  return payload;
};
