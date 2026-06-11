import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublishConflictMap,
  buildTimingConflictMap,
} from "./timetableConflicts.js";

test("buildTimingConflictMap reports both shared panel conflicts on overlapping rows", () => {
  const conflictMap = buildTimingConflictMap({
    reviewRows: [
      {
        key: "row-a",
        slotNo: 1,
        studentId: "student-1",
        studentName: "Ali",
        panel1Id: "panel-1",
        panel2Id: "panel-2",
        panel1Name: "Dr One",
        panel2Name: "Dr Two",
        date: "2026-06-11",
        startTime: "09:00",
        endTime: "10:00",
      },
      {
        key: "row-b",
        slotNo: 2,
        studentId: "student-2",
        studentName: "Bala",
        panel1Id: "panel-1",
        panel2Id: "panel-2",
        panel1Name: "Dr One",
        panel2Name: "Dr Two",
        date: "2026-06-11",
        startTime: "09:30",
        endTime: "10:30",
      },
    ],
    sessions: [],
    panels: [],
  });

  assert.deepEqual(conflictMap.get("row-a"), [
    'Panel conflict: Dr One is also assigned to row #2 (Bala) at 09:30-10:30, which overlaps this row at 09:00-10:00.',
    'Panel conflict: Dr Two is also assigned to row #2 (Bala) at 09:30-10:30, which overlaps this row at 09:00-10:00.',
  ]);
});

test("buildTimingConflictMap reports same-student same-day conflict against existing session", () => {
  const conflictMap = buildTimingConflictMap({
    reviewRows: [
      {
        key: "row-a",
        slotNo: 1,
        studentId: "student-1",
        studentName: "Ali",
        panel1Id: "panel-3",
        panel2Id: "panel-4",
        panel1Name: "Dr Three",
        panel2Name: "Dr Four",
        date: "2026-06-11",
        startTime: "14:00",
        endTime: "15:00",
      },
    ],
    sessions: [
      {
        _id: "existing-1",
        title: "Proposal Defense - Ali",
        student: { _id: "student-1", name: "Ali" },
        panels: [{ _id: "panel-1", name: "Dr One" }, { _id: "panel-2", name: "Dr Two" }],
        date: "2026-06-11",
        startTime: "09:00",
        endTime: "10:00",
        status: "scheduled",
      },
    ],
    panels: [],
  });

  assert.equal(
    conflictMap.get("row-a")?.[0],
    'Student conflict: Ali already has existing session "Proposal Defense - Ali" on 2026-06-11 at 09:00-10:00. One student can only have one session per day.',
  );
});

test("buildPublishConflictMap adds missing publish prerequisites to draft rows", () => {
  const conflictMap = buildPublishConflictMap({
    timingConflictMap: new Map(),
    reviewRows: [{ key: "draft-1", type: "draft" }],
    isExistingBatchMode: true,
    selectedBatchId: "",
    bulkConfig: {
      batchName: "",
      academicSession: "",
      rubricId: "",
      venue: "",
    },
  });

  assert.deepEqual(conflictMap.get("draft-1"), [
    "Select an existing batch before publishing.",
    "Batch name is required before publishing.",
    "Academic session is required before publishing.",
    "Rubric is required before publishing.",
    "Online meeting link is required before publishing.",
  ]);
});
