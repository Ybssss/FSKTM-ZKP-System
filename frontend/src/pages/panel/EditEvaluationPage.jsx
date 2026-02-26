import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, ArrowLeft } from 'lucide-react';
import { evaluationAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function EditEvaluationPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    scores: {},
    strengths: '',
    weaknesses: '',
    recommendations: '',
    overallComments: '',
  });

  const [selectedRubric, setSelectedRubric] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadEvaluation();
  }, [id]);

  const loadEvaluation = async () => {
    try {
      setLoading(true);
      const data = await evaluationAPI.getById(id);
      const evalData = data.evaluation;

      // Check if user can edit
      if (user.role === 'panel' && evalData.evaluatorId._id !== user.id) {
        alert('You can only edit your own evaluations');
        navigate('/panel/historical-feedback');
        return;
      }

      setEvaluation(evalData);
      setSelectedRubric(evalData.rubricId);
      
      setFormData({
        scores: evalData.scores || {},
        strengths: evalData.strengths || '',
        weaknesses: evalData.weaknesses || '',
        recommendations: evalData.recommendations || '',
        overallComments: evalData.overallComments || '',
      });

      console.log('✅ Loaded evaluation for editing');
    } catch (error) {
      console.error('Error loading evaluation:', error);
      alert('Failed to load evaluation');
      navigate('/panel/historical-feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (criterionId, score) => {
    const numScore = parseInt(score) || 0;
    const criterion = selectedRubric?.criteria.find(c => c._id === criterionId);
    
    if (criterion && numScore > criterion.maxScore) {
      setErrors(prev => ({
        ...prev,
        [criterionId]: `Score cannot exceed ${criterion.maxScore}`,
      }));
      return;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[criterionId];
      return newErrors;
    });

    setFormData(prev => ({
      ...prev,
      scores: {
        ...prev.scores,
        [criterionId]: numScore,
      },
    }));
  };

  const calculateOverallScore = () => {
    if (!selectedRubric) return 0;

    let weightedSum = 0;
    selectedRubric.criteria.forEach(criterion => {
      const score = formData.scores[criterion._id] || 0;
      const normalizedScore = (score / criterion.maxScore) * 100;
      const weightedScore = (normalizedScore * criterion.weight) / 100;
      weightedSum += weightedScore;
    });

    return Math.round(weightedSum * 10) / 10;
  };

  const validateForm = () => {
    const newErrors = {};

    // Check all criteria have scores
    if (selectedRubric) {
      selectedRubric.criteria.forEach(criterion => {
        if (!formData.scores[criterion._id] && formData.scores[criterion._id] !== 0) {
          newErrors[criterion._id] = 'Score required';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      
      const updateData = {
        scores: formData.scores,
        strengths: formData.strengths,
        weaknesses: formData.weaknesses,
        recommendations: formData.recommendations,
        overallComments: formData.overallComments,
        overallScore: calculateOverallScore(),
      };

      await evaluationAPI.update(id, updateData);
      
      alert('✅ Evaluation updated successfully!');
      navigate('/panel/historical-feedback');
    } catch (error) {
      console.error('Error updating evaluation:', error);
      alert(error.response?.data?.message || 'Failed to update evaluation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 mt-4">Loading evaluation...</p>
        </div>
      </>
    );
  }

  if (!evaluation) {
    return (
      <>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-500">Evaluation not found</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/panel/historical-feedback')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Historical Feedback
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Evaluation</h1>
          <p className="text-gray-600 mt-2">Update evaluation for {evaluation.studentId.name}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Student Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Student:</span>
                  <p className="text-gray-900">{evaluation.studentId.name}</p>
                  <p className="text-gray-600">{evaluation.studentId.matricNumber}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Rubric:</span>
                  <p className="text-gray-900">{selectedRubric.name}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Semester:</span>
                  <p className="text-gray-900">{evaluation.semester}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Session Type:</span>
                  <p className="text-gray-900">{evaluation.sessionType || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Criteria Scores */}
            {selectedRubric && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Evaluation Criteria</h3>
                <div className="space-y-4">
                  {selectedRubric.criteria.map((criterion) => (
                    <div key={criterion._id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{criterion.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{criterion.description}</p>
                        </div>
                        <div className="ml-4 text-right">
                          <span className="text-xs font-semibold text-gray-700">
                            Weight: {criterion.weight}%
                          </span>
                          <p className="text-xs text-gray-500">Max: {criterion.maxScore}</p>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <input
                          type="number"
                          min="0"
                          max={criterion.maxScore}
                          value={formData.scores[criterion._id] || ''}
                          onChange={(e) => handleScoreChange(criterion._id, e.target.value)}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                            errors[criterion._id] ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder={`Score (0-${criterion.maxScore})`}
                        />
                        {errors[criterion._id] && (
                          <p className="text-red-600 text-sm mt-1">{errors[criterion._id]}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overall Score Display */}
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Overall Score:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {calculateOverallScore()}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback Sections */}
            <div className="space-y-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Feedback</h3>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Strengths
                </label>
                <textarea
                  value={formData.strengths}
                  onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows="3"
                  placeholder="What did the student do well?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Areas for Improvement
                </label>
                <textarea
                  value={formData.weaknesses}
                  onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows="3"
                  placeholder="What could be improved?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recommendations
                </label>
                <textarea
                  value={formData.recommendations}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows="3"
                  placeholder="Suggestions for next steps..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Overall Comments
                </label>
                <textarea
                  value={formData.overallComments}
                  onChange={(e) => setFormData({ ...formData, overallComments: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows="4"
                  placeholder="General comments about the presentation..."
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/panel/historical-feedback')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Update Evaluation
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
