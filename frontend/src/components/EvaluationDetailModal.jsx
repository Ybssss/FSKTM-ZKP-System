import React from 'react';
import { X, Calendar, User, Award, FileText } from 'lucide-react';

export default function EvaluationDetailModal({ evaluation, onClose }) {
  if (!evaluation) return null;

  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const getScoreBarColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Evaluation Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Student Info */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">
                  {evaluation.studentId?.name || 'Unknown Student'}
                </h3>
                <div className="space-y-1 text-sm opacity-90">
                  <p>Matric: {evaluation.studentId?.matricNumber || 'N/A'}</p>
                  <p>Program: {evaluation.studentId?.program || 'N/A'}</p>
                  {evaluation.studentId?.researchTitle && (
                    <p className="mt-2 font-medium">
                      Research: {evaluation.studentId.researchTitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-center">
                <div className="bg-white text-primary rounded-lg px-6 py-4">
                  <div className="text-4xl font-bold">{evaluation.overallScore}</div>
                  <div className="text-sm">Overall Score</div>
                </div>
              </div>
            </div>
          </div>

          {/* Evaluation Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <div className="text-xs text-gray-500">Date</div>
                <div className="font-semibold text-gray-900">
                  {new Date(evaluation.date).toLocaleDateString('en-MY', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <div className="text-xs text-gray-500">Session Type</div>
                <div className="font-semibold text-gray-900">
                  {evaluation.sessionType}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-primary" />
              <div>
                <div className="text-xs text-gray-500">Evaluator</div>
                <div className="font-semibold text-gray-900">
                  {evaluation.evaluatorId?.name || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Criteria Scores */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Evaluation Criteria
            </h3>
            <div className="space-y-4">
              {evaluation.criteria?.map((criterion, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-gray-900">{criterion.name}</h4>
                      <span className="text-sm text-gray-500">
                        Weight: {criterion.weight}%
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(criterion.score)}`}>
                      {criterion.score}/100
                    </span>
                  </div>

                  {/* Score Bar */}
                  <div className="mb-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getScoreBarColor(criterion.score)}`}
                        style={{ width: `${criterion.score}%` }}
                      />
                    </div>
                  </div>

                  {/* Comments */}
                  {criterion.comments && (
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                      <span className="font-medium">Comments: </span>
                      {criterion.comments}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Overall Comments */}
          {evaluation.overallComments && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                Overall Comments
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {evaluation.overallComments}
                </p>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {evaluation.recommendations && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                Recommendations
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {evaluation.recommendations}
                </p>
              </div>
            </div>
          )}

          {/* Rubric Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div>
                <span className="font-medium">Rubric: </span>
                {evaluation.rubricId?.name || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Semester: </span>
                {evaluation.semester}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
