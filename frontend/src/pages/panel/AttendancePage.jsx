import React, { useState, useEffect, useMemo } from "react";
import { CheckCircle, XCircle, Calendar, Users, Clock } from "lucide-react";
import api from "../../services/api";
import SortableTh from "../../components/SortableTh";
import useSortableData from "../../hooks/useSortableData";

export default function PanelAttendancePage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  const fetchAttendanceHistory = async () => {
    try {
      setLoading(true);
      // Fetch sessions/timetables where this user is involved
      const res = await api.get("/timetables/my");
      // Filter strictly to historical/completed sessions if preferred, or just show all
      const historicalSessions = (
        res.data.data ||
        res.data.timetables ||
        []
      ).sort((a, b) => new Date(b.date) - new Date(a.date));
      setSessions(historicalSessions);
    } catch (error) {
      console.error("Failed to fetch attendance records", error);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceStatusLabel = (session) =>
    session.status === "COMPLETED" || new Date(session.date) < new Date()
      ? "Logged"
      : "Pending";

  const attendanceSortAccessors = useMemo(
    () => ({
      date: (session) => `${session.date || ""} ${session.time || session.startTime || ""}`,
      session: (session) => `${session.sessionType || ""} ${session.venue || ""}`,
      candidate: (session) => `${session.student?.name || ""} ${session.student?.matricNumber || ""}`,
      status: (session) => getAttendanceStatusLabel(session),
    }),
    [],
  );
  const {
    sortedItems: sortedSessions,
    sortConfig: attendanceSortConfig,
    requestSort: requestAttendanceSort,
  } = useSortableData(sessions, attendanceSortAccessors, { key: "date" });

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-bold">
        Loading Attendance Records...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Attendance Records</h1>
        <p className="text-gray-600 mt-1">
          Review historical attendance logs for your scheduled sessions.
        </p>
        <p className="text-sm text-indigo-600 font-semibold mt-2 border border-indigo-100 bg-indigo-50 p-3 rounded-lg inline-block">
          Note: Active Session QR Gateways are generated directly inside the
          individual Session Details page.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                <SortableTh className="p-4 font-bold" sortKey="date" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort}>Date & Time</SortableTh>
                <SortableTh className="p-4 font-bold" sortKey="session" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort}>Session / Venue</SortableTh>
                <SortableTh className="p-4 font-bold" sortKey="candidate" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort}>Candidate</SortableTh>
                <SortableTh className="p-4 font-bold text-center" sortKey="status" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort}>Status</SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-500">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                sortedSessions.map((session) => (
                  <tr
                    key={session._id || session.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-900 font-semibold">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(session.date).toLocaleDateString("en-MY", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                        <Clock className="w-4 h-4" />{" "}
                        {session.time || session.startTime}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-gray-900">
                        {session.sessionType?.replace("_", " ") || "Evaluation"}
                      </p>
                      <p className="text-sm text-gray-500">{session.venue}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-gray-900">
                        {session.student?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500 uppercase">
                        {session.student?.matricNumber}
                      </p>
                    </td>
                    <td className="p-4 text-center">
                      {/* Assuming your backend marks session status or you have an attendance boolean */}
                      {getAttendanceStatusLabel(session) === "Logged" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-bold">
                          <CheckCircle className="w-4 h-4" /> Logged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-xs font-bold">
                          <Clock className="w-4 h-4" /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
