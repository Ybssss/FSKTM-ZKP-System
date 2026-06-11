import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { TrendingUp, BookOpen, BarChart3, Calendar } from "lucide-react";

const getResultBadgeClass = (status) =>
  status === "PASS"
    ? "bg-green-100 text-green-700 border-green-200"
    : status === "FAIL"
      ? "bg-red-100 text-red-700 border-red-200"
      : status === "COMPLETED"
        ? "bg-blue-100 text-blue-700 border-blue-200"
      : "bg-orange-100 text-orange-700 border-orange-200";

export default function ProgressPage() {
  const { user } = useAuth();
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProgressData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get(
        `/evaluations/student/${user.id || user.userId || user._id}`,
      );
      const rawEvals = res.data.evaluations || [];

      const grouped = {};
      rawEvals.forEach((ev) => {
        const groupKey = `${ev.sessionType}_${ev.semester}`;

        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            sessionName: `${ev.sessionType} (${ev.semester || "Unknown Sem"})`,
            date: ev.createdAt,
            result: ev.result || {
              status: ev.resultStatus || "PENDING",
              isPublished: ev.resultPublished === true,
            },
          };
        }

        const result = ev.result || {
          status: ev.resultStatus || "PENDING",
          isPublished: ev.resultPublished === true,
        };
        if (result.isPublished) grouped[groupKey].result = result;
      });

      const processedData = [];
      Object.values(grouped).forEach((group) => {
        if (group.result?.isPublished) {
          processedData.push({
            name: group.sessionName,
            status: group.result.status,
            date: new Date(group.date),
          });
        }
      });

      processedData.sort((a, b) => a.date - b.date);
      setChartData(processedData);
    } catch (error) {
      console.error("Error fetching progress:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?._id, user?.userId]);

  useEffect(() => {
    fetchProgressData();
  }, [fetchProgressData]);

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
              Your result timeline will generate once all required evaluations
              are submitted.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {chartData.map((dataPoint, index) => {
              const status = dataPoint.status || "PENDING";

              return (
                <div
                  key={index}
                  className="relative rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex justify-between items-center gap-4">
                    <div>
                      <span className="font-bold text-gray-900">
                        {dataPoint.name}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <Calendar className="w-3 h-3" />
                        {dataPoint.date.toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={`inline-flex px-4 py-2 rounded-lg border text-lg font-black ${getResultBadgeClass(status)}`}
                    >
                      {status}
                    </span>
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
