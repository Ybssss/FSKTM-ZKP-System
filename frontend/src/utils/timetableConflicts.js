export const normalizeDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

export const timeToMinutes = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const minutesToTime = (minutes) => {
  const normalized = ((Number(minutes) || 0) % 1440 + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
};

export const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && bStart < aEnd;

export const idOf = (value) => String(value?._id || value || "");
export const nameOf = (value) => value?.name || value?.userId || "-";
export const getStudent = (session) => session.student || session.students?.[0] || null;
export const getPanel = (session, index) =>
  session.panels?.[index] || session[`panel${index + 1}Id`] || null;

export const buildTimingConflictMap = ({
  reviewRows = [],
  sessions = [],
  panels = [],
} = {}) => {
  const conflicts = new Map();
  const add = (key, message) => {
    const messages = conflicts.get(key) || [];
    if (!messages.includes(message)) conflicts.set(key, [...messages, message]);
  };

  const rows = reviewRows.map((row) => {
    const panelEntries = [
      [idOf(row.panel1Id), row.panel1Name],
      [idOf(row.panel2Id), row.panel2Name],
    ].filter(([panelId]) => panelId);

    return {
      ...row,
      source: "review",
      sessionId: idOf(row.sessionId),
      studentId: idOf(row.studentId),
      date: normalizeDateKey(row.date),
      start: timeToMinutes(row.startTime),
      end: timeToMinutes(row.endTime),
      panels: panelEntries.map(([panelId]) => panelId),
      panelNames: Object.fromEntries(panelEntries),
    };
  });
  const reviewedSessionIds = new Set(rows.map((row) => row.sessionId).filter(Boolean));
  const reviewDates = new Set(rows.map((row) => row.date).filter(Boolean));
  const existingItems = sessions
    .filter((session) => String(session.status || "").toLowerCase() !== "cancelled")
    .map((session) => {
      const sessionId = idOf(session._id || session.id);
      const student = getStudent(session);
      const panelValues = session.panels?.length
        ? session.panels
        : [getPanel(session, 0), getPanel(session, 1)];
      const panelEntries = panelValues
        .map((panel) => [idOf(panel), nameOf(panel)])
        .filter(([panelId]) => panelId);
      return {
        source: "existing",
        sessionId,
        title:
          session.title ||
          session.sessionType?.replaceAll("_", " ") ||
          "Existing session",
        studentId: idOf(student),
        studentName: student?.name || "Student",
        date: normalizeDateKey(session.date),
        startTime: session.startTime || session.time || "",
        endTime: session.endTime || "",
        start: timeToMinutes(session.startTime || session.time),
        end: timeToMinutes(session.endTime),
        panels: panelEntries.map(([panelId]) => panelId),
        panelNames: Object.fromEntries(panelEntries),
      };
    })
    .filter((item) => item.date && reviewDates.has(item.date))
    .filter((item) => !item.sessionId || !reviewedSessionIds.has(item.sessionId));

  rows.forEach((row) => {
    if (!row.studentId) add(row.key, "Missing student.");
    if (!row.date) add(row.key, "Missing date.");
    if (row.start === null || row.end === null) add(row.key, "Invalid time frame.");
    if (row.panels.length !== 2) add(row.key, "Exactly 2 panels required.");
    if (new Set(row.panels).size !== row.panels.length) {
      add(row.key, "Panel 1 and Panel 2 are duplicated.");
    }
  });

  const allItems = [...rows, ...existingItems];
  const addToReviewRow = (item, message) => {
    if (item.source === "review") add(item.key, message);
  };
  const itemLabel = (item) =>
    item.source === "review"
      ? `row #${item.slotNo}`
      : "another scheduled session";
  const itemTime = (item) => `${item.startTime || "?"}-${item.endTime || "?"}`;
  const panelNameFor = (item, panelId) => {
    const directName = item.panelNames?.[panelId];
    if (directName && directName !== "-") return directName;
    const directoryName = nameOf(panels.find((panel) => idOf(panel) === panelId));
    return directoryName && directoryName !== "-" ? directoryName : "Selected panel";
  };

  for (let i = 0; i < allItems.length; i += 1) {
    for (let j = i + 1; j < allItems.length; j += 1) {
      const a = allItems[i];
      const b = allItems[j];
      if (a.source !== "review" && b.source !== "review") continue;
      if (a.sessionId && b.sessionId && a.sessionId === b.sessionId) continue;
      if (a.date !== b.date) continue;
      if (a.studentId && a.studentId === b.studentId) {
        addToReviewRow(
          a,
          `Student already scheduled on ${a.date} at ${itemTime(b)} in ${itemLabel(b)}.`,
        );
        addToReviewRow(
          b,
          `Student already scheduled on ${b.date} at ${itemTime(a)} in ${itemLabel(a)}.`,
        );
      }
      if (a.start === null || a.end === null || b.start === null || b.end === null) {
        continue;
      }
      if (!rangesOverlap(a.start, a.end, b.start, b.end)) continue;
      const sharedPanels = a.panels.filter((panelId) => b.panels.includes(panelId));
      sharedPanels.forEach((sharedPanel) => {
        addToReviewRow(
          a,
          `${panelNameFor(a, sharedPanel)} already booked at ${itemTime(b)} in ${itemLabel(b)}.`,
        );
        addToReviewRow(
          b,
          `${panelNameFor(b, sharedPanel)} already booked at ${itemTime(a)} in ${itemLabel(a)}.`,
        );
      });
    }
  }

  return conflicts;
};

export const buildPublishConflictMap = ({
  timingConflictMap = new Map(),
  reviewRows = [],
  isExistingBatchMode = false,
  selectedBatchId = "",
  bulkConfig = {},
} = {}) => {
  const conflicts = new Map(
    [...timingConflictMap.entries()].map(([key, messages]) => [key, [...messages]]),
  );
  const add = (key, message) =>
    conflicts.set(key, [...(conflicts.get(key) || []), message]);

  reviewRows
    .filter((row) => row.type === "draft")
    .forEach((row) => {
      if (isExistingBatchMode && !selectedBatchId) {
        add(row.key, "Select an existing batch before publishing.");
      }
      if (!String(bulkConfig.batchName || "").trim()) {
        add(row.key, "Batch name is required before publishing.");
      }
      if (!String(bulkConfig.academicSession || "").trim()) {
        add(row.key, "Academic session is required before publishing.");
      }
      if (!bulkConfig.rubricId) {
        add(row.key, "Rubric is required before publishing.");
      }
      if (!String(bulkConfig.venue || "").trim()) {
        add(row.key, "Online meeting link is required before publishing.");
      }
    });

  return conflicts;
};
