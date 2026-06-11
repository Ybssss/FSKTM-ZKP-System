const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Evaluation = require("../models/Evaluation");
require("../models/Rubric");
require("../models/Timetable");
const {
  buildDemoCompletedEvaluationFields,
} = require("../utils/demoEvaluationFixtures");

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is required.");
  process.exit(1);
}

const isDryRun = process.argv.includes("--dry-run");

const run = async () => {
  await mongoose.connect(MONGO_URI);

  const supervisorEvaluations = await Evaluation.find({
    formFiller: "Supervisor",
    status: "PENDING",
  })
    .populate("rubricId", "criteria")
    .populate("sessionId", "title")
    .lean();

  let eligibleCount = 0;
  let updatedCount = 0;

  for (const supervisorEvaluation of supervisorEvaluations) {
    const panelEvaluations = await Evaluation.find({
      sessionId: supervisorEvaluation.sessionId?._id || supervisorEvaluation.sessionId,
      studentId: supervisorEvaluation.studentId,
      formFiller: "Panel",
      status: "COMPLETED",
    })
      .select("_id")
      .lean();

    if (panelEvaluations.length < 2) {
      continue;
    }

    eligibleCount += 1;

    if (isDryRun) {
      continue;
    }

    await Evaluation.findByIdAndUpdate(supervisorEvaluation._id, {
      $set: {
        ...buildDemoCompletedEvaluationFields({
          rubric: supervisorEvaluation.rubricId,
          sessionType: supervisorEvaluation.sessionType,
          title: supervisorEvaluation.sessionId?.title || "",
        }),
        status: "COMPLETED",
        isUnlocked: false,
        lastRelockedAt: new Date(),
      },
    });

    updatedCount += 1;
  }

  console.log(
    JSON.stringify(
      {
        dryRun: isDryRun,
        pendingSupervisorEvaluations: supervisorEvaluations.length,
        eligibleCount,
        updatedCount,
      },
      null,
      2,
    ),
  );
};

run()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
