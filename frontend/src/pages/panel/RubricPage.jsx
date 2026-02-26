import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, X } from 'lucide-react';
import { rubricAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function RubricPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingRubric, setEditingRubric] = useState(null);
  const [viewingRubric, setViewingRubric] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    criteria: [
      { name: '', description: '', weight: 0, maxScore: 100 }
    ],
    isActive: true,
  });

  useEffect(() => {
    loadRubrics();
  }, []);

  const loadRubrics = async () => {
    try {
      setLoading(true);
      const data = await rubricAPI.getAll();
      setRubrics(data.rubrics || []);
    } catch (error) {
      console.error('Error loading rubrics:', error);
      alert('Failed to load rubrics');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCriterion = () => {
    setFormData({
      ...formData,
      criteria: [
        ...formData.criteria,
        { name: '', description: '', weight: 0, maxScore: 100 }
      ]
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
      [field]: field === 'weight' || field === 'maxScore' ? parseFloat(value) || 0 : value
    };
    setFormData({ ...formData, criteria: newCriteria });
  };

  const getTotalWeight = () => {
    return formData.criteria.reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      alert('Please enter rubric name');
      return false;
    }

    if (formData.criteria.length === 0) {
      alert('Please add at least one criterion');
      return false;
    }

    const totalWeight = getTotalWeight();
    if (Math.abs(totalWeight - 100) > 0.01) {
      alert(`Total weight must be 100%. Current total: ${totalWeight}%`);
      return false;
    }

    for (let i = 0; i < formData.criteria.length; i++) {
      const c = formData.criteria[i];
      if (!c.name.trim()) {
        alert(`Please enter name for criterion ${i + 1}`);
        return false;
      }
      if (c.weight <= 0) {
        alert(`Weight for criterion ${i + 1} must be greater than 0`);
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
        alert('Rubric updated successfully!');
      } else {
        await rubricAPI.create(formData);
        alert('Rubric created successfully!');
      }
      
      setShowModal(false);
      setEditingRubric(null);
      resetForm();
      loadRubrics();
    } catch (error) {
      console.error('Error saving rubric:', error);
      alert(error.response?.data?.message || 'Failed to save rubric');
    }
  };

  const handleEdit = (rubric) => {
    setEditingRubric(rubric);
    setFormData({
      name: rubric.name,
      description: rubric.description || '',
      criteria: rubric.criteria || [],
      isActive: rubric.isActive,
    });
    setShowModal(true);
  };

  const handleView = (rubric) => {
    setViewingRubric(rubric);
    setShowViewModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rubric?')) return;

    try {
      await rubricAPI.delete(id);
      alert('Rubric deleted successfully!');
      loadRubrics();
    } catch (error) {
      console.error('Error deleting rubric:', error);
      alert('Failed to delete rubric');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      criteria: [
        { name: '', description: '', weight: 0, maxScore: 100 }
      ],
      isActive: true,
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRubric(null);
    resetForm();
  };

  return (
    <>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Evaluation Rubrics</h1>
            <p className="text-gray-600 mt-2">
              {isAdmin ? 'Manage evaluation criteria and rubrics' : 'View evaluation rubrics'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create New Rubric
            </button>
          )}
        </div>

        {/* Access Notice for Non-Admin */}
        {!isAdmin && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              ℹ️ You have view-only access. Only administrators can create or edit rubrics.
            </p>
          </div>
        )}

        {/* Rubrics List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 mt-4">Loading rubrics...</p>
            </div>
          ) : rubrics.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">No rubrics found</p>
              {isAdmin && (
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 text-primary hover:text-primary-dark font-medium"
                >
                  Create your first rubric
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {rubrics.map((rubric) => (
                <div key={rubric._id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {rubric.name}
                        </h3>
                        {rubric.isActive ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      {rubric.description && (
                        <p className="text-gray-600 mb-3">{rubric.description}</p>
                      )}

                      <div className="text-sm text-gray-500">
                        <span className="font-medium">{rubric.criteria?.length || 0}</span> criteria
                        {rubric.createdBy && (
                          <span className="ml-4">
                            Created by: <span className="font-medium">{rubric.createdBy.name}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleView(rubric)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleEdit(rubric)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Edit rubric"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          
                          <button
                            onClick={() => handleDelete(rubric._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete rubric"
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

      {/* Create/Edit Modal - Admin Only */}
      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingRubric ? 'Edit Rubric' : 'Create New Rubric'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Basic Info */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rubric Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., PhD Progress Review"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows="3"
                  placeholder="Describe the purpose of this rubric..."
                />
              </div>

              {/* Criteria */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Evaluation Criteria *
                  </label>
                  <div className="text-sm">
                    Total Weight: <span className={`font-bold ${Math.abs(getTotalWeight() - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                      {getTotalWeight()}%
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {formData.criteria.map((criterion, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">Criterion {index + 1}</h4>
                        {formData.criteria.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCriterion(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={criterion.name}
                            onChange={(e) => handleCriterionChange(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="e.g., Research Methodology"
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            value={criterion.description}
                            onChange={(e) => handleCriterionChange(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            rows="2"
                            placeholder="Describe what to evaluate..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weight (%) *
                          </label>
                          <input
                            type="number"
                            value={criterion.weight}
                            onChange={(e) => handleCriterionChange(index, 'weight', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            min="0"
                            max="100"
                            step="0.1"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Max Score
                          </label>
                          <input
                            type="number"
                            value={criterion.maxScore}
                            onChange={(e) => handleCriterionChange(index, 'maxScore', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            min="1"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddCriterion}
                  className="mt-4 px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                >
                  + Add Criterion
                </button>
              </div>

              {/* Active Status */}
              <div className="mb-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Set as active rubric
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-4 justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                >
                  {editingRubric ? 'Update Rubric' : 'Create Rubric'}
                </button>
              </div>
            </form>
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
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {viewingRubric.description && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-600">{viewingRubric.description}</p>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Criteria</h3>
                <div className="space-y-4">
                  {viewingRubric.criteria?.map((criterion, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{criterion.name}</h4>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">
                            Weight: <span className="font-semibold">{criterion.weight}%</span>
                          </span>
                          <span className="text-sm text-gray-600">
                            Max: <span className="font-semibold">{criterion.maxScore}</span>
                          </span>
                        </div>
                      </div>
                      {criterion.description && (
                        <p className="text-sm text-gray-600">{criterion.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-200">
                <div>
                  Status: <span className={`font-semibold ${viewingRubric.isActive ? 'text-green-600' : 'text-gray-600'}`}>
                    {viewingRubric.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {viewingRubric.createdBy && (
                  <div>
                    Created by: <span className="font-semibold">{viewingRubric.createdBy.name}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingRubric(null);
                  }}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
