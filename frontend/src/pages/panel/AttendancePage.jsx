import React, { useState, useEffect } from 'react';
import { attendanceAPI } from '../../services/api';
import { UserCheck, QrCode, Download } from 'lucide-react';

export default function AttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, total: 0, rate: 0 });

  useEffect(() => {
    loadAttendance();
  }, []);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      // For now, showing empty state
      // In real app, load from API
      setAttendance([]);
      setStats({ present: 22, total: 24, rate: 91.7 });
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Attendance Tracking</h1>
          <p className="text-gray-600 mt-2">Monitor student attendance</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Present</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.present}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <UserCheck className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Students</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <UserCheck className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Attendance Rate</p>
                <p className="text-3xl font-bold text-primary mt-2">{stats.rate}%</p>
              </div>
              <div className="bg-primary/10 p-3 rounded-lg">
                <UserCheck className="w-8 h-8 text-primary" />
              </div>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Session QR Code</h2>
          <div className="inline-block p-8 bg-gray-100 rounded-lg">
            <QrCode className="w-32 h-32 text-gray-400" />
          </div>
          <p className="text-gray-600 mt-4">Students scan this code to check in</p>
          <button className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">
            Generate New QR Code
          </button>
        </div>

        {/* Attendance List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Attendance Records</h2>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          
          <div className="text-center py-12 text-gray-500">
            No attendance records yet
          </div>
        </div>
      </div>
    </>
  );
}