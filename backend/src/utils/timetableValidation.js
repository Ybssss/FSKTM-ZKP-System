const cleanText = (value = "", max = 500) =>
  String(value)
    .normalize("NFKC")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const cleanArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const normalizeDateOnly = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : raw.slice(0, 10);
};

const parseTimeToMinutes = (timeValue) => {
  const raw = String(timeValue || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const idString = (value) => String(value?._id || value || "");

const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && bStart < aEnd;

const buildValidationItems = (items = []) =>
  items.map((item) => ({
    sessionId: idString(item.sessionId || item._id),
    studentId: idString(item.studentId || item.student || item.students?.[0]),
    panelIds: cleanArray(
      item.panelIds || item.panels || [item.panel1Id, item.panel2Id],
    ).map(idString),
    date: normalizeDateOnly(item.date),
    startTime: cleanText(item.startTime || item.time, 20),
    endTime: cleanText(item.endTime, 20),
    title: cleanText(item.title || "Session", 150),
  }));

const validateItems = (items) => {
  const errors = [];

  for (const item of items) {
    if (!item.studentId) errors.push(`${item.title}: missing student.`);
    if (!item.date) errors.push(`${item.title}: missing date.`);
    if (parseTimeToMinutes(item.startTime) === null) {
      errors.push(`${item.title}: invalid start time.`);
    }
    if (parseTimeToMinutes(item.endTime) === null) {
      errors.push(`${item.title}: invalid end time.`);
    }
    if (item.panelIds.length < 2) {
      errors.push(`${item.title}: exactly 2 panels required.`);
    }
    if (new Set(item.panelIds).size !== item.panelIds.length) {
      errors.push(`${item.title}: duplicate panel selected.`);
    }
  }

  const byStudentDate = new Map();
  for (const item of items) {
    const key = `${item.studentId}|${item.date}`;
    if (!item.studentId || !item.date) continue;
    if (byStudentDate.has(key)) {
      errors.push(
        `Student conflict: one student can only have one session per day (${item.title}).`,
      );
    }
    byStudentDate.set(key, item);
  }

  for (let i = 0; i < items.length; i += 1) {
    const a = items[i];
    const aStart = parseTimeToMinutes(a.startTime);
    const aEnd = parseTimeToMinutes(a.endTime);
    if (aStart === null || aEnd === null) continue;

    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j];
      if (a.date !== b.date) continue;
      const bStart = parseTimeToMinutes(b.startTime);
      const bEnd = parseTimeToMinutes(b.endTime);
      if (bStart === null || bEnd === null) continue;
      if (!rangesOverlap(aStart, aEnd, bStart, bEnd)) continue;

      const sharedPanels = a.panelIds.filter((panelId) =>
        b.panelIds.includes(panelId),
      );
      sharedPanels.forEach((panelId) => {
        errors.push(
          `Panel conflict: panel ${panelId} is assigned at overlapping time (${a.title} / ${b.title}).`,
        );
      });
    }
  }

  if (errors.length) {
    const err = new Error(errors.join("\n"));
    err.statusCode = 400;
    err.validationErrors = errors;
    throw err;
  }
};

module.exports = {
  buildValidationItems,
  cleanArray,
  cleanText,
  idString,
  normalizeDateOnly,
  parseTimeToMinutes,
  rangesOverlap,
  validateItems,
};
