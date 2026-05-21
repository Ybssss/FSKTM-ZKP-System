import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Hourglass,
  Search,
} from "lucide-react";

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

const normalizeScoreEntries = (scores) => {
  if (!scores) return [];

  if (scores instanceof Map) return Array.from(scores.entries());

  if (typeof scores === "object") return Object.entries(scores);

  return [];
};

const getSessionKey = (evaluation) =>
  getId(evaluation.sessionId) ||
  `${evaluation.sessionType || "UNKNOWN"}_${evaluation.semester || "Unknown"}`;

export default function FeedbackPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [openedReportId, setOpenedReportId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyEvaluations();
  }, []);

  const fetchMyEvaluations = async () => {
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
            expectedPanelCount: 0,
            completedEvaluations: [],
            pendingEvaluations: [],
            panels: [],
            remarks: [],
            criteriaScores: {},
          };
        }

        const group = grouped[key];
        const panelName =
          evaluation.evaluatorId?.name ||
          evaluation.panelId?.name ||
          "Panel";

        if (!group.panels.includes(panelName)) group.panels.push(panelName);

        if (evaluation.status === "COMPLETED") {
          group.completedEvaluations.push(evaluation);
        } else {
          group.pendingEvaluations.push(evaluation);
        }

        group.expectedPanelCount = Math.max(
          group.expectedPanelCount,
          group.completedEvaluations.length + group.pendingEvaluations.length,
        );

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

        if (
          evaluation.status === "COMPLETED" &&
          evaluation.sessionType !== "PROGRESS_ASSESSMENT"
        ) {
          normalizeScoreEntries(evaluation.scores).forEach(([key, rawValue]) => {
            let criterionName = key;
            let criterionMax = 4;

            if (Array.isArray(evaluation.rubricId?.criteria)) {
              const found = evaluation.rubricId.criteria.find(
                (criterion) => getId(criterion) === String(key) || criterion.key === key,
              );

              if (found) {
                criterionName = found.title || found.name || key;
                criterionMax = found.maxScore || 4;
              }
            }

            if (!group.criteriaScores[criterionName]) {
              group.criteriaScores[criterionName] = {
                sum: 0,
                count: 0,
                maxScore: criterionMax,
              };
            }

            group.criteriaScores[criterionName].sum += Number(rawValue || 0);
            group.criteriaScores[criterionName].count += 1;
          });
        }
      });

      const finalizedReports = [];
      let pending = 0;

      Object.values(grouped).forEach((group) => {
        const isProgress = group.sessionType === "PROGRESS_ASSESSMENT";
        const completedCount = group.completedEvaluations.length;
        const expectedCount = Math.max(group.expectedPanelCount, 2);

        if (completedCount >= expectedCount || (isProgress && completedCount > 0)) {
          const numericMarks = group.completedEvaluations
            .map((evaluation) => Number(evaluation.totalMarks))
            .filter((mark) => Number.isFinite(mark) && mark > 0);

          const finalAverage =
            !isProgress && numericMarks.length > 0
              ? (
                  numericMarks.reduce((sum, mark) => sum + mark, 0) /
                  numericMarks.length
                ).toFixed(2)
              : null;

          const averagedCriteria = Object.entries(group.criteriaScores).map(
            ([name, data]) => ({
              name,
              average: (data.sum / Math.max(data.count, 1)).toFixed(1),
              maxScore: data.maxScore,
            }),
          );

          finalizedReports.push({
            ...group,
            finalAverage,
            averagedCriteria,
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
  };

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
        report.finalAverage,
        ...(report.panels || []),
        ...(report.remarks || []).flatMap((remark) => [remark.panel, remark.text]),
        ...(report.averagedCriteria || []).map(
          (criterion) => `${criterion.name} ${criterion.average}/${criterion.maxScore}`,
        ),
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
          View finalized academic reports after the assigned panel evaluations are completed.
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
            placeholder="Search by session, rubric, panel, semester, date, score, or feedback text..."
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
              {pendingCount} session(s) are still waiting for all required panel submissions.
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
            const isProgress = report.sessionType === "PROGRESS_ASSESSMENT";

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
                    {!isProgress && report.finalAverage !== null && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-bold uppercase">
                          Final Average
                        </p>
                        <p className="text-2xl font-black text-indigo-700">
                          {report.finalAverage}%
                        </p>
                      </div>
                    )}

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
                            Panel of Examiners
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {report.panels.map((panel) => (
                              <span
                                key={panel}
                                className="bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-md text-sm font-bold border border-indigo-100"
                              >
                                {panel}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>

                    {!isProgress && (
                      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center gap-3">
                          <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                            Criteria Breakdown
                          </span>
                          {report.finalAverage !== null && (
                            <span className="text-lg font-black text-indigo-700">
                              {report.finalAverage}%
                            </span>
                          )}
                        </div>
                        <div className="divide-y divide-gray-100">
                          {report.averagedCriteria.length ? (
                            report.averagedCriteria.map((criterion) => (
                              <div
                                key={criterion.name}
                                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                              >
                                <p className="font-bold text-gray-800">{criterion.name}</p>
                                <p className="text-right font-black text-indigo-700">
                                  {criterion.average} / {criterion.maxScore}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="p-4 text-sm text-gray-500">
                              No criterion score breakdown was provided.
                            </p>
                          )}
                        </div>
                      </section>
                    )}

                    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                        <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                          Panel Feedback
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
