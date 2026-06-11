import React, { useState, useEffect, useMemo } from 'react';
import { timetableAPI } from '../../services/api';
import { Calendar, Clock, MapPin, Users, Plus } from 'lucide-react';
import UserProfileLink from '../../components/UserProfileLink';
import SortableTh from '../../components/SortableTh';
import useSortableData from '../../hooks/useSortableData';

export default function TimetablePage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimetable();
  }, []);

  const loadTimetable = async () => {
    try {
      setLoading(true);
      const response = await timetableAPI.getAll();
      setSessions(response.timetable || []);
    } catch (error) {
      console.error('Error loading timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: 'bg-yellow-100 text-yellow-700',
      'in-progress': 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || colors.scheduled;
  };

  const sessionSortAccessors = useMemo(
    () => ({
      date: (session) => `${session.date || ''} ${session.startTime || session.time || ''}`,
      student: (session) => `${session.studentId?.name || ''} ${session.studentId?.matricNumber || ''}`,
      type: (session) => session.sessionType || '',
      venue: (session) => session.venue || '',
      panel: (session) =>
        (session.panelMembers || [])
          .map((panel) => panel?.name || panel?.userId || panel)
          .join(' '),
      status: (session) => session.status || '',
    }),
    [],
  );
  const {
    sortedItems: sortedSessions,
    sortConfig: sessionSortConfig,
    requestSort: requestSessionSort,
  } = useSortableData(sessions, sessionSortAccessors, { key: 'date' });

  return (
    <>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Presentation Schedule</h1>
            <p className="text-gray-600 mt-2">Manage symposium timetable</p>
          </div>
          <button className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Session
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading schedule...</div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No sessions scheduled</p>
            <button className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">
              Schedule First Session
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortableTh className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase" sortKey="date" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Date & Time</SortableTh>
                  <SortableTh className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase" sortKey="student" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Student</SortableTh>
                  <SortableTh className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase" sortKey="type" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Session Type</SortableTh>
                  <SortableTh className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase" sortKey="venue" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Venue</SortableTh>
                  <SortableTh className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase" sortKey="panel" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Panel</SortableTh>
                  <SortableTh className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase" sortKey="status" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Status</SortableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedSessions.map((session) => (
                  <tr key={session._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{session.startTime} - {session.endTime}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        <UserProfileLink
                          user={session.studentId}
                          fallback="N/A"
                          className="font-semibold"
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        {session.studentId?.matricNumber || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {session.sessionType}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {session.venue}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Users className="w-4 h-4 text-gray-400" />
                        {session.panelMembers?.length || 0} members
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
