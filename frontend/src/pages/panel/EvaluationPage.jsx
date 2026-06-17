import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ClipboardCheck,
  Eye,
  X,
  CheckCircle2,
  FileText,
  AlertCircle,
  ExternalLink,
  Lock,
  ShieldAlert,
} from "lucide-react";
import api from "../../services/api";
import { emitHistoricalRequestsUpdated } from "../../utils/historicalRequestEvents";
import { useAuth } from "../../contexts/AuthContext";
import UserProfileLink from "../../components/UserProfileLink";
import SortableTh from "../../components/SortableTh";
import useSortableData from "../../hooks/useSortableData";
import {
  getDocumentFileName,
  openAuthenticatedFile,
} from "../../utils/authenticatedFile";
import {
  buildEvaluationSubmitPayload,
  calculateCriterionContribution,
  calculateWeightedTotal,
  findMissingQuantitativeCriterion,
  formatMark,
  formatMarkLabel,
  getCriterionMaxScore,
  getCriterionWeight,
  getEvaluationDisplayedTotal,
  getEvaluationRoleBadgeClass,
  getEvaluationRoleLabel,
  getQualitativeCriteria,
  getQuantitativeCriteria,
  getRubricWeightTotal,
  getScoreDescription,
  getScoreScale,
  hasQuantitativeCriteria,
  legacyProgressFeedback,
  toNumber,
} from "../../utils/evaluationForm";
import { getRubricDisplayName } from "../../utils/rubricLabels";

const getSessionDocuments = (evaluation) =>
  evaluation?.sessionId?.studentDocuments || [];
const getSessionId = (evaluation) =>
  evaluation?.sessionId?._id || evaluation?.sessionId || "";
const parseTimeToMinutes = (value = "") => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};
const getEvaluationSessionLabel = (evaluation) =>
  evaluation?.sessionId?.title ||
  getRubricDisplayName(evaluation?.rubricId, evaluation?.sessionType) ||
  "Evaluation";
