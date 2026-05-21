import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ClipboardCheck,
  Eye,
  X,
  Calculator,
  CheckCircle2,
  FileText,
  AlertCircle,
  Calendar,
  Lock,
  ShieldAlert,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const SCALE = [
  { label: "Exemplary", value: 4 },
  { label: "Proficient", value: 3 },
  { label: "Satisfactory", value: 2 },
  { label: "Foundational", value: 1 },
  { label: "Novice", value: 0 },
];

export default function EvaluationPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { id: urlId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedEval, setSelectedEval] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [scores, setScores] = useState({});
  const [qualFeedback, setQualFeedback] = useState({});
  const [overallComments, setOverallComments] = useState("");

  const [progressData, setProgressData] = useState({
    summaryOfProgress: "",
    commentsForImprovement: "",
    overallSuggestions: "",
  });

  useEffect(() => {
    loadEvaluations();
  }, [urlId]);

  const loadEvaluations = async () => {
    try {
      setLoading(true);

      const res = await api.get("/evaluations");
      let loadedEvaluations = res.data.data || res.data.evaluations || [];

      if (
        urlId &&
        !loadedEvaluations.some(
          (evaluation) => String(evaluation._id) === String(urlId),
        )
      ) {
        try {
          const detailRes = await api.get(`/evaluations/${urlId}`);
          const directEvaluation =
            detailRes.data.evaluation || detailRes.data.data;

          if (directEvaluation) {
            loadedEvaluations = [directEvaluation, ...loadedEvaluations];
          }
        } catch (detailError) {
          alert(
            detailError.response?.data?.message ||
              "You do not have permission to view this historical evaluation.",
          );
        }
      }

      setEvaluations(loadedEvaluations);
    } catch (error) {
      console.error("Error loading evaluation data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Send Unlock Request to Admin Dashboard
  const handleUnlockRequest = async () => {
    if (!selectedEval) return;

    const reason = window.prompt(
      "Please provide a reason for requesting this document to be unlocked (e.g., 'Need to correct a calculation error'):",
    );

    if (!reason) return; // User cancelled the prompt

    try {
      const payload = {
        targetEvaluationId: selectedEval._id,
        reason,
      };

      const res = await api.post(
        "/feedback/permissions/request-unlock",
        payload,
      );

      if (res.data.success) {
        alert(
          "✅ Unlock request sent to the Administration. You will be able to edit once approved.",
        );
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to send unlock request. You may already have a pending request.",
      );
    }
  };

  const handleUnlockOwnEvaluation = async () => {
    if (!selectedEval) return;

    if (!window.confirm("Unlock this completed evaluation for editing? You will need to resubmit it after changes.")) {
      return;
    }

    try {
      const res = await api.post(`/feedback/evaluations/${selectedEval._id}/unlock-self`);

      if (res.data.success) {
        alert("✅ Evaluation unlocked. You can now edit and resubmit it.");
        setSelectedEval((prev) => ({ ...prev, isUnlocked: true }));
        loadEvaluations();
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to unlock this evaluation.",
      );
    }
  };


  useEffect(() => {
    if (urlId && evaluations.length > 0 && !selectedEval) {
      const targetEval = evaluations.find((ev) => ev._id === urlId);
      if (targetEval) {
        openEvaluationModal(targetEval);
      }
    }
  }, [urlId, evaluations]);

  const calculateTotalScore = () => {
    if (!selectedEval?.rubricId?.criteria) return 0;

    const quantitativeCriteria = selectedEval.rubricId.criteria.filter(
      (c) => c.type === "quantitative",
    );
    if (quantitativeCriteria.length === 0) return 0;

    let totalEarned = 0;
    let maxPossible = 0;

    quantitativeCriteria.forEach((crit) => {
      const rawScore = scores[crit.key] || 0;
      const weight = crit.weight || 0;
      totalEarned += (rawScore / (crit.maxScore || 4)) * weight;
      maxPossible += weight;
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

      if (isScored) {
        const quantitativeCriteria =
          selectedEval.rubricId?.criteria?.filter(
            (c) => c.type === "quantitative",
          ) || [];
        if (Object.keys(scores).length < quantitativeCriteria.length) {
          alert("Please provide a score for ALL criteria before submitting.");
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        sessionId: selectedEval.sessionId._id || selectedEval.sessionId,
        sessionType: selectedEval.sessionType,
      };

      if (isScored) {
        payload.scores = scores;
        payload.qualitativeFeedback = qualFeedback;
        payload.totalMarks = parseFloat(calculateTotalScore());
        payload.overallComments = overallComments;
      } else {
        payload.summaryOfProgress = progressData.summaryOfProgress;
        payload.commentsForImprovement = progressData.commentsForImprovement;
        payload.overallSuggestions = progressData.overallSuggestions;
      }

      await api.post("/evaluations/submit", payload);
      alert("✅ Evaluation submitted successfully and is now LOCKED.");
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

    if (!urlId || urlId !== ev._id) {
      navigate(`/panel/evaluation/${ev._id}`, {
        replace: true,
        state: location.state,
      });
    }

    if (ev.status === "COMPLETED") {
      if (ev.sessionType === "PROGRESS_ASSESSMENT") {
        setProgressData({
          summaryOfProgress: ev.summaryOfProgress || "",
          commentsForImprovement: ev.commentsForImprovement || "",
          overallSuggestions: ev.overallSuggestions || "",
        });
      } else {
        setScores(ev.scores || {});
        setQualFeedback(ev.qualitativeFeedback || {});
        setOverallComments(ev.overallComments || "");
      }
    } else {
      const savedDraft = localStorage.getItem(`eval_draft_${ev._id}`);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setScores(parsed.scores || {});
        setQualFeedback(parsed.qualFeedback || {});
        setOverallComments(parsed.overallComments || "");
      } else {
        setScores({});
        setQualFeedback({});
        setOverallComments("");
      }
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

    if (location.state?.returnUrl) {
      navigate(location.state.returnUrl, { replace: true });
    } else {
      navigate("/panel/evaluation", { replace: true });
    }
  };

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (selectedEval && selectedEval.status === "PENDING") {
      const draft = { scores, qualFeedback, overallComments };
      localStorage.setItem(
        `eval_draft_${selectedEval._id}`,
        JSON.stringify(draft),
      );
    }
  }, [scores, qualFeedback, overallComments]);

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-700 bg-green-100 border-green-300";
    if (score >= 80) return "text-blue-700 bg-blue-100 border-blue-300";
    if (score >= 65) return "text-yellow-700 bg-yellow-100 border-yellow-300";
    if (score >= 50) return "text-orange-700 bg-orange-100 border-orange-300";
    return "text-red-700 bg-red-100 border-red-300";
  };

  // LOCK LOGIC: If it's completed, NO ONE can edit it.
  // Determine if the logged-in user is the actual author/evaluator of this document
  const currentUserId = user?.id || user?._id || user?.userId;
  const selectedEvaluatorId =
    selectedEval?.evaluatorId?._id || selectedEval?.evaluatorId;
  const isAuthor = String(selectedEvaluatorId || "") === String(currentUserId || "");

  // LOCK LOGIC:
  // 1. If it's completed, it's locked for EVERYONE.
  // 2. If it's pending, ONLY the actual author can edit it. Admins cannot edit someone else's pending form.
  const isCompleted = selectedEval?.status === "COMPLETED";
  const isUnlocked = selectedEval?.isUnlocked === true;

  const isLocked = isCompleted && !isUnlocked;
  const canEdit =
    isAuthor &&
    (selectedEval?.status === "PENDING" || (isCompleted && isUnlocked));

  const canDirectUnlock = isAdmin && isAuthor && isLocked;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search by Student Name or Matric No..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-1/3 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Session Info</th>
                  {isAdmin && <th className="p-4">Evaluator</th>}
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Final Score</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {evaluations
                  .filter(
                    (e) =>
                      e.studentId?.name
                        ?.toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      e.studentId?.matricNumber
                        ?.toLowerCase()
                        .includes(searchTerm.toLowerCase()),
                  )
                  .map((ev) => (
                    <tr key={ev._id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <p className="font-bold text-gray-900">
                          {ev.studentId?.name || "Unknown Student"}
                        </p>
                        <p className="text-xs font-mono text-gray-500">
                          {ev.studentId?.matricNumber || "No Matric"}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold uppercase border border-indigo-100 mb-1">
                          {ev.sessionType?.replace("_", " ")}
                        </span>
                        <p className="text-xs text-gray-500 font-semibold">
                          {ev.semester}
                        </p>
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-sm font-semibold text-gray-700">
                          {ev.evaluatorId?.name}
                        </td>
                      )}
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex px-3 py-1 rounded text-xs font-bold ${ev.status === "COMPLETED" ? "bg-green-100 text-green-700 border border-green-200" : "bg-yellow-100 text-yellow-700 border border-yellow-200"}`}
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
                            className={`inline-flex px-3 py-1.5 rounded-lg border font-bold text-sm shadow-sm ${getScoreColor(ev.totalMarks)}`}
                          >
                            {ev.totalMarks?.toFixed(2)}%
                          </div>
                        ) : (
                          <span className="text-gray-400 font-bold">--</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openEvaluationModal(ev)}
                          className={`px-5 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ml-auto ${
                            ev.status === "PENDING" && !isAdmin
                              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {ev.status === "PENDING" && !isAdmin ? (
                            <>
                              <FileText className="w-4 h-4" /> Evaluate
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" /> View Report
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedEval && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100] p-4 sm:p-6 lg:p-8 backdrop-blur-sm">
          <div className="bg-white shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col mx-auto rounded-xl overflow-hidden relative">
            <div className="px-8 py-5 border-b border-gray-200 flex items-center justify-between bg-white z-20 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                    {!isAdmin && !isLocked
                      ? "Conduct Evaluation"
                      : "Official Evaluation Report"}
                    {isLocked && <Lock className="w-4 h-4 text-red-500" />}
                  </h2>
                  <p className="text-sm font-semibold text-indigo-600">
                    {selectedEval.rubricId?.name ||
                      selectedEval.sessionType?.replace("_", " ")}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 bg-gray-50">
              {/* LOCK WARNING BANNER */}
              {isLocked && (isAdmin || isAuthor) && (
                <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
                  <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-red-900">
                      {isAdmin
                        ? "Officially Submitted Document"
                        : "Document Locked"}
                    </h3>

                    <p className="text-sm text-red-800 mt-1">
                      {isAdmin
                        ? "This evaluation has been submitted and is currently read-only. If you authored this evaluation, you can unlock it directly, edit, and resubmit."
                        : "This evaluation has been officially submitted and secured. To revise the scores or remarks, please submit an Unlock Request to the administration."}
                    </p>

                    {canDirectUnlock && (
                      <button
                        onClick={handleUnlockOwnEvaluation}
                        className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Lock className="w-3 h-3 inline mr-1" />
                        Unlock My Evaluation to Edit
                      </button>
                    )}

                    {isAuthor && !isAdmin && (
                      <button
                        onClick={handleUnlockRequest}
                        className="mt-3 bg-red-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
                      >
                        <Lock className="w-3 h-3 inline mr-1" />
                        Request Unlock to Edit
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="border border-gray-300 mb-8 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                  <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                    Section A: Candidate's & Examiner's Details
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="p-4 border-b md:border-b-0 md:border-r border-gray-300">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                      Candidate's Name
                    </p>
                    <p className="font-bold text-gray-900 text-lg">
                      {selectedEval.studentId?.name || "N/A"}
                    </p>
                  </div>
                  <div className="p-4 border-b border-gray-300 bg-gray-50">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                      Matric Number
                    </p>
                    <p className="font-mono font-bold text-gray-900 text-lg">
                      {selectedEval.studentId?.matricNumber || "N/A"}
                    </p>
                  </div>
                  <div className="p-4 border-t md:border-t-0 border-b md:border-b-0 md:border-r border-gray-300 bg-gray-50">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                      Academic Programme
                    </p>
                    <p className="font-semibold text-gray-900">
                      {selectedEval.studentId?.program || "N/A"}
                    </p>
                  </div>
                  <div className="p-4 border-t border-gray-300">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                      Semester / Session Type
                    </p>
                    <p className="font-semibold text-gray-900">
                      {selectedEval.semester} |{" "}
                      {selectedEval.sessionType?.replace("_", " ")}
                    </p>
                  </div>
                  <div className="p-4 border-t md:border-r border-gray-300">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                      Examiner's Name
                    </p>
                    <p className="font-bold text-indigo-700">
                      {selectedEval.evaluatorId?.name || "N/A"}
                    </p>
                  </div>
                  <div className="p-4 border-t border-gray-300 bg-gray-50 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                        Evaluation Status
                      </p>
                      <span
                        className={`inline-block px-3 py-1 rounded text-xs font-bold ${isLocked ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                      >
                        {selectedEval.status}
                      </span>
                    </div>
                    {isLocked &&
                      selectedEval.sessionType !== "PROGRESS_ASSESSMENT" && (
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                            Total Marks
                          </p>
                          <p className="text-2xl font-black text-green-600">
                            {selectedEval.totalMarks}%
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {selectedEval.studentId?.researchTitle && (
                <div className="mb-8 p-5 bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm">
                  <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-1">
                    Research Title
                  </p>
                  <p className="font-bold text-gray-900 text-lg leading-snug">
                    {selectedEval.studentId.researchTitle}
                  </p>
                </div>
              )}

              <form id="evalForm" onSubmit={handleSubmit}>
                {selectedEval.sessionType === "PROGRESS_ASSESSMENT" && (
                  <div className="space-y-6">
                    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-gray-100 px-4 py-3 border-b border-gray-300">
                        <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                          Section B: Progress Report
                        </span>
                      </div>
                      <div className="p-6 space-y-6">
                        <div>
                          <label className="block text-sm font-bold text-gray-900 mb-2">
                            Summary of Research Progress
                          </label>
                          <textarea
                            required
                            disabled={!canEdit}
                            rows="4"
                            className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-800"
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
                          <label className="block text-sm font-bold text-gray-900 mb-2">
                            Comments for Improvement
                          </label>
                          <textarea
                            required
                            disabled={!canEdit}
                            rows="4"
                            className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-800"
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
                          <label className="block text-sm font-bold text-gray-900 mb-2">
                            Overall Suggestions
                          </label>
                          <textarea
                            required
                            disabled={!canEdit}
                            rows="4"
                            className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-800"
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
                    </div>
                  </div>
                )}

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
                        <div className="bg-gray-900 text-white px-5 py-3 rounded-t-lg flex justify-between items-center shadow-md">
                          <span className="font-bold uppercase text-sm tracking-widest flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Section B: Detailed
                            Evaluation Rubric
                          </span>
                        </div>

                        <div className="space-y-6 mb-8">
                          {selectedEval.rubricId.criteria
                            ?.filter((c) => c.type === "quantitative")
                            .map((crit) => (
                              <div
                                key={crit.key}
                                className="border border-gray-300 bg-white rounded-b-lg overflow-hidden shadow-sm"
                              >
                                <div className="bg-gray-50 px-5 py-3 border-b border-gray-300 flex justify-between items-center">
                                  <h3 className="font-black text-gray-900">
                                    {crit.title}
                                  </h3>
                                  <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded text-xs font-bold">
                                    Weight: {crit.weight}%
                                  </span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-sm table-fixed">
                                    <thead>
                                      <tr className="bg-white border-b border-gray-200">
                                        {SCALE.map((s) => (
                                          <th
                                            key={s.value}
                                            className="p-3 border-r last:border-r-0 border-gray-200 text-center font-bold text-gray-500 text-xs uppercase tracking-wider w-1/5"
                                          >
                                            {s.label} ({s.value})
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-x divide-gray-200">
                                      <tr>
                                        {SCALE.map((s) => {
                                          const scaleKey =
                                            s.label.toLowerCase();
                                          const isSelected =
                                            scores[crit.key] === s.value;
                                          return (
                                            <td
                                              key={s.value}
                                              className={`p-4 align-top transition-colors relative ${!isAdmin && !isLocked ? "cursor-pointer hover:bg-blue-50" : ""} ${isSelected ? "bg-indigo-50 border-t-4 border-t-indigo-600" : ""}`}
                                              onClick={() =>
                                                !isAdmin &&
                                                !isLocked &&
                                                handleScoreChange(
                                                  crit.key,
                                                  s.value,
                                                )
                                              }
                                            >
                                              <div className="flex flex-col items-center">
                                                <input
                                                  type="radio"
                                                  name={crit.key}
                                                  required
                                                  disabled={!canEdit}
                                                  checked={isSelected}
                                                  onChange={() =>
                                                    handleScoreChange(
                                                      crit.key,
                                                      s.value,
                                                    )
                                                  }
                                                  className="w-5 h-5 accent-indigo-600 mb-3 cursor-pointer disabled:opacity-60"
                                                />
                                                <p
                                                  className={`text-xs text-justify leading-relaxed ${isSelected ? "text-indigo-900 font-bold" : "text-gray-600 font-medium"}`}
                                                >
                                                  {crit[scaleKey] ||
                                                    "No description provided."}
                                                </p>
                                              </div>
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                        </div>

                        {canEdit && (
                          <div className="bg-gradient-to-r from-gray-900 to-indigo-900 text-white p-6 rounded-xl flex justify-between items-center mb-8 shadow-xl">
                            <div>
                              <span className="block text-lg font-bold uppercase tracking-widest text-indigo-300">
                                Live Calculated Mark
                              </span>
                              <span className="block text-sm text-gray-400 mt-1">
                                Weighted average of all quantitative criteria
                              </span>
                            </div>
                            <span className="text-5xl font-black text-white">
                              {calculateTotalScore()}%
                            </span>
                          </div>
                        )}

                        <div className="border border-gray-300 bg-white rounded-lg overflow-hidden shadow-sm mb-8">
                          <div className="bg-gray-100 px-5 py-3 border-b border-gray-300">
                            <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                              Section C: Qualitative Feedback
                            </span>
                          </div>
                          <div className="p-6 space-y-6 bg-gray-50">
                            {selectedEval.rubricId.criteria
                              ?.filter((c) => c.type === "qualitative")
                              .map((crit) => (
                                <div
                                  key={crit.key}
                                  className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm"
                                >
                                  <label className="block text-sm font-bold text-indigo-900 mb-1">
                                    {crit.title}
                                  </label>
                                  {crit.description && (
                                    <p className="text-xs text-gray-500 mb-3 font-medium">
                                      {crit.description}
                                    </p>
                                  )}
                                  <textarea
                                    required
                                    disabled={!canEdit}
                                    rows="4"
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-800"
                                    placeholder="Write your detailed feedback here..."
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

                            <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
                              <label className="block text-sm font-bold text-gray-900 mb-2">
                                Overall Examiner Remarks
                              </label>
                              <p className="text-xs text-gray-500 mb-3 font-medium">
                                Provide final constructive feedback. This will
                                be indexed for the Historical Vault.
                              </p>
                              <textarea
                                required
                                disabled={!canEdit}
                                rows="5"
                                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-800"
                                placeholder="Final remarks..."
                                value={overallComments}
                                onChange={(e) =>
                                  setOverallComments(e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </form>
            </div>

            <div className="px-8 py-4 border-t border-gray-200 flex justify-end gap-3 bg-white z-20 flex-shrink-0">
              <button
                onClick={closeModal}
                type="button"
                className="px-6 py-2.5 bg-gray-100 border border-gray-300 text-gray-700 font-bold hover:bg-gray-200 rounded-lg transition-colors"
              >
                {!isAdmin && !isLocked ? "Cancel" : "Close Document"}
              </button>

              {/* ONLY show submit button if NOT locked */}
              {canEdit && (
                <button
                  type="submit"
                  form="evalForm"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 bg-indigo-600 text-white font-black rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center gap-2 shadow-md"
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
