import React, { useState, useEffect } from "react";
import {
  ClipboardCheck,
  Eye,
  X,
  Calculator,
  CheckCircle2,
  FileText,
  AlertCircle,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useLocation } from "react-router-dom";

const SCALE = [
  { label: "Exemplary", value: 4 },
  { label: "Proficient", value: 3 },
  { label: "Satisfactory", value: 2 },
  { label: "Foundational", value: 1 },
  { label: "Novice", value: 0 },
];

export default function EvaluationPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedEval, setSelectedEval] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State (Scored Rubric)
  const [scores, setScores] = useState({});
  const [qualFeedback, setQualFeedback] = useState({}); // 👈 Qualitative text answers
  const [overallComments, setOverallComments] = useState("");

  // Form State (Progress Assessment)
  const [progressData, setProgressData] = useState({
    summaryOfProgress: "",
    commentsForImprovement: "",
    overallSuggestions: "",
  });

  useEffect(() => {
    loadEvaluations();
  }, []);

  const loadEvaluations = async () => {
    try {
      setLoading(true);
      const res = await api.get("/evaluations");

      // DEBUG LOG
      console.log("API Response for Evaluations:", res.data);

      // Handle different possible response structures
      const evaluationData = res.data.data || res.data.evaluations || [];
      setEvaluations(evaluationData);
    } catch (error) {
      console.error("Error loading evaluation data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only run this check after evaluations have finished loading
    if (!loading && evaluations.length > 0) {
      const searchParams = new URLSearchParams(location.search);
      const targetSessionId = searchParams.get("sessionId");

      if (targetSessionId) {
        // Find the evaluation that matches this session AND belongs to the current user
        const targetEval = evaluations.find(
          (e) =>
            (e.sessionId?._id === targetSessionId ||
              e.sessionId === targetSessionId) &&
            e.evaluatorId?._id === user.id,
        );

        if (targetEval) {
          openEvaluationModal(targetEval);

          // Optional: Clean up the URL so it doesn't keep opening if they refresh
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      }
    }
  }, [evaluations, loading, location.search, user.id]);

  // Math: Calculate percentage based on (Total Earned / Max Possible) * 100
  // Note: Only counts criteria that are 'quantitative'
  const calculateTotalScore = () => {
    if (!selectedEval?.rubricId?.criteria) return 0;

    const quantitativeCriteria = selectedEval.rubricId.criteria.filter(
      (c) => c.type === "quantitative",
    );
    if (quantitativeCriteria.length === 0) return 0;

    let totalEarned = 0;
    let maxPossible = 0;

    quantitativeCriteria.forEach((crit) => {
      // Find the score the user selected, multiply by weight if your system uses weighted scores,
      // or just sum the raw values. Here we just sum the raw 0-4 scores.
      const score = scores[crit.key] || 0;
      totalEarned += score;
      maxPossible += crit.maxScore || 4;
    });

    return maxPossible > 0 ? ((totalEarned / maxPossible) * 100).toFixed(2) : 0;
  };

  const handleScoreChange = (criteriaKey, value) => {
    setScores((prev) => ({ ...prev, [criteriaKey]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const isScored =
        selectedEval.sessionType === "PROPOSAL_DEFENSE" ||
        selectedEval.sessionType === "PRE_VIVA";

      // Validation for Scored Rubrics
      if (isScored) {
        const quantitativeCriteria =
          selectedEval.rubricId?.criteria?.filter(
            (c) => c.type === "quantitative",
          ) || [];
        if (Object.keys(scores).length < quantitativeCriteria.length) {
          alert(
            "Please provide a score for ALL quantitative criteria in the table before submitting.",
          );
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        sessionId: selectedEval.sessionId._id,
        sessionType: selectedEval.sessionType,
      };

      if (isScored) {
        payload.scores = scores;
        payload.qualitativeFeedback = qualFeedback; // Send the text feedback
        payload.totalMarks = parseFloat(calculateTotalScore());
        payload.overallComments = overallComments;
      } else {
        payload.summaryOfProgress = progressData.summaryOfProgress;
        payload.commentsForImprovement = progressData.commentsForImprovement;
        payload.overallSuggestions = progressData.overallSuggestions;
      }

      await api.post("/evaluations/submit", payload);

      alert("✅ Evaluation submitted successfully!");
      closeModal();
      loadEvaluations();
    } catch (error) {
      alert(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to submit evaluation",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEvaluationModal = (ev) => {
    setSelectedEval(ev);
    if (ev.status === "COMPLETED") {
      if (ev.sessionType === "PROGRESS_ASSESSMENT") {
        setProgressData({
          summaryOfProgress: ev.summaryOfProgress,
          commentsForImprovement: ev.commentsForImprovement,
          overallSuggestions: ev.overallSuggestions,
        });
      } else {
        setScores(ev.scores || {});
        setQualFeedback(ev.qualitativeFeedback || {});
        setOverallComments(ev.overallComments || "");
      }
    } else {
      setScores({});
      setQualFeedback({});
      setOverallComments("");
      setProgressData({
        summaryOfProgress: "",
        commentsForImprovement: "",
        overallSuggestions: "",
      });
    }
  };

  const closeModal = () => {
    setSelectedEval(null);
    setScores({});
    setQualFeedback({});
    setOverallComments("");
  };

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-700 bg-green-100 border-green-300";
    if (score >= 80) return "text-blue-700 bg-blue-100 border-blue-300";
    if (score >= 65) return "text-yellow-700 bg-yellow-100 border-yellow-300";
    if (score >= 50) return "text-orange-700 bg-orange-100 border-orange-300";
    return "text-red-700 bg-red-100 border-red-300";
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-8 h-8 text-indigo-600" /> Pending &
            Completed Evaluations
          </h1>
          <p className="text-gray-600 mt-2">
            {isAdmin
              ? "Monitor system-wide evaluations."
              : "Complete your assigned panel evaluations here."}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : evaluations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No evaluations assigned to you yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Student</th>
                  <th className="p-4">Session Type</th>
                  <th className="p-4">Semester</th>
                  {isAdmin && <th className="p-4">Evaluator</th>}
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {evaluations.map((ev) => (
                  <tr key={ev._id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <p className="font-semibold">
                        {ev.studentId?.name || "Unknown Student"}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                        {ev.sessionType?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">{ev.semester}</td>
                    {isAdmin && (
                      <td className="p-4 text-sm text-gray-600">
                        {ev.evaluatorId?.name}
                      </td>
                    )}

                    <td className="p-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${ev.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                      >
                        {ev.status}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      {ev.sessionType === "PROGRESS_ASSESSMENT" ? (
                        <span className="text-gray-400 text-xs italic">
                          Text Only
                        </span>
                      ) : ev.status === "COMPLETED" ? (
                        <div
                          className={`inline-flex px-3 py-1 rounded-lg border font-bold text-sm ${getScoreColor(ev.totalMarks)}`}
                        >
                          {ev.totalMarks?.toFixed(2)}%
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">--</span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => openEvaluationModal(ev)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                          ev.status === "PENDING" && !isAdmin
                            ? "bg-indigo-600 text-white hover:bg-indigo-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {ev.status === "PENDING" && !isAdmin
                          ? "Evaluate Now"
                          : "View Report"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EVALUATION MODAL */}
      {selectedEval && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-xl">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {selectedEval.sessionType === "PROGRESS_ASSESSMENT" ? (
                  <FileText className="w-6 h-6 text-indigo-600" />
                ) : (
                  <Calculator className="w-6 h-6 text-indigo-600" />
                )}
                {selectedEval.status === "PENDING"
                  ? "Conduct Evaluation"
                  : "Evaluation Report"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Student Info Header */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">
                    Candidate Details
                  </p>
                  <h3 className="text-xl font-bold text-gray-900 mt-1">
                    {selectedEval.studentId?.name}
                  </h3>
                  <p className="text-gray-700 text-sm mt-1">
                    <strong>Session:</strong>{" "}
                    {selectedEval.sessionType?.replace("_", " ")} |{" "}
                    {selectedEval.semester}
                  </p>
                </div>
                {selectedEval.status === "COMPLETED" &&
                  selectedEval.sessionType !== "PROGRESS_ASSESSMENT" && (
                    <div
                      className={`px-6 py-3 rounded-xl border-2 text-center bg-white ${getScoreColor(selectedEval.totalMarks)}`}
                    >
                      <p className="text-xs font-bold uppercase mb-1">
                        Final Score
                      </p>
                      <p className="text-3xl font-black">
                        {selectedEval.totalMarks?.toFixed(2)}%
                      </p>
                    </div>
                  )}
              </div>

              <form id="evalForm" onSubmit={handleSubmit}>
                {/* 1. PROGRESS ASSESSMENT FORM (Text Only) */}
                {selectedEval.sessionType === "PROGRESS_ASSESSMENT" && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Summary of Research Progress
                      </label>
                      <textarea
                        required
                        disabled={selectedEval.status === "COMPLETED"}
                        rows="4"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-700"
                        value={progressData.summaryOfProgress}
                        onChange={(e) =>
                          setProgressData({
                            ...progressData,
                            summaryOfProgress: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Comments for Improvement
                      </label>
                      <textarea
                        required
                        disabled={selectedEval.status === "COMPLETED"}
                        rows="4"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-700"
                        value={progressData.commentsForImprovement}
                        onChange={(e) =>
                          setProgressData({
                            ...progressData,
                            commentsForImprovement: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Overall Suggestions
                      </label>
                      <textarea
                        required
                        disabled={selectedEval.status === "COMPLETED"}
                        rows="4"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-700"
                        value={progressData.overallSuggestions}
                        onChange={(e) =>
                          setProgressData({
                            ...progressData,
                            overallSuggestions: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {/* 2. SCORED RUBRIC (Proposal & Pre-Viva) */}
                {(selectedEval.sessionType === "PROPOSAL_DEFENSE" ||
                  selectedEval.sessionType === "PRE_VIVA") && (
                  <div>
                    {!selectedEval.rubricId ? (
                      <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg border border-red-200">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                        <p className="font-bold">Rubric Missing</p>
                        <p className="text-sm">
                          No rubric template was found for this session type.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* 2A. QUANTITATIVE CRITERIA (The Table) */}
                        {selectedEval.rubricId.criteria?.some(
                          (c) => c.type === "quantitative",
                        ) && (
                          <div className="overflow-x-auto border border-gray-200 rounded-xl mb-6 shadow-sm">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="bg-indigo-700 text-white">
                                  <th className="p-4 border-b border-indigo-800 w-1/4">
                                    Quantitative Criteria
                                  </th>
                                  {SCALE.map((s) => (
                                    <th
                                      key={s.value}
                                      className="p-3 border-b border-indigo-800 text-center font-semibold"
                                    >
                                      {s.label} ({s.value})
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                {selectedEval.rubricId.criteria
                                  .filter((c) => c.type === "quantitative")
                                  .map((crit) => (
                                    <tr
                                      key={crit.key}
                                      className="hover:bg-indigo-50/30 transition-colors"
                                    >
                                      <td className="p-4 bg-gray-50 border-r border-gray-200">
                                        <p className="font-bold text-gray-800">
                                          {crit.title}
                                        </p>
                                      </td>

                                      {SCALE.map((s) => {
                                        const scaleKey = s.label.toLowerCase();
                                        const isSelected =
                                          scores[crit.key] === s.value;
                                        return (
                                          <td
                                            key={s.value}
                                            className={`p-3 border-r border-gray-200 text-center align-top ${selectedEval.status === "PENDING" ? "cursor-pointer hover:bg-indigo-50" : ""} ${isSelected ? "bg-indigo-50 ring-2 ring-inset ring-indigo-500" : ""}`}
                                            onClick={() =>
                                              selectedEval.status ===
                                                "PENDING" &&
                                              handleScoreChange(
                                                crit.key,
                                                s.value,
                                              )
                                            }
                                          >
                                            <div className="flex flex-col items-center gap-2">
                                              <input
                                                type="radio"
                                                name={crit.key}
                                                required
                                                disabled={
                                                  selectedEval.status ===
                                                  "COMPLETED"
                                                }
                                                checked={isSelected}
                                                onChange={() =>
                                                  handleScoreChange(
                                                    crit.key,
                                                    s.value,
                                                  )
                                                }
                                                className="w-5 h-5 accent-indigo-600"
                                              />
                                              <p
                                                className={`text-xs text-justify leading-relaxed ${isSelected ? "text-indigo-900 font-medium" : "text-gray-600"}`}
                                              >
                                                {crit[scaleKey] ||
                                                  "No description provided."}
                                              </p>
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* LIVE SCORE TRACKER */}
                        {selectedEval.status === "PENDING" && (
                          <div className="bg-gray-900 text-white p-6 rounded-xl flex justify-between items-center mb-6 shadow-lg">
                            <span className="text-lg font-medium text-gray-300 uppercase tracking-widest">
                              Live Calculated Score
                            </span>
                            <span className="text-4xl font-black text-indigo-400">
                              {calculateTotalScore()}%
                            </span>
                          </div>
                        )}

                        {/* 2B. QUALITATIVE CRITERIA (The Textboxes) */}
                        {selectedEval.rubricId.criteria
                          ?.filter((c) => c.type === "qualitative")
                          .map((crit) => (
                            <div
                              key={crit.key}
                              className="mb-6 bg-blue-50 border border-blue-200 p-5 rounded-xl"
                            >
                              <label className="block text-sm font-bold text-blue-900 mb-1">
                                {crit.title}
                              </label>
                              {crit.description && (
                                <p className="text-xs text-blue-700 mb-3">
                                  {crit.description}
                                </p>
                              )}
                              <textarea
                                required
                                disabled={selectedEval.status === "COMPLETED"}
                                rows="4"
                                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-700"
                                placeholder="Write your feedback here..."
                                value={qualFeedback[crit.key] || ""}
                                onChange={(e) =>
                                  setQualFeedback((prev) => ({
                                    ...prev,
                                    [crit.key]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          ))}

                        {/* GENERAL OVERALL REMARKS */}
                        <div className="mt-8 pt-6 border-t border-gray-200">
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            Overall Remarks (Indexed for Historical Search)
                          </label>
                          <textarea
                            required
                            disabled={selectedEval.status === "COMPLETED"}
                            rows="4"
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-700"
                            placeholder="Provide constructive feedback... This will be searchable in future semesters."
                            value={overallComments}
                            onChange={(e) => setOverallComments(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </form>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl sticky bottom-0">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                {selectedEval.status === "PENDING" ? "Cancel" : "Close"}
              </button>

              {selectedEval.status === "PENDING" && !isAdmin && (
                <button
                  type="submit"
                  form="evalForm"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isSubmitting ? (
                    "Submitting..."
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Submit Official
                      Evaluation
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
