const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("../models/User");
const Timetable = require("../models/Timetable");
const Evaluation = require("../models/Evaluation");
const PermissionRequest = require("../models/PermissionRequest");

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is required.");
  process.exit(1);
}

const normalizeId = (value) => String(value?._id || value || "");

const buildExistingKey = (request) =>
  `${normalizeId(request.requestingPanelId)}:${normalizeId(request.targetEvaluationId)}`;

const findCurrentSessionForStudent = (sessions, studentId) => {
  const matches = sessions.filter((session) =>
    (session.students || []).some(
      (student) => normalizeId(student) === normalizeId(studentId),
    ),
  );

  if (!matches.length) return null;

  const preferred =
    matches.find((session) => session.sessionType === "PRE_VIVA") || matches[0];

  return preferred;
};

async function main() {
  await mongoose.connect(MONGO_URI);

  const [panels, sessions, completedEvaluations, existingRequests] =
    await Promise.all([
      User.find({ role: "panel" }).select("_id userId name role").lean(),
      Timetable.find({})
        .select("_id batchId sessionType date students title status")
        .sort({ date: -1, startTime: -1 })
        .lean(),
      Evaluation.find({ status: "COMPLETED" })
        .select("_id evaluatorId studentId sessionId sessionType status")
        .lean(),
      PermissionRequest.find({
        scope: "SINGLE_EVALUATION",
        status: { $in: ["PENDING", "APPROVED"] },
      })
        .select("requestingPanelId targetEvaluationId")
        .lean(),
    ]);

  const panelIds = new Set(panels.map((panel) => normalizeId(panel._id)));
  const existingKeys = new Set(existingRequests.map(buildExistingKey));

  const candidateTargets = completedEvaluations
    .filter(
      (evaluation) =>
        panelIds.has(normalizeId(evaluation.evaluatorId)) &&
        panelIds.has(normalizeId(evaluation.evaluatorId)),
    )
    .map((evaluation) => {
      const currentSession = findCurrentSessionForStudent(
        sessions,
        evaluation.studentId,
      );

      if (!currentSession) return null;

      return {
        evaluationId: normalizeId(evaluation._id),
        ownerId: normalizeId(evaluation.evaluatorId),
        studentId: normalizeId(evaluation.studentId),
        currentSessionId: normalizeId(currentSession._id),
        batchId: currentSession.batchId || null,
      };
    })
    .filter(Boolean);

  const chooseTarget = (requesterId, preferredOwnerIds = []) => {
    const owners = [
      ...preferredOwnerIds,
      ...panels.map((panel) => normalizeId(panel._id)),
    ];

    for (const ownerId of owners) {
      const target = candidateTargets.find((candidate) => {
        const key = `${requesterId}:${candidate.evaluationId}`;
        return (
          requesterId !== candidate.ownerId &&
          candidate.ownerId === ownerId &&
          !existingKeys.has(key)
        );
      });

      if (target) return target;
    }

    return candidateTargets.find((candidate) => {
      const key = `${requesterId}:${candidate.evaluationId}`;
      return requesterId !== candidate.ownerId && !existingKeys.has(key);
    });
  };

  const payloads = [];

  panels.forEach((panel, index) => {
    const requesterId = normalizeId(panel._id);
    const nextOwnerId = normalizeId(panels[(index + 1) % panels.length]?._id);
    const altOwnerId = normalizeId(panels[(index + 2) % panels.length]?._id);

    const pendingTarget = chooseTarget(requesterId, [nextOwnerId, altOwnerId]);
    if (pendingTarget) {
      const key = `${requesterId}:${pendingTarget.evaluationId}`;
      existingKeys.add(key);
      payloads.push({
        requestingPanelId: requesterId,
        targetEvaluationId: pendingTarget.evaluationId,
        owningPanelId: pendingTarget.ownerId,
        studentId: pendingTarget.studentId,
        status: "PENDING",
        reason:
          "Demo pending request: panel needs historical context from this student's completed evaluation before the current session.",
        scope: "SINGLE_EVALUATION",
        currentSessionId: pendingTarget.currentSessionId,
        batchId: pendingTarget.batchId,
      });
    }

    const approvedTarget = chooseTarget(requesterId, [altOwnerId, nextOwnerId]);
    if (approvedTarget) {
      const key = `${requesterId}:${approvedTarget.evaluationId}`;
      existingKeys.add(key);
      payloads.push({
        requestingPanelId: requesterId,
        targetEvaluationId: approvedTarget.evaluationId,
        owningPanelId: approvedTarget.ownerId,
        studentId: approvedTarget.studentId,
        status: "APPROVED",
        reason:
          "Demo approved request: panel can review a historical evaluation and student context for continuity.",
        scope: "SINGLE_EVALUATION",
        currentSessionId: approvedTarget.currentSessionId,
        batchId: approvedTarget.batchId,
        approvedBy: approvedTarget.ownerId,
        approvedAt: new Date(),
      });
    }
  });

  if (!payloads.length) {
    console.log(
      JSON.stringify(
        {
          createdCount: 0,
          message:
            "No additional permission request demos were needed or no valid targets were available.",
        },
        null,
        2,
      ),
    );
    await mongoose.connection.close();
    return;
  }

  await PermissionRequest.insertMany(payloads, { ordered: false });

  console.log(
    JSON.stringify(
      {
        createdCount: payloads.length,
        requesterCount: panels.length,
        sample: payloads.slice(0, 4).map((payload) => ({
          requestingPanelId: payload.requestingPanelId,
          owningPanelId: payload.owningPanelId,
          studentId: payload.studentId,
          status: payload.status,
        })),
      },
      null,
      2,
    ),
  );

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
