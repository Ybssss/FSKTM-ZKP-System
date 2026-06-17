import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  Eye,
  Lock,
  Search,
  Shield,
  Unlock,
  XCircle,
  X,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import UserProfileLink from "../../components/UserProfileLink";
import {
  getScoreBadgeClass,
  getScoreBadgeLabel,
} from "../../utils/historicalFeedback";
import { getRubricDisplayName } from "../../utils/rubricLabels";

const getId = (value) => (typeof value === "object" ? value?._id : value);

const getPersonName = (value, fallback = "-") => {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.name || value.userId || value.email || fallback;
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
const getSessionId = (item) => {
  const session = getSession(item);
  return getId(session);
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

const getRubric = (item) => getEvaluation(item)?.rubricId;
const getEvaluationDisplayLabel = (item) => {
  const evaluation = getEvaluation(item);
  const rubric = getRubric(item);
  const session = getSession(item);

  return (
    session?.title ||
    getRubricDisplayName(rubric, evaluation?.sessionType || session?.sessionType) ||
    "Evaluation"
  );
};

const getHistoricalSortTimestamp = (item) => {
  const evaluation = getEvaluation(item);
  const session = getSession(item);
  return new Date(
    item?.approvedAt ||
      item?.updatedAt ||
      session?.date ||
      evaluation?.updatedAt ||
      evaluation?.createdAt ||
      item?.createdAt ||
      0,
  ).getTime();
};

const sortHistoricalItemsByTime = (items = []) =>
  [...items].sort(
    (left, right) =>
      getHistoricalSortTimestamp(right) - getHistoricalSortTimestamp(left),
  );

const PERMISSION_SCOPE_LABELS = {
  SINGLE_EVALUATION: "Single Evaluation",
  STUDENT_HISTORY: "Student History",
  UNLOCK_EVALUATION: "Unlock Evaluation",
};

const getPermissionScopeLabel = (scope) =>
  PERMISSION_SCOPE_LABELS[scope] || scope || "Single Evaluation";

export default function HistoricalFeedbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManagePermissions = user?.role === "panel" || isAdmin;
  const allowedTabs = [
    "my-access",
    "locked",
    "requests",
    "approved",
    "my-requests",
  ];
  const initialTab = new URLSearchParams(location.search).get("tab");
  const initialSearchTerm = new URLSearchParams(location.search).get("q") || "";

  const [evaluations, setEvaluations] = useState([]);
  const [lockedEvals, setLockedEvals] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    allowedTabs.includes(initialTab) ? initialTab : "my-access",
  );
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [requestModalData, setRequestModalData] = useState(null);
  const [requestReason, setRequestReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const searchPromise = api.get("/feedback/search");
      const incomingPendingPromise = canManagePermissions
        ? api.get("/feedback/permissions/incoming?status=PENDING")
        : Promise.resolve({ data: { requests: [] } });
      const incomingApprovedPromise = canManagePermissions
        ? api.get("/feedback/permissions/incoming?status=APPROVED")
        : Promise.resolve({ data: { requests: [] } });
      const myPermissionsPromise = canManagePermissions
        ? api.get("/feedback/permissions/my")
        : Promise.resolve({ data: { requests: [] } });

      const [res, pendingRes, approvedRes, myRes] = await Promise.all([
        searchPromise,
        incomingPendingPromise,
        incomingApprovedPromise,
        myPermissionsPromise,
      ]);

      const allHistorical = res.data.evaluations || [];
      const myPermissionRequests = myRes.data.requests || [];
      const approvedMyEvaluationIds = new Set(
        myPermissionRequests
          .filter((request) => request.status === "APPROVED")
          .map((request) => String(getPermissionTargetId(request))),
      );

      const accessibleCompleted = sortHistoricalItemsByTime(
        allHistorical.filter(
          (evaluation) =>
            evaluation.status === "COMPLETED" ||
            evaluation.accessGranted === true ||
            approvedMyEvaluationIds.has(String(getId(evaluation))),
        ),
      );
      const lockedHistorical = sortHistoricalItemsByTime(
        allHistorical.filter(
          (evaluation) =>
            evaluation.accessGranted === false &&
            !approvedMyEvaluationIds.has(String(getId(evaluation))),
        ),
      );

      setEvaluations(accessibleCompleted);
      setLockedEvals(lockedHistorical);

      if (canManagePermissions) {
        setIncomingRequests(
          sortHistoricalItemsByTime(pendingRes.data.requests || []),
        );
        setApprovedRequests(
          sortHistoricalItemsByTime(approvedRes.data.requests || []),
        );
        setMyRequests(sortHistoricalItemsByTime(myPermissionRequests));
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
      alert(error.response?.data?.message || "Failed to load historical data.");
    } finally {
      setLoading(false);
    }
  }, [canManagePermissions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buildReturnUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (activeTab && activeTab !== "my-access") params.set("tab", activeTab);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    const query = params.toString();
    return `${location.pathname}${query ? `?${query}` : ""}`;
  }, [activeTab, location.pathname, searchTerm]);

  const openEvaluationReport = useCallback((item) => {
    const evaluationId = getId(getEvaluation(item));
    if (!evaluationId) return;

    navigate(`/panel/evaluation/${evaluationId}`, {
      state: { returnUrl: buildReturnUrl() },
    });
  }, [buildReturnUrl, navigate]);

  const openSessionDetail = useCallback((item) => {
    const sessionId = getSessionId(item);
    if (!sessionId) return;

    navigate(`/panel/sessions/${sessionId}`);
  }, [navigate]);

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

  const buildSearchText = useCallback((item) => {
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
      getEvaluationDisplayLabel(item),
      session?.title,
      session?.sessionType,
      session?.batchName,
      session?.batchId,
      session?.academicSession,
      item?.currentSessionId?.title,
      item?.currentSessionId?.batchName,
      item?.currentSessionId?.batchId,
      getPersonName(evaluation?.evaluatorId, ""),
      getPersonName(item?.requestingPanelId, ""),
      getPersonName(item?.owningPanelId, ""),
      item?.scope,
      item?.status,
      item?.reason,
      item?.responseNote,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }, []);

  const filterItems = useCallback((items) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => buildSearchText(item).includes(term));
  }, [buildSearchText, searchTerm]);

  const visibleEvaluations = useMemo(
    () => sortHistoricalItemsByTime(filterItems(evaluations)),
    [evaluations, filterItems],
  );
  const visibleLocked = useMemo(
    () => sortHistoricalItemsByTime(filterItems(lockedEvals)),
    [lockedEvals, filterItems],
  );
  const visiblePending = useMemo(
    () => sortHistoricalItemsByTime(filterItems(incomingRequests)),
    [incomingRequests, filterItems],
  );
  const visibleApproved = useMemo(
    () => sortHistoricalItemsByTime(filterItems(approvedRequests)),
    [approvedRequests, filterItems],
  );
  const visibleMyRequests = useMemo(
    () => sortHistoricalItemsByTime(filterItems(myRequests)),
    [myRequests, filterItems],
  );

  const getPermissionTargetId = (permission) =>
    getId(permission?.targetEvaluationId);

  const getRequestForEvaluation = (evaluationId) =>
    myRequests.find(
      (request) =>
        String(getPermissionTargetId(request)) === String(getId(evaluationId)) &&
        request.status !== "WITHDRAWN",
    );

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

  const handleRespondToRequest = async (request, action) => {
    let responseNote = "";

    if (action === "REJECTED") {
      const feedback = window.prompt(
        "Enter rejection feedback for the requester:",
        request?.responseNote || "",
      );
      if (feedback === null) return;
      responseNote = feedback.trim();

      if (!responseNote) {
        alert("Rejection feedback is required.");
        return;
      }
    } else if (
      !window.confirm(
        `Are you sure you want to ${action.toLowerCase()} this request?`,
      )
    ) {
      return;
    }

    try {
      await api.post("/feedback/permissions/respond", {
        requestId: getId(request),
        action,
        responseNote,
      });
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || error.response?.data?.error || "Failed to respond.");
    }
  };

  const handleWithdrawPermission = async (request) => {
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
  const InfoLine = ({ label, value, content }) => (
    <div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="text-sm font-semibold text-gray-900 break-words">
        {content ?? value ?? "-"}
      </div>
    </div>
  );

  const EvaluationCard = ({ evaluation, locked = false }) => {
    const session = getSession(evaluation);
    const student = getStudent(evaluation);
    const rubric = getRubric(evaluation);
    const request = locked ? getRequestForEvaluation(evaluation._id) : null;
    const isPending = request?.status === "PENDING";
    const isApproved = request?.status === "APPROVED";
    const isRejected = request?.status === "REJECTED";

    const handleLockedAction = () => {
      if (isPending) return;
      if (isApproved) {
        openEvaluationReport(evaluation);
        return;
      }

      setRequestModalData(evaluation);
      setRequestReason(
        isRejected
          ? `Re-requesting access after previous rejection. Reason: ${request?.reason || ""}`
          : "",
      );
    };

    return (
      <div className="p-4 sm:p-5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {session?.title && getSessionId(evaluation) ? (
                <button
                  type="button"
                  onClick={() => openSessionDetail(evaluation)}
                  className="px-2 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 hover:text-indigo-900"
                >
                  {getEvaluationDisplayLabel(evaluation)}
                </button>
              ) : (
                <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700">
                  {getEvaluationDisplayLabel(evaluation)}
                </span>
              )}
              <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                {evaluation.semester || session?.academicSession || "No semester"}
              </span>
              {locked && (
                <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
              {request && (
                <span
                  className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                    isApproved
                      ? "bg-green-100 text-green-700"
                      : isRejected
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  Request {request.status}
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-gray-900 text-base sm:text-lg break-words">
                <UserProfileLink
                  user={student}
                  fallback="Unknown Student"
                  className="font-bold text-base sm:text-lg"
                />
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
              <InfoLine
                label="Rubric"
                value={getRubricDisplayName(rubric, evaluation.sessionType)}
              />
              <InfoLine label="Materials" value={`${session?.studentDocuments?.length || 0} file(s)`} />
            </div>

            {locked && request && (
              <div className="space-y-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Your Request Reason
                  </p>
                  <p className="text-sm text-gray-800 break-words">
                    {request.reason || "-"}
                  </p>
                </div>
                {request.responseNote && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-red-600">
                      Decision Feedback
                    </p>
                    <p className="text-sm text-red-900 break-words">
                      {request.responseNote}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-row xl:flex-col items-center xl:items-end gap-2 shrink-0">
            {!locked && (
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreBadgeClass(evaluation)}`}>
                {getScoreBadgeLabel(evaluation)}
              </span>
            )}
            <button
              onClick={() =>
                locked ? handleLockedAction() : openEvaluationReport(evaluation)
              }
              disabled={isPending}
              className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${
                isPending
                  ? "bg-yellow-100 text-yellow-800 cursor-not-allowed"
                  : locked
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {locked ? <Unlock className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isPending
                ? "Pending"
                : isRejected
                  ? "Request Again"
                  : locked
                    ? "Request Access"
                    : "View"}
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
    const scopeLabel = getPermissionScopeLabel(request.scope);
    const showRequestGroup =
      request.scope === "STUDENT_HISTORY" && Boolean(request.batchId);
    const requestContextFields = [
      currentSession?.title
        ? {
            label: "Requesting Session",
            content: getId(currentSession) ? (
              <button
                type="button"
                onClick={() => navigate(`/panel/sessions/${getId(currentSession)}`)}
                className="text-indigo-700 hover:text-indigo-900 hover:underline"
              >
                {currentSession.title}
              </button>
            ) : (
              currentSession.title
            ),
          }
        : null,
      currentSession?.batchName || currentSession?.batchId
        ? {
            label: "Requesting Batch",
            value: currentSession.batchName || currentSession.batchId,
          }
        : null,
    ].filter(Boolean);
    const details = [
      {
        label: "Student",
        value: `${getPersonName(student)} ${
          student?.matricNumber ? `(${student.matricNumber})` : ""
        }`,
      },
      {
        label: "Historical Session",
        content:
          session?.title && getSessionId(request) ? (
            <button
              type="button"
              onClick={() => openSessionDetail(request)}
              className="text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              {session.title}
            </button>
          ) : (
            session?.title || "-"
          ),
      },
      { label: "Historical Batch", value: session?.batchName || session?.batchId },
      {
        label: "Historical Date",
        value: `${formatDate(session?.date)} · ${session?.startTime || "-"} - ${session?.endTime || "-"}`,
      },
      {
        label: "Rubric / Session",
        content:
          session?.title && getSessionId(request) ? (
            <button
              type="button"
              onClick={() => openSessionDetail(request)}
              className="text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              {getEvaluationDisplayLabel(request)}
            </button>
          ) : (
            getEvaluationDisplayLabel(request)
          ),
      },
      {
        label: "Original Owner",
        value: getPersonName(request.owningPanelId || evaluation?.evaluatorId),
      },
      { label: "Access Holder", value: getPersonName(request.requestingPanelId) },
      ...requestContextFields,
    ];

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
                {scopeLabel}
              </span>
              {showRequestGroup && (
                <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700">
                  Appeal Group {request.batchId}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {details.map((detail, index) => (
                <InfoLine
                  key={`${detail.label}-${index}`}
                  label={detail.label}
                  value={detail.value}
                  content={detail.content}
                />
              ))}
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Reason</p>
                <p className="text-sm text-gray-800 break-words">{request.reason || "-"}</p>
              </div>
              {request.responseNote && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide">
                    Decision Feedback
                  </p>
                  <p className="text-sm text-red-900 break-words">
                    {request.responseNote}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap xl:flex-col gap-2 shrink-0 xl:min-w-[150px]">
            {mode === "pending" && (
              <>
                <button
                  onClick={() => handleRespondToRequest(request, "APPROVED")}
                  className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => handleRespondToRequest(request, "REJECTED")}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </>
            )}
            {mode === "approved" && (
              <>
                <button
                  onClick={() => openEvaluationReport(evaluation)}
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
