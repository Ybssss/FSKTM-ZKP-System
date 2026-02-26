import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsAPI, evaluationAPI, timetableAPI, userAPI } from '../../services/api';
import { 
  FileText, 
  Calendar, 
  TrendingUp, 
  Award,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Users
} from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    averageScore: 0,
    upcomingSessions: 0,
    attendanceRate: 0
  });
  const [recentEvaluations, setRecentEvaluations] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [assignedPanels, setAssignedPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Loading student dashboard data...');

      // Try to get analytics data first
      try {
        const analyticsResponse = await analyticsAPI.getStudentStats();
        console.log('✅ Analytics response:', analyticsResponse);
        
        if (analyticsResponse.success && analyticsResponse.stats) {
          setStats(analyticsResponse.stats);
          setRecentEvaluations(analyticsResponse.stats.recentFeedback || []);
        }
      } catch (error) {
        console.log('⚠️ Analytics not available, using fallback method');
        
        // Fallback: Fetch data manually
        await fetchDataManually();
      }

      // Fetch assigned panels (separate from analytics)
      try {
        const studentResponse = await userAPI.getById(user.id);
        const studentData = studentResponse.user;
        
        const activePanels = studentData.assignedPanels?.filter(assignment => {
          if (!assignment.endDate) return true;
          return new Date(assignment.endDate) >= new Date();
        }) || [];
        
        setAssignedPanels(activePanels);
      } catch (error) {
        console.log('Could not fetch assigned panels:', error.message);
      }

      // Fetch upcoming sessions
      try {
        const sessionsResponse = await timetableAPI.getMy();
        const sessions = sessionsResponse.timetables || [];
        const upcoming = sessions.filter(s => new Date(s.date) >= new Date());
        setUpcomingSessions(upcoming.slice(0, 3));
      } catch (error) {
        console.log('Could not fetch timetables:', error.message);
      }

    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataManually = async () => {
    try {
      // Fetch evaluations manually
      let evaluations = [];
      try {
        const evalResponse = await evaluationAPI.getByStudent(user.id);
        evaluations = evalResponse.evaluations || [];
      } catch (error) {
        try {
          const evalResponse = await evaluationAPI.getAll();
          evaluations = (evalResponse.evaluations || []).filter(
            e => e.studentId === user.id || e.studentId?._id === user.id
          );
        } catch (error2) {
          console.log('Could not fetch evaluations');
        }
      }
      
      const submittedEvals = evaluations.filter(e => e.status === 'submitted');
      const avgScore = submittedEvals.length > 0
        ? submittedEvals.reduce((sum, e) => sum + (e.overallScore || 0), 0) / submittedEvals.length
        : 0;

      setStats(prev => ({
        ...prev,
        totalEvaluations: submittedEvals.length,
        averageScore: avgScore.toFixed(1)
      }));

      setRecentEvaluations(submittedEvals.slice(0, 3));
    } catch (error) {
      console.error('Error in manual fetch:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Unable to load some data</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalEvaluations}</div>
          <div className="text-sm text-gray-600 mt-1">Total Evaluations</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Award className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.averageScore}%</div>
          <div className="text-sm text-gray-600 mt-1">Average Score</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{upcomingSessions.length}</div>
          <div className="text-sm text-gray-600 mt-1">Upcoming Sessions</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.attendanceRate}%</div>
          <div className="text-sm text-gray-600 mt-1">Attendance Rate</div>
        </div>
      </div>

      {/* My Assigned Panels */}
      {assignedPanels.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">My Assigned Panels</h2>
              <span className="ml-auto px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                {assignedPanels.length} Panel{assignedPanels.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedPanels.map((assignment, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">
                        {assignment.panelId?.name || 'Panel Member'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {assignment.panelId?.userId || 'N/A'}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          From: {new Date(assignment.startDate).toLocaleDateString()}
                        </span>
                        {assignment.endDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            To: {new Date(assignment.endDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Evaluations */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Evaluations</h2>
          </div>
          <div className="p-6">
            {recentEvaluations.length > 0 ? (
              <div className="space-y-3">
                {recentEvaluations.map((evaluation) => (
                  <div key={evaluation._id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {evaluation.sessionType || 'Evaluation'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {evaluation.semester || new Date(evaluation.date).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {evaluation.panel || evaluation.evaluatorId?.name || 'Panel Member'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          evaluation.overallScore >= 80 ? 'text-green-600' :
                          evaluation.overallScore >= 60 ? 'text-blue-600' :
                          'text-orange-600'
                        }`}>
                          {evaluation.overallScore?.toFixed(1) || 0}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(evaluation.createdAt || evaluation.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No evaluations yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Sessions</h2>
          </div>
          <div className="p-6">
            {upcomingSessions.length > 0 ? (
              <div className="space-y-3">
                {upcomingSessions.map((session) => (
                  <div key={session._id} className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                    <h3 className="font-semibold text-gray-900">{session.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{session.sessionType}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(session.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.startTime}
                      </span>
                    </div>
                    {session.deadline && new Date(session.deadline) > new Date() && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                        <AlertCircle className="w-3 h-3" />
                        <span>Deadline: {new Date(session.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No upcoming sessions</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/student/feedback"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">View Feedback</div>
              <div className="text-sm text-gray-500">Check evaluations</div>
            </div>
          </a>
          <a
            href="/student/progress"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
          >
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Track Progress</div>
              <div className="text-sm text-gray-500">View your growth</div>
            </div>
          </a>
          <a
            href="/student/schedule"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
          >
            <div className="p-2 bg-purple-50 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">View Schedule</div>
              <div className="text-sm text-gray-500">Check sessions</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
