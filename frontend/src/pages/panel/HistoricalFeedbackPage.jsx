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
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function HistoricalFeedbackPage() {
  const { user } = useAuth();
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

      // 1. Fetch Evaluations (Includes unlocked and locked ones from the backend)
      const res = await api.get("/evaluations");

      // Only show completed ones in history
      const completed = (res.data.data || []).filter(
        (e) => e.status === "COMPLETED",
      );
      setEvaluations(completed);

      // These are records this panel knows exist, but cannot read without permission
      setLockedEvals(res.data.locked || []);

      // 2. Fetch Incoming Requests (Only if Panel)
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

  // --- Handle Requesting Access ---
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
      loadData(); // Reload to update UI
    } catch (error) {
      alert(error.response?.data?.error || "Failed to send request.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- Handle Approving/Rejecting Requests ---
  const handleRespondToRequest = async (requestId, action) => {
    if (
      !window.confirm(
        `Are you sure you want to ${action.toLowerCase()} this request?`,
      )
    )
      return;

    try {
      await api.post("/evaluations/respond-request", { requestId, action });
      loadData(); // Reload the lists
    } catch (error) {
      alert(
        error.response?.data?.error ||
          `Failed to ${action.toLowerCase()} request.`,
      );
    }
  };

  // Only calculate average for scored rubrics they have access to
  const scoredEvals = evaluations.filter(
    (e) => e.sessionType !== "PROGRESS_ASSESSMENT",
  );
  const avgScore =
    scoredEvals.length > 0
      ? (
          scoredEvals.reduce((sum, e) => sum + e.totalMarks, 0) /
          scoredEvals.length
        ).toFixed(1)
      : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Feedback History & Vault
          </h1>
          <p className="text-gray-600 mt-2">
            View past feedback or request access to historical records.
          </p>
        </div>

        {user?.role === "panel" && (
          <div className="flex bg-gray-200 p-1 rounded-lg">
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
        <div className="text-center p-12 text-gray-500">
          Loading historical data...
        </div>
      ) : (
        <>
          {/* ========================================================= */}
          {/* TAB 1: MY ACCESS (Evaluations I wrote or unlocked)        */}
          {/* ========================================================= */}
          {activeTab === "my-access" && (
            <>
              {scoredEvals.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-600">
                        Accessible Records
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {evaluations.length}
                      </p>
                    </div>
                    <FileText className="w-12 h-12 text-blue-500" />
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-600">
                        Average Score
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {avgScore}%
                      </p>
                    </div>
                    <TrendingUp className="w-12 h-12 text-green-500" />
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="divide-y divide-gray-200">
                  {evaluations.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      No historical records available.
                    </div>
                  )}
                  {evaluations.map((ev) => (
                    <div
                      key={ev._id}
                      className="p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">
                              {ev.studentId?.name || "Unknown Student"}
                            </h3>
                            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-200">
                              {ev.sessionType?.replace("_", " ")}
                            </span>
                            {ev.evaluatorId?._id !== user.id && (
                              <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                                <Unlock className="w-3 h-3" /> Granted
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                            <div>
                              <span className="font-semibold">Evaluator:</span>{" "}
                              {ev.evaluatorId?.name || "Unknown"}
                            </div>
                            <div>
                              <span className="font-semibold">Semester:</span>{" "}
                              {ev.sessionId?.semester || "Unknown"}
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 italic">
                            {ev.sessionType === "PROGRESS_ASSESSMENT"
                              ? `Progress: "${ev.summaryOfProgress}"`
                              : `Score: ${ev.totalMarks}% | Comments: "${ev.overallComments}"`}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedEvaluation(ev)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold flex items-center gap-2"
                        >
                          <Eye className="w-5 h-5" /> View Full
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 2: LOCKED RECORDS (Belong to other panels)            */}
          {/* ========================================================= */}
          {activeTab === "locked" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 bg-gray-50 border-b flex items-center gap-3">
                <Lock className="w-5 h-5 text-gray-500" />
                <p className="text-sm text-gray-600">
                  These are historical evaluations for your current students,
                  authored by other panels. You must request permission to read
                  them.
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {lockedEvals.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No locked records found for your current students.
                  </div>
                )}
                {lockedEvals.map((locked) => (
                  <div
                    key={locked._id}
                    className="p-6 flex justify-between items-center bg-gray-50/50"
                  >
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {locked.studentId?.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>{locked.sessionType?.replace("_", " ")}</strong>{" "}
                        ({locked.semester}) &nbsp;&bull;&nbsp; Evaluator:{" "}
                        <span className="font-semibold">
                          {locked.evaluatorId?.name}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => setRequestModalData(locked)}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded shadow hover:bg-indigo-700 flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" /> Request Access
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: PENDING APPROVALS (Incoming requests for me)       */}
          {/* ========================================================= */}
          {activeTab === "requests" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
                <Shield className="w-5 h-5 text-indigo-700" />
                <p className="text-sm text-indigo-900 font-semibold">
                  Other panels are requesting access to evaluations you
                  authored.
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {incomingRequests.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    You have no pending access requests.
                  </div>
                )}
                {incomingRequests.map((req) => (
                  <div key={req._id} className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-1">
                          Request From:
                        </p>
                        <h3 className="text-lg font-bold text-gray-900">
                          {req.requestingPanelId?.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {req.requestingPanelId?.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-1">
                          Target Record:
                        </p>
                        <p className="font-bold text-gray-800">
                          {req.studentId?.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {req.targetEvaluationId?.sessionType?.replace(
                            "_",
                            " ",
                          )}{" "}
                          ({req.targetEvaluationId?.semester})
                        </p>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-4">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                        Reason for request:
                      </p>
                      <p className="text-sm text-gray-800 italic">
                        "{req.reason}"
                      </p>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() =>
                          handleRespondToRequest(req._id, "REJECTED")
                        }
                        className="px-4 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 font-bold rounded flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() =>
                          handleRespondToRequest(req._id, "APPROVED")
                        }
                        className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 font-bold rounded shadow-sm flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Grant Access
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* MODAL: REQUEST ACCESS FORM                                */}
      {/* ========================================================= */}
      {requestModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold mb-2">Request Record Access</h2>
            <p className="text-sm text-gray-600 mb-6">
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
                rows="3"
                className="w-full border p-3 rounded focus:ring-2 focus:ring-indigo-500 mb-6"
                placeholder="e.g., I am evaluating this student's Pre-Viva and need to see their Proposal feedback..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRequestModalData(null)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700 flex items-center gap-2"
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

      {/* ========================================================= */}
      {/* MODAL: VIEW EVALUATION (Same as before)                   */}
      {/* ========================================================= */}
      {selectedEvaluation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold">Evaluation Report</h2>
                <p className="text-gray-600">
                  {selectedEvaluation.studentId?.name} -{" "}
                  {selectedEvaluation.sessionType?.replace("_", " ")}
                </p>
              </div>
              <button onClick={() => setSelectedEvaluation(null)}>
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {selectedEvaluation.sessionType === "PROGRESS_ASSESSMENT" ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <strong>Summary of Progress:</strong>
                  <p className="mt-1">{selectedEvaluation.summaryOfProgress}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <strong>Comments for Improvement:</strong>
                  <p className="mt-1">
                    {selectedEvaluation.commentsForImprovement}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <strong>Overall Suggestions:</strong>
                  <p className="mt-1">
                    {selectedEvaluation.overallSuggestions}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex justify-between">
                  <span className="text-lg font-semibold text-gray-800">
                    Final Score:
                  </span>
                  <span className="text-3xl font-bold text-green-600">
                    {selectedEvaluation.totalMarks}%
                  </span>
                </div>

                {/* Optional: Iterate over scores and display criteria here if needed */}

                <div className="bg-gray-50 p-4 rounded-lg border">
                  <strong>Overall Comments:</strong>
                  <p className="mt-1">{selectedEvaluation.overallComments}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
