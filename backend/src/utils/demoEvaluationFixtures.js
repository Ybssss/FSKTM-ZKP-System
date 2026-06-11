const DEFAULT_QUANTITATIVE_SCORE = 4;

const PROGRESS_TEXT = {
  progress1: {
    summaryOfProgress:
      "The student has completed early research milestones after proposal approval, including refinement of objectives and initial system design.",
    commentsForImprovement:
      "The student should strengthen the literature gap, improve research planning, and prepare clearer evidence for the next progress review.",
    overallSuggestions:
      "Proceed to the next progress assessment after completing planned implementation milestones.",
  },
  progress2: {
    summaryOfProgress:
      "The student has demonstrated continued progress, including prototype improvement, preliminary validation, and preparation for pre-viva readiness.",
    commentsForImprovement:
      "The student should finalize data analysis, improve report structure, and prepare stronger justification before pre-viva.",
    overallSuggestions:
      "Proceed toward pre-viva preparation with continuous supervision and final documentation refinement.",
  },
};

const makeScoreMapFromValues = (rubric, values = {}) => {
  const map = {};

  (rubric?.criteria || [])
    .filter((criterion) => criterion.type === "quantitative")
    .forEach((criterion) => {
      map[criterion.key] = values[criterion.key] ?? DEFAULT_QUANTITATIVE_SCORE;
    });

  return map;
};

const calculateWeightedTotalMarks = (rubric, scores = {}) =>
  Number(
    (rubric?.criteria || [])
      .filter((criterion) => criterion.type === "quantitative")
      .reduce((sum, criterion) => {
        const score = Number(scores[criterion.key] || 0);
        const maxScore = Number(criterion.maxScore || 5);
        const weight = Number(criterion.weight || 0);

        return maxScore > 0 ? sum + (score / maxScore) * weight : sum;
      }, 0)
      .toFixed(2),
  );

const makeQualitativeMap = (rubric, text) => {
  const map = {};

  (rubric?.criteria || [])
    .filter((criterion) => criterion.type === "qualitative")
    .forEach((criterion) => {
      map[criterion.key] = text;
    });

  return map;
};

const inferProgressStageKey = (title = "") =>
  String(title).includes("Progress Assessment 1") ? "progress1" : "progress2";

const buildDemoCompletedEvaluationFields = ({
  rubric,
  sessionType,
  title = "",
}) => {
  if (sessionType === "PROGRESS_ASSESSMENT") {
    const stageKey = inferProgressStageKey(title);
    return {
      ...PROGRESS_TEXT[stageKey],
    };
  }

  if (sessionType === "PRE_VIVA") {
    const scores = makeScoreMapFromValues(rubric, {
      crit_a_title: 4,
      crit_b_abs: 4,
      crit_c_prob: 4,
      crit_d_obj: 4,
      crit_e_lit: 4,
      crit_f_meth: 4,
      crit_g_res: 4,
      crit_h_find: 4,
      crit_i_eth: 4,
      crit_j_contrib: 4,
      crit_k_conc: 4,
      crit_l_org2: 4,
      crit_m_lang2: 4,
      crit_n_ref2: 4,
      crit_o_pres2: 4,
      crit_p_delib: 4,
    });

    return {
      totalMarks: calculateWeightedTotalMarks(rubric, scores),
      scores,
      qualitativeFeedback: makeQualitativeMap(
        rubric,
        "The candidate demonstrates acceptable thesis readiness with minor improvements required before final submission.",
      ),
      overallComments:
        "The candidate is ready to proceed with minor amendments and improved presentation of findings.",
    };
  }

  const scores = makeScoreMapFromValues(rubric, {
    crit_a_title: 4,
    crit_b_exec_summary: 4,
    crit_c_problem: 4,
    crit_d_objective: 4,
    crit_e_literature: 4,
    crit_f_methodology: 4,
    crit_g_prelim: 4,
    crit_h_ethics: 4,
    crit_i_org: 4,
    crit_j_lang: 4,
    crit_k_ref: 4,
    crit_l_pres: 4,
  });

  return {
    totalMarks: calculateWeightedTotalMarks(rubric, scores),
    scores,
    qualitativeFeedback: makeQualitativeMap(
      rubric,
      "The proposal is acceptable. The research direction is clear and the methodology is suitable with minor refinement.",
    ),
    overallComments:
      "Good proposal foundation. The candidate can proceed after refining literature gap and methodology justification.",
  };
};

module.exports = {
  buildDemoCompletedEvaluationFields,
};
