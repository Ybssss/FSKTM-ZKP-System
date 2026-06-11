import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { attendanceAPI, timetableAPI, userAPI } from '../../services/api';
import { CalendarCheck, Users, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import UserProfileLink from '../../components/UserProfileLink';
import SortableTh from '../../components/SortableTh';
import useSortableData from '../../hooks/useSortableData';

export default function PanelAttendancePage() {
  const [attendances, setAttendances] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [attendanceRes, sessionsRes, usersRes] = await Promise.all([
        attendanceAPI.getMy().catch(() => ({ attendances: [] })),
        timetableAPI.getAll().catch(() => ({ timetables: [] })),
        userAPI.getAll().catch(() => ({ users: [] }))
      ]);

      setAttendances(attendanceRes.attendances || []);
      setSessions(sessionsRes.timetables || []);
      setStudents(usersRes.users?.filter(u => u.role === 'student') || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSessionName = useCallback((timetableId) => {
    const session = sessions.find(s => s._id === timetableId);
    return session?.title || 'Unknown Session';
  }, [sessions]);

  const getStudentName = useCallback((studentId) => {
    const student = students.find(s => s._id === studentId);
    return student?.name || 'Unknown Student';
  }, [students]);

  const getStudent = (studentId) => students.find(s => s._id === studentId) || null;

  const getStatusBadge = (status) => {
    const styles = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-orange-100 text-orange-800'
    };

    const icons = {
      present: <CheckCircle className="w-4 h-4" />,
      absent: <XCircle className="w-4 h-4" />,
      late: <AlertCircle className="w-4 h-4" />
    };

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredAttendances = selectedSession === 'all'
    ? attendances
    : attendances.filter(a => a.timetableId === selectedSession);
  const stats = useMemo(() => ({
    total: filteredAttendances.length,
    present: filteredAttendances.filter(a => a.status === 'present').length,
    absent: filteredAttendances.filter(a => a.status === 'absent').length,
    late: filteredAttendances.filter(a => a.status === 'late').length
  }), [filteredAttendances]);
  const attendanceSortAccessors = useMemo(
    () => ({
      student: (attendance) => getStudentName(attendance.studentId),
      session: (attendance) => getSessionName(attendance.timetableId),
      status: (attendance) => attendance.status || '',
      checkIn: (attendance) => attendance.checkInTime || '',
      method: (attendance) => attendance.method || '',
    }),
    [getSessionName, getStudentName],
  );
  const {
    sortedItems: sortedAttendances,
    sortConfig: attendanceSortConfig,
    requestSort: requestAttendanceSort,
  } = useSortableData(filteredAttendances, attendanceSortAccessors, { key: 'student' });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarCheck className="w-8 h-8" />
          Attendance Management
        </h1>
        <p className="text-gray-600 mt-1">View and manage student attendance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Records</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Present</p>
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Late</p>
              <p className="text-2xl font-bold text-orange-600">{stats.late}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Absent</p>
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by Session:</label>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Sessions</option>
            {sessions.map(session => (
              <option key={session._id} value={session._id}>
                {session.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableTh className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" sortKey="student" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort}>Student</SortableTh>
                <SortableTh className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" sortKey="session" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort}>Session</SortableTh>
                <SortableTh className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" sortKey="status" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort}>Status</SortableTh>
                <SortableTh className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" sortKey="checkIn" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort}>Check-in Time</SortableTh>
                <SortableTh className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" sortKey="method" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort}>Method</SortableTh>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                sortedAttendances.map((attendance) => (
                  <tr key={attendance._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        <UserProfileLink
                          user={getStudent(attendance.studentId)}
                          fallback={getStudentName(attendance.studentId)}
                          className="font-medium"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {getSessionName(attendance.timetableId)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(attendance.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {attendance.checkInTime 
                          ? new Date(attendance.checkInTime).toLocaleString()
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                        {attendance.verificationMethod || 'Manual'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Banner */}
      {filteredAttendances.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Attendance records will appear here once students check in to sessions.
            Students can mark attendance using QR codes or manual check-in.
          </p>
        </div>
      )}
    </div>
  );
}
