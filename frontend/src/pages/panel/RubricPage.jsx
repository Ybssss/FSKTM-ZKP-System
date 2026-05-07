import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Eye, X, Settings } from "lucide-react";
import { rubricAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function RubricPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingRubric, setEditingRubric] = useState(null);
  const [viewingRubric, setViewingRubric] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    sessionType: "",
    criteria: [
      {
        key: `crit_${Date.now()}`,
        title: "",
        type: "quantitative",
        weight: 0,
        maxScore: 4,
        description: "",
        exemplary: "",
        proficient: "",
        satisfactory: "",
        foundational: "",
        novice: "",
      },
    ],
  });

  useEffect(() => {
    loadRubrics();
  }, []);

  const loadRubrics = async () => {
    try {
      setLoading(true);
      const data = await rubricAPI.getAll();
      setRubrics(data.rubrics || data.data || []);
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
      criteria: [
        ...formData.criteria,
        {
          key: `crit_${Date.now()}`,
          title: "",
          type: "quantitative",
          weight: 0,
          maxScore: 4,
          description: "",
          exemplary: "",
          proficient: "",
          satisfactory: "",
          foundational: "",
          novice: "",
        },
      ],
    });
  };

  const handleRemoveCriterion = (index) => {
    const newCriteria = formData.criteria.filter((_, i) => i !== index);
    setFormData({ ...formData, criteria: newCriteria });
  };

  const handleCriterionChange = (index, field, value) => {
    const newCriteria = [...formData.criteria];
    newCriteria[index] = {
      ...newCriteria[index],
      [field]:
        field === "weight" || field === "maxScore"
          ? parseFloat(value) || 0
          : value,
    };
    setFormData({ ...formData, criteria: newCriteria });
  };

  const getTotalWeight = () => {
    return formData.criteria
      .filter((c) => c.type === "quantitative")
      .reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);
  };

  const validateForm = () => {
    if (!formData.name.trim()) return alert("Please enter rubric name");
    if (!formData.sessionType) return alert("Please select a session type");
    if (formData.criteria.length === 0)
      return alert("Please add at least one criterion");

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
        alert(`Please enter a title for criterion ${i + 1}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (editingRubric) {
        await rubricAPI.update(editingRubric._id, formData);
        alert("Rubric updated successfully!");
      } else {
        await rubricAPI.create(formData);
        alert("Rubric created successfully!");
      }

      handleCloseModal();
      loadRubrics();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save rubric");
    }
  };

  const handleEdit = (rubric) => {
    setEditingRubric(rubric);
    setFormData({
      name: rubric.name,
      sessionType: rubric.sessionType || "",
      criteria: rubric.criteria || [],
    });
    setShowModal(true);
  };

  const handleView = (rubric) => {
    setViewingRubric(rubric);
    setShowViewModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this rubric?")) return;
    try {
      await rubricAPI.delete(id);
      loadRubrics();
    } catch (error) {
      alert("Failed to delete rubric");
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRubric(null);
    setFormData({
      name: "",
      sessionType: "",
      criteria: [
        {
          key: `crit_${Date.now()}`,
          title: "",
          type: "quantitative",
          weight: 0,
          maxScore: 4,
          description: "",
          exemplary: "",
          proficient: "",
          satisfactory: "",
          foundational: "",
          novice: "",
        },
      ],
    });
  };

  return (
    <>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Evaluation Rubrics
            </h1>
            <p className="text-gray-600 mt-2">
              Manage UTHM evaluation criteria and rubrics
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Create New Rubric
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-12 text-center">Loading rubrics...</div>
          ) : rubrics.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No rubrics found. Please seed the database or create one.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {rubrics.map((rubric) => (
                <div key={rubric._id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {rubric.name}
                      </h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                        {rubric.sessionType?.replace("_", " ")}
                      </span>
                      <p className="text-sm text-gray-500 mt-3">
                        {rubric.criteria?.length || 0} Criteria configured
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(rubric)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleEdit(rubric)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rubric._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
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

      {/* CREATE / EDIT MODAL */}
      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingRubric ? "Edit Rubric" : "Create New Rubric"}
              </h2>
              <button onClick={handleCloseModal}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <form
                id="rubricForm"
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-6 bg-white p-5 rounded-lg border shadow-sm">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Rubric Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Pre-Viva Final Evaluation"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Linked Session Type
                    </label>
                    <select
                      value={formData.sessionType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sessionType: e.target.value,
                        })
                      }
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">-- Select --</option>
                      <option value="PROPOSAL_DEFENSE">Proposal Defense</option>
                      <option value="PRE_VIVA">Pre-Viva Voce</option>
                      <option value="PROGRESS_ASSESSMENT">
                        Progress Assessment
                      </option>
                    </select>
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
                    key={index}
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
                              Weight (%)
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
                              disabled
                              className="w-full p-2 border rounded bg-gray-200 text-gray-500 cursor-not-allowed"
                            />
                          </div>
                        </div>

                        <label className="block text-xs font-bold text-indigo-500 uppercase mb-3">
                          5-Tier Grading Scale Descriptions (Optional)
                        </label>
                        <div className="grid grid-cols-5 gap-2">
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

      {/* View Modal - For Everyone */}
      {showViewModal && viewingRubric && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {viewingRubric.name}
              </h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingRubric(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Criteria Details
                </h3>
                <div className="space-y-4">
                  {viewingRubric.criteria?.map((criterion, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-gray-900">
                          {criterion.title}
                        </h4>
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold uppercase ${criterion.type === "quantitative" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"}`}
                        >
                          {criterion.type}
                        </span>
                      </div>

                      {criterion.type === "quantitative" ? (
                        <div className="mt-4">
                          <p className="text-sm font-bold text-gray-600 mb-2">
                            Weight: {criterion.weight}%
                          </p>
                          <div className="grid grid-cols-5 gap-2 text-xs">
                            <div className="bg-white p-2 rounded border">
                              <strong>Exemplary:</strong>
                              <p className="mt-1">{criterion.exemplary}</p>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <strong>Proficient:</strong>
                              <p className="mt-1">{criterion.proficient}</p>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <strong>Satisfactory:</strong>
                              <p className="mt-1">{criterion.satisfactory}</p>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <strong>Foundational:</strong>
                              <p className="mt-1">{criterion.foundational}</p>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <strong>Novice:</strong>
                              <p className="mt-1">{criterion.novice}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border">
                          <strong>Instructions:</strong> {criterion.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end bg-gray-50">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingRubric(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300"
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
