import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Hourglass,
  Search,
} from "lucide-react";
import UserProfileLink from "../../components/UserProfileLink";

const SESSION_TYPE_LABELS = {
  PROPOSAL_DEFENSE: "Proposal Defense",
  PROGRESS_ASSESSMENT: "Progress Assessment",
  PRE_VIVA: "Pre-Viva",
};

const formatDate = (value) => {
  if (!value) return "Date not available";
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "Date not available";

  return date.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getId = (value) =>
  String(value?._id || value?.id || value || "");

const getSessionKey = (evaluation) =>
  getId(evaluation.sessionId) ||
  `${evaluation.sessionType || "UNKNOWN"}_${evaluation.semester || "Unknown"}`;

const getResultBadgeClass = (status) =>
  status === "PASS"
    ? "bg-green-100 text-green-700 border-green-200"
    : status === "FAIL"
      ? "bg-red-100 text-red-700 border-red-200"
      : status === "COMPLETED"
        ? "bg-blue-100 text-blue-700 border-blue-200"
      : "bg-orange-100 text-orange-700 border-orange-200";

const getResultLabel = (status) =>
  status === "PASS"
    ? "PASS"
    : status === "FAIL"
      ? "FAIL"
      : status === "COMPLETED"
        ? "COMPLETED"
        : "PENDING";

export default function FeedbackPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [openedReportId, setOpenedReportId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMyEvaluations = useCallback(async () => {
    try {
      setLoading(true);

      const studentId = user?.id || user?._id || user?.userId;
      const res = await api.get(`/evaluations/student/${studentId}`);
      const rawEvaluations = res.data.evaluations || [];

      const grouped = {};

      rawEvaluations.forEach((evaluation) => {
        const key = getSessionKey(evaluation);
        const session = evaluation.sessionId || {};

        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            sessionTitle:
              session.title ||
              SESSION_TYPE_LABELS[evaluation.sessionType] ||
              evaluation.sessionType ||
              "Evaluation Report",
            sessionType: evaluation.sessionType,
            semester: evaluation.semester || "Unknown semester",
            date: session.date || evaluation.updatedAt || evaluation.createdAt,
            rubricName: evaluation.rubricId?.name || "Evaluation Rubric",
            completedEvaluations: [],
            pendingEvaluations: [],
            panels: [],
            remarks: [],
            result: {
              status: "PENDING",
              isPublished: false,
              passThreshold: 65,
              completedEvaluatorCount: 0,
              requiredEvaluatorCount: 3,
              usesQuantitativeScoring: true,
            },
          };
        }

        const group = grouped[key];
        const result = evaluation.result || {
          status: evaluation.resultStatus || "PENDING",
          isPublished: evaluation.resultPublished === true,
          passThreshold: 65,
          completedEvaluatorCount: 0,
          requiredEvaluatorCount: 3,
          usesQuantitativeScoring: true,
        };
        const panelUser = evaluation.evaluatorId || evaluation.panelId || null;
        const isSupervisorEvaluation = evaluation.formFiller === "Supervisor";
        const panelName =
          panelUser?.name ||
          (isSupervisorEvaluation ? "Supervisor" : "Panel");
        const panelKey = panelUser?._id || panelUser?.id || panelName;

        if (!group.panels.some((panel) => panel.key === panelKey)) {
          group.panels.push({
            key: panelKey,
            name: panelName,
            user: panelUser,
            roleLabel: isSupervisorEvaluation ? "SV" : "Panel",
          });
        }

        if (
          result.isPublished ||
          result.requiredEvaluatorCount > group.result.requiredEvaluatorCount
        ) {
          group.result = result;
        }

        if (evaluation.status === "COMPLETED") {
          group.completedEvaluations.push(evaluation);
        } else {
          group.pendingEvaluations.push(evaluation);
        }

        if (evaluation.overallComments) {
          group.remarks.push({ panel: panelName, text: evaluation.overallComments });
        }

        if (evaluation.sessionType === "PROGRESS_ASSESSMENT") {
          const progressText = [
            evaluation.summaryOfProgress && `Summary: ${evaluation.summaryOfProgress}`,
            evaluation.commentsForImprovement &&
              `Improvement: ${evaluation.commentsForImprovement}`,
            evaluation.overallSuggestions &&
              `Suggestions: ${evaluation.overallSuggestions}`,
          ]
            .filter(Boolean)
            .join("\n\n");

          if (progressText) {
            group.remarks.push({ panel: panelName, text: progressText });
          }
        }
      });

      const finalizedReports = [];
      let pending = 0;

      Object.values(grouped).forEach((group) => {
        if (group.result.isPublished) {
          finalizedReports.push({
            ...group,
          });
        } else {
          pending += 1;
        }
      });

      finalizedReports.sort((a, b) => new Date(b.date) - new Date(a.date));
      setReports(finalizedReports);
      setPendingCount(pending);
    } catch (error) {
      console.error("Error loading evaluation reports:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?._id, user?.userId]);

  useEffect(() => {
    fetchMyEvaluations();
  }, [fetchMyEvaluations]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredReports = useMemo(() => {
    if (!normalizedSearchTerm) return reports;

    return reports.filter((report) => {
      const searchableText = [
        report.sessionTitle,
        report.rubricName,
        SESSION_TYPE_LABELS[report.sessionType],
        report.sessionType,
        report.semester,
        formatDate(report.date),
        ...(report.panels || []).map((panel) => panel.name),
        report.result?.status,
        ...(report.remarks || []).flatMap((remark) => [remark.panel, remark.text]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchTerm);
    });
  }, [reports, normalizedSearchTerm]);

  const hasReports = useMemo(() => reports.length > 0, [reports]);
  const hasFilteredReports = useMemo(
    () => filteredReports.length > 0,
    [filteredReports],
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-indigo-600" /> Official Evaluation Reports
        </h1>
        <p className="text-gray-600 mt-2">
          View finalized academic outcomes after the assigned panel and supervisor evaluations are completed.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
          Search Reports
        </label>
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by session, rubric, evaluator, semester, date, result, or feedback text..."
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 hover:text-gray-900"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Showing {filteredReports.length} of {reports.length} published report(s).
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-orange-100 rounded-full text-orange-600">
            <Hourglass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-orange-900 text-lg">
              Results Pending Publication
            </h3>
            <p className="text-orange-800 text-sm">
              {pendingCount} session(s) are still waiting for all required evaluator submissions.
            </p>
          </div>
        </div>
      )}

      {!hasReports ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Published Reports</h3>
          <p className="text-gray-500">
            Your official results will appear here once finalized.
          </p>
        </div>
      ) : !hasFilteredReports ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Matching Reports</h3>
          <p className="text-gray-500">
            No published report matches “{searchTerm}”. Try another keyword.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const isOpen = openedReportId === report.id;
            const resultStatus = getResultLabel(report.result?.status);

            return (
              <div
                key={report.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                      {report.rubricName}
                    </p>
                    <h3 className="text-xl font-bold text-gray-900 mt-1">
                      {report.sessionTitle}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {SESSION_TYPE_LABELS[report.sessionType] || report.sessionType} · {report.semester} · {formatDate(report.date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-bold uppercase">
                        Result
                      </p>
                      <span
                        className={`inline-flex px-4 py-2 rounded-lg border text-lg font-black ${getResultBadgeClass(resultStatus)}`}
                      >
                        {resultStatus}
                      </span>
                    </div>

                    <button
                      onClick={() => setOpenedReportId(isOpen ? null : report.id)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                    >
                      {isOpen ? "Hide Details" : "View Details"}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-200 bg-gray-50 p-5 md:p-6 space-y-6">
                    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                        <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                          Candidate and Panel Details
                        </span>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Candidate</p>
                          <p className="font-bold text-gray-900">{user?.name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Matric Number</p>
                          <p className="font-mono font-bold text-gray-900">
                            {user?.matricNumber || user?.userId}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                            Evaluation Team
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {report.panels.map((panel) => (
                              <span
                                key={panel.key}
                                className="bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-md text-sm font-bold border border-indigo-100"
                              >
                                <UserProfileLink
                                  user={panel.user}
                                  fallback={panel.name}
                                  className="font-bold"
                                />
                                <span className="ml-2 text-[10px] uppercase opacity-70">
                                  {panel.roleLabel}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center gap-3">
                        <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                          Published Result
                        </span>
                        <span
                          className={`inline-flex px-3 py-1 rounded-md border text-sm font-black ${getResultBadgeClass(resultStatus)}`}
                        >
                          {resultStatus}
                        </span>
                      </div>
                      <p className="p-4 text-sm text-gray-600">
                        {report.result?.usesQuantitativeScoring
                          ? `The official outcome is published after the two panel evaluations and supervisor evaluation are completed. The passing threshold is ${report.result?.passThreshold || 65}%.`
                          : "This progress feedback is published after the two panel evaluations and supervisor evaluation are completed."}
                      </p>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                        <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                          Evaluator Feedback
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {report.remarks.length ? (
                          report.remarks.map((remark, index) => (
                            <div key={`${remark.panel}-${index}`} className="p-4">
                              <p className="text-xs font-bold text-indigo-600 uppercase mb-1">
                                {remark.panel}
                              </p>
                              <p className="whitespace-pre-line text-sm text-gray-700 leading-relaxed">
                                {remark.text}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="p-4 text-sm text-gray-500">
                            No written feedback was provided.
                          </p>
                        )}
                      </div>
                    </section>

                    <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" /> Officially Finalized
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
