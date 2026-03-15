import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import {
  TrendingUp,
  CheckCircle,
  BookOpen,
  BarChart3,
  Calendar,
} from "lucide-react";

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

      // 1. Group raw evaluations strictly by Session Type
      const grouped = {};
      rawEvals.forEach((ev) => {
        const sessionName = ev.sessionType || "Unknown Session";
        if (!grouped[sessionName]) {
          grouped[sessionName] = {
            sessionType: sessionName,
            date: ev.createdAt, // Store date for sorting
            evalCount: 0,
            totalSum: 0,
          };
        }
        // Add up the scores
        grouped[sessionName].totalSum += ev.totalScore ?? ev.overallScore ?? 0;
        grouped[sessionName].evalCount += 1;
      });

      // 2. Filter ONLY fully graded sessions (both panels submitted) and calculate average
      const processedData = [];
      Object.values(grouped).forEach((group) => {
        if (group.evalCount >= 2) {
          processedData.push({
            name: group.sessionType,
            score: parseFloat((group.totalSum / group.evalCount).toFixed(1)),
            date: new Date(group.date),
          });
        }
      });

      // 3. Sort chronologically (oldest to newest)
      processedData.sort((a, b) => a.date - b.date);

      setChartData(processedData);
    } catch (error) {
      console.error("Failed to fetch progress data:", error);
      setError("Could not load progress data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600 font-medium">
          Analyzing performance data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-4xl mx-auto">
        <h3 className="text-red-900 font-semibold mb-2">
          Error Loading Progress
        </h3>
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchProgressData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-8 h-8 text-indigo-600" />
          Academic Progress
        </h1>
        <p className="text-gray-600 mt-2">
          Track your finalized, combined scores across different symposium
          sessions.
        </p>
      </div>

      {/* Simplified & Relevant Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-green-50 rounded-full text-green-600">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              Fully Graded Sessions
            </p>
            <p className="text-3xl font-black text-gray-900">
              {chartData.length}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-indigo-50 rounded-full text-indigo-600">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              Active Program
            </p>
            <p className="text-xl font-bold text-gray-900">
              {user?.program || "Postgraduate Research"}
            </p>
          </div>
        </div>
      </div>

      {/* Clean Timeline Visualization (Pure Tailwind, No External Libraries!) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          Performance Timeline
        </h2>

        {chartData.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 font-medium">
              Not enough finalized data to generate a timeline.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Sessions will appear here once both assigned panels have submitted
              their marks.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {chartData.map((dataPoint, index) => {
              const score = dataPoint.score;
              // Determine color based on score threshold
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
