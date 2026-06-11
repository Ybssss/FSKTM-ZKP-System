const Evaluation = require("../models/Evaluation");
const Timetable = require("../models/Timetable");
const User = require("../models/User");

const PASS_THRESHOLD = 65;
const REQUIRED_EVALUATOR_COUNT = 3;

const idString = (value) => String(value?._id || value || "");

const isSameId = (a, b) => idString(a) && idString(a) === idString(b);

const getEvaluationGroupKey = (evaluation) =>
  idString(evaluation.sessionId) ||
  `${evaluation.sessionType || "UNKNOWN"}_${evaluation.semester || "UNKNOWN"}`;

const getCriterionList = (evaluation) =>
  Array.isArray(evaluation?.rubricId?.criteria) ? evaluation.rubricId.criteria : [];

const getScoreKeys = (evaluation) => {
  if (evaluation?.scores instanceof Map) {
    return Array.from(evaluation.scores.keys());
  }

  if (evaluation?.scores && typeof evaluation.scores === "object") {
    return Object.keys(evaluation.scores);
  }

  return [];
};

const usesQuantitativeScoring = (groupEvaluations = []) => {
  let sawRubricCriteria = false;

  for (const evaluation of groupEvaluations) {
    const criteria = getCriterionList(evaluation);
    if (!criteria.length) continue;

    sawRubricCriteria = true;
    if (criteria.some((criterion) => criterion.type === "quantitative")) {
      return true;
    }
  }

  if (sawRubricCriteria) {
    return false;
  }

  if (groupEvaluations.some((evaluation) => getScoreKeys(evaluation).length > 0)) {
    return true;
  }

  return !groupEvaluations.every(
    (evaluation) => evaluation?.sessionType === "PROGRESS_ASSESSMENT",
  );
};

const buildEvaluationDocsForTimetable = async (
  timetable,
  payload = {},
  semester,
) => {
  const studentId = payload.students?.[0] || timetable.students?.[0];
  if (!studentId || !Array.isArray(payload.panels)) return [];

  const base = {
    sessionId: timetable._id,
    studentId,
    rubricId: payload.rubricId,
    semester: semester || payload.semester || payload.academicSession || "",
    sessionType: payload.sessionType,
    status: "PENDING",
  };

  const seenPanelIds = new Set();
  const panelEvaluations = payload.panels
    .filter(Boolean)
    .filter((panelId) => {
      const key = idString(panelId);
      if (!key || seenPanelIds.has(key)) return false;
      seenPanelIds.add(key);
      return true;
    })
    .map((evaluatorId) => ({
      ...base,
      evaluatorId,
      formFiller: "Panel",
    }));

  const student = await User.findById(studentId).select("supervisorId").lean();
  const supervisorId = student?.supervisorId;

  if (!supervisorId) return panelEvaluations;

  return [
    ...panelEvaluations,
    {
      ...base,
      evaluatorId: supervisorId,
      formFiller: "Supervisor",
    },
  ];
};

const ensureSupervisorEvaluations = async ({
  studentIds = [],
  supervisorId = null,
} = {}) => {
  const query = {};
  const cleanStudentIds = studentIds.map(idString).filter(Boolean);
  if (cleanStudentIds.length) query.students = { $in: cleanStudentIds };

  const sessions = await Timetable.find(query)
    .select("_id students rubricId sessionType academicSession")
    .populate({ path: "students", select: "supervisorId" });

  if (!sessions.length) return 0;

  const candidates = [];

  sessions.forEach((session) => {
    const student = session.students?.[0];
    const studentId = student?._id || student;
    const studentSupervisorId = student?.supervisorId;

    if (!studentId || !studentSupervisorId) return;
    if (supervisorId && !isSameId(studentSupervisorId, supervisorId)) return;

    candidates.push({
      sessionId: session._id,
      studentId,
      evaluatorId: studentSupervisorId,
      rubricId: session.rubricId,
      semester: session.academicSession || "",
      sessionType: session.sessionType,
      status: "PENDING",
      formFiller: "Supervisor",
    });
  });

  if (!candidates.length) return 0;

  const existing = await Evaluation.find({
    sessionId: { $in: candidates.map((candidate) => candidate.sessionId) },
    formFiller: "Supervisor",
  })
    .select("sessionId studentId evaluatorId formFiller")
    .lean();

  const existingKeys = new Set(
    existing.map(
      (evaluation) =>
        `${idString(evaluation.sessionId)}|${idString(
          evaluation.studentId,
        )}|${idString(evaluation.evaluatorId)}|Supervisor`,
    ),
  );

  const missing = candidates.filter(
    (candidate) =>
      !existingKeys.has(
        `${idString(candidate.sessionId)}|${idString(
          candidate.studentId,
        )}|${idString(candidate.evaluatorId)}|Supervisor`,
      ),
  );

  if (!missing.length) return 0;

  await Evaluation.insertMany(missing, { ordered: false });
  return missing.length;
};

