import React, { useState, useEffect } from "react";
import {
  Eye,
  FileText,
  TrendingUp,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Send,
  Shield,
  X,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function HistoricalFeedbackPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [evaluations, setEvaluations] = useState([]);
  const [lockedEvals, setLockedEvals] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & UI State
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [activeTab, setActiveTab] = useState("my-access"); // 'my-access' | 'locked' | 'requests'
  const [requestReason, setRequestReason] = useState("");
  const [requestModalData, setRequestModalData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/evaluations");

      const completed = (res.data.data || []).filter(
        (e) => e.status === "COMPLETED",
      );
      setEvaluations(completed);
      setLockedEvals(res.data.locked || []);

      if (user?.role === "panel") {
        const reqRes = await api.get("/evaluations/pending-requests");
        setIncomingRequests(reqRes.data.data || []);
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post("/evaluations/request-access", {
        targetEvaluationId: requestModalData._id,
        reason: requestReason,
      });
      alert("Access request sent successfully!");
      setRequestModalData(null);
      setRequestReason("");
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to send request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRespondToRequest = async (requestId, action) => {
    if (
      !window.confirm(
        `Are you sure you want to ${action.toLowerCase()} this request?`,
      )
    )
      return;
    try {
      await api.post("/evaluations/respond-request", { requestId, action });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || `Failed to respond to request.`);
    }
  };

  const getScoreColor = (score) => {
    if (!score && score !== 0) return "text-gray-500";
    if (score >= 80) return "text-green-600";
    if (score >= 65) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Historical Feedback Vault
          </h1>
          <p className="text-gray-600 mt-2">
            View past feedback or manage access requests.
          </p>
        </div>

        {user?.role === "panel" && (
          <div className="flex bg-gray-200 p-1 rounded-lg self-start">
            <button
              onClick={() => setActiveTab("my-access")}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${activeTab === "my-access" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}
            >
              My Access
            </button>
            <button
              onClick={() => setActiveTab("locked")}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-1 ${activeTab === "locked" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}
            >
              <Lock className="w-4 h-4" /> Locked Records
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`relative px-4 py-2 rounded-md font-bold text-sm transition-all ${activeTab === "requests" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600"}`}
            >
              Pending Approvals
              {incomingRequests.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                  {incomingRequests.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-500 font-bold">
          Loading historical data...
        </div>
      ) : (
        <>
          {/* TAB 1: MY ACCESS */}
          {(activeTab === "my-access" || isAdmin) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {evaluations.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    No historical records available.
                  </div>
                )}
                {evaluations.map((ev) => (
                  <div
                    key={ev._id}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">
                            {ev.studentId?.name || "Unknown Student"}
                          </h3>
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-200 text-gray-700">
                            {ev.sessionType?.replace("_", " ")}
                          </span>
                          {ev.evaluatorId?._id !== user.id && !isAdmin && (
                            <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                              <Unlock className="w-3 h-3" /> Access Granted
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3 bg-gray-50 p-3 rounded border">
                          <div>
                            <span className="font-semibold block text-xs uppercase text-gray-400">
                              Evaluator
                            </span>{" "}
                            {ev.evaluatorId?.name || "Unknown"}
                          </div>
                          <div>
                            <span className="font-semibold block text-xs uppercase text-gray-400">
                              Semester
                            </span>{" "}
                            {ev.sessionId?.semester || "Unknown"}
                          </div>
                          <div>
                            <span className="font-semibold block text-xs uppercase text-gray-400">
                              Score
                            </span>{" "}
                            <span
                              className={`font-bold ${getScoreColor(ev.totalMarks)}`}
                            >
                              {ev.sessionType === "PROGRESS_ASSESSMENT"
                                ? "N/A"
                                : `${ev.totalMarks}%`}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 italic border-l-4 border-indigo-200 pl-3">
                          "
                          {ev.sessionType === "PROGRESS_ASSESSMENT"
                            ? ev.summaryOfProgress || "No summary provided."
                            : ev.overallComments ||
                              "No overall comments provided."}
                          "
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedEvaluation(ev)}
                        className="w-full md:w-auto px-5 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors"
                      >
                        <Eye className="w-5 h-5" /> View Full Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: LOCKED RECORDS */}
          {activeTab === "locked" && !isAdmin && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b flex items-center gap-3">
                <Lock className="w-5 h-5 text-gray-500" />
                <p className="text-sm text-gray-600">
                  These are historical evaluations for your currently assigned
                  students, authored by other panels. You must request
                  permission to read them.
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {lockedEvals.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    No locked records found for your current students.
                  </div>
                )}
                {lockedEvals.map((locked) => (
                  <div
                    key={locked._id}
                    className="p-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-white hover:bg-gray-50"
                  >
                    <div className="w-full md:w-auto">
                      <h3 className="text-lg font-bold text-gray-900">
                        {locked.studentId?.name}
                      </h3>
                      <div className="flex flex-wrap gap-2 items-center mt-2">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600 uppercase">
                          {locked.sessionType?.replace("_", " ")}
                        </span>
                        <span className="text-sm text-gray-500">
                          Semester: {locked.semester}
                        </span>
                        <span className="text-sm text-gray-500 ml-4">
                          Evaluator:{" "}
                          <strong className="text-gray-700">
                            {locked.evaluatorId?.name}
                          </strong>
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setRequestModalData(locked)}
                      className="w-full md:w-auto px-5 py-2.5 bg-gray-800 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-black flex justify-center items-center gap-2"
                    >
                      <Lock className="w-4 h-4" /> Request Access
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PENDING APPROVALS */}
          {activeTab === "requests" && !isAdmin && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
                <Shield className="w-5 h-5 text-indigo-700" />
                <p className="text-sm text-indigo-900 font-semibold">
                  Other panels are requesting access to evaluations you
                  authored.
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {incomingRequests.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    You have no pending access requests.
                  </div>
                )}
                {incomingRequests.map((req) => (
                  <div key={req._id} className="p-6 bg-white hover:bg-gray-50">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1">
                          Request From Panel:
                        </p>
                        <h3 className="text-lg font-bold text-gray-900">
                          {req.requestingPanelId?.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {req.requestingPanelId?.email}
                        </p>
                      </div>
                      <div className="md:text-right">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1">
                          Wants to view record of:
                        </p>
                        <p className="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-block">
                          {req.studentId?.name}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {req.targetEvaluationId?.sessionType?.replace(
                            "_",
                            " ",
                          )}{" "}
                          ({req.targetEvaluationId?.semester})
                        </p>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 relative">
                      <div className="absolute -top-3 left-4 bg-gray-50 px-2 text-xs font-bold text-gray-500 uppercase">
                        Reason for request
                      </div>
                      <p className="text-sm text-gray-800 italic leading-relaxed">
                        "{req.reason}"
                      </p>
                    </div>
                    <div className="flex justify-end gap-3 border-t pt-4">
                      <button
                        onClick={() =>
                          handleRespondToRequest(req._id, "REJECTED")
                        }
                        className="px-5 py-2.5 border-2 border-red-200 text-red-600 bg-white hover:bg-red-50 font-bold rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <XCircle className="w-5 h-5" /> Reject
                      </button>
                      <button
                        onClick={() =>
                          handleRespondToRequest(req._id, "APPROVED")
                        }
                        className="px-5 py-2.5 bg-green-600 text-white hover:bg-green-700 font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                      >
                        <CheckCircle className="w-5 h-5" /> Grant Access
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* REQUEST ACCESS MODAL */}
      {requestModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Lock className="w-6 h-6 text-gray-700" /> Request Record Access
            </h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              You are requesting permission from{" "}
              <strong>{requestModalData.evaluatorId?.name}</strong> to view
              their evaluation of{" "}
              <strong>{requestModalData.studentId?.name}</strong>.
            </p>

            <form onSubmit={handleRequestAccess}>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Reason for Access *
              </label>
              <textarea
                required
                rows="4"
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-6"
                placeholder="e.g., I am evaluating this student's Pre-Viva today and need to verify their Proposal feedback..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRequestModalData(null)}
                  className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-gray-900 text-white font-bold rounded-lg shadow hover:bg-black flex items-center gap-2 transition-colors"
                >
                  {actionLoading ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW EVALUATION MODAL */}
      {selectedEvaluation && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 sm:p-6 lg:p-8 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 flex flex-col max-h-[90vh] overflow-hidden">
            {/* DOCUMENT HEADER */}
            <div className="bg-indigo-900 p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-indigo-500 relative">
              <button
                onClick={() => setSelectedEvaluation(null)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              <div className="text-center md:text-left w-full mt-4 md:mt-0">
                <span className="inline-block px-3 py-1 bg-white/10 rounded text-xs font-bold tracking-widest uppercase mb-3 border border-white/20">
                  {selectedEvaluation.rubricId?.name || "Official Record"}
                </span>
                <h2 className="text-3xl font-black uppercase tracking-wide">
                  {selectedEvaluation.sessionType?.replace("_", " ")}
                </h2>
                <p className="text-indigo-200 font-medium mt-2 flex items-center justify-center md:justify-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" /> Historical
                  Vault Copy • {selectedEvaluation.semester}
                </p>
              </div>

              {selectedEvaluation.sessionType !== "PROGRESS_ASSESSMENT" && (
                <div className="bg-white text-gray-900 px-8 py-5 rounded-xl text-center shadow-2xl min-w-[180px] border-2 border-indigo-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-400">
                    Final Official Score
                  </p>
                  <p className="text-5xl font-black text-indigo-700">
                    {selectedEvaluation.totalMarks}%
                  </p>
                </div>
              )}
            </div>

            {/* DOCUMENT BODY */}
            <div className="p-8 overflow-y-auto bg-gray-50 flex-1">
              {/* SECTION A */}
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
                      {selectedEvaluation.studentId?.name}
                    </p>
                  </div>
                  <div className="p-4 border-b border-gray-300 bg-gray-50">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                      Matric Number
                    </p>
                    <p className="font-mono font-bold text-gray-900 text-lg">
                      {selectedEvaluation.studentId?.matricNumber ||
                        selectedEvaluation.studentId?.userId}
                    </p>
                  </div>
                  <div className="p-4 border-t border-gray-300 md:col-span-2">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                      Evaluating Panel
                    </p>
                    <p className="font-bold text-indigo-700 text-lg">
                      {selectedEvaluation.evaluatorId?.name}
                    </p>
                  </div>
                </div>
              </div>

              {selectedEvaluation.sessionType === "PROGRESS_ASSESSMENT" ? (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                      <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                        Section B: Progress Report Details
                      </span>
                    </div>
                    <div className="p-6 space-y-6">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">
                          Summary of Progress
                        </p>
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {selectedEvaluation.summaryOfProgress ||
                            "No summary provided."}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">
                          Comments for Improvement
                        </p>
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {selectedEvaluation.commentsForImprovement ||
                            "No comments provided."}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">
                          Overall Suggestions
                        </p>
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {selectedEvaluation.overallSuggestions ||
                            "No suggestions provided."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {/* SECTION B */}
                  {selectedEvaluation.rubricId?.criteria && (
                    <div className="border border-gray-300 mb-8 rounded-lg overflow-hidden bg-white shadow-sm">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                        <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                          Section B: Detailed Criteria Breakdown
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {selectedEvaluation.rubricId.criteria.map(
                          (criterion) => {
                            const score =
                              selectedEvaluation.scores?.[criterion.key] || 0;
                            const percentage = criterion.maxScore
                              ? (score / criterion.maxScore) * 100
                              : 0;
                            const specificFeedback =
                              selectedEvaluation.qualitativeFeedback?.[
                                criterion.key
                              ];

                            return (
                              <div
                                key={criterion.key}
                                className="p-6 hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                  <div className="flex-1">
                                    <span className="font-bold text-gray-900 text-lg block mb-2">
                                      {criterion.title}
                                    </span>
                                    <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${percentage >= 80 ? "bg-green-500" : percentage >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                                        style={{ width: `${percentage}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <span className="text-2xl font-black text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
                                      {score}{" "}
                                      <span className="text-sm font-semibold text-indigo-400">
                                        / {criterion.maxScore}
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                {/* Remarks specifically for this row */}
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                                    Examiner's Specific Remarks
                                  </span>
                                  <p className="text-gray-800 text-sm leading-relaxed">
                                    {specificFeedback ? (
                                      `"${specificFeedback}"`
                                    ) : (
                                      <span className="italic text-gray-400">
                                        No specific remarks provided.
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}

                  {/* SECTION C */}
                  <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                      <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                        Section C: Overall Summary & Recommendations
                      </span>
                    </div>
                    <div className="p-6">
                      <p className="text-gray-900 whitespace-pre-wrap leading-relaxed text-lg italic border-l-4 border-indigo-400 pl-4">
                        "
                        {selectedEvaluation.overallComments ||
                          "No overall feedback provided."}
                        "
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DOCUMENT FOOTER */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-100 rounded-b-xl flex justify-between items-center">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                Confidential FSKTM Record
              </p>
              <button
                onClick={() => setSelectedEvaluation(null)}
                className="px-8 py-2.5 bg-gray-900 text-white rounded-lg font-bold hover:bg-black shadow-sm transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
