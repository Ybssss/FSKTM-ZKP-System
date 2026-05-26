import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Eye,
  FileText,
  Lock,
  Search,
  Shield,
  Unlock,
  XCircle,
  X,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  getDocumentFileName,
  openAuthenticatedFile,
} from "../../utils/authenticatedFile";

export default function HistoricalFeedbackPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManagePermissions = user?.role === "panel" || isAdmin;

  const [evaluations, setEvaluations] = useState([]);
  const [lockedEvals, setLockedEvals] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-access");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [requestModalData, setRequestModalData] = useState(null);
  const [requestReason, setRequestReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const res = await api.get("/feedback/search");
      const allHistorical = res.data.evaluations || [];
      const accessibleCompleted = allHistorical.filter(
        (evaluation) => evaluation.status === "COMPLETED" || evaluation.accessGranted === true,
      );
      const lockedHistorical = allHistorical.filter(
        (evaluation) => evaluation.accessGranted === false,
      );

      setEvaluations(accessibleCompleted);
      setLockedEvals(lockedHistorical);

      if (canManagePermissions) {
        const historicalAccessRequestsOnly = (request) =>
          request?.scope !== "UNLOCK_EVALUATION";

        const [pendingRes, approvedRes, myRes] = await Promise.all([
          api.get("/feedback/permissions/incoming?status=PENDING"),
          api.get("/feedback/permissions/incoming?status=APPROVED"),
          api.get("/feedback/permissions/my"),
        ]);

        setIncomingRequests(
          (pendingRes.data.requests || []).filter(historicalAccessRequestsOnly),
        );
        setApprovedRequests(
          (approvedRes.data.requests || []).filter(historicalAccessRequestsOnly),
        );
        setMyRequests(
          (myRes.data.requests || []).filter(historicalAccessRequestsOnly),
        );
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
      alert(error.response?.data?.message || "Failed to load historical data.");
    } finally {
      setLoading(false);
    }
  };

  const getId = (value) => (typeof value === "object" ? value?._id : value);

  const handleOpenMaterial = async (document) => {
    try {
      await openAuthenticatedFile(document);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to open material.",
      );
    }
  };

  const getOriginalFileLabel = (document) => {
    const fileName = getDocumentFileName(document);
    return fileName && fileName !== document?.title ? fileName : "";
  };

  const getPersonName = (value, fallback = "-") => {
    if (!value) return fallback;
    if (typeof value === "string") return value;
    return value.name || value.userId || value.email || fallback;
  };

  const getStudent = (item) => {
    const evaluation = getEvaluation(item);
    const session = evaluation?.sessionInfo || evaluation?.sessionId || item?.sessionInfo || item?.sessionId;
    return (
      evaluation?.studentId ||
      item?.studentId ||
      item?.targetEvaluationId?.studentId ||
      session?.students?.[0] ||
      null
    );
  };

  const getEvaluation = (item) => item?.targetEvaluationId || item;

  const getSession = (item) => {
    const evaluation = getEvaluation(item);
    return (
      evaluation?.sessionInfo ||
      evaluation?.sessionId ||
      item?.sessionInfo ||
      item?.currentSessionId ||
      item?.sessionId ||
      null
    );
  };

  const getRubric = (item) => getEvaluation(item)?.rubricId;

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const buildSearchText = (item) => {
    const evaluation = getEvaluation(item);
    const session = getSession(item);
    const student = getStudent(item);
    const rubric = getRubric(item);

    return [
      student?.name,
      student?.matricNumber,
      student?.userId,
      student?.program,
      evaluation?.semester,
      evaluation?.sessionType,
      evaluation?.status,
      rubric?.name,
      session?.title,
      session?.sessionType,
      session?.batchName,
      session?.batchId,
      session?.academicSession,
      getPersonName(evaluation?.evaluatorId, ""),
      getPersonName(item?.requestingPanelId, ""),
      getPersonName(item?.owningPanelId, ""),
      item?.scope,
      item?.status,
      item?.reason,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  const filterItems = (items) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => buildSearchText(item).includes(term));
  };

  const visibleEvaluations = useMemo(
    () => filterItems(evaluations),
    [evaluations, searchTerm],
  );
  const visibleLocked = useMemo(
    () => filterItems(lockedEvals),
    [lockedEvals, searchTerm],
  );
  const visiblePending = useMemo(
    () => filterItems(incomingRequests),
    [incomingRequests, searchTerm],
  );
  const visibleApproved = useMemo(
    () => filterItems(approvedRequests),
    [approvedRequests, searchTerm],
  );
  const visibleMyRequests = useMemo(
    () => filterItems(myRequests),
    [myRequests, searchTerm],
  );

  const getScoreColor = (score) => {
    if (!score && score !== 0) return "text-gray-600 bg-gray-100";
    if (score >= 80) return "text-green-700 bg-green-100";
    if (score >= 65) return "text-yellow-700 bg-yellow-100";
    return "text-red-700 bg-red-100";
  };

  const handleRequestAccess = async (event) => {
    event.preventDefault();
    setActionLoading(true);

    try {
      await api.post("/feedback/permissions/request", {
        targetEvaluationId: requestModalData._id,
        reason: requestReason,
      });

      alert("Access request sent successfully.");
      setRequestModalData(null);
      setRequestReason("");
      loadData();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to send request.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRespondToRequest = async (requestId, action) => {
    if (!window.confirm(`Are you sure you want to ${action.toLowerCase()} this request?`)) {
      return;
    }

    try {
      await api.post("/feedback/permissions/respond", { requestId, action });
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || error.response?.data?.error || "Failed to respond.");
    }
  };

  const handleWithdrawPermission = async (request) => {
    const evaluation = getEvaluation(request);
    const session = getSession(request);
    const student = getStudent(request);

    const confirmed = window.confirm(
      `Withdraw approved access?\n\nStudent: ${getPersonName(student)}\nSession: ${session?.title || "-"}\nBatch: ${session?.batchName || session?.batchId || "-"}\nAccess holder: ${getPersonName(request.requestingPanelId)}`,
    );

    if (!confirmed) return;

    try {
      await api.post("/feedback/permissions/withdraw", { requestId: getId(request) });
      loadData();
      alert("Approved access withdrawn.");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to withdraw permission.");
    }
  };


  const readMapValue = (value, key) => {
    if (!value || !key) return "";
    if (value instanceof Map) return value.get(key);
    return value[key];
  };

  const scoreLabel = (score) => {
    const numeric = Number(score);
    if (numeric === 4) return "Exemplary";
    if (numeric === 3) return "Proficient";
    if (numeric === 2) return "Satisfactory";
    if (numeric === 1) return "Foundational";
    if (numeric === 0) return "Novice";
    return "-";
  };

  const getReportCriteria = (evaluation) =>
    (getRubric(evaluation)?.criteria || []).filter(
      (criterion) => criterion.type === "quantitative",
    );

  const getReportQualitativeCriteria = (evaluation) =>
    (getRubric(evaluation)?.criteria || []).filter(
      (criterion) => criterion.type === "qualitative",
    );

  const InfoLine = ({ label, value }) => (
    <div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-gray-900 break-words">{value || "-"}</p>
    </div>
  );

  const EvaluationCard = ({ evaluation, locked = false }) => {
    const session = getSession(evaluation);
    const student = getStudent(evaluation);
    const rubric = getRubric(evaluation);

    return (
      <div className="p-4 sm:p-5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700">
                {evaluation.sessionType || session?.sessionType || "Evaluation"}
              </span>
              <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                {evaluation.semester || session?.academicSession || "No semester"}
              </span>
              {locked && (
                <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-gray-900 text-base sm:text-lg break-words">
                {student?.name || "Unknown Student"}
              </h3>
              <p className="text-xs text-gray-500 font-mono font-bold">
                {student?.matricNumber || student?.userId || "-"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <InfoLine label="Session" value={session?.title} />
              <InfoLine label="Batch" value={session?.batchName || session?.batchId} />
              <InfoLine label="Date / Time" value={`${formatDate(session?.date)} · ${session?.startTime || "-"} - ${session?.endTime || "-"}`} />
              <InfoLine label="Evaluator" value={getPersonName(evaluation.evaluatorId)} />
              <InfoLine label="Rubric" value={rubric?.name || evaluation.sessionType} />
              <InfoLine label="Materials" value={`${session?.studentDocuments?.length || 0} file(s)`} />
            </div>
          </div>

          <div className="flex flex-row xl:flex-col items-center xl:items-end gap-2 shrink-0">
            {!locked && (
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(evaluation.totalMarks)}`}>
                {evaluation.totalMarks || evaluation.totalMarks === 0 ? `${evaluation.totalMarks}%` : "Completed"}
              </span>
            )}
            <button
              onClick={() => (locked ? setRequestModalData(evaluation) : setSelectedEvaluation(evaluation))}
              className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${
                locked
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {locked ? <Unlock className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {locked ? "Request" : "View"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const PermissionCard = ({ request, mode }) => {
    const evaluation = getEvaluation(request);
    const session = getSession(request);
    const student = getStudent(request);
    const currentSession = request.currentSessionId;
    const rubric = getRubric(request);

    return (
      <div className="p-4 sm:p-5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                request.status === "APPROVED"
                  ? "bg-green-100 text-green-700"
                  : request.status === "REJECTED"
                    ? "bg-red-100 text-red-700"
                    : request.status === "WITHDRAWN"
                      ? "bg-gray-200 text-gray-700"
                      : "bg-yellow-100 text-yellow-700"
              }`}>
                {request.status}
              </span>
              <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                {request.scope || "SINGLE_EVALUATION"}
              </span>
              {request.batchId && (
                <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700">
                  Request batch {request.batchId}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <InfoLine label="Student" value={`${getPersonName(student)} ${student?.matricNumber ? `(${student.matricNumber})` : ""}`} />
              <InfoLine label="Historical Session" value={session?.title} />
              <InfoLine label="Historical Batch" value={session?.batchName || session?.batchId} />
              <InfoLine label="Historical Date" value={`${formatDate(session?.date)} · ${session?.startTime || "-"} - ${session?.endTime || "-"}`} />
              <InfoLine label="Rubric / Type" value={rubric?.name || evaluation?.sessionType} />
              <InfoLine label="Original Owner" value={getPersonName(request.owningPanelId || evaluation?.evaluatorId)} />
              <InfoLine label="Access Holder" value={getPersonName(request.requestingPanelId)} />
              <InfoLine label="Current Session" value={currentSession?.title || "-"} />
              <InfoLine label="Current Batch" value={currentSession?.batchName || currentSession?.batchId || "-"} />
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Reason</p>
              <p className="text-sm text-gray-800 break-words">{request.reason || "-"}</p>
            </div>
          </div>

          <div className="flex flex-wrap xl:flex-col gap-2 shrink-0 xl:min-w-[150px]">
            {mode === "pending" && (
              <>
                <button
                  onClick={() => handleRespondToRequest(request._id, "APPROVED")}
                  className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => handleRespondToRequest(request._id, "REJECTED")}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </>
            )}
            {mode === "approved" && (
              <>
                <button
                  onClick={() => setSelectedEvaluation(evaluation)}
                  className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" /> View Report
                </button>
                <button
                  onClick={() => handleWithdrawPermission(request)}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Withdraw
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = ({ text }) => (
    <div className="p-12 text-center text-gray-500 font-semibold">{text}</div>
  );

  const ScrollPanel = ({ children }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="max-h-[68vh] overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5 px-1 sm:px-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Historical Feedback Vault</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            View completed evaluations, request historical access, and manage approved access clearly.
          </p>
        </div>

        {canManagePermissions && (
          <div className="w-full lg:w-auto overflow-x-auto pb-1">
            <div className="inline-flex bg-gray-200 p-1 rounded-lg min-w-max">
              <button onClick={() => setActiveTab("my-access")} className={`px-3 py-2 rounded-md font-bold text-xs sm:text-sm ${activeTab === "my-access" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}>
                My Access
              </button>
              {!isAdmin && (
                <button onClick={() => setActiveTab("locked")} className={`px-3 py-2 rounded-md font-bold text-xs sm:text-sm flex items-center gap-1 ${activeTab === "locked" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}>
                  <Lock className="w-4 h-4" /> Locked
                </button>
              )}
              <button onClick={() => setActiveTab("requests")} className={`relative px-3 py-2 rounded-md font-bold text-xs sm:text-sm ${activeTab === "requests" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600"}`}>
                Pending
                {incomingRequests.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{incomingRequests.length}</span>}
              </button>
              <button onClick={() => setActiveTab("approved")} className={`relative px-3 py-2 rounded-md font-bold text-xs sm:text-sm ${activeTab === "approved" ? "bg-red-600 text-white shadow-sm" : "text-gray-600"}`}>
                Approved Access
                {approvedRequests.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{approvedRequests.length}</span>}
              </button>
              <button onClick={() => setActiveTab("my-requests")} className={`px-3 py-2 rounded-md font-bold text-xs sm:text-sm ${activeTab === "my-requests" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}>
                My Requests
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-2 shadow-sm">
        <Search className="w-5 h-5 text-gray-400 shrink-0" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search student, matric, evaluator, session, batch, rubric, semester, reason..."
          className="w-full outline-none text-sm font-semibold"
        />
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-500 font-bold">Loading historical data...</div>
      ) : (
        <>
          {activeTab === "my-access" && (
            <ScrollPanel>
              {visibleEvaluations.length === 0 ? (
                <EmptyState text="No completed historical records available." />
              ) : (
                visibleEvaluations.map((evaluation) => <EvaluationCard key={evaluation._id} evaluation={evaluation} />)
              )}
            </ScrollPanel>
          )}

          {activeTab === "locked" && !isAdmin && (
            <ScrollPanel>
              {visibleLocked.length === 0 ? (
                <EmptyState text="No locked records found." />
              ) : (
                visibleLocked.map((evaluation) => <EvaluationCard key={evaluation._id} evaluation={evaluation} locked />)
              )}
            </ScrollPanel>
          )}

          {activeTab === "requests" && (
            <ScrollPanel>
              {visiblePending.length === 0 ? (
                <EmptyState text="No pending approval requests." />
              ) : (
                visiblePending.map((request) => <PermissionCard key={request._id} request={request} mode="pending" />)
              )}
            </ScrollPanel>
          )}

          {activeTab === "approved" && (
            <ScrollPanel>
              {visibleApproved.length === 0 ? (
                <EmptyState text="No approved access permissions." />
              ) : (
                visibleApproved.map((request) => <PermissionCard key={request._id} request={request} mode="approved" />)
              )}
            </ScrollPanel>
          )}

          {activeTab === "my-requests" && (
            <ScrollPanel>
              {visibleMyRequests.length === 0 ? (
                <EmptyState text="You have not requested historical access yet." />
              ) : (
                visibleMyRequests.map((request) => <PermissionCard key={request._id} request={request} mode="readonly" />)
              )}
            </ScrollPanel>
          )}
        </>
      )}

      {selectedEvaluation && (
        <div className="fixed inset-0 bg-black/70 z-[100] p-3 sm:p-6 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
            <div className="bg-indigo-950 text-white p-5 sm:p-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-200">
                  Historical Vault • View Report
                </p>
                <h2 className="text-xl sm:text-2xl font-black mt-1">
                  {getRubric(selectedEvaluation)?.name || selectedEvaluation.sessionType || "Evaluation Report"}
                </h2>
                <p className="text-sm text-indigo-200 mt-1">
                  {getSession(selectedEvaluation)?.title || selectedEvaluation.sessionType} • {selectedEvaluation.semester || getSession(selectedEvaluation)?.academicSession || "-"}
                </p>
              </div>
              <button onClick={() => setSelectedEvaluation(null)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-gray-50 p-4">
                  <InfoLine label="Student" value={`${getPersonName(getStudent(selectedEvaluation))} ${getStudent(selectedEvaluation)?.matricNumber ? `(${getStudent(selectedEvaluation).matricNumber})` : ""}`} />
                </div>
                <div className="rounded-xl border bg-gray-50 p-4">
                  <InfoLine label="Evaluator" value={getPersonName(selectedEvaluation.evaluatorId)} />
                </div>
                <div className="rounded-xl border bg-gray-50 p-4">
                  <InfoLine label="Session / Batch" value={`${getSession(selectedEvaluation)?.batchName || getSession(selectedEvaluation)?.batchId || "No batch"}`} />
                </div>
                <div className="rounded-xl border bg-gray-50 p-4">
                  <InfoLine label="Date / Time" value={`${formatDate(getSession(selectedEvaluation)?.date)} · ${getSession(selectedEvaluation)?.startTime || "-"} - ${getSession(selectedEvaluation)?.endTime || "-"}`} />
                </div>
              </div>

              {selectedEvaluation.sessionType === "PROGRESS_ASSESSMENT" ? (
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-blue-800 mb-2">Summary of Research Progress</p>
                    <p className="text-sm text-blue-950 whitespace-pre-wrap leading-relaxed">{selectedEvaluation.summaryOfProgress || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-800 mb-2">Comments for Improvement</p>
                    <p className="text-sm text-amber-950 whitespace-pre-wrap leading-relaxed">{selectedEvaluation.commentsForImprovement || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-green-800 mb-2">Overall Suggestions</p>
                    <p className="text-sm text-green-950 whitespace-pre-wrap leading-relaxed">{selectedEvaluation.overallSuggestions || "-"}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                      <p className="font-black text-gray-900">Scored Criteria</p>
                      <span className={`px-3 py-1 rounded-full text-sm font-black ${getScoreColor(selectedEvaluation.totalMarks)}`}>
                        Final Score: {selectedEvaluation.totalMarks || selectedEvaluation.totalMarks === 0 ? `${Number(selectedEvaluation.totalMarks).toFixed(2)}%` : "-"}
                      </span>
                    </div>
                    <div className="divide-y max-h-[45vh] overflow-y-auto">
                      {getReportCriteria(selectedEvaluation).length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">No scored criteria found.</div>
                      ) : (
                        getReportCriteria(selectedEvaluation).map((criterion) => {
                          const score = readMapValue(selectedEvaluation.scores, criterion.key);
                          return (
                            <div key={criterion.key} className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_130px_120px] gap-3 items-start">
                              <div>
                                <p className="font-bold text-gray-900">{criterion.title}</p>
                                <p className="text-xs text-gray-500 mt-1">Weight: {criterion.weight || 0}% • Max: {criterion.maxScore || 5}</p>
                              </div>
                              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-center">
                                <p className="text-[10px] font-black text-indigo-500 uppercase">Score</p>
                                <p className="text-lg font-black text-indigo-900">{score ?? "-"}</p>
                              </div>
                              <div className="rounded-lg bg-gray-50 border p-3 text-center">
                                <p className="text-[10px] font-black text-gray-500 uppercase">Level</p>
                                <p className="text-xs font-bold text-gray-900">{scoreLabel(score)}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-gray-50 p-4">
                    <p className="font-black text-gray-900 mb-3">Panel Feedback</p>
                    {getReportQualitativeCriteria(selectedEvaluation).length > 0 && (
                      <div className="space-y-3 mb-4">
                        {getReportQualitativeCriteria(selectedEvaluation).map((criterion) => (
                          <div key={criterion.key} className="rounded-lg bg-white border p-3">
                            <p className="text-xs font-black text-gray-500 uppercase">{criterion.title}</p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{readMapValue(selectedEvaluation.qualitativeFeedback, criterion.key) || "-"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs font-black text-gray-500 uppercase mb-1">Overall Comments</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selectedEvaluation.overallComments || "-"}</p>
                  </div>
                </>
              )}

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="font-black text-blue-900 flex items-center gap-2"><FileText className="w-4 h-4" /> Student Submitted Materials</p>
                {(getSession(selectedEvaluation)?.studentDocuments || []).length === 0 ? (
                  <p className="text-sm text-blue-800 mt-2">No material attached.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(getSession(selectedEvaluation)?.studentDocuments || []).map((doc) => (
                      <button
                        key={doc._id || doc.url}
                        type="button"
                        onClick={() => handleOpenMaterial(doc)}
                        className="block w-full text-left p-3 bg-white rounded-lg border text-sm font-bold text-blue-700 hover:underline"
                      >
                        {doc.title} <span className="text-blue-400">• {doc.type || "material"}</span>
                        {getOriginalFileLabel(doc) && (
                          <span className="block text-xs text-blue-500 mt-1 break-all">
                            {getOriginalFileLabel(doc)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {requestModalData && (
        <div className="fixed inset-0 bg-black/60 z-[100] p-4 flex items-center justify-center">
          <form onSubmit={handleRequestAccess} className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-600" /> Request Access</h2>
                <p className="text-sm text-gray-600 mt-1">Explain why this historical record is needed.</p>
              </div>
              <button type="button" onClick={() => setRequestModalData(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={requestReason}
              onChange={(event) => setRequestReason(event.target.value)}
              required
              rows={5}
              className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="Example: I need to review previous panel feedback before evaluating the current session."
            />
            <button disabled={actionLoading} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-gray-400">
              {actionLoading ? "Sending..." : "Send Request"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
