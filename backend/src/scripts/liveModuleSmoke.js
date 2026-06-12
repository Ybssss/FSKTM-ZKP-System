const path = require("path");
const dotenv = require("dotenv");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const events = require("events");

const User = require("../models/User");
const Timetable = require("../models/Timetable");
const Evaluation = require("../models/Evaluation");
const Attendance = require("../models/Attendance");
const PermissionRequest = require("../models/PermissionRequest");
const SessionBatch = require("../models/SessionBatch");
const Rubric = require("../models/Rubric");

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "your-fallback-secret-key";
const PORT = process.env.PORT || 5000;
const BASE_URL =
  process.env.PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ||
  `http://localhost:${PORT}`;
const API_BASE = `${BASE_URL}/api`;
const SMOKE_PROFILE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9oNcamcAAAAASUVORK5CYII=";

// The smoke harness opens several concurrent localhost requests at once.
// Raise the listener ceiling so the shared sockets do not emit misleading
// EventEmitter warnings during an otherwise healthy run.
events.defaultMaxListeners = 50;

if (!MONGO_URI) {
  console.error("MONGO_URI is required.");
  process.exit(1);
}

const toId = (value) => String(value?._id || value || "");

const requireTruthy = (value, message) => {
  if (!value) throw new Error(message);
  return value;
};