const getEvaluationScheduleSortValue = (evaluation) => {
  const rawDate = evaluation?.sessionId?.date;
  if (!rawDate) return 0;

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return 0;

  const dayStart = new Date(parsedDate);
  dayStart.setHours(0, 0, 0, 0);

  const startMinutes = parseTimeToMinutes(evaluation?.sessionId?.startTime);
  return dayStart.getTime() + (startMinutes ?? 0) * 60 * 1000;
};
const formatScheduleDate = (value) => {
  if (!value) return "-";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "-";
  return parsedDate.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
const getEvaluationScheduleLabel = (evaluation) => {
  const startTime = evaluation?.sessionId?.startTime || "-";
  const endTime = evaluation?.sessionId?.endTime || "-";
  if (!evaluation?.sessionId?.startTime && !evaluation?.sessionId?.endTime) {
    return "No time set";
  }
  return `${startTime} - ${endTime}`;
};
const getEvaluationSessionEndTimestamp = (evaluation) => {
  const rawDate = evaluation?.sessionId?.date;
  if (!rawDate) return null;

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const dayStart = new Date(parsedDate);
  dayStart.setHours(0, 0, 0, 0);

  const endMinutes =
    parseTimeToMinutes(evaluation?.sessionId?.endTime) ??
    parseTimeToMinutes(evaluation?.sessionId?.startTime);

  if (endMinutes === null) return null;
  return dayStart.getTime() + endMinutes * 60 * 1000;
};
const isLatePendingEvaluation = (evaluation) =>
  String(evaluation?.status || "").toUpperCase() === "PENDING" &&
  (() => {
    const sessionEndTimestamp = getEvaluationSessionEndTimestamp(evaluation);
    return sessionEndTimestamp !== null && sessionEndTimestamp < Date.now();
  })();
const hasSessionTitle = (evaluation) => Boolean(evaluation?.sessionId?.title);
const normalizeSearchText = (value = "") =>
  String(value || "").toLowerCase().trim();
const tokenizeSearchText = (value = "") =>
  normalizeSearchText(value)
    .split(/[\s/()-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
const buildEvaluationSearchData = (evaluation, isAdminView = false) => {
  const partialFields = [
    evaluation?.studentId?.name,
    evaluation?.studentId?.matricNumber,
    getEvaluationSessionLabel(evaluation),
    getEvaluationRoleLabel(evaluation),
    evaluation?.semester,
    formatScheduleDate(evaluation?.sessionId?.date),
    getEvaluationScheduleLabel(evaluation),
    evaluation?.status,
  ]
    .concat(
      isAdminView
        ? [
            evaluation?.evaluatorId?.name,
            evaluation?.evaluatorId?.userId,
            getEvaluationRoleLabel(evaluation),
          ]
        : [],
    )
    .map(normalizeSearchText)
    .filter(Boolean);

  const exactTokens = new Set(
    [
      evaluation?.status,
      getEvaluationRoleLabel(evaluation),
      isAdminView ? evaluation?.evaluatorId?.userId : "",
      evaluation?.studentId?.matricNumber,
    ].flatMap(tokenizeSearchText),
  );

  return {
    partialFields,
    exactTokens,
    fullQueryText: partialFields.join(" "),
  };
};

export default function EvaluationPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { id: urlId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialSearchTerm = new URLSearchParams(location.search).get("q") || "";

  const [evaluations, setEvaluations] = useState([]);
  const [unlockRequestsByEvaluationId, setUnlockRequestsByEvaluationId] = useState(
    {},
  );
  const [loading, setLoading] = useState(true);

  const [selectedEval, setSelectedEval] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dismissedEvaluationId, setDismissedEvaluationId] = useState("");

  const [scores, setScores] = useState({});
  const [qualFeedback, setQualFeedback] = useState({});
  const [overallComments, setOverallComments] = useState("");

  const loadEvaluations = useCallback(async () => {
    try {
      setLoading(true);

      const [evaluationsRes, permissionsRes] = await Promise.all([
        api.get("/evaluations"),
        api.get("/feedback/permissions/my"),
      ]);
      let loadedEvaluations =
        evaluationsRes.data.data || evaluationsRes.data.evaluations || [];
      const unlockRequests = (permissionsRes.data.requests || []).filter(
        (request) => request?.scope === "UNLOCK_EVALUATION",
      );
      const latestUnlockRequestsByEvaluationId = unlockRequests.reduce(
        (accumulator, request) => {
          const targetEvaluationId =
            request?.targetEvaluationId?._id || request?.targetEvaluationId;

          if (!targetEvaluationId) return accumulator;
          if (accumulator[String(targetEvaluationId)]) return accumulator;

          accumulator[String(targetEvaluationId)] = request;
          return accumulator;
        },
        {},
      );

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
      setUnlockRequestsByEvaluationId(latestUnlockRequestsByEvaluationId);
    } catch (error) {
      console.error("Error loading evaluation data:", error);
    } finally {
      setLoading(false);
    }
  }, [urlId]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

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
        emitHistoricalRequestsUpdated();
        alert(
          "Unlock request sent to the administration. You will be able to edit once approved.",
        );
        loadEvaluations();
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
        alert("Evaluation unlocked. You can now edit and resubmit it.");
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


  const getLiveTotalScore = () => calculateWeightedTotal(selectedEval, scores);

  const calculateTotalScore = () => formatMark(getLiveTotalScore());

  const handleScoreChange = (criteriaKey, value) => {
    setScores((prev) => ({ ...prev, [criteriaKey]: value }));
  };

  const handleMaterialOpen = async (document) => {
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

  const openSessionDetail = (evaluation) => {
    const sessionId = getSessionId(evaluation);
    if (!sessionId) return;
    navigate(`/panel/sessions/${sessionId}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const missingScore = findMissingQuantitativeCriterion(selectedEval, scores);

      if (missingScore) {
        alert("Please provide a score for ALL criteria before submitting.");
        setIsSubmitting(false);
        return;
      }
      const payload = buildEvaluationSubmitPayload(selectedEval, {
        scores,
        qualFeedback,
        overallComments,
      });

      await api.post("/evaluations/submit", payload);
      alert("Evaluation submitted successfully and is now locked.");
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

  const openEvaluationModal = useCallback((ev) => {
    setDismissedEvaluationId("");
    setSelectedEval(ev);

    if (!urlId || urlId !== ev._id) {
      navigate(`/panel/evaluation/${ev._id}`, {
        replace: true,
        state: location.state,
      });
    }

    if (ev.status === "COMPLETED") {
      const savedQualFeedback =
        ev.qualitativeFeedback && Object.keys(ev.qualitativeFeedback).length
          ? ev.qualitativeFeedback
          : legacyProgressFeedback(ev);

      setScores(ev.scores || {});
      setQualFeedback(savedQualFeedback);
      setOverallComments(ev.overallComments || "");
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
    }
  }, [location.state, navigate, urlId]);

  useEffect(() => {
    if (
      urlId &&
      evaluations.length > 0 &&
      !selectedEval &&
      String(urlId) !== String(dismissedEvaluationId)
    ) {
      const targetEval = evaluations.find((ev) => ev._id === urlId);
      if (targetEval) {
        openEvaluationModal(targetEval);
      }
    }
  }, [urlId, evaluations, selectedEval, dismissedEvaluationId, openEvaluationModal]);

  useEffect(() => {
    if (!selectedEval?._id) return;
    const refreshedEvaluation = evaluations.find(
      (evaluation) => String(evaluation._id) === String(selectedEval._id),
    );
    if (refreshedEvaluation) {
      setSelectedEval((previous) => ({
        ...previous,
        ...refreshedEvaluation,
      }));
    }
  }, [evaluations, selectedEval?._id]);

  const closeModal = () => {
    setDismissedEvaluationId(selectedEval?._id || urlId || "");
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

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const filteredEvaluations = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchTerm);
    if (!normalizedQuery) return evaluations;

    return evaluations.filter((evaluation) => {
      const { fullQueryText, exactTokens } = buildEvaluationSearchData(
        evaluation,
        isAdmin,
      );

      return (
        fullQueryText.includes(normalizedQuery) || exactTokens.has(normalizedQuery)
      );
    });
  }, [evaluations, isAdmin, searchTerm]);
  const evaluationSortAccessors = useMemo(
    () => ({
      candidate: (ev) => `${ev.studentId?.name || ""} ${ev.studentId?.matricNumber || ""}`,
      session: (ev) => `${getEvaluationSessionLabel(ev)} ${getEvaluationRoleLabel(ev)} ${ev.semester || ""}`,
      schedule: (ev) => getEvaluationScheduleSortValue(ev),
      evaluator: (ev) => `${ev.evaluatorId?.name || ""} ${ev.evaluatorId?.userId || ""} ${getEvaluationRoleLabel(ev)}`,
      status: (ev) => ev.status || "",
      score: (ev) => getEvaluationDisplayedTotal(ev),
    }),
    [],
  );
  const {
    sortedItems: sortedEvaluations,
    sortConfig: evaluationSortConfig,
    requestSort: requestEvaluationSort,
  } = useSortableData(filteredEvaluations, evaluationSortAccessors, { key: "candidate" });

  useEffect(() => {
    if (selectedEval && selectedEval.status === "PENDING") {
      const draft = { scores, qualFeedback, overallComments };
      localStorage.setItem(
        `eval_draft_${selectedEval._id}`,
        JSON.stringify(draft),
      );
    }
  }, [selectedEval, scores, qualFeedback, overallComments]);

  useEffect(() => {
    setSearchTerm(new URLSearchParams(location.search).get("q") || "");
  }, [location.search]);

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-700 bg-green-100 border-green-300";
    if (score >= 80) return "text-blue-700 bg-blue-100 border-blue-300";
    if (score >= 65) return "text-yellow-700 bg-yellow-100 border-yellow-300";
    if (score >= 50) return "text-orange-700 bg-orange-100 border-orange-300";
    return "text-red-700 bg-red-100 border-red-300";
  };

  // Only the original evaluator can edit a pending evaluation or a completed
  // evaluation that has been explicitly unlocked for resubmission.
  const currentUserId = user?.id || user?._id || user?.userId;
  const selectedEvaluatorId =
    selectedEval?.evaluatorId?._id || selectedEval?.evaluatorId;
  const isAuthor = String(selectedEvaluatorId || "") === String(currentUserId || "");

  const isCompleted = selectedEval?.status === "COMPLETED";
  const isUnlocked = selectedEval?.isUnlocked === true;
  const selectedUnlockRequest =
    unlockRequestsByEvaluationId[String(selectedEval?._id || "")] || null;
  const hasPendingUnlockRequest =
    selectedUnlockRequest?.status === "PENDING";
  const hasRejectedUnlockRequest =
    selectedUnlockRequest?.status === "REJECTED";

  const isLocked = isCompleted && !isUnlocked;
  const canEdit =
    isAuthor &&
    (selectedEval?.status === "PENDING" || (isCompleted && isUnlocked));

  const canDirectUnlock = isAdmin && isAuthor && isLocked;
  const displayedTotalScore = getEvaluationDisplayedTotal(selectedEval, scores);
  const rubricWeightTotal = getRubricWeightTotal(selectedEval);

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
              : "Complete your assigned panel and supervisor evaluations here."}
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
                placeholder="Search candidate, session, schedule, evaluator name / ID, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-1/3 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 uppercase tracking-wider">
                <tr>
                  <SortableTh className="p-4" sortKey="candidate" sortConfig={evaluationSortConfig} onSort={requestEvaluationSort}>Candidate</SortableTh>
                  <SortableTh className="p-4" sortKey="session" sortConfig={evaluationSortConfig} onSort={requestEvaluationSort}>Session Info</SortableTh>
                  <SortableTh className="p-4" sortKey="schedule" sortConfig={evaluationSortConfig} onSort={requestEvaluationSort}>Schedule</SortableTh>
                  {isAdmin && <SortableTh className="p-4" sortKey="evaluator" sortConfig={evaluationSortConfig} onSort={requestEvaluationSort}>Evaluator</SortableTh>}
                  <SortableTh className="p-4 text-center" sortKey="status" sortConfig={evaluationSortConfig} onSort={requestEvaluationSort}>Status</SortableTh>
                  <SortableTh className="p-4 text-center" sortKey="score" sortConfig={evaluationSortConfig} onSort={requestEvaluationSort}>Final Score</SortableTh>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedEvaluations.map((ev) => {
                  const isLate = isLatePendingEvaluation(ev);
                  return (
                    <tr
                      key={ev._id}
                      className={`${
                        isLate ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="p-4">
                        <p className="font-bold text-gray-900">
                          <UserProfileLink
                            user={ev.studentId}
                            fallback="Unknown Student"
                            className="font-bold"
                          />
                        </p>
                        <p className="text-xs font-mono text-gray-500">
                          {ev.studentId?.matricNumber || "No Matric"}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {hasSessionTitle(ev) && getSessionId(ev) ? (
                            <button
                              type="button"
                              onClick={() => openSessionDetail(ev)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold border border-indigo-100 hover:bg-indigo-100 hover:text-indigo-900"
                            >
                              {getEvaluationSessionLabel(ev)}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold border border-indigo-100">
                              {getEvaluationSessionLabel(ev)}
                            </span>
                          )}
                          <span
                            className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase border ${getEvaluationRoleBadgeClass(ev)}`}
                          >
                            {getEvaluationRoleLabel(ev)}
                          </span>
                          {isLate && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-bold uppercase border border-red-200 bg-red-100 text-red-700">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Late
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-semibold">
                          {ev.semester}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatScheduleDate(ev.sessionId?.date)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-gray-500">
                          {getEvaluationScheduleLabel(ev)}
                        </p>
                        {isLate && (
                          <p className="mt-1 text-xs font-semibold text-red-700">
                            Pending after the scheduled session end time.
                          </p>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-sm font-semibold text-gray-700">
                          <UserProfileLink
                            user={ev.evaluatorId}
                            fallback="Unknown Evaluator"
                            className="font-semibold"
                          />
                          <p className="mt-1 text-xs font-mono text-gray-500">
                            {ev.evaluatorId?.userId || ev.evaluatorId?.email || "-"}
                          </p>
                        </td>
                      )}
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex px-3 py-1 rounded text-xs font-bold ${
                              ev.status === "COMPLETED"
                                ? "bg-green-100 text-green-700 border border-green-200"
                                : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                            }`}
                          >
                            {ev.status}
                          </span>
                          {isLate && (
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {!hasQuantitativeCriteria(ev) ? (
                          <span className="text-gray-400 text-xs italic">
                            Text Only
                          </span>
                        ) : ev.status === "COMPLETED" ? (
                          <div
                            className={`inline-flex px-3 py-1.5 rounded-lg border font-bold text-sm shadow-sm ${getScoreColor(getEvaluationDisplayedTotal(ev))}`}
                          >
                            {formatMark(getEvaluationDisplayedTotal(ev))}%
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
                              ? isLate
                                ? "bg-red-600 text-white hover:bg-red-700 shadow-sm"
                                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {ev.status === "PENDING" && !isAdmin ? (
                            <>
                              <FileText className="w-4 h-4" /> {isLate ? "Late" : "Evaluate"}
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" /> View Report
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
                    {getRubricDisplayName(
                      selectedEval.rubricId,
                      selectedEval.sessionType,
                    )}
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
                      <div className="mt-3 space-y-3">
                        {selectedUnlockRequest && (
                          <div
                            className={`rounded-lg border p-3 text-sm ${
                              hasPendingUnlockRequest
                                ? "border-yellow-200 bg-yellow-50 text-yellow-900"
                                : hasRejectedUnlockRequest
                                  ? "border-red-200 bg-red-50 text-red-900"
                                  : "border-green-200 bg-green-50 text-green-900"
                            }`}
                          >
                            <p className="font-bold uppercase text-xs tracking-wide">
                              Unlock Request {selectedUnlockRequest.status}
                            </p>
                            <p className="mt-1">
                              {hasPendingUnlockRequest
                                ? "Your request is waiting for admin review."
                                : hasRejectedUnlockRequest
                                  ? "Your request was rejected by admin."
                                  : "Your unlock request has been approved. Reload this page if editing is still locked."}
                            </p>
                            {selectedUnlockRequest.responseNote && (
                              <p className="mt-2 whitespace-pre-wrap">
                                Feedback: {selectedUnlockRequest.responseNote}
                              </p>
                            )}
                          </div>
                        )}

                        <button
                          onClick={handleUnlockRequest}
                          disabled={hasPendingUnlockRequest}
                          className={`px-4 py-2 rounded text-xs font-bold transition-colors shadow-sm ${
                            hasPendingUnlockRequest
                              ? "bg-yellow-100 text-yellow-800 cursor-not-allowed"
                              : "bg-red-600 text-white hover:bg-red-700"
                          }`}
                        >
                          <Lock className="w-3 h-3 inline mr-1" />
                          {hasPendingUnlockRequest
                            ? "Unlock Request Pending"
                            : hasRejectedUnlockRequest
                              ? "Request Unlock Again"
                              : "Request Unlock to Edit"}
                        </button>
                      </div>
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
                      <UserProfileLink
                        user={selectedEval.studentId}
                        fallback="N/A"
                        className="font-bold text-lg"
                      />
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
                      Evaluator's Name
                    </p>
                    <p className="font-bold text-indigo-700">
                      <UserProfileLink
                        user={selectedEval.evaluatorId}
                        fallback="N/A"
                        className="font-bold"
                      />
                    </p>
                    <span
                      className={`mt-2 inline-block px-3 py-1 rounded text-xs font-bold uppercase border ${getEvaluationRoleBadgeClass(selectedEval)}`}
                    >
                      {getEvaluationRoleLabel(selectedEval)}
                    </span>
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
                      hasQuantitativeCriteria(selectedEval) && (
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                            Total Marks
                          </p>
                          <p className="text-2xl font-black text-green-600">
                            {formatMark(displayedTotalScore)}%
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {(selectedEval.studentId?.researchTitle ||
                selectedEval.studentId?.researchAbstract) && (
                <div className="mb-8 p-5 bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm space-y-4">
                  {selectedEval.studentId?.researchTitle && (
                    <div>
                      <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-1">
                        Research Title
                      </p>
                      <p className="font-bold text-gray-900 text-lg leading-snug">
                        {selectedEval.studentId.researchTitle}
                      </p>
                    </div>
                  )}

                  {selectedEval.studentId?.researchAbstract && (
                    <div>
                      <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-1">
                        Abstract
                      </p>
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                        {selectedEval.studentId.researchAbstract}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gray-100 px-5 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
                  <span className="font-bold text-gray-800 uppercase text-sm tracking-widest flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Student Materials
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    {getSessionDocuments(selectedEval).length} file(s)
                  </span>
                </div>

                {getSessionDocuments(selectedEval).length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {getSessionDocuments(selectedEval).map((document) => (
                      <div
                        key={document._id || document.fileStorageId || document.url}
                        className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                      >
                        <div>
                          <p className="font-bold text-gray-900">
                            {document.title || "Student material"}
                          </p>
                          {getOriginalFileLabel(document) && (
                            <p className="text-xs text-gray-500 mt-1 break-all">
                              {getOriginalFileLabel(document)}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {document.type || "other"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMaterialOpen(document)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-50"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-gray-500">
                    No student materials are attached to this evaluation yet.
                  </p>
                )}
              </div>

              <form id="evalForm" onSubmit={handleSubmit}>
                {selectedEval && (
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
                          {getQuantitativeCriteria(selectedEval).map((crit) => {
                            const criterionWeight = getCriterionWeight(crit);
                            const criterionMaxScore = getCriterionMaxScore(crit);
                            const criterionScale = getScoreScale(crit);
                            const selectedContribution =
                              calculateCriterionContribution(crit, scores);

                            return (
                              <div
                                key={crit.key}
                                className="border border-gray-300 bg-white rounded-b-lg overflow-hidden shadow-sm"
                              >
                                <div className="bg-gray-50 px-5 py-3 border-b border-gray-300 flex flex-wrap justify-between items-center gap-3">
                                  <h3 className="font-black text-gray-900">
                                    {crit.title}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded text-xs font-bold">
                                      Weight: {formatMark(criterionWeight)}%
                                    </span>
                                    <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded text-xs font-bold">
                                      Contribution:{" "}
                                      {formatMark(selectedContribution)} /{" "}
                                      {formatMark(criterionWeight)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-sm table-fixed">
                                    <thead>
                                      <tr className="bg-white border-b border-gray-200">
                                        {criterionScale.map((s) => (
                                          <th
                                            key={s.value}
                                            className="p-3 border-r last:border-r-0 border-gray-200 text-center font-bold text-gray-500 text-xs uppercase tracking-wider min-w-[150px]"
                                          >
                                            {formatMarkLabel(s.value)}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-x divide-gray-200">
                                      <tr>
                                        {criterionScale.map((s) => {
                                          const isSelected =
                                            toNumber(scores[crit.key], -1) ===
                                            s.value;
                                          const optionContribution =
                                            calculateCriterionContribution(crit, {
                                              [crit.key]: s.value,
                                            });

                                          return (
                        <td
                          key={s.value}
                          className={`p-4 align-top transition-colors relative ${canEdit ? "cursor-pointer hover:bg-blue-50" : ""} ${isSelected ? "bg-indigo-50 border-t-4 border-t-indigo-600" : ""}`}
                          onClick={() => {
                            if (canEdit) {
                              handleScoreChange(crit.key, s.value);
                            }
                          }}
                        >
                                              <div className="flex flex-col items-center">
                                                <span
                                                  className={`mb-2 px-2.5 py-1 rounded-full text-[11px] font-black ${
                                                    isSelected
                                                      ? "bg-indigo-600 text-white"
                                                      : "bg-gray-900 text-white"
                                                  }`}
                                                >
                                                  {formatMarkLabel(s.value)}
                                                </span>
                                                <input
                                                  type="radio"
                                                  name={crit.key}
                                                  required
                                                  disabled={!canEdit}
                                                  checked={isSelected}
                              onChange={() => {
                                if (canEdit) {
                                  handleScoreChange(crit.key, s.value);
                                }
                              }}
                                                  className="w-5 h-5 accent-indigo-600 mb-3 cursor-pointer disabled:opacity-60"
                                                />
                                                <span
                                                  className={`mb-3 px-2 py-1 rounded text-[11px] font-black ${
                                                    isSelected
                                                      ? "bg-indigo-600 text-white"
                                                      : "bg-gray-100 text-gray-600"
                                                  }`}
                                                >
                                                  {formatMark(optionContribution)} /{" "}
                                                  {formatMark(criterionWeight)}%
                                                </span>
                                                <span className="sr-only">
                                                  Score {s.value} of{" "}
                                                  {criterionMaxScore}
                                                </span>
                                                <p
                                                  className={`text-xs text-justify leading-relaxed ${isSelected ? "text-indigo-900 font-bold" : "text-gray-600 font-medium"}`}
                                                >
                                                  {getScoreDescription(crit, s)}
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
                            );
                          })}
                        </div>

                        {canEdit && hasQuantitativeCriteria(selectedEval) && (
                          <div className="bg-gradient-to-r from-gray-900 to-indigo-900 text-white p-6 rounded-xl flex justify-between items-center mb-8 shadow-xl">
                            <div>
                              <span className="block text-lg font-bold uppercase tracking-widest text-indigo-300">
                                Live Calculated Mark
                              </span>
                              <span className="block text-sm text-gray-400 mt-1">
                                Selected contribution out of{" "}
                                {formatMark(rubricWeightTotal)}%
                              </span>
                            </div>
                            <span className="text-5xl font-black text-white">
                              {calculateTotalScore()}%
                            </span>
                          </div>
                        )}

                        {getQualitativeCriteria(selectedEval).length > 0 && (
                        <div className="border border-gray-300 bg-white rounded-lg overflow-hidden shadow-sm mb-8">
                          <div className="bg-gray-100 px-5 py-3 border-b border-gray-300">
                            <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                              Section C: Qualitative Feedback
                            </span>
                          </div>
                          <div className="p-6 space-y-6 bg-gray-50">
                            {getQualitativeCriteria(selectedEval).map((crit) => (
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
                        )}
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
