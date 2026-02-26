import React, { useState, useEffect } from 'react';
import { analyticsAPI, evaluationAPI } from '../../services/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, FileCheck, Award } from 'lucide-react';
import { CardSkeleton, ListSkeleton } from '../../components/common/LoadingSkeleton';

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load overview stats
      const overviewRes = await analyticsAPI.getOverview();
      setOverview(overviewRes.stats);

      // Load trends
      const trendsRes = await analyticsAPI.getTrends();
      setTrends(trendsRes.trends || []);

      // Mock distribution data
      setDistribution([
        { name: 'AI/ML', value: 10, color: '#10b981' },
        { name: 'Cybersecurity', value: 7, color: '#3b82f6' },
        { name: 'IoT', value: 4, color: '#f59e0b' },
        { name: 'Blockchain', value: 3, color: '#8b5cf6' },
      ]);

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-4 gap-6 mb-8">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <ListSkeleton items={3} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">Performance insights and trends</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Students"
            value={overview?.totalStudents || 0}
            icon={Users}
            color="bg-blue-500"
            trend="+5%"
          />
          <StatCard
            title="Total Evaluations"
            value={overview?.totalEvaluations || 0}
            icon={FileCheck}
            color="bg-green-500"
            trend="+12%"
          />
          <StatCard
            title="Avg Score"
            value={overview?.averageScore?.toFixed(1) || '0.0'}
            icon={Award}
            color="bg-purple-500"
            trend="+8%"
          />
          <StatCard
            title="Completion Rate"
            value="94%"
            icon={TrendingUp}
            color="bg-orange-500"
            trend="+3%"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Score Trends */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Score Trends</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avgScore" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Average Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Research Area Distribution */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Research Areas</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evaluation by Month */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Evaluations by Month</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#10b981" name="Number of Evaluations" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Performers */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performers</h2>
          <div className="space-y-3">
            {[
              { name: 'Ahmad Ibrahim', score: 92, program: 'PhD (CS)' },
              { name: 'Siti Nurhaliza', score: 89, program: 'Master (IT)' },
              { name: 'Muhammad Ali', score: 87, program: 'PhD (CS)' },
            ].map((student, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{student.name}</div>
                    <div className="text-sm text-gray-600">{student.program}</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {student.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value, icon: Icon, color, trend }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <span className="text-green-600 text-sm font-semibold">{trend}</span>
      </div>
      <div>
        <p className="text-sm text-gray-600 font-medium">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  );
}