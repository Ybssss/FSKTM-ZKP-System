exports.calculateUTHMGrade = (panel1Marks, panel2Marks) => {
  // If one panel hasn't graded yet, we don't have a final recommendation
  if (panel1Marks == null || panel2Marks == null) {
    return "PENDING SECOND EVALUATION";
  }

  const averageMarks = (panel1Marks + panel2Marks) / 2;

  // According to UTHM Grade Recommendation Table 2, 3, 6, and 7
  // (Proposal Defense & Pre-Viva use the exact same scale)
  if (averageMarks >= 90 && averageMarks <= 100)
    return "PASS WITHOUT AMENDMENT";
  if (averageMarks >= 80 && averageMarks <= 89.99)
    return "PASS WITH MINOR AMENDMENT";
  if (averageMarks >= 65 && averageMarks <= 79.99)
    return "PASS WITH MAJOR AMENDMENT";
  if (averageMarks >= 50 && averageMarks <= 64.99)
    return "RE-EVALUATION OF PROPOSAL/THESIS DRAFT";

  return "FAIL";
};
