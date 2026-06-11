const {
  PASS_THRESHOLD,
  buildEvaluationOutcomeMap,
  sanitizeEvaluationForStudent,
} = require("./evaluationWorkflow");

describe("evaluationWorkflow", () => {
  const sessionId = "session-1";
  const sessionType = "PROPOSAL_DEFENSE";
  const semester = "Semester 1, 2025/2026";
  const scoredRubric = {
    criteria: [{ key: "crit-1", type: "quantitative", weight: 100, maxScore: 5 }],
  };
  const qualitativeRubric = {
    criteria: [{ key: "prog-1", type: "qualitative" }],
  };

  const makeEvaluation = ({
    status = "COMPLETED",
    totalMarks = 80,
    formFiller = "Panel",
    evaluatorId,
    rubricId = scoredRubric,
    sessionType: evaluationSessionType = sessionType,
  } = {}) => ({
    sessionId,
    sessionType: evaluationSessionType,
    semester,
    status,
    totalMarks,
    formFiller,
    rubricId,
    evaluatorId:
      evaluatorId ||
      (formFiller === "Supervisor" ? "supervisor-1" : "panel-1"),
  });

  it("keeps results pending until all three evaluator submissions are completed", () => {
    const outcomes = buildEvaluationOutcomeMap([
      makeEvaluation({ evaluatorId: "panel-1", totalMarks: 80 }),
      makeEvaluation({ evaluatorId: "panel-2", totalMarks: 70 }),
      makeEvaluation({
        evaluatorId: "supervisor-1",
        formFiller: "Supervisor",
        status: "PENDING",
        totalMarks: 0,
      }),
    ]);

    expect(outcomes.get(sessionId)).toEqual({
      isPublished: false,
      status: "PENDING",
      passed: false,
      passThreshold: PASS_THRESHOLD,
      completedEvaluatorCount: 2,
      requiredEvaluatorCount: 3,
      usesQuantitativeScoring: true,
    });
  });

  it("publishes PASS after three completed evaluations meet the threshold", () => {
    const outcomes = buildEvaluationOutcomeMap([
      makeEvaluation({ evaluatorId: "panel-1", totalMarks: 80 }),
      makeEvaluation({ evaluatorId: "panel-2", totalMarks: 70 }),
      makeEvaluation({
        evaluatorId: "supervisor-1",
        formFiller: "Supervisor",
        totalMarks: 65,
      }),
    ]);

    expect(outcomes.get(sessionId)).toEqual({
      isPublished: true,
      status: "PASS",
      passed: true,
      passThreshold: PASS_THRESHOLD,
      completedEvaluatorCount: 3,
      requiredEvaluatorCount: 3,
      usesQuantitativeScoring: true,
    });
  });

  it("publishes FAIL after three completed evaluations fall below the threshold", () => {
    const outcomes = buildEvaluationOutcomeMap([
      makeEvaluation({ evaluatorId: "panel-1", totalMarks: 60 }),
      makeEvaluation({ evaluatorId: "panel-2", totalMarks: 55 }),
      makeEvaluation({
        evaluatorId: "supervisor-1",
        formFiller: "Supervisor",
        totalMarks: 50,
      }),
    ]);

    expect(outcomes.get(sessionId)).toEqual({
      isPublished: true,
      status: "FAIL",
      passed: false,
      passThreshold: PASS_THRESHOLD,
      completedEvaluatorCount: 3,
      requiredEvaluatorCount: 3,
      usesQuantitativeScoring: true,
    });
  });

  it("publishes qualitative-only progress assessments as completed feedback", () => {
    const outcomes = buildEvaluationOutcomeMap([
      makeEvaluation({
        evaluatorId: "panel-1",
        totalMarks: 0,
        rubricId: qualitativeRubric,
        sessionType: "PROGRESS_ASSESSMENT",
      }),
      makeEvaluation({
        evaluatorId: "panel-2",
        totalMarks: 0,
        rubricId: qualitativeRubric,
        sessionType: "PROGRESS_ASSESSMENT",
      }),
      makeEvaluation({
        evaluatorId: "supervisor-1",
        formFiller: "Supervisor",
        totalMarks: 0,
        rubricId: qualitativeRubric,
        sessionType: "PROGRESS_ASSESSMENT",
      }),
    ]);

    expect(outcomes.get(sessionId)).toEqual({
      isPublished: true,
      status: "COMPLETED",
      passed: null,
      passThreshold: null,
      completedEvaluatorCount: 3,
      requiredEvaluatorCount: 3,
      usesQuantitativeScoring: false,
    });
  });

  it("hides marks and narrative fields from students before publication", () => {
    const evaluation = {
      toObject: () => ({
        sessionId,
        sessionType,
        semester,
        scores: { crit_a_title: 4 },
        totalMarks: 80,
        qualitativeFeedback: { prog_1_summary: "Hidden" },
        overallComments: "Hidden",
        summaryOfProgress: "Hidden",
        commentsForImprovement: "Hidden",
        overallSuggestions: "Hidden",
      }),
    };

    const sanitized = sanitizeEvaluationForStudent(evaluation, {
      isPublished: false,
      status: "PENDING",
      passed: false,
      passThreshold: PASS_THRESHOLD,
      completedEvaluatorCount: 2,
      requiredEvaluatorCount: 3,
    });

    expect(sanitized.scores).toBeUndefined();
    expect(sanitized.totalMarks).toBeUndefined();
    expect(sanitized.qualitativeFeedback).toBeUndefined();
    expect(sanitized.overallComments).toBeUndefined();
    expect(sanitized.summaryOfProgress).toBeUndefined();
    expect(sanitized.commentsForImprovement).toBeUndefined();
    expect(sanitized.overallSuggestions).toBeUndefined();
    expect(sanitized.result.status).toBe("PENDING");
  });
});
