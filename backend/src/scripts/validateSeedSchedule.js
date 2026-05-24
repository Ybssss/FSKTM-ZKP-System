// src/scripts/validateSeedSchedule.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const Timetable = require("../models/Timetable");

const envPath = path.join(__dirname, "../../.env");
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("FATAL ERROR: MONGO_URI is undefined.");
  process.exit(1);
}

const dateKey = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const parseTimeToMinutes = (timeValue) => {
  const match = String(timeValue || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const reservedConcurrentBatchNames = new Set([
  "PIXEL",
  "QUANTUM",
  "WAVELET",
  "CYBER",
]);

const validate = (sessions) => {
  const violations = [];
  const studentDayMap = new Map();

  sessions.forEach((session) => {
    const sessionDate = dateKey(session.date);
    (session.students || []).forEach((student) => {
      const studentId = String(student?._id || student);
      const key = `${studentId}:${sessionDate}`;

      if (studentDayMap.has(key)) {
        violations.push({
          type: "STUDENT_DAY_DUPLICATE",
          message: `Student ${student?.name || studentId} has more than one session on ${sessionDate}.`,
          firstSession: studentDayMap.get(key),
          secondSession: session.title,
        });
      } else {
        studentDayMap.set(key, session.title);
      }
    });
  });

  const lifecycleByStudent = new Map();

  sessions.forEach((session) => {
    (session.students || []).forEach((student) => {
      const studentId = String(student?._id || student);
      if (!lifecycleByStudent.has(studentId)) lifecycleByStudent.set(studentId, []);
      lifecycleByStudent.get(studentId).push(session);
    });
  });

  lifecycleByStudent.forEach((studentSessions, studentId) => {
    const studentName =
      studentSessions[0]?.students?.find((student) => String(student?._id || student) === studentId)
        ?.name || studentId;
    const proposalSessions = studentSessions.filter(
      (session) => session.sessionType === "PROPOSAL_DEFENSE",
    );
    const progressSessions = studentSessions.filter(
      (session) => session.sessionType === "PROGRESS_ASSESSMENT",
    );
    const preVivaSessions = studentSessions.filter(
      (session) => session.sessionType === "PRE_VIVA",
    );

    if (proposalSessions.length !== 1) {
      violations.push({
        type: "LIFECYCLE_PROPOSAL_COUNT",
        message: `${studentName} must have exactly one Proposal Defense, found ${proposalSessions.length}.`,
        firstSession: proposalSessions.map((session) => session.title).join(", ") || "None",
        secondSession: "Expected exactly one Proposal Defense before progress assessments.",
      });
    }

    if (progressSessions.length < 2) {
      violations.push({
        type: "LIFECYCLE_PROGRESS_COUNT",
        message: `${studentName} must have at least two Progress Assessments before Pre-Viva, found ${progressSessions.length}.`,
        firstSession: progressSessions.map((session) => session.title).join(", ") || "None",
        secondSession: "Expected at least two Progress Assessments.",
      });
    }

    if (preVivaSessions.length !== 1) {
      violations.push({
        type: "LIFECYCLE_PREVIVA_COUNT",
        message: `${studentName} must have exactly one Pre-Viva, found ${preVivaSessions.length}.`,
        firstSession: preVivaSessions.map((session) => session.title).join(", ") || "None",
        secondSession: "Expected exactly one Pre-Viva after progress assessments.",
      });
    }

    if (
      proposalSessions.length === 1 &&
      progressSessions.length >= 2 &&
      preVivaSessions.length === 1
    ) {
      const proposalDate = new Date(proposalSessions[0].date).getTime();
      const latestProgressDate = Math.max(
        ...progressSessions.map((session) => new Date(session.date).getTime()),
      );
      const preVivaDate = new Date(preVivaSessions[0].date).getTime();

      if (!(proposalDate < latestProgressDate && latestProgressDate < preVivaDate)) {
        violations.push({
          type: "LIFECYCLE_ORDER",
          message: `${studentName} lifecycle order is invalid. Expected Proposal Defense → Progress Assessment(s) → Pre-Viva.`,
          firstSession: `${proposalSessions[0].title} / latest progress ${new Date(latestProgressDate).toISOString().slice(0, 10)}`,
          secondSession: preVivaSessions[0].title,
        });
      }
    }
  });

  const exactConcurrentBatchSessions = sessions.filter((session) =>
    reservedConcurrentBatchNames.has(String(session.batchName || "").toUpperCase()),
  );

  const exactConcurrentNames = new Set(
    exactConcurrentBatchSessions.map((session) => String(session.batchName).toUpperCase()),
  );

  for (const requiredName of reservedConcurrentBatchNames) {
    if (!exactConcurrentNames.has(requiredName)) {
      violations.push({
        type: "RESERVED_BATCH_NAME_MISSING",
        message: `Missing required same-day demo batch name ${requiredName}.`,
        firstSession: "Seeded same-day demo batches",
        secondSession: requiredName,
      });
    }
  }

  if (exactConcurrentNames.size !== reservedConcurrentBatchNames.size) {
    violations.push({
      type: "RESERVED_BATCH_NAME_SET",
      message:
        "Only PIXEL, QUANTUM, WAVELET, and CYBER should use the reserved same-day demo batch names.",
      firstSession: [...exactConcurrentNames].join(", ") || "None",
      secondSession: [...reservedConcurrentBatchNames].join(", "),
    });
  }

  const exactConcurrentDates = new Set(
    exactConcurrentBatchSessions.map((session) => dateKey(session.date)),
  );

  if (exactConcurrentDates.size !== 1) {
    violations.push({
      type: "RESERVED_BATCH_DATE_MISMATCH",
      message: "PIXEL, QUANTUM, WAVELET, and CYBER demo batches must be on the same date.",
      firstSession: [...exactConcurrentDates].join(", "),
      secondSession: "Expected one shared date.",
    });
  }

  exactConcurrentBatchSessions
    .filter((session) => session.sessionType !== "PROGRESS_ASSESSMENT")
    .forEach((session) => {
      violations.push({
        type: "RESERVED_BATCH_TYPE_MISMATCH",
        message: `${session.batchName} must be a Progress Assessment session.`,
        firstSession: session.title,
        secondSession: session.sessionType,
      });
    });

  for (const requiredName of reservedConcurrentBatchNames) {
    const rowCount = exactConcurrentBatchSessions.filter(
      (session) => String(session.batchName || "").toUpperCase() === requiredName,
    ).length;

    if (rowCount < 2) {
      violations.push({
        type: "RESERVED_BATCH_TOO_SMALL",
        message: `${requiredName} should contain at least two students for richer demo export/print rows.`,
        firstSession: `${requiredName} row count: ${rowCount}`,
        secondSession: "Expected at least two timetable rows.",
      });
    }
  }

  for (let i = 0; i < sessions.length; i += 1) {
    const a = sessions[i];
    const aDate = dateKey(a.date);
    const aStart = parseTimeToMinutes(a.startTime);
    const aEnd = parseTimeToMinutes(a.endTime);

    if (aStart === null || aEnd === null) continue;

    for (let j = i + 1; j < sessions.length; j += 1) {
      const b = sessions[j];
      const bDate = dateKey(b.date);
      if (aDate !== bDate) continue;

      const bStart = parseTimeToMinutes(b.startTime);
      const bEnd = parseTimeToMinutes(b.endTime);
      if (bStart === null || bEnd === null) continue;

      const overlaps = aStart < bEnd && bStart < aEnd;
      if (!overlaps) continue;

      const aPanels = new Map(
        (a.panels || []).map((panel) => [String(panel?._id || panel), panel]),
      );
      const crashedPanel = (b.panels || []).find((panel) =>
        aPanels.has(String(panel?._id || panel)),
      );

      if (crashedPanel) {
        violations.push({
          type: "PANEL_TIME_CRASH",
          message: `Panel ${crashedPanel?.name || crashedPanel} has overlapping sessions on ${aDate}.`,
          firstSession: `${a.title} (${a.startTime}-${a.endTime})`,
          secondSession: `${b.title} (${b.startTime}-${b.endTime})`,
        });
      }
    }
  }

  return violations;
};

const main = async () => {
  try {
    await mongoose.connect(MONGO_URI);

    const sessions = await Timetable.find({})
      .populate("students", "name userId matricNumber")
      .populate("panels", "name userId")
      .sort({ date: 1, startTime: 1 })
      .lean();

    const violations = validate(sessions);

    console.log(`Checked ${sessions.length} timetable session(s).`);

    if (violations.length > 0) {
      console.error(`❌ Schedule validation failed: ${violations.length} violation(s).`);
      violations.forEach((violation, index) => {
        console.error(`\n${index + 1}. ${violation.type}`);
        console.error(violation.message);
        console.error(`First: ${violation.firstSession}`);
        console.error(`Second: ${violation.secondSession}`);
      });
      process.exitCode = 1;
      return;
    }

    console.log(
      "✅ Schedule validation passed: one student/day/session, no panel-time crashes, valid Proposal → Progress → Pre-Viva lifecycle, and four same-day PIXEL/QUANTUM/WAVELET/CYBER Progress Assessment demo batches with multiple students.",
    );
  } catch (error) {
    console.error("❌ Validation error:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

main();
