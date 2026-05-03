import React, { useState, useEffect } from "react";
import { Eye, FileText, TrendingUp, Award, X } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function HistoricalFeedbackPage() {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);

  useEffect(() => {
    loadEvaluations();
  }, []);

  const loadEvaluations = async () => {
    try {
      setLoading(true);
      const res = await api.get("/evaluations");
      // Only show completed ones in history
      const completed = (res.data.data || []).filter(
        (e) => e.status === "COMPLETED",
      );
      setEvaluations(completed);
    } catch (error) {
      console.error("Error loading evaluations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Only calculate average for scored rubrics
  const scoredEvals = evaluations.filter(
    (e) => e.sessionType !== "PROGRESS_ASSESSMENT",
  );
  const avgScore =
    scoredEvals.length > 0
      ? (
          scoredEvals.reduce((sum, e) => sum + e.totalMarks, 0) /
          scoredEvals.length
        ).toFixed(1)
      : 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Feedback History</h1>
        <p className="text-gray-600 mt-2">
          View completed evaluations and past feedback.
        </p>
      </div>

      {scoredEvals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600">
                Total Records
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {evaluations.length}
              </p>
            </div>
            <FileText className="w-12 h-12 text-blue-500" />
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600">
                Average Score
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {avgScore}%
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-500" />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="divide-y divide-gray-200">
          {evaluations.map((ev) => (
            <div
              key={ev._id}
              className="p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      {ev.studentId?.name || "Student"}
                    </h3>
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-200">
                      {ev.sessionType?.replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                    <div>
                      <span className="font-semibold">Evaluator:</span>{" "}
                      {ev.evaluatorId?.name}
                    </div>
                    <div>
                      <span className="font-semibold">Semester:</span>{" "}
                      {ev.semester}
                    </div>
                  </div>
                  {/* 👈 FIXED: Shows text if progress, score if rubric */}
                  <p className="text-sm text-gray-700 italic">
                    {ev.sessionType === "PROGRESS_ASSESSMENT"
                      ? `Progress: "${ev.summaryOfProgress}"`
                      : `Score: ${ev.totalMarks}% | Comments: "${ev.overallComments}"`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvaluation(ev)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VIEW MODAL */}
      {selectedEvaluation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold">Evaluation Report</h2>
                <p className="text-gray-600">
                  {selectedEvaluation.studentId?.name} -{" "}
                  {selectedEvaluation.sessionType?.replace("_", " ")}
                </p>
              </div>
              <button onClick={() => setSelectedEvaluation(null)}>
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {selectedEvaluation.sessionType === "PROGRESS_ASSESSMENT" ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <strong>Summary of Progress:</strong>
                  <p className="mt-1">{selectedEvaluation.summaryOfProgress}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <strong>Comments for Improvement:</strong>
                  <p className="mt-1">
                    {selectedEvaluation.commentsForImprovement}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <strong>Overall Suggestions:</strong>
                  <p className="mt-1">
                    {selectedEvaluation.overallSuggestions}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex justify-between">
                  <span className="text-lg font-semibold text-gray-800">
                    Final Score:
                  </span>
                  <span className="text-3xl font-bold text-green-600">
                    {selectedEvaluation.totalMarks}%
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <strong>Overall Comments:</strong>
                  <p className="mt-1">{selectedEvaluation.overallComments}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
