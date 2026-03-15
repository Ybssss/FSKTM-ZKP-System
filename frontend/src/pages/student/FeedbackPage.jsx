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
            criteriaScores: {},
            rubricName: ev.rubricId?.name || "Standard Rubric",
          };
        }
        const group = grouped[ev.sessionType];
        group.totalSum += ev.totalScore ?? ev.overallScore ?? 0;
        group.evalCount += 1;

        const panelName =
          ev.evaluatorId?.name || ev.panelId?.name || "Unknown Panel";
        if (!group.panels.includes(panelName)) group.panels.push(panelName);
        if (ev.remarks)
          group.remarks.push({ panel: panelName, text: ev.remarks });

        // 🚀 FIXED: Translate IDs back to names for Student View!
        if (typeof ev.scores === "object") {
          Object.entries(ev.scores).forEach(([key, val]) => {
            let critName = key;
            let critWeight = "-";
            let critMax = 100;

            // Look up the actual name using the populated rubric criteria
            if (ev.rubricId && Array.isArray(ev.rubricId.criteria)) {
              const found = ev.rubricId.criteria.find(
                (c) => c._id === key || c.name === key,
              );
              if (found) {
                critName = found.name;
                critWeight = found.weight;
                critMax = found.maxScore;
              }
            }

            if (!group.criteriaScores[critName]) {
              group.criteriaScores[critName] = {
                sum: 0,
                count: 0,
                weight: critWeight,
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
          // STRICT 2-PANEL REQUIREMENT
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-8 h-8 text-indigo-600" /> My Official Results
        </h1>
        <p className="text-gray-600 mt-2">
          View your finalized evaluation scores. Results are only published once
          both assigned panels submit their marks.
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
              You have {pendingCount} session(s) currently being processed.
              Marks will be revealed automatically once both panels complete
              their evaluation.
            </p>
          </div>
        </div>
      )}

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
        <div className="space-y-8">
          {groupedEvaluations.map((result, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wider uppercase mb-2">
                    {result.rubricName}
                  </span>
                  <h2 className="text-2xl font-bold">{result.sessionType}</h2>
                </div>
                <div className="bg-white text-indigo-900 px-8 py-5 rounded-2xl text-center shadow-xl min-w-[180px]">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1 text-indigo-500">
                    Combined Final Score
                  </p>
                  <p className="text-5xl font-black">{result.finalAverage}%</p>
                </div>
              </div>

              <div className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" /> Averaged
                      Criteria Breakdown
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
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-indigo-700">
                              {crit.average}
                            </span>
                            <span className="text-sm text-gray-500">
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
                      <MessageSquare className="w-5 h-5 text-indigo-600" />{" "}
                      Panel Remarks
                    </h3>
                    {result.remarks.map((rem, i) => (
                      <div
                        key={i}
                        className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-3"
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
                </div>
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-indigo-600" /> Evaluated By
                    </h3>
                    <ul className="space-y-3">
                      {result.panels.map((panel, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm font-medium text-gray-800"
                        >
                          {panel}
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
