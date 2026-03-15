import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import {
  ClipboardCheck,
  Users,
  Calendar,
  Award,
  MessageSquare,
  Hourglass,
  BarChart3,
} from "lucide-react";

export default function FeedbackPage() {
  const { user } = useAuth();
  const [groupedEvaluations, setGroupedEvaluations] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

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

      // 1. Group raw evaluations by Session Type
      const grouped = {};
      rawEvals.forEach((ev) => {
        if (!grouped[ev.sessionType]) {
          grouped[ev.sessionType] = {
            sessionType: ev.sessionType,
            date: ev.createdAt,
            evalCount: 0,
            totalSum: 0,
            panels: [],
            remarks: [],
            criteriaScores: {}, // New: Track subcategory scores
            rubricName: ev.rubricId?.name || "Standard Rubric",
          };
        }

        const group = grouped[ev.sessionType];

        // Add to Overall Score
        group.totalSum += ev.totalScore ?? ev.overallScore ?? 0;
        group.evalCount += 1;

        // Grab Panel Name & Remarks
        const panelName =
          ev.evaluatorId?.name || ev.panelId?.name || "Unknown Panel";
        if (!group.panels.includes(panelName)) group.panels.push(panelName);
        if (ev.remarks)
          group.remarks.push({ panel: panelName, text: ev.remarks });

        // 2. Add to Subcategory (Criteria) Scores
        if (Array.isArray(ev.scores)) {
          ev.scores.forEach((s) => {
            if (!group.criteriaScores[s.criterionName]) {
              group.criteriaScores[s.criterionName] = {
                sum: 0,
                count: 0,
                weight: s.weight,
                maxScore: s.maxScore,
              };
            }
            group.criteriaScores[s.criterionName].sum +=
              parseFloat(s.score) || 0;
            group.criteriaScores[s.criterionName].count += 1;
          });
        } else if (typeof ev.scores === "object") {
          // Handle old Map object data
          Object.entries(ev.scores).forEach(([name, val]) => {
            if (!group.criteriaScores[name]) {
              group.criteriaScores[name] = {
                sum: 0,
                count: 0,
                weight: "-",
                maxScore: 100,
              };
            }
            group.criteriaScores[name].sum += parseFloat(val) || 0;
            group.criteriaScores[name].count += 1;
          });
        }
      });

      // 3. Filter completed vs pending, and calculate final averages
      const completed = [];
      let pending = 0;

      Object.values(grouped).forEach((group) => {
        // STRICT RULE: Only show if 2 panels have graded!
        if (group.evalCount >= 2) {
          // Calculate average for each subcategory
          const averagedCriteria = Object.entries(group.criteriaScores).map(
            ([name, data]) => ({
              name,
              average: (data.sum / data.count).toFixed(1),
              weight: data.weight,
              maxScore: data.maxScore,
            }),
          );

          completed.push({
            ...group,
            finalAverage: (group.totalSum / group.evalCount).toFixed(1),
            averagedCriteria,
          });
        } else {
          // If only 1 panel has graded, it is pending
          pending += 1;
        }
      });

      // Sort completed by newest date
      completed.sort((a, b) => new Date(b.date) - new Date(a.date));

      setGroupedEvaluations(completed);
      setPendingCount(pending);
    } catch (error) {
      console.error("Failed to fetch evaluations:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-8 h-8 text-indigo-600" />
          My Official Results
        </h1>
        <p className="text-gray-600 mt-2">
          View your finalized evaluation scores. Results are only published once
          both assigned panels have submitted their marks.
        </p>
      </div>

      {/* PENDING NOTIFICATION */}
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
              You have {pendingCount} session(s) currently being processed.
              Marks will be revealed here automatically once the second panel
              completes their evaluation.
            </p>
          </div>
        </div>
      )}

      {/* NO RESULTS AT ALL */}
      {groupedEvaluations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">
            No Finalized Results Yet
          </h3>
          <p className="text-gray-500">
            Your results will appear here once grading is fully completed.
          </p>
        </div>
      ) : (
        /* PUBLISHED RESULTS */
        <div className="space-y-8">
          {groupedEvaluations.map((result, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Top Header: Final Average */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wider uppercase mb-2">
                    {result.rubricName}
                  </span>
                  <h2 className="text-2xl font-bold">{result.sessionType}</h2>
                  <div className="flex items-center gap-2 text-indigo-100 mt-2 text-sm font-medium">
                    <Calendar className="w-4 h-4" /> Published on{" "}
                    {new Date(result.date).toLocaleDateString()}
                  </div>
                </div>

                <div className="bg-white text-indigo-900 px-8 py-5 rounded-2xl text-center shadow-xl min-w-[180px]">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1 text-indigo-500">
                    Combined Final Score
                  </p>
                  <p className="text-5xl font-black">{result.finalAverage}%</p>
                  <p className="text-xs font-medium text-gray-400 mt-1">
                    Averaged from {result.evalCount} Panels
                  </p>
                </div>
              </div>

              <div className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Subcategory Averages */}
                <div className="lg:col-span-2 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      Averaged Criteria Breakdown
                    </h3>
                    <div className="space-y-3">
                      {result.averagedCriteria.map((crit, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100"
                        >
                          <div>
                            <p className="font-bold text-gray-800 capitalize">
                              {crit.name.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Weight: {crit.weight}
                              {crit.weight !== "-" ? "%" : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-indigo-700">
                              {crit.average}
                            </span>
                            <span className="text-sm font-medium text-gray-500">
                              {" "}
                              / {crit.maxScore}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
                      <MessageSquare className="w-5 h-5 text-indigo-600" />
                      Panel Remarks
                    </h3>
                    {result.remarks.length > 0 ? (
                      <div className="space-y-4">
                        {result.remarks.map((rem, i) => (
                          <div
                            key={i}
                            className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100"
                          >
                            <p className="text-xs font-bold text-indigo-700 mb-2 uppercase tracking-wider">
                              Comment from {rem.panel}
                            </p>
                            <p className="text-gray-700 leading-relaxed">
                              "{rem.text}"
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic bg-gray-50 p-4 rounded-xl">
                        No additional remarks were provided.
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column: Panels Involved */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 sticky top-6">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-indigo-600" /> Evaluated By
                    </h3>
                    <ul className="space-y-3">
                      {result.panels.map((panel, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm"
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                            {panel.charAt(0)}
                          </div>
                          <span className="text-gray-800 font-medium">
                            {panel}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