const ensureSupervisorEvaluationsForViewer = async (viewer = {}) => {
  const viewerId = viewer.id || viewer._id || viewer.userId;

  if (viewer.role === "student") {
    return ensureSupervisorEvaluations({ studentIds: [viewerId] });
  }

  if (viewer.role === "panel") {
    return ensureSupervisorEvaluations({ supervisorId: viewerId });
  }

  if (viewer.role === "admin") {
    return ensureSupervisorEvaluations();
  }

  return 0;
};

const buildEvaluationOutcomeMap = (evaluations = []) => {
  const groups = new Map();

  evaluations.forEach((evaluation) => {
    const key = getEvaluationGroupKey(evaluation);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(evaluation);
  });

  const outcomes = new Map();

  groups.forEach((groupEvaluations, key) => {
    const requiredEvaluatorCount = Math.max(
      groupEvaluations.length,
      REQUIRED_EVALUATOR_COUNT,
    );
    const hasQuantitativeScoring = usesQuantitativeScoring(groupEvaluations);
    const completedEvaluations = groupEvaluations.filter(
      (evaluation) => evaluation.status === "COMPLETED",
    );
    const marks = hasQuantitativeScoring
      ? completedEvaluations
          .map((evaluation) => Number(evaluation.totalMarks))
          .filter((mark) => Number.isFinite(mark))
      : [];

    const isPublished = hasQuantitativeScoring
      ? completedEvaluations.length >= requiredEvaluatorCount &&
        marks.length >= requiredEvaluatorCount
      : completedEvaluations.length >= requiredEvaluatorCount;
    const finalAverage =
      hasQuantitativeScoring && isPublished
        ? marks.reduce((sum, mark) => sum + mark, 0) / marks.length
        : null;
    const passed = hasQuantitativeScoring
      ? isPublished
        ? finalAverage >= PASS_THRESHOLD
        : false
      : null;

    outcomes.set(key, {
      isPublished,
      status: isPublished
        ? hasQuantitativeScoring
          ? passed
            ? "PASS"
            : "FAIL"
          : "COMPLETED"
        : "PENDING",
      passed,
      passThreshold: hasQuantitativeScoring ? PASS_THRESHOLD : null,
      completedEvaluatorCount: completedEvaluations.length,
      requiredEvaluatorCount,
      usesQuantitativeScoring: hasQuantitativeScoring,
    });
  });

  return outcomes;
};

const sanitizeEvaluationForStudent = (evaluation, outcome) => {
  const doc = evaluation?.toObject ? evaluation.toObject() : { ...evaluation };
  const result = outcome || {
    isPublished: false,
    status: "PENDING",
    passed: false,
    passThreshold: PASS_THRESHOLD,
    completedEvaluatorCount: 0,
    requiredEvaluatorCount: REQUIRED_EVALUATOR_COUNT,
    usesQuantitativeScoring: true,
  };

  doc.result = result;
  doc.resultStatus = result.status;
  doc.resultPublished = result.isPublished;
  doc.scores = undefined;
  doc.totalMarks = undefined;

  if (!result.isPublished) {
    doc.qualitativeFeedback = undefined;
    doc.overallComments = undefined;
    doc.summaryOfProgress = undefined;
    doc.commentsForImprovement = undefined;
    doc.overallSuggestions = undefined;
  }

  return doc;
};

module.exports = {
  PASS_THRESHOLD,
  REQUIRED_EVALUATOR_COUNT,
  buildEvaluationDocsForTimetable,
  buildEvaluationOutcomeMap,
  ensureSupervisorEvaluations,
  ensureSupervisorEvaluationsForViewer,
  getEvaluationGroupKey,
  sanitizeEvaluationForStudent,
};
