import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Users, FileCheck, Clock, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { analyticsAPI } from '../../services/api';

export default function PanelDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentEvaluations, setRecentEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Loading panel dashboard data...');
      
      // Call the correct analytics API endpoint
      const response = await analyticsAPI.getStats();
      
      console.log('✅ Analytics response:', response);
      
      if (response.success && response.stats) {
        setStats(response.stats);
        setRecentEvaluations(response.stats.recentEvaluations || []);
        console.log('✅ Dashboard data loaded successfully');
      } else {
        throw new Error('Invalid response from analytics API');
      }

    } catch (error) {
      console.error('❌ Error loading dashboard:', error);
      setError(error.message);
      
      // Set empty stats instead of demo data
      setStats({
        totalStudents: 0,
        totalEvaluations: 0,
        totalPanels: 0,
        totalSessions: 0,
        activeRubrics: 0,
      });
      setRecentEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's what's happening with your evaluations today.
        </p>
      </div>

      {/* Error Alert - Only show if there's an actual error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              Unable to Load Dashboard Data
            </p>
            <p className="text-xs text-red-700 mt-1">
              {error}
            </p>
            <button
              onClick={loadData}
              className="mt-2 text-xs text-red-700 underline hover:text-red-800"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Students"
          value={stats?.totalStudents || 0}
          icon={Users}
          color="bg-blue-500"
          bgLight="bg-blue-50"
          textColor="text-blue-600"
        />
        <StatCard
          title="Total Evaluations"
          value={stats?.totalEvaluations || 0}
          icon={FileCheck}
          color="bg-green-500"
          bgLight="bg-green-50"
          textColor="text-green-600"
        />
        <StatCard
          title="Total Panels"
          value={stats?.totalPanels || 0}
          icon={Clock}
          color="bg-yellow-500"
          bgLight="bg-yellow-50"
          textColor="text-yellow-600"
        />
        <StatCard
          title="Sessions"
          value={stats?.totalSessions || 0}
          icon={TrendingUp}
          color="bg-purple-500"
          bgLight="bg-purple-50"
          textColor="text-purple-600"
        />
      </div>

      {/* Recent Evaluations */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Recent Evaluations
          </h2>
          <Link
            to="/panel/historical-feedback"
            className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {recentEvaluations.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No evaluations yet</p>
            <Link
              to="/panel/evaluation"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              Create Your First Evaluation
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentEvaluations.map((evaluation) => (
              <div
                key={evaluation._id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {evaluation.student || 'Unknown Student'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Evaluation • {new Date(evaluation.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {evaluation.overallScore || 0}
                    </div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickAction
          title="Create Evaluation"
          description="Submit a new student evaluation"
          link="/panel/evaluation"
          icon={FileCheck}
          color="bg-gradient-to-br from-green-500 to-green-600"
        />
        <QuickAction
          title="Search Feedback"
          description="Browse historical evaluations"
          link="/panel/historical-feedback"
          icon={Clock}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <QuickAction
          title="Manage Rubrics"
          description="View and edit rubric templates"
          link="/panel/rubrics"
          icon={TrendingUp}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon: Icon, color, bgLight, textColor }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`${bgLight} p-3 rounded-lg`}>
          <Icon className={`w-8 h-8 ${textColor}`} />
        </div>
      </div>
    </div>
  );
}

// Quick Action Component
function QuickAction({ title, description, link, icon: Icon, color }) {
  return (
    <Link
      to={link}
      className={`${color} text-white rounded-lg p-6 hover:shadow-lg transition-all transform hover:-translate-y-1 group`}
    >
      <div className="flex items-start justify-between mb-3">
        <Icon className="w-8 h-8" />
        <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-white/90 text-sm">{description}</p>
    </Link>
  );
}
