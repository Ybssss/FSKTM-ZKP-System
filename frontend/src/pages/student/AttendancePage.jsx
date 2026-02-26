import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { attendanceAPI } from '../../services/api';
import { UserCheck, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function AttendancePage() {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    attendanceRate: 0
  });

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getMy();
      const records = response.attendances || [];
      setAttendanceRecords(records);

      const total = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const rate = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

      setStats({ total, present, absent, attendanceRate: rate });
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
        <p className="text-gray-600 mt-1">Track your symposium session attendance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-6 h-6 text-gray-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600 mt-1">Total Sessions</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.present}</div>
          <div className="text-sm text-gray-600 mt-1">Present</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.absent}</div>
          <div className="text-sm text-gray-600 mt-1">Absent</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <UserCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.attendanceRate}%</div>
          <div className="text-sm text-gray-600 mt-1">Attendance Rate</div>
        </div>
      </div>

      {/* Attendance Progress Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Attendance</h2>
        <div className="w-full bg-gray-200 rounded-full h-6">
          <div
            className={`h-6 rounded-full transition-all flex items-center justify-center text-white text-sm font-bold ${
              stats.attendanceRate >= 80 ? 'bg-green-500' :
              stats.attendanceRate >= 60 ? 'bg-blue-500' :
              stats.attendanceRate >= 40 ? 'bg-orange-500' :
              'bg-red-500'
            }`}
            style={{ width: `${stats.attendanceRate}%` }}
          >
            {stats.attendanceRate}%
          </div>
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Attendance History</h2>
        </div>
        <div className="p-6">
          {attendanceRecords.length > 0 ? (
            <div className="space-y-3">
              {attendanceRecords.map((record) => (
                <div
                  key={record._id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                    record.status === 'present'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {record.status === 'present' ? (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {record.timetableId?.title || 'Session'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {record.timetableId?.sessionType}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(record.timetableId?.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Marked: {new Date(record.markedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                        record.status === 'present'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {record.status.toUpperCase()}
                    </span>
                    {record.verificationMethod && (
                      <p className="text-xs text-gray-500 mt-2">
                        Via {record.verificationMethod}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <UserCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Attendance Records</h3>
              <p className="text-gray-600">Your attendance records will appear here once recorded.</p>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Tips */}
      {stats.attendanceRate < 80 && stats.total > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 text-orange-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-orange-900 mb-2">Attendance Reminder</h3>
              <p className="text-sm text-orange-800">
                Your current attendance rate is {stats.attendanceRate}%. Regular attendance is important for your academic progress.
                Make sure to attend all scheduled symposium sessions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
