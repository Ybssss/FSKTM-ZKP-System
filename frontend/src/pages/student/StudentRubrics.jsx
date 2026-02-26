import React, { useState, useEffect } from 'react';
import { rubricAPI } from '../../services/api';
import { ClipboardList, Search, ChevronDown, ChevronUp } from 'lucide-react';

export default function StudentRubrics() {
  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRubric, setExpandedRubric] = useState(null);

  useEffect(() => {
    fetchRubrics();
  }, []);

  const fetchRubrics = async () => {
    try {
      setLoading(true);
      const response = await rubricAPI.getAll();
      // Only show active rubrics to students
      const activeRubrics = response.rubrics?.filter(r => r.isActive) || [];
      setRubrics(activeRubrics);
    } catch (error) {
      console.error('Error fetching rubrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (rubricId) => {
    setExpandedRubric(expandedRubric === rubricId ? null : rubricId);
  };

  const filteredRubrics = rubrics.filter(r =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Evaluation Rubrics</h1>
        <p className="text-gray-600 mt-1">View the rubrics used for evaluating your progress</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Search Rubrics</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredRubrics.length} of {rubrics.length} rubrics
        </div>
      </div>

      {/* Rubrics List */}
      <div className="space-y-4">
        {filteredRubrics.length > 0 ? (
          filteredRubrics.map((rubric) => {
            const isExpanded = expandedRubric === rubric._id;
            const totalWeightage = rubric.criteria?.reduce((sum, c) => sum + (c.weightage || 0), 0) || 0;

            return (
              <div key={rubric._id} className="bg-white rounded-lg border border-gray-200">
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => toggleExpand(rubric._id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{rubric.name}</h3>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          Active
                        </span>
                      </div>
                      {rubric.description && (
                        <p className="text-sm text-gray-600 mt-1">{rubric.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                        <span>{rubric.criteria?.length || 0} Criteria</span>
                        <span>Total Weightage: {totalWeightage}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="w-6 h-6 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-blue-600" />
                      Evaluation Criteria
                    </h4>
                    <div className="space-y-3">
                      {rubric.criteria?.map((criterion, index) => (
                        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900">{criterion.name}</h5>
                              {criterion.description && (
                                <p className="text-sm text-gray-600 mt-1">{criterion.description}</p>
                              )}
                            </div>
                            <div className="ml-4 text-right">
                              <div className="text-sm font-semibold text-gray-900">
                                {criterion.maxScore} points
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {criterion.weightage}% weight
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {rubric.createdBy && (
                      <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                        Created by: {rubric.createdBy.name || 'Administrator'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Rubrics Found</h3>
            <p className="text-gray-600">
              {rubrics.length === 0
                ? "No evaluation rubrics are currently available."
                : "No rubrics match your search criteria."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
