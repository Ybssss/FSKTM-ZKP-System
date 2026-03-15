import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { TrendingUp, BookOpen, BarChart3, Calendar } from "lucide-react";

export default function ProgressPage() {
  const { user } = useAuth();
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all raw evaluations for this student
      const res = await api.get(
        `/evaluations/student/${user.id || user.userId || user._id}`,
      );
      const rawEvals = res.data.evaluations || [];

      // 1. 🚀 FIXED: Group raw evaluations strictly by Session Type AND Semester
      const grouped = {};
      rawEvals.forEach((ev) => {
        const groupKey = `${ev.sessionType}_${ev.semester}`;

        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            sessionName: `${ev.sessionType} (${ev.semester || "Unknown Sem"})`,
            date: ev.createdAt, // Store date for sorting
            evalCount: 0,
            totalSum: 0,
          };
        }
        // Add up the scores
        grouped[groupKey].totalSum += ev.totalScore ?? ev.overallScore ?? 0;
        grouped[groupKey].evalCount += 1;
      });

      // 2. Filter ONLY fully graded sessions (2 panels)
      const processedData = [];
      Object.values(grouped).forEach((group) => {
        if (group.evalCount >= 2) {
          processedData.push({
            name: group.sessionName,
            score: parseFloat((group.totalSum / group.evalCount).toFixed(1)),
            date: new Date(group.date),
          });
        }
      });

      // Sort by date ascending for the timeline progression
      processedData.sort((a, b) => a.date - b.date);
      setChartData(processedData);
    } catch (error) {
      console.error("❌ Error fetching progress:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600">Loading progress...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-900 font-semibold mb-2">
          Error Loading Progress
        </h3>
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchProgressData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-8 h-8 text-indigo-600" /> My Academic
          Progress
        </h1>
        <p className="text-gray-600 mt-1">
          Track your performance across all finalized symposium sessions.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-500" /> Performance Timeline
        </h2>

        {chartData.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No Finalized Data Yet
            </h3>
            <p className="text-gray-500 mt-1">
              Your progress chart will generate once panels submit their
              evaluations.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {chartData.map((dataPoint, index) => {
              const score = dataPoint.score;
              const colorClass =
                score >= 80
                  ? "bg-green-500"
                  : score >= 60
                    ? "bg-indigo-500"
                    : score >= 40
                      ? "bg-orange-500"
                      : "bg-red-500";

              const textClass =
                score >= 80
                  ? "text-green-600"
                  : score >= 60
                    ? "text-indigo-600"
                    : score >= 40
                      ? "text-orange-600"
                      : "text-red-600";

              return (
                <div key={index} className="relative">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="font-bold text-gray-900">
                        {dataPoint.name}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <Calendar className="w-3 h-3" />
                        {dataPoint.date.toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`text-2xl font-black ${textClass}`}>
                      {score}%
                    </span>
                  </div>

                  {/* Tailwind Progress Bar */}
                  <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${colorClass}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
