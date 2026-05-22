const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Timetable = require("../models/Timetable");

dotenv.config({ path: path.join(__dirname, "../../.env") });

const normalizeDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const toMinutes = (value) => {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const overlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
const id = (value) => String(value?._id || value || "");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing.");
  await mongoose.connect(process.env.MONGO_URI);

  const sessions = await Timetable.find({ status: { $ne: "cancelled" } })
    .populate("students", "name userId matricNumber")
    .populate("panels", "name userId")
    .sort({ date: 1, batchName: 1, startTime: 1 })
    .lean();

  const errors = [];
  const studentDay = new Map();

  for (const session of sessions) {
    const date = normalizeDateKey(session.date);
    const student = session.students?.[0];
    const studentId = id(student);
    if (!date || !studentId) continue;
    const key = `${studentId}|${date}`;
    if (studentDay.has(key)) {
      errors.push(
        `STUDENT-DAY DUPLICATE: ${student.name || student.userId} has more than one session on ${date}: ${studentDay.get(key).title} AND ${session.title}`,
      );
    }
    studentDay.set(key, session);
  }

  for (let i = 0; i < sessions.length; i += 1) {
    const a = sessions[i];
    const aDate = normalizeDateKey(a.date);
    const aStart = toMinutes(a.startTime);
    const aEnd = toMinutes(a.endTime);
    if (aStart === null || aEnd === null) continue;

    for (let j = i + 1; j < sessions.length; j += 1) {
      const b = sessions[j];
      const bDate = normalizeDateKey(b.date);
      if (aDate !== bDate) continue;
      const bStart = toMinutes(b.startTime);
      const bEnd = toMinutes(b.endTime);
      if (bStart === null || bEnd === null) continue;
      if (!overlap(aStart, aEnd, bStart, bEnd)) continue;

      const aPanels = (a.panels || []).map(id);
      const bPanels = (b.panels || []).map(id);
      const shared = aPanels.find((panelId) => bPanels.includes(panelId));
      if (shared) {
        const panel = [...(a.panels || []), ...(b.panels || [])].find((p) => id(p) === shared);
        errors.push(
          `PANEL-TIME CONFLICT: ${panel?.name || shared} overlaps on ${aDate}: ${a.title} (${a.startTime}-${a.endTime}) AND ${b.title} (${b.startTime}-${b.endTime})`,
        );
      }
    }
  }

  const batches = new Map();
  for (const session of sessions) {
    const key = `${normalizeDateKey(session.date)}|${session.batchName || session.batchId || "No Batch"}`;
    batches.set(key, (batches.get(key) || 0) + 1);
  }

  console.log("\n📅 Batch summary");
  [...batches.entries()].forEach(([key, count]) => console.log(`${key}: ${count} session(s)`));

  if (errors.length) {
    console.error("\n❌ Schedule validation failed:");
    errors.forEach((e) => console.error(`- ${e}`));
    process.exitCode = 1;
  } else {
    console.log("\n✅ Schedule validation passed: one student/day/session and no panel-time crashes.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
