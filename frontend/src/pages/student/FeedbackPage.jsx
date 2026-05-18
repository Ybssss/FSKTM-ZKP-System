import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import {
  ClipboardCheck,
  Hourglass,
  FileText,
  CheckCircle2,
} from "lucide-react";

export default function FeedbackPage() {
  const { user } = useAuth();
  const [groupedEvaluations, setGroupedEvaluations] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openedReportId, setOpenedReportId] = useState(null);

  useEffect(() => {
    fetchMyEvaluations();
  }, []);

  const fetchMyEvaluations = async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/evaluations/student/${user.id || user.userId || user._id}`,
      );
      const rawEvals = res.data.evaluations || [];

      const grouped = {};
      rawEvals.forEach((ev) => {
        const sessionId =
          typeof ev.sessionId === "object" ? ev.sessionId?._id : ev.sessionId;

        const groupKey =
          sessionId || `${ev.sessionType}_${ev.semester || "Unknown"}`;

        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            sessionId: sessionId || null,
            sessionType: ev.sessionType,
            semester: ev.semester || "Unknown",
            date: ev.createdAt,
            evalCount: 0,
            totalSum: 0,
            panels: [],
            remarks: [],
            criteriaScores: {},
            rubricName: ev.rubricId?.name || "Standard Evaluation",
          };
        }

        const group = grouped[groupKey];
        group.totalSum += ev.totalMarks ?? ev.totalScore ?? 0;
        group.evalCount += 1;

        const panelName =
          ev.evaluatorId?.name || ev.panelId?.name || "Unknown Panel";
        if (!group.panels.includes(panelName)) group.panels.push(panelName);

        if (ev.overallComments)
          group.remarks.push({ panel: panelName, text: ev.overallComments });

        // Progress Assessment specific logic
        if (ev.sessionType === "PROGRESS_ASSESSMENT" && ev.summaryOfProgress) {
          group.remarks.push({
            panel: panelName,
            text: `Summary: ${ev.summaryOfProgress}\n\nImprovement: ${ev.commentsForImprovement}\n\nSuggestions: ${ev.overallSuggestions}`,
          });
        }

        if (
          typeof ev.scores === "object" &&
          ev.sessionType !== "PROGRESS_ASSESSMENT"
        ) {
          Object.entries(ev.scores).forEach(([key, val]) => {
            let critName = key;
            let critMax = 4;

            if (ev.rubricId && Array.isArray(ev.rubricId.criteria)) {
              const found = ev.rubricId.criteria.find(
                (c) => c._id === key || c.key === key,
              );
              if (found) {
                critName = found.title || found.name;
                critMax = found.maxScore || 4;
              }
            }

            if (!group.criteriaScores[critName]) {
              group.criteriaScores[critName] = {
                sum: 0,
                count: 0,
                maxScore: critMax,
              };
            }
            group.criteriaScores[critName].sum += parseFloat(val) || 0;
            group.criteriaScores[critName].count += 1;
          });
        }
      });

      const completed = [];
      let pending = 0;
      Object.values(grouped).forEach((group) => {
        if (group.evalCount >= 2) {
          const averagedCriteria = Object.entries(group.criteriaScores).map(
            ([name, data]) => ({
              name,
              average: (data.sum / data.count).toFixed(1),
              maxScore: data.maxScore,
            }),
          );
          completed.push({
            id:
              group.sessionId ||
              `${group.sessionType || "UNKNOWN"}_${group.semester || "Unknown"}`,
            ...group,
            finalAverage: (group.totalSum / group.evalCount).toFixed(2),
            averagedCriteria,
          });
        } else {
          pending += 1;
        }
      });

      completed.sort((a, b) => new Date(b.date) - new Date(a.date));
      setGroupedEvaluations(completed);
      setPendingCount(pending);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-8 h-8 text-indigo-600" /> Official Evaluation
          Reports
        </h1>
        <p className="text-gray-600 mt-2">
          View your formal academic evaluation results. Documents are published
          only after all assigned panels have submitted their marks.
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
              You have {pendingCount} session(s) currently under review.
              Documents will be published automatically once panel grading
              concludes.
            </p>
          </div>
        </div>
      )}

      {groupedEvaluations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">
            No Published Reports
          </h3>
          <p className="text-gray-500">
            Your official results will appear here once finalized by the
            administration.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedEvaluations.map((result, idx) => {
            const isOpen = openedReportId === result.id;

            return (
              <div
                key={result.id || idx}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* SUMMARY HEADER - shown first */}
                <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                      {result.rubricName}
                    </p>
                    <h3 className="text-xl font-bold text-gray-900 mt-1">
                      {result.sessionType?.replaceAll("_", " ")}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {result.semester} • {result.panels.length} panel(s) •{" "}
                      {new Date(result.date).toLocaleDateString("en-MY")}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {result.sessionType !== "PROGRESS_ASSESSMENT" && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-bold uppercase">
                          Final Average
                        </p>
                        <p className="text-2xl font-black text-indigo-700">
                          {result.finalAverage}%
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() =>
                        setOpenedReportId(isOpen ? null : result.id)
                      }
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                    >
                      {isOpen ? "Hide Details" : "View Details"}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <>
                    {/* DOCUMENT HEADER */}
                    <div className="bg-indigo-900 p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-indigo-500">
                      <div className="text-center md:text-left">
                        <span className="inline-block px-3 py-1 bg-white/10 rounded text-xs font-bold tracking-widest uppercase mb-3 border border-white/20">
                          {result.rubricName}
                        </span>
                        <h2 className="text-3xl font-black uppercase tracking-wide">
                          {result.sessionType?.replaceAll("_", " ")}
                        </h2>
                        <p className="text-indigo-200 font-medium mt-2 flex items-center justify-center md:justify-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />{" "}
                          Officially Finalized • {result.semester}
                        </p>
                      </div>
                      {result.sessionType !== "PROGRESS_ASSESSMENT" && (
                        <div className="bg-white text-gray-900 px-8 py-5 rounded-xl text-center shadow-2xl min-w-[180px] border-2 border-indigo-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-400">
                            Combined Final Grade
                          </p>
                          <p className="text-5xl font-black text-indigo-700">
                            {result.finalAverage}%
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-8 bg-gray-50">
                      {/* SECTION A */}
                      <div className="border border-gray-300 mb-8 rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                          <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                            Section A: Candidate's & Examiners' Details
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2">
                          <div className="p-4 border-b md:border-b-0 md:border-r border-gray-300">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                              Candidate's Name
                            </p>
                            <p className="font-bold text-gray-900 text-lg">
                              {user.name}
                            </p>
                          </div>
                          <div className="p-4 border-b border-gray-300 bg-gray-50">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                              Matric Number
                            </p>
                            <p className="font-mono font-bold text-gray-900 text-lg">
                              {user.matricNumber || user.userId}
                            </p>
                          </div>
                          <div className="p-4 border-t border-gray-300 md:col-span-2">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                              Panel of Examiners
                            </p>
                            <ul className="flex flex-wrap gap-3">
                              {result.panels.map((panel, i) => (
                                <li
                                  key={i}
                                  className="bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-md text-sm font-bold border border-indigo-100"
                                >
                                  {panel}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* SECTION B */}
                      {result.sessionType !== "PROGRESS_ASSESSMENT" && (
                        <div className="border border-gray-300 mb-8 rounded-lg overflow-hidden bg-white shadow-sm">
                          <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                            <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                              Section B: Averaged Criteria Breakdown
                            </span>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {result.averagedCriteria.map((crit, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center p-4 hover:bg-gray-50"
                              >
                                <p className="font-bold text-gray-800">
                                  {crit.name}
                                </p>
                                <div className="text-right">
                                  <span className="text-xl font-black text-indigo-700">
                                    {crit.average}
                                  </span>
                                  <span className="text-sm text-gray-400 font-bold">
                                    {" "}
                                    / {crit.maxScore}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SECTION C */}
                      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                          <span className="font-bold text-gray-800 uppercase text-sm tracking-widest">
                            Section C: Combined Panel Remarks
                          </span>
                        </div>
                        <div className="p-6 space-y-6">
                          {result.remarks.length === 0 ? (
                            <p className="text-gray-500 italic">
                              No formal remarks provided.
                            </p>
                          ) : (
                            result.remarks.map((rem, i) => (
                              <div
                                key={i}
                                className="bg-gray-50 p-5 rounded-lg border border-gray-200"
                              >
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-200 pb-2">
                                  Remarks by {rem.panel}
                                </p>
                                <p className="text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">
                                  "{rem.text}"
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
