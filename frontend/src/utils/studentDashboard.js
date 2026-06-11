export const getEvaluationGroupKey = (evaluation) =>
  String(evaluation?.sessionId?._id || evaluation?.sessionId || "") ||
  `${evaluation?.sessionType || "UNKNOWN"}_${evaluation?.semester || "UNKNOWN"}`;

export const countPublishedEvaluationGroups = (evaluations = []) => {
  const publishedKeys = new Set();

  evaluations.forEach((evaluation) => {
    const result = evaluation?.result || {
      isPublished: evaluation?.resultPublished === true,
    };

    if (!result.isPublished) return;
    publishedKeys.add(getEvaluationGroupKey(evaluation));
  });

  return publishedKeys.size;
};
