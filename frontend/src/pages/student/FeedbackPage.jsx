import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { evaluationAPI } from '../../services/api';
import { 
  FileText, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Award, 
  MessageSquare, 
  Calendar, 
  User 
} from 'lucide-react';

export default function FeedbackPage() {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [filteredEvaluations, setFilteredEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('all');
  const [selectedSessionType, setSelectedSessionType] = useState('all');
  const [expandedEval, setExpandedEval] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [sessionTypes, setSessionTypes] = useState([]);

  useEffect(() => {
    fetchEvaluations();
  }, []);

  useEffect(() => {
    filterEvaluations();
  }, [searchTerm, selectedSemester, selectedSessionType, evaluations]);

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let evals = [];
      try {
        const response = await evaluationAPI.getByStudent(user.id);
        evals = response.evaluations || [];
      } catch (err) {
        try {
          const response = await evaluationAPI.getAll();
          const allEvals = response.evaluations || [];
          evals = allEvals.filter(e => {
            const studentId = e.studentId?._id || e.studentId;
            return studentId === user.id;
          });
        } catch (err2) {
          console.error('Error fetching evaluations:', err2);
          setError('Could not load evaluations');
          return;
        }
      }
      
      const submittedEvals = evals.filter(e => e.status === 'submitted');
      setEvaluations(submittedEvals);
      
      const uniqueSemesters = [...new Set(submittedEvals.map(e => e.semester).filter(Boolean))];
      const uniqueSessionTypes = [...new Set(submittedEvals.map(e => e.sessionType).filter(Boolean))];
      
      setSemesters(uniqueSemesters);
      setSessionTypes(uniqueSessionTypes);
      
    } catch (error) {
      console.error('Error in fetchEvaluations:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterEvaluations = () => {
    let filtered = [...evaluations];

    if (searchTerm) {
      filtered = filtered.filter(e =>
        e.sessionType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.semester?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.evaluatorId?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedSemester !== 'all') {
      filtered = filtered.filter(e => e.semester === selectedSemester);
    }

    if (selectedSessionType !== 'all') {
      filtered = filtered.filter(e => e.sessionType === selectedSessionType);
    }

    setFilteredEvaluations(filtered);
  };

  const toggleExpand = (evalId) => {
    setExpandedEval(expandedEval === evalId ? null : evalId);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreBadge = (score) => {
    if (score >= 80) return { text: 'Excellent', color: 'bg-green-500' };
    if (score >= 60) return { text: 'Good', color: 'bg-blue-500' };
    if (score >= 40) return { text: 'Satisfactory', color: 'bg-orange-500' };
    return { text: 'Needs Improvement', color: 'bg-red-500' };
  };

  // Get criterion name from rubric or use ID as fallback
  const getCriterionName = (evaluation, criterionId) => {
    // Try to find the criterion name from rubric
    if (evaluation.rubricId?.criteria) {
      const criterion = evaluation.rubricId.criteria.find(c => 
        c._id === criterionId || c._id?.toString() === criterionId
      );
      if (criterion) return criterion.name;
    }
    
    // Fallback: return a cleaned version of the ID
    return `Criterion ${criterionId.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Loading evaluations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-900 font-semibold mb-2">Error Loading Evaluations</h3>
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchEvaluations}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Feedback</h1>
        <p className="text-gray-600 mt-1">View all your evaluation feedback and scores</p>
      </div>

      {evaluations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search evaluations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Semesters</option>
                {semesters.map(sem => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session Type</label>
              <select
                value={selectedSessionType}
                onChange={(e) => setSelectedSessionType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                {sessionTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredEvaluations.length} of {evaluations.length} evaluations
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredEvaluations.length > 0 ? (
          filteredEvaluations.map((evaluation) => {
            const isExpanded = expandedEval === evaluation._id;
            const scoreBadge = getScoreBadge(evaluation.overallScore);

            return (
              <div key={evaluation._id} className="bg-white rounded-lg border border-gray-200">
                <div className="p-6 cursor-pointer" onClick={() => toggleExpand(evaluation._id)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{evaluation.sessionType}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${scoreBadge.color}`}>
                          {scoreBadge.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 mt-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {evaluation.semester}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {evaluation.evaluatorId?.name || 'Panel Member'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(evaluation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getScoreColor(evaluation.overallScore).split(' ')[0]}`}>
                          {evaluation.overallScore?.toFixed(1) || 0}%
                        </div>
                        <div className="text-sm text-gray-500">Overall</div>
                      </div>
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
                    {evaluation.scores && Object.keys(evaluation.scores).length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Award className="w-5 h-5 text-blue-600" />
                          Score Breakdown
                        </h4>
                        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                          {Object.entries(evaluation.scores).map(([criterionId, score]) => (
                            <div key={criterionId} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700">
                                {getCriterionName(evaluation, criterionId)}
                              </span>
                              <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${getScoreColor(score)}`}>
                                {score}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        Feedback Comments
                      </h4>

                      {evaluation.strengths && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h5 className="font-semibold text-green-900 mb-2">Strengths</h5>
                          <p className="text-sm text-green-800 whitespace-pre-wrap">{evaluation.strengths}</p>
                        </div>
                      )}

                      {evaluation.weaknesses && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <h5 className="font-semibold text-orange-900 mb-2">Areas for Improvement</h5>
                          <p className="text-sm text-orange-800 whitespace-pre-wrap">{evaluation.weaknesses}</p>
                        </div>
                      )}

                      {evaluation.recommendations && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h5 className="font-semibold text-blue-900 mb-2">Recommendations</h5>
                          <p className="text-sm text-blue-800 whitespace-pre-wrap">{evaluation.recommendations}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Evaluations Found</h3>
            <p className="text-gray-600">
              {evaluations.length === 0
                ? "You haven't received any evaluations yet. Your panel members will submit evaluations after each session."
                : "No evaluations match your filters. Try adjusting your search criteria."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
