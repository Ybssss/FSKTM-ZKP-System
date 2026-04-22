import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  Edit,
  Trash2,
  FileText,
  TrendingUp,
  Calendar,
  Award,
} from "lucide-react";
import { evaluationAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function HistoricalFeedbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadEvaluations();
  }, []);

  const loadEvaluations = async () => {
    try {
      setLoading(true);
      const data = await evaluationAPI.getAll();

      let filteredEvaluations = data.evaluations || [];

      // Filter based on role
      if (user?.role === "panel") {
        // Panel sees:
        // 1. Evaluations they created (evaluatorId matches)
        // 2. Other panels' evaluations for their assigned students (for co-supervisor scenario)
        filteredEvaluations = filteredEvaluations.filter((evaluation) => {
          // Show if panel created this evaluation
          if (evaluation.evaluatorId._id === user.id) {
            return true;
          }

          // Show if evaluation is for panel's assigned student
          const assignedStudentIds = user.assignedStudents || [];
          const isForAssignedStudent = assignedStudentIds.some(
            (id) => id.toString() === evaluation.studentId._id.toString(),
          );

          if (isForAssignedStudent) {
            // Check if evaluation was created during panel's assignment period
            const student = evaluation.studentId;
            const panelAssignment = student.assignedPanels?.find(
              (ap) => ap.panelId?._id === user.id || ap.panelId === user.id,
            );

            if (panelAssignment) {
              const evalDate = new Date(evaluation.createdAt);
              const assignStart = new Date(panelAssignment.startDate);
              const assignEnd = panelAssignment.endDate
                ? new Date(panelAssignment.endDate)
                : new Date();

              // Show if evaluation was created during assignment period
              return evalDate >= assignStart && evalDate <= assignEnd;
            }
          }

          return false;
        });
      } else if (user?.role === "student") {
        // Students see only their own evaluations
        filteredEvaluations = filteredEvaluations.filter(
          (evaluation) => evaluation.studentId._id === user.id,
        );
      }
      // Admin sees all (no filtering)

      // Filter out draft evaluations (only show submitted/finalized)
      filteredEvaluations = filteredEvaluations.filter(
        (e) => e.status !== "draft",
      );

      // Sort by creation date (newest first)
      filteredEvaluations.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );

      setEvaluations(filteredEvaluations);
      console.log(`✅ Loaded ${filteredEvaluations.length} evaluations`);
    } catch (error) {
      console.error("Error loading evaluations:", error);
      alert("Failed to load evaluations");
    } finally {
      setLoading(false);
    }
  };

  const handleView = (evaluation) => {
    setSelectedEvaluation(evaluation);
    setShowModal(true);
  };

  const handleEdit = (evaluationId) => {
    navigate(`/panel/evaluation/edit/${evaluationId}`);
  };

  const handleDelete = async (evaluationId) => {
    if (!window.confirm("Are you sure you want to delete this evaluation?")) {
      return;
    }

    try {
      await evaluationAPI.delete(evaluationId);
      alert("✅ Evaluation deleted successfully!");
      loadEvaluations();
    } catch (error) {
      console.error("Error deleting evaluation:", error);
      alert("Failed to delete evaluation");
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getScoreEmoji = (score) => {
    if (score >= 80) return "🌟";
    if (score >= 60) return "👍";
    return "📝";
  };

  return (
    <>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {user?.role === "student"
              ? "My Feedback History"
              : "Historical Feedback"}
          </h1>
          <p className="text-gray-600 mt-2">
            {user?.role === "student"
              ? "View all your evaluation feedback and track your progress"
              : user?.role === "panel"
                ? "View evaluations you created and feedback for your assigned students"
                : "View all evaluation records in the system"}
          </p>
        </div>

        {/* Statistics Cards */}
        {evaluations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">
                    Total Evaluations
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {evaluations.length}
                  </p>
                </div>
                <FileText className="w-12 h-12 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">
                    Average Score
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {(
                      evaluations.reduce((sum, e) => sum + e.overallScore, 0) /
                      evaluations.length
                    ).toFixed(1)}
                    %
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">
                    Latest Score
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {evaluations[0]?.overallScore || 0}%
                  </p>
                </div>
                <Award className="w-12 h-12 text-purple-500" />
              </div>
            </div>
          </div>
        )}

        {/* Evaluations List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500">Loading evaluations...</p>
            </div>
          ) : evaluations.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Evaluations Yet
              </h3>
              <p className="text-gray-600">
                {user?.role === "student"
                  ? "Your panel members haven't submitted any evaluations yet."
                  : user?.role === "panel"
                    ? 'You haven\'t created any evaluations yet. Go to "Create Evaluation" to get started.'
                    : "No evaluations have been created in the system yet."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {evaluations.map((evaluation) => (
                <div
                  key={evaluation._id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {user?.role === "student"
                            ? evaluation.rubricId?.name || "N/A"
                            : evaluation.studentId?.name || "N/A"}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(evaluation.overallScore)}`}
                        >
                          {getScoreEmoji(evaluation.overallScore)}{" "}
                          {evaluation.overallScore}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                        {user?.role !== "student" && (
                          <div>
                            <span className="font-semibold">Student:</span>{" "}
                            {evaluation.studentId?.name || "N/A"} (
                            {evaluation.studentId?.matricNumber || "N/A"})
                          </div>
                        )}
                        <div>
                          <span className="font-semibold">Rubric:</span>{" "}
                          {evaluation.rubricId?.name || "N/A"}
                        </div>
                        <div>
                          <span className="font-semibold">Semester:</span>{" "}
                          {evaluation.semester}
                        </div>
                        <div>
                          <span className="font-semibold">Evaluator:</span>{" "}
                          {evaluation.evaluatorId?.name || "N/A"}
                        </div>
                        <div>
                          <span className="font-semibold">Date:</span>{" "}
                          {new Date(evaluation.createdAt).toLocaleDateString(
                            "en-MY",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </div>
                        {evaluation.sessionType && (
                          <div>
                            <span className="font-semibold">Session:</span>{" "}
                            {evaluation.sessionType}
                          </div>
                        )}
                      </div>

                      {evaluation.overallComments && (
                        <p className="text-sm text-gray-700 line-clamp-2 italic">
                          "{evaluation.overallComments}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleView(evaluation)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>

                      {(user?.role === "admin" ||
                        (user?.role === "panel" &&
                          evaluation.evaluatorId._id === user.id)) && (
                        <>
                          <button
                            onClick={() => handleEdit(evaluation._id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit evaluation"
                          >
                            <Edit className="w-5 h-5" />
                          </button>

                          <button
                            onClick={() => handleDelete(evaluation._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete evaluation"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showModal && selectedEvaluation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Evaluation Details
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedEvaluation.studentId.name} -{" "}
                    {selectedEvaluation.semester}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {/* Overall Score */}
                <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-800">
                      Overall Score:
                    </span>
                    <span className="text-4xl font-bold text-green-600">
                      {selectedEvaluation.overallScore}%
                    </span>
                  </div>
                </div>

                {/* Criteria Scores */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    Criteria Breakdown
                  </h3>
                  <div className="space-y-3">
                    {selectedEvaluation.rubricId.criteria.map((criterion) => {
                      const score =
                        selectedEvaluation.scores[criterion._id] || 0;
                      const percentage = (score / criterion.maxScore) * 100;

                      return (
                        <div
                          key={criterion._id}
                          className="p-3 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-900">
                              {criterion.name}
                            </span>
                            <span className="text-lg font-bold text-gray-900">
                              {score}/{criterion.maxScore}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                percentage >= 80
                                  ? "bg-green-500"
                                  : percentage >= 60
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                              }`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback Sections */}
                {selectedEvaluation.strengths && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      💪 Strengths
                    </h3>
                    <p className="text-gray-700 bg-green-50 p-4 rounded-lg border border-green-200">
                      {selectedEvaluation.strengths}
                    </p>
                  </div>
                )}

                {selectedEvaluation.weaknesses && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      📈 Areas for Improvement
                    </h3>
                    <p className="text-gray-700 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      {selectedEvaluation.weaknesses}
                    </p>
                  </div>
                )}

                {selectedEvaluation.recommendations && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      💡 Recommendations
                    </h3>
                    <p className="text-gray-700 bg-blue-50 p-4 rounded-lg border border-blue-200">
                      {selectedEvaluation.recommendations}
                    </p>
                  </div>
                )}

                {selectedEvaluation.overallComments && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      📝 Overall Comments
                    </h3>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      {selectedEvaluation.overallComments}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-semibold">Evaluator:</span>{" "}
                      {selectedEvaluation.evaluatorId.name}
                    </div>
                    <div>
                      <span className="font-semibold">Date:</span>{" "}
                      {new Date(selectedEvaluation.createdAt).toLocaleString(
                        "en-MY",
                      )}
                    </div>
                    {selectedEvaluation.sessionType && (
                      <div>
                        <span className="font-semibold">Session Type:</span>{" "}
                        {selectedEvaluation.sessionType}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
