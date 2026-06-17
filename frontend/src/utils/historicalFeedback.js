export const readMapValue = (value, key) => {
  if (!value || !key) return "";
  if (value instanceof Map) return value.get(key);
  return value[key];
};

export const scoreLabel = (score) => {
  if (score === undefined || score === null || score === "") return "-";
  const numeric = Number(score);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return `${numeric} ${numeric === 1 ? "mark" : "marks"}`;
  }
  return "-";
};

export const getReportCriteria = (evaluation) =>
  (evaluation?.rubricId?.criteria || []).filter(
    (criterion) => criterion.type === "quantitative",
  );

export const getReportQualitativeCriteria = (evaluation) =>
  (evaluation?.rubricId?.criteria || []).filter(
    (criterion) => criterion.type === "qualitative",
  );

export const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";

export const hasSubmittedScore = (evaluation) =>
  getReportCriteria(evaluation).some((criterion) =>
    hasValue(readMapValue(evaluation.scores, criterion.key)),
  );

export const hasDisplayableScore = (evaluation) =>
  evaluation?.status === "COMPLETED" &&
  Number.isFinite(Number(evaluation.totalMarks)) &&
  hasSubmittedScore(evaluation);

export const getScoreBadgeLabel = (evaluation) => {
  if (hasDisplayableScore(evaluation)) {
    return `${Number(evaluation.totalMarks).toFixed(2).replace(/\.?0+$/, "")}%`;
  }
  if (getReportCriteria(evaluation).length === 0) return "Text Only";
  if (evaluation?.status !== "COMPLETED") return "Pending";
  return "Not Marked";
};

export const getScoreColorClass = (score) => {
  if (!score && score !== 0) return "text-gray-600 bg-gray-100";
  if (score >= 80) return "text-green-700 bg-green-100";
  if (score >= 65) return "text-yellow-700 bg-yellow-100";
  return "text-red-700 bg-red-100";
};

export const getScoreBadgeClass = (evaluation) =>
  hasDisplayableScore(evaluation)
    ? getScoreColorClass(Number(evaluation.totalMarks))
    : "text-gray-600 bg-gray-100";
