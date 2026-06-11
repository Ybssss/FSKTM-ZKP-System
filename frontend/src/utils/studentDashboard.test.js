import test from "node:test";
import assert from "node:assert/strict";
import { countPublishedEvaluationGroups } from "./studentDashboard.js";

test("countPublishedEvaluationGroups counts one published session once across multiple evaluator records", () => {
  const count = countPublishedEvaluationGroups([
    {
      sessionId: "session-1",
      result: { isPublished: true },
    },
    {
      sessionId: "session-1",
      result: { isPublished: true },
    },
    {
      sessionId: "session-1",
      result: { isPublished: true },
    },
  ]);

  assert.equal(count, 1);
});

test("countPublishedEvaluationGroups ignores unpublished evaluations", () => {
  const count = countPublishedEvaluationGroups([
    {
      sessionId: "session-1",
      result: { isPublished: false },
    },
    {
      sessionId: "session-2",
      result: { isPublished: true },
    },
  ]);

  assert.equal(count, 1);
});

test("countPublishedEvaluationGroups falls back to sessionType and semester when sessionId is absent", () => {
  const count = countPublishedEvaluationGroups([
    {
      sessionType: "PROGRESS_ASSESSMENT",
      semester: "Semester 1",
      result: { isPublished: true },
    },
    {
      sessionType: "PROGRESS_ASSESSMENT",
      semester: "Semester 1",
      result: { isPublished: true },
    },
    {
      sessionType: "PRE_VIVA",
      semester: "Semester 1",
      result: { isPublished: true },
    },
  ]);

  assert.equal(count, 2);
});
