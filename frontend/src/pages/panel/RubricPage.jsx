import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  X,
  Settings,
  FileText,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const toSessionTypeCode = (value = "") =>
  String(value)
    .normalize("NFKC")
    .replace(/'/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 50);

const formatSessionType = (value = "") => String(value).replaceAll("_", " ");

export default function RubricPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingRubric, setEditingRubric] = useState(null);
  const [viewingRubric, setViewingRubric] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultCriterion = () => ({
    key: `crit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title: "",
    type: "quantitative",
    weight: 0,
    maxScore: 5,
    description: "",
    outstanding: "",
    exemplary: "",
    proficient: "",
    satisfactory: "",
    foundational: "",
    novice: "",
  });

  const [formData, setFormData] = useState({
    name: "",
    sessionType: "",
    criteria: [defaultCriterion()],
  });

  useEffect(() => {
    loadRubrics();
  }, []);

  const loadRubrics = async () => {
    try {
      setLoading(true);
      const res = await api.get("/rubrics");
      setRubrics(res.data.data || res.data.rubrics || []);
    } catch (error) {
      console.error("Error loading rubrics:", error);
      alert("Failed to load rubrics");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCriterion = () => {
    setFormData({
      ...formData,
      criteria: [...formData.criteria, defaultCriterion()],
    });
  };

  const handleRemoveCriterion = (index) => {
    const newCriteria = formData.criteria.filter((_, i) => i !== index);
    setFormData({ ...formData, criteria: newCriteria });
  };

  const handleCriterionChange = (index, field, value) => {
    const newCriteria = [...formData.criteria];
    let nextValue = value;

    if (field === "weight") {
      nextValue = parseFloat(value) || 0;
    } else if (field === "maxScore") {
      nextValue = Math.min(Math.max(parseInt(value, 10) || 5, 1), 5);
    }

    newCriteria[index] = {
      ...newCriteria[index],
      [field]: nextValue,
    };
    setFormData({ ...formData, criteria: newCriteria });
  };

  const getTotalWeight = () => {
    return formData.criteria
      .filter((c) => c.type === "quantitative")
      .reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      alert("Please enter a rubric name");
      return false;
    }
    if (formData.criteria.length === 0) {
      alert("Please add at least one criterion");
      return false;
    }

    const hasQuantitative = formData.criteria.some(
      (c) => c.type === "quantitative",
    );
    if (hasQuantitative) {
      const totalWeight = getTotalWeight();
      if (Math.abs(totalWeight - 100) > 0.01) {
        alert(
          `Total weight for quantitative criteria must be exactly 100%. Current total: ${totalWeight}%`,
        );
        return false;
      }
    }

    for (let i = 0; i < formData.criteria.length; i++) {
      const c = formData.criteria[i];
      if (!c.title.trim()) {
        alert(`Please enter a title for Criterion ${i + 1}`);
        return false;
      }
      if (
        c.type === "quantitative" &&
        (!Number.isInteger(Number(c.maxScore)) ||
          Number(c.maxScore) < 1 ||
          Number(c.maxScore) > 5)
      ) {
        alert(`Criterion ${i + 1} max score must be a whole number from 1 to 5.`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        sessionType:
          editingRubric?.sessionType || toSessionTypeCode(formData.name),
      };

      if (editingRubric) {
        await api.put(`/rubrics/${editingRubric._id}`, payload);
        alert("Rubric updated successfully!");
      } else {
        await api.post("/rubrics", payload);
        alert("Rubric created successfully!");
      }

      handleCloseModal();
      loadRubrics();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to save rubric",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (rubric) => {
    setEditingRubric(rubric);
    setFormData({
      name: rubric.name,
      sessionType: rubric.sessionType || "",
      criteria:
        rubric.criteria && rubric.criteria.length > 0
          ? rubric.criteria
          : [defaultCriterion()],
    });
    setShowModal(true);
  };

  const handleView = (rubric) => {
    setViewingRubric(rubric);
    setShowViewModal(true);
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this rubric? This may break historical evaluations linked to it.",
      )
    )
      return;
    try {
      await api.delete(`/rubrics/${id}`);
      loadRubrics();
    } catch (error) {
      alert("Failed to delete rubric");
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRubric(null);
    setFormData({ name: "", sessionType: "", criteria: [defaultCriterion()] });
  };

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-8 h-8 text-indigo-600" /> Evaluation
              Rubrics
            </h1>
            <p className="text-gray-600 mt-2">
              Manage UTHM evaluation criteria and rubrics
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-5 h-5" /> Create New Rubric
            </button>
          )}
        </div>

        {!isAdmin && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-800">
              ℹ️ You have view-only access. Only administrators can create or
              edit official rubrics.
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              Loading rubrics...
            </div>
          ) : rubrics.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No rubrics found. Please seed the database or create one.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rubrics.map((rubric) => (
                <div
                  key={rubric._id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {rubric.name}
                        </h3>
                        <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-bold uppercase rounded-full">
                          {formatSessionType(rubric.sessionType || rubric.name)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-3 bg-white border p-3 rounded-lg inline-block">
                        <div>
                          <span className="font-bold text-gray-900">
                            {rubric.criteria?.filter(
                              (c) => c.type === "quantitative",
                            ).length || 0}
                          </span>{" "}
                          Scored Criteria
                        </div>
                        <div className="border-l pl-4">
                          <span className="font-bold text-gray-900">
                            {rubric.criteria?.filter(
                              (c) => c.type === "qualitative",
                            ).length || 0}
                          </span>{" "}
                          Text Feedbacks
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleView(rubric)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" /> View Details
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleEdit(rubric)}
                            className="p-2 text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rubric._id)}
                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
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
      </div>

      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full my-8 flex flex-col mx-auto">
            <div className="px-8 py-5 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="w-6 h-6 text-indigo-600" />
                {editingRubric ? "Edit Rubric" : "Create New Rubric"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 bg-gray-50 flex-1 overflow-y-auto">
              <form
                id="rubricForm"
                onSubmit={handleSubmit}
                className="space-y-8"
              >
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Rubric Name / Session Type *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Pre-Viva Final Evaluation"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-8">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Settings className="w-5 h-5" /> Criteria Configuration
                  </h3>
                  <div className="bg-white px-4 py-2 border rounded-lg shadow-sm text-sm">
                    Total Weight:{" "}
                    <span
                      className={`font-black ${Math.abs(getTotalWeight() - 100) < 0.01 ? "text-green-600" : "text-red-600"}`}
                    >
                      {getTotalWeight()}%
                    </span>
                  </div>
                </div>

                {formData.criteria.map((criterion, index) => (
                  <div
                    key={criterion.key}
                    className="bg-white border-2 border-indigo-100 rounded-xl p-5 shadow-sm relative mb-4"
                  >
                    <div className="absolute top-4 right-4 flex gap-4">
                      {formData.criteria.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCriterion(index)}
                          className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" /> Remove
                        </button>
                      )}
                    </div>

                    <h4 className="font-black text-indigo-800 mb-4">
                      CRITERION {index + 1}
                    </h4>

                    <div className="grid grid-cols-12 gap-4 mb-4">
                      <div className="col-span-8">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={criterion.title}
                          onChange={(e) =>
                            handleCriterionChange(
                              index,
                              "title",
                              e.target.value,
                            )
                          }
                          className="w-full p-2 border rounded font-bold"
                          placeholder="e.g., CRITERIA A: RESEARCH TITLE"
                          required
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                          Evaluation Type
                        </label>
                        <select
                          value={criterion.type}
                          onChange={(e) =>
                            handleCriterionChange(index, "type", e.target.value)
                          }
                          className="w-full p-2 border rounded font-semibold text-indigo-700 bg-indigo-50"
                        >
                          <option value="quantitative">
                            Quantitative (Scored)
                          </option>
                          <option value="qualitative">
                            Qualitative (Text Only)
                          </option>
                        </select>
                      </div>
                    </div>

                    {criterion.type === "quantitative" ? (
                      <div className="bg-gray-50 p-4 rounded-lg border mt-4">
                        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                              Weight (%) *
                            </label>
                            <input
                              type="number"
                              value={criterion.weight}
                              onChange={(e) =>
                                handleCriterionChange(
                                  index,
                                  "weight",
                                  e.target.value,
                                )
                              }
                              className="w-full p-2 border rounded"
                              min="0"
                              max="100"
                              step="0.1"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                              Max Score Possible
                            </label>
                            <input
                              type="number"
                              value={criterion.maxScore}
                              onChange={(e) =>
                                handleCriterionChange(
                                  index,
                                  "maxScore",
                                  e.target.value,
                                )
                              }
                              className="w-full p-2 border rounded"
                              min="1"
                              max="5"
                              step="1"
                              required
                            />
                          </div>
                        </div>

                        <label className="block text-xs font-bold text-indigo-500 uppercase mb-3">
                          Grading Scale Descriptions (Optional)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 text-center">
                              Outstanding (5)
                            </p>
                            <textarea
                              className="w-full text-xs p-2 border rounded"
                              rows="4"
                              value={criterion.outstanding || ""}
                              onChange={(e) =>
                                handleCriterionChange(
                                  index,
                                  "outstanding",
                                  e.target.value,
                                )
                              }
                              placeholder="Definition..."
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 text-center">
                              Exemplary (4)
                            </p>
                            <textarea
                              className="w-full text-xs p-2 border rounded"
                              rows="4"
                              value={criterion.exemplary}
                              onChange={(e) =>
                                handleCriterionChange(
                                  index,
                                  "exemplary",
                                  e.target.value,
                                )
                              }
                              placeholder="Definition..."
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 text-center">
                              Proficient (3)
                            </p>
                            <textarea
                              className="w-full text-xs p-2 border rounded"
                              rows="4"
                              value={criterion.proficient}
                              onChange={(e) =>
                                handleCriterionChange(
                                  index,
                                  "proficient",
                                  e.target.value,
                                )
                              }
                              placeholder="Definition..."
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 text-center">
                              Satisfactory (2)
                            </p>
                            <textarea
                              className="w-full text-xs p-2 border rounded"
                              rows="4"
                              value={criterion.satisfactory}
                              onChange={(e) =>
                                handleCriterionChange(
                                  index,
                                  "satisfactory",
                                  e.target.value,
                                )
                              }
                              placeholder="Definition..."
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 text-center">
                              Foundational (1)
                            </p>
                            <textarea
                              className="w-full text-xs p-2 border rounded"
                              rows="4"
                              value={criterion.foundational}
                              onChange={(e) =>
                                handleCriterionChange(
                                  index,
                                  "foundational",
                                  e.target.value,
                                )
                              }
                              placeholder="Definition..."
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 text-center">
                              Novice (0)
                            </p>
                            <textarea
                              className="w-full text-xs p-2 border rounded"
                              rows="4"
                              value={criterion.novice}
                              onChange={(e) =>
                                handleCriterionChange(
                                  index,
                                  "novice",
                                  e.target.value,
                                )
                              }
                              placeholder="Definition..."
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
                        <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                          Instructions for Evaluator
                        </label>
                        <textarea
                          value={criterion.description}
                          onChange={(e) =>
                            handleCriterionChange(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          className="w-full p-2 border border-blue-300 rounded"
                          rows="3"
                          placeholder="Explain what the panel should write about in this text box..."
                        />
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddCriterion}
                  className="w-full py-4 border-2 border-dashed border-indigo-300 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition"
                >
                  + ADD NEW CRITERION
                </button>
              </form>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-white sticky bottom-0 rounded-b-xl">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="rubricForm"
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm"
              >
                {editingRubric ? "Update Rubric" : "Save New Rubric"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewingRubric && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-hidden">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between z-10 rounded-t-xl flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {viewingRubric.name}
                </h2>
                <span className="inline-block mt-2 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-bold uppercase rounded-full">
                  {formatSessionType(viewingRubric.sessionType || viewingRubric.name)}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingRubric(null);
                }}
                className="text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 bg-gray-50 flex-1 overflow-y-auto min-h-0">
              <div className="space-y-6">
                {viewingRubric.criteria?.map((criterion, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden"
                  >
                    <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                      <h4 className="font-bold text-gray-900">
                        {criterion.title}
                      </h4>
                      <span
                        className={`px-3 py-1 rounded-md text-xs font-bold uppercase border ${criterion.type === "quantitative" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                      >
                        {criterion.type}
                      </span>
                    </div>

                    <div className="p-6">
                      {criterion.type === "quantitative" ? (
                        <div>
                          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                            Weight:{" "}
                            <span className="text-indigo-600">
                              {criterion.weight}%
                            </span>
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                            {Number(criterion.maxScore ?? 5) >= 5 && (
                              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2 border-b border-emerald-200 pb-1">
                                  Outstanding (5)
                                </p>
                                <p className="text-xs text-gray-700">
                                  {criterion.outstanding}
                                </p>
                              </div>
                            )}
                            <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                              <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-2 border-b border-green-200 pb-1">
                                Exemplary (4)
                              </p>
                              <p className="text-xs text-gray-700">
                                {criterion.exemplary}
                              </p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-2 border-b border-blue-200 pb-1">
                                Proficient (3)
                              </p>
                              <p className="text-xs text-gray-700">
                                {criterion.proficient}
                              </p>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                              <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-widest mb-2 border-b border-yellow-200 pb-1">
                                Satisfactory (2)
                              </p>
                              <p className="text-xs text-gray-700">
                                {criterion.satisfactory}
                              </p>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                              <p className="text-[10px] font-bold text-orange-700 uppercase tracking-widest mb-2 border-b border-orange-200 pb-1">
                                Foundational (1)
                              </p>
                              <p className="text-xs text-gray-700">
                                {criterion.foundational}
                              </p>
                            </div>
                            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                              <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest mb-2 border-b border-red-200 pb-1">
                                Novice (0)
                              </p>
                              <p className="text-xs text-gray-700">
                                {criterion.novice}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">
                            Instructions for Evaluator
                          </p>
                          <p className="text-sm text-gray-800 bg-blue-50 p-4 rounded-lg border border-blue-100">
                            {criterion.description ||
                              "No instructions provided."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-8 py-5 border-t border-gray-200 flex justify-end bg-white rounded-b-xl flex-shrink-0">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingRubric(null);
                }}
                className="px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
