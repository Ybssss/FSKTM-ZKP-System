import React, { useState, useEffect } from "react";
import {
  ClipboardCheck,
  Plus,
  Eye,
  Trash2,
  X,
  AlertCircle,
  Calculator,
  CheckCircle2,
  Users,
} from "lucide-react";
import { evaluationAPI, userAPI, rubricAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function EvaluationPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isPanel = user?.role === "panel";
  const isCoordinator = user?.role === "coordinator";

  const [evaluations, setEvaluations] = useState([]);
  const [students, setStudents] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewingEval, setViewingEval] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    studentId: "",
    rubricId: "",
    sessionType: "",
    remarks: "",
  });
  const [scores, setScores] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const evalsResponse = await evaluationAPI.getAll();
      setEvaluations(evalsResponse.evaluations || evalsResponse || []);

      const rubricsResponse = await rubricAPI.getAll();
      setRubrics((rubricsResponse.rubrics || []).filter((r) => r.isActive));

      if (isPanel) {
        const studentsData = await userAPI.getMyStudents();
        setStudents(studentsData.students || []);
      } else if (isAdmin) {
        const usersData = await userAPI.getAll();
        setStudents(
          (usersData.users || usersData).filter((u) => u.role === "student"),
        );
      }
    } catch (error) {
      console.error("Error loading evaluation data:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedRubric = rubrics.find((r) => r._id === formData.rubricId);

  const calculateTotalScore = () => {
    if (!selectedRubric) return 0;
    let total = 0;
    selectedRubric.criteria.forEach((criterion, index) => {
      const scoreGiven = parseFloat(scores[index]) || 0;
      total += (scoreGiven / criterion.maxScore) * criterion.weight;
    });
    return total.toFixed(2);
  };

  const handleScoreChange = (index, value) =>
    setScores((prev) => ({ ...prev, [index]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.studentId || !formData.rubricId || !formData.sessionType) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Convert scores to a Map Object to satisfy Mongoose Schema
      const formattedScoresMap = {};
      selectedRubric.criteria.forEach((c, index) => {
        formattedScoresMap[c.name] = parseFloat(scores[index]) || 0;
      });

      const payload = {
        studentId: formData.studentId,
        rubricId: formData.rubricId,
        sessionType: formData.sessionType,
        scores: formattedScoresMap, // Send as Map {}
        overallScore: parseFloat(calculateTotalScore()), // Send as overallScore
        remarks: formData.remarks,
      };

      await evaluationAPI.create(payload);

      alert("✅ Evaluation submitted successfully!");
      closeModal();
      loadData();
    } catch (error) {
      console.error("Error submitting evaluation:", error);
      alert(error.response?.data?.message || "Failed to submit evaluation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this evaluation record?")) return;
    try {
      await evaluationAPI.delete(id);
      loadData();
    } catch (error) {
      alert("Failed to delete");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setViewingEval(null);
    setFormData({ studentId: "", rubricId: "", sessionType: "", remarks: "" });
    setScores({});
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 40) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  // 🚀 NEW FEATURE: CALCULATE COMBINED AVERAGE
  const getCombinedAverage = () => {
    if (!viewingEval) return null;
    const relatedEvals = evaluations.filter(
      (e) =>
        e.studentId?._id === viewingEval.studentId?._id &&
        e.sessionType === viewingEval.sessionType,
    );
    if (relatedEvals.length <= 1) return null; // No combined score if only 1 panel has marked

    const sum = relatedEvals.reduce(
      (acc, curr) => acc + (curr.totalScore ?? curr.overallScore ?? 0),
      0,
    );
    return (sum / relatedEvals.length).toFixed(1);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-8 h-8 text-indigo-600" /> Student
            Evaluations
          </h1>
          <p className="text-gray-600 mt-2">
            {isPanel
              ? "Evaluate your assigned students."
              : "Manage system-wide student evaluations."}
          </p>
        </div>
        {(isPanel || isAdmin) && (
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-semibold"
          >
            <Plus className="w-5 h-5" /> New Evaluation
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : evaluations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No evaluations found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Student</th>
                  <th className="p-4">Session Type</th>
                  <th className="p-4">Panel</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {evaluations.map((ev) => (
                  <tr key={ev._id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <p className="font-semibold">{ev.studentId?.name}</p>
                      <p className="text-xs text-gray-500">
                        {ev.studentId?.matricNumber}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold">
                        {ev.sessionType}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium">
                      {ev.evaluatorId?.name || ev.panelId?.name}
                    </td>
                    <td className="p-4 text-center">
                      {/* FIX: Handled the fallback between totalScore and overallScore! */}
                      <div
                        className={`inline-flex px-3 py-1 rounded-lg border font-bold text-sm ${getScoreColor(ev.totalScore ?? ev.overallScore)}`}
                      >
                        {(ev.totalScore ?? ev.overallScore) !== undefined
                          ? `${(ev.totalScore ?? ev.overallScore).toFixed(1)}%`
                          : "N/A"}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setViewingEval(ev)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(ev._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW EVALUATION MODAL */}
      {viewingEval && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between">
              <h2 className="text-xl font-bold">Evaluation Report</h2>
              <button onClick={closeModal}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* 🚀 COMBINED AVERAGE UI */}
              {getCombinedAverage() && (
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-full">
                      <Users className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">
                        Combined Final Result
                      </h3>
                      <p className="text-indigo-100 text-sm">
                        Average of both panels for {viewingEval.sessionType}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black">
                      {getCombinedAverage()}%
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-start bg-gray-50 p-5 rounded-xl border border-gray-200">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {viewingEval.studentId?.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Matric: {viewingEval.studentId?.matricNumber}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Session:</strong> {viewingEval.sessionType}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Panel:</strong>{" "}
                    {viewingEval.evaluatorId?.name || viewingEval.panelId?.name}
                  </p>
                </div>
                <div
                  className={`px-4 py-3 rounded-xl border-2 text-center min-w-[120px] ${getScoreColor(viewingEval.totalScore ?? viewingEval.overallScore)}`}
                >
                  <p className="text-xs font-bold uppercase mb-1">
                    Individual Score
                  </p>
                  <p className="text-3xl font-black">
                    {(
                      viewingEval.totalScore ?? viewingEval.overallScore
                    )?.toFixed(1)}
                    %
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">
                  Score Breakdown
                </h4>
                <div className="space-y-3">
                  {(Array.isArray(viewingEval.scores)
                    ? viewingEval.scores
                    : Object.entries(viewingEval.scores || {}).map(
                        ([k, v]) => ({
                          criterionName: k,
                          score: v,
                          maxScore: 100,
                          weight: "-",
                        }),
                      )
                  ).map((scoreItem, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-semibold capitalize">
                          {scoreItem.criterionName?.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-gray-500">
                          Weight: {scoreItem.weight}
                          {scoreItem.weight !== "-" ? "%" : ""}
                        </p>
                      </div>
                      <div className="text-right font-bold text-lg">
                        {scoreItem.score}{" "}
                        <span className="text-sm text-gray-500 font-normal">
                          / {scoreItem.maxScore || 100}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-gray-800 mb-2">Remarks</h4>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  {viewingEval.remarks || "No remarks provided."}
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end bg-gray-50">
              <button
                onClick={closeModal}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KEEP YOUR EXISTING CREATE EVALUATION MODAL FORM DOWN HERE */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calculator className="w-6 h-6 text-indigo-600" />
                Conduct Student Evaluation
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form
                id="evaluationForm"
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* Meta Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Student *
                    </label>
                    <select
                      value={formData.studentId}
                      onChange={(e) =>
                        setFormData({ ...formData, studentId: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">-- Choose Student --</option>
                      {students.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({s.matricNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Session Type *
                    </label>
                    <select
                      value={formData.sessionType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sessionType: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">-- Select Type --</option>
                      <option value="Proposal Defense">Proposal Defense</option>
                      <option value="Progress Review #1">
                        Progress Review #1
                      </option>
                      <option value="Progress Review #2">
                        Progress Review #2
                      </option>
                      <option value="Final Defense">Final Defense</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Evaluation Rubric *
                    </label>
                    <select
                      value={formData.rubricId}
                      onChange={(e) => {
                        setFormData({ ...formData, rubricId: e.target.value });
                        setScores({});
                      }}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">-- Select Rubric --</option>
                      {rubrics.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedRubric ? (
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-800 border-b pb-2">
                      Grading Criteria
                    </h3>
                    {selectedRubric.criteria.map((criterion, index) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
                      >
                        <div className="flex-1 pr-4">
                          <p className="font-semibold text-gray-900">
                            {criterion.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {criterion.description}
                          </p>
                          <div className="mt-2 text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded inline-block">
                            Weight: {criterion.weight}%
                          </div>
                        </div>
                        <div className="mt-4 sm:mt-0 flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max={criterion.maxScore}
                            step="0.5"
                            required
                            placeholder="Score"
                            value={scores[index] || ""}
                            onChange={(e) =>
                              handleScoreChange(index, e.target.value)
                            }
                            className="w-24 border border-gray-300 rounded-lg p-2 text-center text-lg font-bold focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-gray-500 font-medium">
                            / {criterion.maxScore}
                          </span>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-end pt-4">
                      <div className="bg-gray-900 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-400 uppercase tracking-wide">
                            Final Weighted Score
                          </p>
                          <p className="text-3xl font-bold">
                            {calculateTotalScore()}{" "}
                            <span className="text-lg text-gray-400">/ 100</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Panel Remarks / Feedback
                      </label>
                      <textarea
                        value={formData.remarks}
                        onChange={(e) =>
                          setFormData({ ...formData, remarks: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500"
                        rows="3"
                        placeholder="Provide overall feedback..."
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
                    <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">
                      Select a rubric above to load the grading criteria.
                    </p>
                  </div>
                )}
              </form>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
              <button
                onClick={closeModal}
                type="button"
                className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="evaluationForm"
                disabled={isSubmitting || !selectedRubric}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  "Saving..."
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Submit Evaluation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
