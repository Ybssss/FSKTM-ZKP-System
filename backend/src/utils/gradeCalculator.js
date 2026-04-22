exports.calculateUTHMGrade = (panel1Marks, panel2Marks, sessionType) => {
  const averageMarks = (panel1Marks + panel2Marks) / 2;

  // 🔴 FIX: Logic for UPGRADING (Tables 4 & 5)
  if (sessionType === "UPGRADING") {
    if (averageMarks >= 80)
      return {
        average: averageMarks,
        recommendation: "RECOMMENDED AND APPROVED FOR UPGRADE",
      };
    return {
      average: averageMarks,
      recommendation: "NOT ENDORSED FOR CANDIDACY UPGRADE",
    };
  }

  if (sessionType === "PROPOSAL_DEFENSE" || sessionType === "PRE_VIVA") {
    if (averageMarks >= 90)
      return {
        average: averageMarks,
        recommendation: "PASS WITHOUT AMENDMENT",
      };
    if (averageMarks >= 80)
      return {
        average: averageMarks,
        recommendation: "PASS WITH MINOR AMENDMENT",
      };
    if (averageMarks >= 65)
      return {
        average: averageMarks,
        recommendation: "PASS WITH MAJOR AMENDMENT",
      };
    if (averageMarks >= 50)
      return {
        average: averageMarks,
        recommendation: "RE-EVALUATION OF PROPOSAL/THESIS DRAFT",
      };
    return { average: averageMarks, recommendation: "FAIL" };
  }

  // 🔴 FIX: Logic for MILESTONE/SYMPOSIUM (Table 1)
  if (sessionType === "MILESTONE") {
    if (averageMarks >= 84)
      return {
        average: averageMarks,
        recommendation: "Pass With Distinction",
        standing: "Good Standing",
      };
    if (averageMarks >= 75)
      return {
        average: averageMarks,
        recommendation: "Pass With Commendation",
        standing: "Good Standing",
      };
    if (averageMarks >= 70)
      return {
        average: averageMarks,
        recommendation: "Pass with Merit",
        standing: "Good Standing",
      };
    if (averageMarks >= 65)
      return {
        average: averageMarks,
        recommendation: "Good Pass",
        standing: "Good Standing",
      };
    if (averageMarks >= 60)
      return {
        average: averageMarks,
        recommendation: "Pass",
        standing: "Conditional Standing",
      };
    return {
      average: averageMarks,
      recommendation: "Fail",
      standing: "Fail Standing",
    };
  }
};