const createToken = (user) => {
  const activeDevice = (user.authenticatedDevices || []).find(
    (device) => device.isActive !== false,
  );
  requireTruthy(
    activeDevice,
    `User ${user.userId} has no active authenticated device.`,
  );

  return jwt.sign(
    {
      id: user._id,
      userId: user.userId,
      role: user.role,
      deviceId: activeDevice.deviceId,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
};

const makeClient = (token) =>
  axios.create({
    baseURL: API_BASE,
    timeout: 15000,
    headers: { Authorization: `Bearer ${token}` },
  });

const makePublicClient = () =>
  axios.create({
    baseURL: API_BASE,
    timeout: 15000,
  });

const pickUser = async (query, label) => {
  const user = await User.findOne({
    ...query,
    authenticatedDevices: { $elemMatch: { isActive: { $ne: false } } },
  }).lean();
  return requireTruthy(user, `Unable to find active ${label} user.`);
};

const pickActivePanelForSmoke = async () => {
  const panels = await User.find({
    role: "panel",
    authenticatedDevices: { $elemMatch: { isActive: { $ne: false } } },
  })
    .select("_id userId role authenticatedDevices")
    .lean();

  for (const panel of panels) {
    const completedCount = await Evaluation.countDocuments({
      evaluatorId: panel._id,
      status: "COMPLETED",
      isUnlocked: { $ne: true },
    });

    if (completedCount > 0) return panel;
  }

  throw new Error("Unable to find active panel user with completed evaluations.");
};

const findAttendanceCandidate = async () => {
  const sessions = await Timetable.find({
    status: { $in: ["scheduled", "active", "completed"] },
    students: { $exists: true, $ne: [] },
  })
    .select("_id students title sessionType date startTime endTime status")
    .sort({ date: -1, startTime: -1 })
    .lean();

  for (const session of sessions) {
    for (const studentId of session.students || []) {
      const existing = await Attendance.findOne({
        timetableId: session._id,
        studentId,
      })
        .select("_id")
        .lean();
      if (!existing) {
        return { sessionId: session._id, studentId };
      }
    }
  }

  throw new Error("No available session/student pair for attendance smoke test.");
};

const findQrCandidateForStudent = async (studentId) => {
  const sessions = await Timetable.find({
    students: studentId,
    status: { $in: ["scheduled", "active", "completed"] },
  })
    .select("_id qrCode qrExpiresAt qrGeneratedAt date startTime")
    .sort({ date: -1, startTime: -1 })
    .lean();

  requireTruthy(
    sessions.length,
    "No session available for QR smoke test with the active student user.",
  );

  for (const session of sessions) {
    const existingAttendance = await Attendance.findOne({
      timetableId: session._id,
      studentId,
    })
      .select("_id")
      .lean();

    if (!existingAttendance) {
      return { session, attendanceExists: false };
    }
  }

  return { session: sessions[0], attendanceExists: true };
};

const findPermissionTarget = async (requesterId) => {
  const completedEvaluations = await Evaluation.find({
    status: "COMPLETED",
    evaluatorId: { $ne: requesterId },
  })
    .select("_id evaluatorId studentId sessionId")
    .sort({ createdAt: -1 })
    .lean();

  for (const evaluation of completedEvaluations) {
    const existing = await PermissionRequest.findOne({
      requestingPanelId: requesterId,
      targetEvaluationId: evaluation._id,
      status: { $in: ["PENDING", "APPROVED"] },
    })
      .select("_id")
      .lean();
    if (existing) continue;

    const currentSession = await Timetable.findOne({
      sessionType: "PRE_VIVA",
      students: evaluation.studentId,
    })
      .select("_id")
      .lean();

    return {
      evaluationId: evaluation._id,
      ownerId: evaluation.evaluatorId,
      currentSessionId: currentSession?._id || null,
    };
  }

  throw new Error("No available evaluation target for permission smoke test.");
};

const findUnlockTarget = async (panelId) => {
  const evaluations = await Evaluation.find({
    status: "COMPLETED",
    evaluatorId: panelId,
    isUnlocked: { $ne: true },
  })
    .select("_id")
    .sort({ createdAt: -1 })
    .lean();

  for (const evaluation of evaluations) {
    const existing = await PermissionRequest.findOne({
      requestingPanelId: panelId,
      targetEvaluationId: evaluation._id,
      scope: "UNLOCK_EVALUATION",
      status: { $in: ["PENDING", "APPROVED"] },
    })
      .select("_id")
      .lean();

    if (!existing) return evaluation._id;
  }

  throw new Error("No available evaluation target for unlock smoke test.");
};

const findEvaluationSubmissionTarget = async (preferredStudentId, evaluatorId) => {
  const sessions = await Timetable.find({
    status: { $in: ["scheduled", "active", "completed"] },
    students: { $exists: true, $ne: [] },
  })
    .select("_id students rubricId sessionType academicSession semester title")
    .sort({ date: -1, startTime: -1 })
    .lean();

  for (const session of sessions) {
    const sessionStudents = session.students || [];
    const hasPreferredStudent =
      preferredStudentId &&
      sessionStudents.some(
        (candidate) => String(candidate) === String(preferredStudentId),
      );

    if (preferredStudentId && !hasPreferredStudent) continue;

    const targetStudentId = hasPreferredStudent
      ? preferredStudentId
      : sessionStudents[0];

    if (!targetStudentId) continue;

    let rubric = null;
    if (session.rubricId) {
      rubric = await Rubric.findById(session.rubricId)
        .select("criteria sessionType")
        .lean();
    }

    if (!rubric && session.sessionType) {
      rubric = await Rubric.findOne({ sessionType: session.sessionType })
        .select("criteria sessionType")
        .lean();
    }

    if (!rubric?.criteria?.length) continue;

    const duplicate = await Evaluation.findOne({
      sessionId: session._id,
      studentId: targetStudentId,
      evaluatorId,
      status: "PENDING",
    })
      .select("_id")
      .lean();

    if (duplicate) continue;

    return {
      sessionId: session._id,
      studentId: targetStudentId,
      semester: session.academicSession || session.semester || "2025/2026",
      sessionType: rubric.sessionType || session.sessionType,
      rubricId: session.rubricId || rubric._id,
      rubric,
    };
  }

  throw new Error("No suitable session/rubric target found for evaluation submit smoke test.");
};

async function main() {
  await mongoose.connect(MONGO_URI);

  const cleanupTasks = [];
  const results = [];

  const record = async (name, fn) => {
    const startedAt = Date.now();
    try {
      const detail = await fn();
      results.push({
        name,
        status: "passed",
        durationMs: Date.now() - startedAt,
        detail,
      });
    } catch (error) {
      results.push({
        name,
        status: "failed",
        durationMs: Date.now() - startedAt,
        error: error.response?.data || error.message,
      });
    }
  };

  try {
    const adminUser = await pickUser({ role: "admin" }, "admin");
    const requesterPanel = await pickActivePanelForSmoke();
    const studentUser = await pickUser({ role: "student" }, "student");

    const ownerTarget = await findPermissionTarget(requesterPanel._id);
    const unlockTargetId = await findUnlockTarget(requesterPanel._id);

    const adminClient = makeClient(createToken(adminUser));
    const requesterClient = makeClient(createToken(requesterPanel));
    const studentClient = makeClient(createToken(studentUser));
    const publicClient = makePublicClient();

    await record("auth:identity-devices-and-registration-check", async () => {
      const fakeDeviceId = `smoke-device-${Date.now()}`;
      await User.findByIdAndUpdate(adminUser._id, {
        $push: {
          authenticatedDevices: {
            deviceId: fakeDeviceId,
            deviceName: "Smoke Test Device",
            trusted: false,
            isActive: true,
            lastLogin: new Date(),
            ipAddress: "127.0.0.1",
          },
        },
      });

      cleanupTasks.push(async () => {
        await User.findByIdAndUpdate(adminUser._id, {
          $pull: { authenticatedDevices: { deviceId: fakeDeviceId } },
        });
      });

      const [meRes, verifyRes, devicesRes, adminDevicesRes, registrationRes] =
        await Promise.all([
          adminClient.get("/auth/me"),
          adminClient.get("/auth/verify"),
          adminClient.get("/auth/my-devices"),
          adminClient.get(`/auth/admin/user-devices/${encodeURIComponent(adminUser.userId)}`),
          publicClient.post("/auth/check-registration", {
            userId: studentUser.userId,
          }),
        ]);

      if (!meRes.data?.success || meRes.data.user?.userId !== adminUser.userId) {
        throw new Error("Auth me endpoint failed.");
      }
      if (!verifyRes.data?.success || verifyRes.data.user?.userId !== adminUser.userId) {
        throw new Error("Auth verify endpoint failed.");
      }
      if (!devicesRes.data?.success || !Array.isArray(devicesRes.data.devices)) {
        throw new Error("Auth my-devices endpoint failed.");
      }
      if (!adminDevicesRes.data?.success || !Array.isArray(adminDevicesRes.data.devices)) {
        throw new Error("Auth admin user-devices endpoint failed.");
      }
      if (!registrationRes.data?.success || !registrationRes.data.userExists) {
        throw new Error("Auth check-registration endpoint failed.");
      }

      const removeRes = await adminClient.delete(`/auth/device/${encodeURIComponent(fakeDeviceId)}`);
      if (!removeRes.data?.success) {
        throw new Error("Auth remove-device endpoint failed.");
      }

      cleanupTasks.pop();

      return {
        deviceCount: devicesRes.data.devices.length,
        registeredUserChecked: studentUser.userId,
      };
    });

    await record("auth:pairing-roundtrip-and-ownership-guard", async () => {
      const pairingRequestRes = await publicClient.post("/auth/pairing/request", {
        userId: adminUser.userId,
        tempPublicKeyBase64: "temp-public-key-smoke",
      });

      if (!pairingRequestRes.data?.success || !pairingRequestRes.data.pairingCode) {
        throw new Error("Pairing request endpoint failed.");
      }

      const pairingCode = pairingRequestRes.data.pairingCode;

      const ownKeyRes = await adminClient.post("/auth/pairing/key", {
        pairingCode,
      });

      if (
        !ownKeyRes.data?.success ||
        ownKeyRes.data.tempPublicKeyBase64 !== "temp-public-key-smoke" ||
        !ownKeyRes.data.expiresAt
      ) {
        throw new Error("Pairing key retrieval failed.");
      }

      let unauthorizedBlocked = false;
      try {
        await studentClient.post("/auth/pairing/key", { pairingCode });
      } catch (error) {
        unauthorizedBlocked = error.response?.status === 403;
      }

      if (!unauthorizedBlocked) {
        throw new Error("Pairing ownership guard did not block a different authenticated user.");
      }

      const submitRes = await adminClient.post("/auth/pairing/submit", {
        pairingCode,
        encryptedPayload: "encrypted-smoke-payload",
      });
      if (!submitRes.data?.success) {
        throw new Error("Pairing submit endpoint failed.");
      }

      const pollRes = await publicClient.post("/auth/pairing/poll", {
        userId: adminUser.userId,
        pairingCode,
      });

      if (
        !pollRes.data?.success ||
        pollRes.data.status !== "complete" ||
        pollRes.data.encryptedPayload !== "encrypted-smoke-payload"
      ) {
        throw new Error("Pairing poll endpoint failed.");
      }

      return {
        pairingCode,
        expiresAt: ownKeyRes.data.expiresAt,
      };
    });

    await record("user:list-and-assignments", async () => {
      const [usersRes, assignmentsRes] = await Promise.all([
        adminClient.get("/users"),
        adminClient.get("/users/assignments"),
      ]);
      if (!usersRes.data?.success || !Array.isArray(usersRes.data.users)) {
        throw new Error("Users listing did not return a valid payload.");
      }
      if (!assignmentsRes.data?.success || !Array.isArray(assignmentsRes.data.students)) {
        throw new Error("Assignments listing did not return a valid payload.");
      }
      return {
        userCount: usersRes.data.users.length,
        assignmentStudentCount: assignmentsRes.data.students.length,
      };
    });

    let tempUserId = null;
    let tempUserLoginId = null;

    await record("user:create-update-profile-image-reset", async () => {
      const unique = Date.now();
      const createPayload = {
        userId: `panel_smoke_${unique}`,
        name: `Smoke Panel ${unique}`,
        email: `panel_smoke_${unique}@example.test`,
        role: "panel",
        expertiseTags: ["security", "demo"],
      };

      const createRes = await adminClient.post("/users", createPayload);
      if (!createRes.data?.success) {
        throw new Error("Failed to create temporary panel user.");
      }

      tempUserId = toId(createRes.data.user);
      tempUserLoginId = createRes.data.user?.userId || createPayload.userId;

      cleanupTasks.push(async () => {
        if (!tempUserId) return;
        await User.findByIdAndDelete(tempUserId);
      });

      const updateRes = await adminClient.put(`/users/${tempUserId}`, {
        name: `${createPayload.name} Updated`,
        profession: "Associate Professor",
        expertiseTags: ["security", "testing"],
      });

      if (!updateRes.data?.success) {
        throw new Error("Failed to update temporary panel user.");
      }

      const imageRes = await adminClient.patch(`/users/${tempUserId}/profile-image`, {
        profileImageUrl: SMOKE_PROFILE_IMAGE,
      });
      if (!imageRes.data?.success || imageRes.data.user?.profileImageUrl !== SMOKE_PROFILE_IMAGE) {
        throw new Error("Failed to set profile image.");
      }

      const clearImageRes = await adminClient.patch(`/users/${tempUserId}/profile-image`, {
        profileImageUrl: "",
      });
      if (!clearImageRes.data?.success || clearImageRes.data.user?.profileImageUrl !== "") {
        throw new Error("Failed to clear profile image.");
      }

      const resetRes = await adminClient.post(`/users/${encodeURIComponent(tempUserLoginId)}/reset-zkp`);
      if (!resetRes.data?.success || !resetRes.data.registrationCode) {
        throw new Error("Failed to reset ZKP registration.");
      }

      return {
        tempUserId,
        registrationCodeIssued: true,
      };
    });

    let rubricId = null;

    await record("rubric:create-read-update-delete", async () => {
      const unique = Date.now();
      const createPayload = {
        name: `Smoke Rubric ${unique}`,
        sessionType: `SMOKE_SESSION_${unique}`,
        criteria: [
          {
            key: "criterion_quantitative",
            title: "Quantitative Criterion",
            type: "quantitative",
            weight: 100,
            maxScore: 5,
            outstanding: "Excellent.",
          },
          {
            key: "criterion_qualitative",
            title: "Qualitative Criterion",
            type: "qualitative",
            weight: 0,
            description: "Feedback prompt.",
          },
        ],
      };

      const createRes = await adminClient.post("/rubrics", createPayload);
      if (!createRes.data?.success) {
        throw new Error("Rubric creation failed.");
      }

      rubricId = toId(createRes.data.rubric || createRes.data.data);
      cleanupTasks.push(async () => {
        if (!rubricId) return;
        try {
          await adminClient.delete(`/rubrics/${rubricId}`);
        } catch {}
      });

      const getRes = await adminClient.get(`/rubrics/${rubricId}`);
      if (!getRes.data?.success) {
        throw new Error("Rubric read failed.");
      }

      const updateRes = await adminClient.put(`/rubrics/${rubricId}`, {
        ...createPayload,
        name: `${createPayload.name} Updated`,
      });
      if (!updateRes.data?.success) {
        throw new Error("Rubric update failed.");
      }

      const deleteRes = await adminClient.delete(`/rubrics/${rubricId}`);
      if (!deleteRes.data?.success) {
        throw new Error("Rubric delete failed.");
      }

      cleanupTasks.pop();
      rubricId = null;

      return {
        createdRubricId: toId(createRes.data.rubric || createRes.data.data),
      };
    });

    let sessionBatchId = null;

    await record("session-batch:create-list-read-update", async () => {
      const rubric = await Rubric.findOne({})
        .select("_id sessionType")
        .sort({ createdAt: 1 })
        .lean();
      requireTruthy(rubric, "No rubric available for session batch smoke test.");

      const unique = Date.now();
      const batchId = `SMOKE-BATCH-${unique}`;
      const createPayload = {
        batchName: `Smoke Batch ${unique}`,
        batchId,
        academicSession: "2025/2026",
        scheduleTitle: "Smoke Test Schedule",
        rubricId: toId(rubric._id),
        date: "2026-06-20",
        startTime: "09:00",
        slotDurationMinutes: 45,
        breakBetweenSlotsMinutes: 10,
        googleMeetLink: "https://meet.google.com/smoke-batch-demo",
        status: "active",
      };

      const createRes = await adminClient.post("/session-batches", createPayload);
      if (!createRes.data?.success || !createRes.data.batch?.batchId) {
        throw new Error("Session batch creation failed.");
      }

      sessionBatchId = createRes.data.batch.batchId;
      cleanupTasks.push(async () => {
        if (!sessionBatchId) return;
        await SessionBatch.findOneAndDelete({ batchId: sessionBatchId });
      });

      const [listRes, getRes] = await Promise.all([
        adminClient.get("/session-batches"),
        adminClient.get(`/session-batches/${encodeURIComponent(sessionBatchId)}`),
      ]);

      if (!listRes.data?.success || !Array.isArray(listRes.data.batches)) {
        throw new Error("Session batch listing failed.");
      }
      if (!getRes.data?.success || getRes.data.batch?.batchId !== sessionBatchId) {
        throw new Error("Session batch read failed.");
      }

      const updateRes = await adminClient.put(
        `/session-batches/${encodeURIComponent(sessionBatchId)}`,
        {
          batchName: `${createPayload.batchName} Updated`,
          date: "2026-06-21",
          googleMeetLink: "https://meet.google.com/smoke-batch-updated",
        },
      );

      if (!updateRes.data?.success || updateRes.data.batch?.batchName !== `${createPayload.batchName} Updated`) {
        throw new Error("Session batch update failed.");
      }

      return {
        batchId: sessionBatchId,
        listedCount: listRes.data.batches.length,
      };
    });

    await record("timetable:list-batches-and-update-timeframes", async () => {
      const batchesRes = await adminClient.get("/timetables/batches");
      if (!batchesRes.data?.success || !Array.isArray(batchesRes.data.batches)) {
        throw new Error("Batch listing failed.");
      }

      const targetBatch = batchesRes.data.batches.find(
        (batch) => (batch.sessionCount || batch.totalSessions || 0) > 0,
      );
      requireTruthy(targetBatch, "No batch available for time-frame smoke test.");

      const batchSessions = await Timetable.find({
        batchId: targetBatch.batchId,
        status: { $ne: "completed" },
      })
        .select("_id date startTime endTime")
        .sort({ date: 1, startTime: 1 })
        .lean();

      requireTruthy(
        batchSessions.length,
        `No editable sessions found for batch ${targetBatch.batchId}.`,
      );

      const firstSession = batchSessions[0];
      const updateRes = await adminClient.post(
        `/timetables/batches/${encodeURIComponent(targetBatch.batchId)}/time-frames`,
        {
          items: [
            {
              sessionId: toId(firstSession._id),
              date: String(firstSession.date).slice(0, 10),
              startTime: firstSession.startTime,
              endTime: firstSession.endTime,
            },
          ],
        },
      );

      if (!updateRes.data?.success || updateRes.data.updatedCount < 1) {
        throw new Error("Batch time-frame update did not affect any session.");
      }

      return {
        batchId: targetBatch.batchId,
        updatedCount: updateRes.data.updatedCount,
      };
    });

    let tempEvaluationId = null;

    await record("evaluation:list-submit-read-search", async () => {
      const target = await findEvaluationSubmissionTarget(
        studentUser._id,
        requesterPanel._id,
      );

      const quantitativeCriteria = (target.rubric.criteria || []).filter(
        (criterion) => criterion.type === "quantitative",
      );
      const qualitativeCriteria = (target.rubric.criteria || []).filter(
        (criterion) => criterion.type === "qualitative",
      );

      const tempEvaluation = await Evaluation.create({
        sessionId: target.sessionId,
        studentId: target.studentId,
        evaluatorId: requesterPanel._id,
        semester: target.semester,
        sessionType: target.sessionType,
        rubricId: target.rubricId,
        status: "PENDING",
        formFiller: "Panel",
      });

      tempEvaluationId = toId(tempEvaluation._id);
      cleanupTasks.push(async () => {
        if (!tempEvaluationId) return;
        await Evaluation.findByIdAndDelete(tempEvaluationId);
      });

      const scores = Object.fromEntries(
        quantitativeCriteria.map((criterion) => [
          criterion.key,
          Math.max(1, Number(criterion.maxScore || 5) - 1),
        ]),
      );
      const qualitativeFeedback = Object.fromEntries(
        qualitativeCriteria.map((criterion, index) => [
          criterion.key,
          `Smoke qualitative feedback ${index + 1}`,
        ]),
      );
      const searchToken = `smoke-historical-comment-${Date.now()}`;

      const [panelListRes, studentListRes, studentRouteRes] = await Promise.all([
        requesterClient.get("/evaluations"),
        studentClient.get("/evaluations"),
        studentClient.get(`/evaluations/student/${encodeURIComponent(target.studentId)}`),
      ]);

      if (!panelListRes.data?.success || !Array.isArray(panelListRes.data.data)) {
        throw new Error("Panel evaluation listing failed.");
      }
      if (!studentListRes.data?.success || !Array.isArray(studentListRes.data.data)) {
        throw new Error("Student evaluation listing failed.");
      }
      if (!studentRouteRes.data?.success || !Array.isArray(studentRouteRes.data.evaluations)) {
        throw new Error("Student evaluation route failed.");
      }

      const submitRes = await requesterClient.post("/evaluations/submit", {
        evaluationId: tempEvaluationId,
        scores,
        qualitativeFeedback,
        overallComments: searchToken,
        summaryOfProgress: "Smoke progress summary",
        commentsForImprovement: "Smoke improvement comments",
        overallSuggestions: "Smoke overall suggestions",
      });

      if (!submitRes.data?.success || submitRes.data.data?.status !== "COMPLETED") {
        throw new Error("Evaluation submit route failed.");
      }

      const [getByIdRes, sessionRes, searchRes] = await Promise.all([
        requesterClient.get(`/evaluations/${tempEvaluationId}`),
        adminClient.get(`/evaluations/session/${encodeURIComponent(target.sessionId)}`),
        requesterClient.get(`/evaluations/search?searchQuery=${encodeURIComponent(searchToken)}`),
      ]);

      if (!getByIdRes.data?.success || toId(getByIdRes.data.evaluation?._id) !== tempEvaluationId) {
        throw new Error("Evaluation read by id failed.");
      }
      if (!sessionRes.data?.success || !Array.isArray(sessionRes.data.evaluations)) {
        throw new Error("Session evaluation listing failed.");
      }
      if (!Array.isArray(searchRes.data?.results) || !searchRes.data.results.length) {
        throw new Error("Evaluation historical search failed.");
      }

      return {
        evaluationId: tempEvaluationId,
        quantitativeCriteria: quantitativeCriteria.length,
        qualitativeCriteria: qualitativeCriteria.length,
      };
    });

    await record("analytics:stats-student-stats-and-dashboard", async () => {
      const [adminStatsRes, studentStatsRes, adminDashboardRes, studentDashboardRes] =
        await Promise.all([
          adminClient.get("/analytics/stats"),
          studentClient.get("/analytics/student-stats"),
          adminClient.get("/analytics/dashboard"),
          studentClient.get("/analytics/dashboard"),
        ]);

      if (!adminStatsRes.data?.success || !adminStatsRes.data.stats) {
        throw new Error("Admin analytics stats failed.");
      }
      if (!Array.isArray(adminStatsRes.data.stats.recentEvaluations)) {
        throw new Error("Admin analytics recent evaluations missing.");
      }
      if (!Array.isArray(adminStatsRes.data.stats.trends)) {
        throw new Error("Admin analytics trends missing.");
      }
      if (typeof adminStatsRes.data.stats.averageScore !== "number") {
        throw new Error("Admin analytics average score missing.");
      }

      if (!studentStatsRes.data?.success || !studentStatsRes.data.stats) {
        throw new Error("Student analytics stats failed.");
      }
      if (!adminDashboardRes.data?.success || !studentDashboardRes.data?.success) {
        throw new Error("Analytics dashboard redirect handling failed.");
      }

      return {
        recentEvaluations: adminStatsRes.data.stats.recentEvaluations.length,
        trends: adminStatsRes.data.stats.trends.length,
        studentUpcomingSessions: studentStatsRes.data.stats.upcomingSessions,
      };
    });

    await record("attendance:mark-read-update-delete", async () => {
      const candidate = await findAttendanceCandidate();
      const createRes = await adminClient.post("/attendance", {
        timetableId: toId(candidate.sessionId),
        studentId: toId(candidate.studentId),
        verificationMethod: "manual",
        status: "present",
        notes: "Live smoke test attendance mark.",
      });

      if (!createRes.data?.success) {
        throw new Error("Attendance creation failed.");
      }

      const attendanceId = toId(createRes.data.attendance);

      const cleanupDeleteAttendance = async () => {
        try {
          await adminClient.delete(`/attendance/${attendanceId}`);
        } catch {}
      };
      cleanupTasks.push(cleanupDeleteAttendance);

      const [timetableRes, myAttendanceRes, statsRes] = await Promise.all([
        adminClient.get(`/attendance/timetable/${encodeURIComponent(candidate.sessionId)}`),
        studentClient.get("/attendance/my"),
        adminClient.get(`/attendance/stats?studentId=${encodeURIComponent(candidate.studentId)}`),
      ]);

      if (!timetableRes.data?.success || !Array.isArray(timetableRes.data.attendances)) {
        throw new Error("Attendance by timetable failed.");
      }
      if (!myAttendanceRes.data?.success || !Array.isArray(myAttendanceRes.data.attendances)) {
        throw new Error("Student attendance listing failed.");
      }
      if (!statsRes.data?.success || !statsRes.data.stats) {
        throw new Error("Attendance stats failed.");
      }

      const updateRes = await adminClient.put(`/attendance/${attendanceId}`, {
        status: "late",
        notes: "Updated by live smoke test.",
      });
      if (!updateRes.data?.success || updateRes.data.attendance?.status !== "late") {
        throw new Error("Attendance update failed.");
      }

      const deleteRes = await adminClient.delete(`/attendance/${attendanceId}`);
      if (!deleteRes.data?.success) {
        throw new Error("Attendance delete failed.");
      }

      cleanupTasks.pop();

      return {
        attendanceId,
        statsTotal: statsRes.data.stats.total,
      };
    });

    await record("qr:generate-fetch-and-verify", async () => {
      const qrCandidate = await findQrCandidateForStudent(studentUser._id);
      const sessionId = toId(qrCandidate.session._id);
      const originalQrState = {
        qrCode: qrCandidate.session.qrCode || "",
        qrExpiresAt: qrCandidate.session.qrExpiresAt || null,
        qrGeneratedAt: qrCandidate.session.qrGeneratedAt || null,
      };

      cleanupTasks.push(async () => {
        await Timetable.findByIdAndUpdate(sessionId, {
          $set: originalQrState,
        });
      });

      const generateRes = await adminClient.post(`/qr/generate/${sessionId}`);
      if (!generateRes.data?.success || !generateRes.data.token || !generateRes.data.qrCode) {
        throw new Error("QR generation failed.");
      }

      const getRes = await adminClient.get(`/qr/${sessionId}`);
      if (!getRes.data?.success || getRes.data.token !== generateRes.data.token) {
        throw new Error("QR retrieval failed.");
      }

      const verifyRes = await studentClient.post("/qr/verify", {
        timetableId: sessionId,
        token: generateRes.data.token,
      });

      if (!verifyRes.data?.success) {
        throw new Error("QR verification failed.");
      }

      const createdAttendanceId = toId(verifyRes.data.attendance);
      if (createdAttendanceId) {
        cleanupTasks.push(async () => {
          try {
            await adminClient.delete(`/attendance/${createdAttendanceId}`);
          } catch {}
        });
      }

      return {
        sessionId,
        attendanceCreated: Boolean(createdAttendanceId),
        attendanceAlreadyExisted: !createdAttendanceId,
      };
    });

    let requestPermissionId = null;

    await record("feedback:request-approve-withdraw-history-access", async () => {
      const createRes = await requesterClient.post("/feedback/permissions/request", {
        targetEvaluationId: toId(ownerTarget.evaluationId),
        currentSessionId: ownerTarget.currentSessionId
          ? toId(ownerTarget.currentSessionId)
          : undefined,
        reason: "Live smoke test request for historical evaluation access.",
      });

      if (!createRes.data?.success) {
        throw new Error("Historical access request creation failed.");
      }

      requestPermissionId = toId(createRes.data.permission);
      cleanupTasks.push(async () => {
        if (!requestPermissionId) return;
        await PermissionRequest.findByIdAndDelete(requestPermissionId);
      });

      const [myRequestsRes, incomingRes] = await Promise.all([
        requesterClient.get("/feedback/permissions/my"),
        adminClient.get("/feedback/permissions/incoming?status=PENDING"),
      ]);

      if (!myRequestsRes.data?.success || !incomingRes.data?.success) {
        throw new Error("Permission listing failed after request creation.");
      }

      const approveRes = await adminClient.post("/feedback/permissions/respond", {
        requestId: requestPermissionId,
        action: "APPROVED",
      });

      if (!approveRes.data?.success || approveRes.data.request?.status !== "APPROVED") {
        throw new Error("Permission approval failed.");
      }

      const withdrawRes = await adminClient.post("/feedback/permissions/withdraw", {
        requestId: requestPermissionId,
      });

      if (!withdrawRes.data?.success || withdrawRes.data.request?.status !== "WITHDRAWN") {
        throw new Error("Permission withdrawal failed.");
      }

      return {
        requestPermissionId,
        requesterUserId: requesterPanel.userId,
      };
    });

    let unlockPermissionId = null;

    await record("feedback:request-and-reject-unlock", async () => {
      const requestUnlockRes = await requesterClient.post(
        "/feedback/permissions/request-unlock",
        {
          targetEvaluationId: toId(unlockTargetId),
          reason: "Live smoke test unlock request.",
        },
      );

      if (!requestUnlockRes.data?.success) {
        throw new Error("Unlock request creation failed.");
      }

      unlockPermissionId = toId(requestUnlockRes.data.permission);
      cleanupTasks.push(async () => {
        if (!unlockPermissionId) return;
        await PermissionRequest.findByIdAndDelete(unlockPermissionId);
      });

      const incomingUnlockRes = await adminClient.get(
        "/feedback/permissions/incoming?status=PENDING",
      );

      if (!incomingUnlockRes.data?.success) {
        throw new Error("Admin incoming permissions listing failed.");
      }

      const rejectRes = await adminClient.post("/feedback/permissions/respond", {
        requestId: unlockPermissionId,
        action: "REJECTED",
        responseNote: "Live smoke rejection note.",
      });

      if (!rejectRes.data?.success || rejectRes.data.request?.status !== "REJECTED") {
        throw new Error("Unlock rejection failed.");
      }

      return {
        unlockPermissionId,
      };
    });
  } finally {
    while (cleanupTasks.length) {
      const cleanup = cleanupTasks.pop();
      try {
        await cleanup();
      } catch (error) {
        results.push({
          name: "cleanup",
          status: "failed",
          error: error.message,
        });
      }
    }

    await mongoose.connection.close();
  }

  const failed = results.filter((result) => result.status !== "passed");
  console.log(JSON.stringify({ apiBase: API_BASE, results }, null, 2));

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
