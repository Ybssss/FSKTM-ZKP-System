import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { evaluationAPI } from '../../services/api';
import { TrendingUp, TrendingDown, Award, Target, Calendar, BarChart3 } from 'lucide-react';

export default function ProgressPage() {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    overallAverage: 0,
    highestScore: 0,
    lowestScore: 0,
    totalEvaluations: 0,
    trend: 0
  });
  const [progressBySemester, setProgressBySemester] = useState([]);

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Fetching progress data for user:', user.id);
      
      // Try to get evaluations
      let evals = [];
      try {
        console.log('📡 Trying getByStudent...');
        const response = await evaluationAPI.getByStudent(user.id);
        console.log('✅ Response:', response);
        evals = response.evaluations || [];
      } catch (err) {
        console.log('❌ getByStudent failed, trying getAll...');
        try {
          const response = await evaluationAPI.getAll();
          const allEvals = response.evaluations || [];
          evals = allEvals.filter(e => {
            const studentId = e.studentId?._id || e.studentId;
            return studentId === user.id;
          });
          console.log(`✅ Filtered ${evals.length} from ${allEvals.length} total`);
        } catch (err2) {
          console.error('❌ Both methods failed:', err2);
          setError('Could not load evaluations');
          return;
        }
      }
      
      const submittedEvals = evals.filter(e => e.status === 'submitted');
      console.log(`✅ Found ${submittedEvals.length} submitted evaluations`);
      
      setEvaluations(submittedEvals);

      if (submittedEvals.length > 0) {
        const scores = submittedEvals.map(e => e.overallScore || 0);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const highest = Math.max(...scores);
        const lowest = Math.min(...scores);

        const mid = Math.floor(submittedEvals.length / 2);
        const firstHalf = submittedEvals.slice(0, mid);
        const secondHalf = submittedEvals.slice(mid);
        
        const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, e) => sum + (e.overallScore || 0), 0) / firstHalf.length : 0;
        const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, e) => sum + (e.overallScore || 0), 0) / secondHalf.length : 0;
        const trend = secondAvg - firstAvg;

        setStats({
          overallAverage: avg.toFixed(2),
          highestScore: highest.toFixed(2),
          lowestScore: lowest.toFixed(2),
          totalEvaluations: submittedEvals.length,
          trend: trend.toFixed(2)
        });

        const semesterGroups = {};
        submittedEvals.forEach(e => {
          if (!semesterGroups[e.semester]) semesterGroups[e.semester] = [];
          semesterGroups[e.semester].push(e.overallScore || 0);
        });

        const semesterProgress = Object.keys(semesterGroups).map(semester => ({
          semester,
          average: (semesterGroups[semester].reduce((a, b) => a + b, 0) / semesterGroups[semester].length).toFixed(2),
          count: semesterGroups[semester].length
        }));

        console.log('📈 Progress by semester:', semesterProgress);
        setProgressBySemester(semesterProgress);
      }
    } catch (error) {
      console.error('❌ Error fetching progress data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Loading progress data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-900 font-semibold mb-2">Error Loading Progress</h3>
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchProgressData}
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
        <h1 className="text-2xl font-bold text-gray-900">My Progress</h1>
        <p className="text-gray-600 mt-1">Track your academic performance over time</p>
      </div>

      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="text-blue-900">
          📊 Status: Analyzing <strong>{evaluations.length}</strong> submitted evaluations
          {evaluations.length === 0 && ' (No evaluations to analyze yet)'}
        </p>
      </div>

      {evaluations.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <Award className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.overallAverage}%</div>
              <div className="text-sm text-gray-600 mt-1">Overall Average</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.highestScore}%</div>
              <div className="text-sm text-gray-600 mt-1">Highest Score</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalEvaluations}</div>
              <div className="text-sm text-gray-600 mt-1">Total Evaluations</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${parseFloat(stats.trend) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  {parseFloat(stats.trend) >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  )}
                </div>
              </div>
              <div className={`text-2xl font-bold ${parseFloat(stats.trend) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {parseFloat(stats.trend) >= 0 ? '+' : ''}{stats.trend}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Performance Trend</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Progress by Semester
            </h2>
            {progressBySemester.length > 0 ? (
              <div className="space-y-4">
                {progressBySemester.map((sem, index) => {
                  const percentage = parseFloat(sem.average);
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{sem.semester}</span>
                        <span className="text-sm font-bold text-gray-900">{sem.average}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-blue-500' : percentage >= 40 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{sem.count} evaluation{sem.count > 1 ? 's' : ''}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No semester data available</p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Performance</h2>
            <div className="space-y-3">
              {evaluations.slice(0, 5).map((evaluation) => (
                <div key={evaluation._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{evaluation.sessionType}</h3>
                    <p className="text-sm text-gray-500 mt-1">{evaluation.semester}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      evaluation.overallScore >= 80 ? 'text-green-600' :
                      evaluation.overallScore >= 60 ? 'text-blue-600' :
                      'text-orange-600'
                    }`}>
                      {evaluation.overallScore?.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(evaluation.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {parseFloat(stats.trend) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <p className="text-sm text-gray-700">
                    Great job! Your performance has improved by <strong>{stats.trend}%</strong> over time.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Progress Data Yet</h3>
          <p className="text-gray-600">
            Progress tracking requires at least one submitted evaluation. Your panel members will create evaluations after each session.
          </p>
        </div>
      )}
    </div>
  );
}
