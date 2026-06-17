const Evaluation = require("../models/Evaluation");
const Timetable = require("../models/Timetable");
const User = require("../models/User");

const PASS_THRESHOLD = 65;
const REQUIRED_EVALUATOR_COUNT = 3;

const idString = (value) => String(value?._id || value || "");

const isSameId = (a, b) => idString(a) && idString(a) === idString(b);

const getSessionStudentKey = (sessionId, studentId) =>
  `${idString(sessionId)}|${idString(studentId)}`;

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

const syncSupervisorEvaluationsForStudents = async ({
  studentIds = [],
} = {}) => {
  const cleanStudentIds = [...new Set(studentIds.map(idString).filter(Boolean))];
  const sessionQuery = cleanStudentIds.length
    ? { students: { $in: cleanStudentIds } }
    : {};

  const sessions = await Timetable.find(sessionQuery)
    .select("_id students rubricId sessionType academicSession")
    .populate({ path: "students", select: "supervisorId" })
    .lean();

  if (!sessions.length) {
    return { createdCount: 0, updatedCount: 0, deletedCount: 0 };
  }

  const sessionRows = sessions
    .map((session) => {
      const student = Array.isArray(session.students) ? session.students[0] : null;
      const studentId = student?._id || session.students?.[0];

      if (!studentId) return null;

      return {
        sessionId: session._id,
        studentId,
        supervisorId: student?.supervisorId || null,
        rubricId: session.rubricId || null,
        semester: session.academicSession || "",
        sessionType: session.sessionType || "",
      };
    })
    .filter(Boolean);

  if (!sessionRows.length) {
    return { createdCount: 0, updatedCount: 0, deletedCount: 0 };
  }

  const sessionIds = [...new Set(sessionRows.map((row) => idString(row.sessionId)))];
  const rowStudentIds = [...new Set(sessionRows.map((row) => idString(row.studentId)))];

  const existingSupervisorEvals = await Evaluation.find({
    sessionId: { $in: sessionIds },
    studentId: { $in: rowStudentIds },
    formFiller: "Supervisor",
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const existingByKey = new Map();
  existingSupervisorEvals.forEach((evaluation) => {
    const key = getSessionStudentKey(evaluation.sessionId, evaluation.studentId);
    if (!existingByKey.has(key)) existingByKey.set(key, []);
    existingByKey.get(key).push(evaluation);
  });

  const toCreate = [];
  const updateOps = [];
  const deleteIds = [];

  sessionRows.forEach((row) => {
    const key = getSessionStudentKey(row.sessionId, row.studentId);
    const existing = existingByKey.get(key) || [];
    const completed = existing.filter(
      (evaluation) => evaluation.status === "COMPLETED",
    );
    const pending = existing.filter(
      (evaluation) => evaluation.status !== "COMPLETED",
    );

    if (completed.length) {
      pending.forEach((evaluation) => deleteIds.push(evaluation._id));
      return;
    }

    const supervisorId = idString(row.supervisorId);
    if (!supervisorId) {
      pending.forEach((evaluation) => deleteIds.push(evaluation._id));
      return;
    }

    if (!pending.length) {
      toCreate.push({
        sessionId: row.sessionId,
        studentId: row.studentId,
        evaluatorId: row.supervisorId,
        rubricId: row.rubricId,
        semester: row.semester,
        sessionType: row.sessionType,
        status: "PENDING",
        formFiller: "Supervisor",
      });
      return;
    }

    const [keeper, ...extras] = pending;
    const needsUpdate =
      !isSameId(keeper.evaluatorId, row.supervisorId) ||
      !isSameId(keeper.rubricId, row.rubricId) ||
      String(keeper.semester || "") !== String(row.semester || "") ||
      String(keeper.sessionType || "") !== String(row.sessionType || "");

    if (needsUpdate) {
      updateOps.push({
        updateOne: {
          filter: { _id: keeper._id },
          update: {
            $set: {
              evaluatorId: row.supervisorId,
              rubricId: row.rubricId,
              semester: row.semester,
              sessionType: row.sessionType,
              formFiller: "Supervisor",
            },
          },
        },
      });
    }

    extras.forEach((evaluation) => deleteIds.push(evaluation._id));
  });

  if (updateOps.length) {
    await Evaluation.bulkWrite(updateOps, { ordered: false });
  }

  if (deleteIds.length) {
    await Evaluation.deleteMany({ _id: { $in: deleteIds } });
  }

  if (toCreate.length) {
    await Evaluation.insertMany(toCreate, { ordered: false });
  }

  return {
    createdCount: toCreate.length,
    updatedCount: updateOps.length,
    deletedCount: deleteIds.length,
  };
};

const ensureSupervisorEvaluations = async ({
  studentIds = [],
  supervisorId = null,
} = {}) => {
  const cleanStudentIds = studentIds.map(idString).filter(Boolean);
  const query = cleanStudentIds.length
    ? { students: { $in: cleanStudentIds } }
    : {};
  const supervisorIdString = idString(supervisorId);

  const sessions = await Timetable.find(query)
    .select("students")
    .populate({ path: "students", select: "supervisorId" })
    .lean();

  if (!sessions.length) return 0;

  const relevantStudentIds = [...new Set(
    sessions
      .map((session) => {
        const student = Array.isArray(session.students) ? session.students[0] : null;
        const studentId = student?._id || session.students?.[0];
        const studentSupervisorId = student?.supervisorId;

        if (!studentId) return "";
        if (
          supervisorIdString &&
          !isSameId(studentSupervisorId, supervisorIdString)
        ) {
          return "";
        }

        return idString(studentId);
      })
      .filter(Boolean),
  )];

  if (!relevantStudentIds.length) return 0;

  const summary = await syncSupervisorEvaluationsForStudents({
    studentIds: relevantStudentIds,
  });

  return (
    summary.createdCount + summary.updatedCount + summary.deletedCount
  );
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
  syncSupervisorEvaluationsForStudents,
};
