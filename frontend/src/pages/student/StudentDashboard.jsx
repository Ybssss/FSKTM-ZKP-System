import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api, { analyticsAPI, attendanceAPI, timetableAPI } from "../../services/api";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
} from "lucide-react";

const SESSION_TYPE_LABELS = {
  PROPOSAL_DEFENSE: "Proposal Defense",
  PROGRESS_ASSESSMENT: "Progress Assessment",
  PRE_VIVA: "Pre-Viva",
};

const formatDateKey = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

const parseLocalDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatDisplayDate = (value) => {
  const date = parseLocalDateKey(formatDateKey(value));
  if (!date) return "Date TBA";
  return date.toLocaleDateString("en-MY", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const sortSessions = (items = []) =>
  [...items].sort((a, b) => {
    const dateDiff = formatDateKey(a.date).localeCompare(formatDateKey(b.date));
    if (dateDiff !== 0) return dateDiff;
    return String(a.startTime || a.time || "").localeCompare(
      String(b.startTime || b.time || ""),
    );
  });

function CompactSessionCard({ session }) {
  return (
    <a
      href={`/student/sessions/${session._id || session.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <h3 className="font-bold text-gray-900 truncate">
        {session.title || SESSION_TYPE_LABELS[session.sessionType] || "Session"}
      </h3>
      <p className="text-xs text-gray-500 mt-1">
        {SESSION_TYPE_LABELS[session.sessionType] || session.sessionType || "Session"}
        {session.batchName ? ` · ${session.batchName}` : ""}
      </p>

      <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-semibold">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          {formatDisplayDate(session.date)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-semibold">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          {session.startTime || session.time || "TBA"}
        </span>
        {(session.venue || session.googleMeetLink) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-semibold max-w-full break-all">
            <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
            {session.venue || session.googleMeetLink}
          </span>
        )}
      </div>
    </a>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    upcomingSessions: 0,
    attendanceRate: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(new Date()));

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      try {
        const analyticsResponse = await analyticsAPI.getStudentStats();
        if (analyticsResponse.success && analyticsResponse.stats) {
          setStats((prev) => ({ ...prev, ...analyticsResponse.stats }));
        }
      } catch (_) {
        try {
          const evalResponse = await api.get("/evaluations");
          const evaluations = evalResponse.data?.evaluations || evalResponse.data?.data || [];
          const myCompleted = evaluations.filter((evaluation) => {
            const studentId = evaluation.studentId?._id || evaluation.studentId;
            return String(studentId) === String(user?.id) && evaluation.status === "COMPLETED";
          });
          setStats((prev) => ({
            ...prev,
            totalEvaluations: myCompleted.length,
          }));
        } catch (_) {
          // Keep default stats.
        }
      }

      try {
        const sessionsResponse = await timetableAPI.getMy();
        const sessions =
          sessionsResponse.timetables ||
          sessionsResponse.sessions ||
          sessionsResponse.data ||
          [];
        const todayKey = formatDateKey(new Date());
        const upcoming = sortSessions(
          sessions.filter((session) => formatDateKey(session.date) >= todayKey),
        );
        setUpcomingSessions(upcoming);
        setStats((prev) => ({ ...prev, upcomingSessions: upcoming.length }));
      } catch (error) {
        console.log("Could not fetch timetables:", error.message);
      }

      try {
        const attendanceResponse = await attendanceAPI.getMy();
        const records = attendanceResponse.attendances || [];
        const total = records.length;
        const present = records.filter((record) => record.status === "present").length;
        const attendanceRate =
          total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;
        setStats((prev) => ({ ...prev, attendanceRate }));
      } catch (error) {
        console.log("Could not fetch attendance:", error.message);
      }
    } catch (error) {
      console.error("❌ Error fetching dashboard data:", error);
      setError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const todayKey = formatDateKey(new Date());

  const sessionsByDate = useMemo(() => {
    return upcomingSessions.reduce((acc, session) => {
      const key = formatDateKey(session.date);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(session);
      return acc;
    }, {});
  }, [upcomingSessions]);

  const selectedDateSessions = sortSessions(sessionsByDate[selectedDateKey] || []);

  const monthYear = calendarMonth.getFullYear();
  const monthIndex = calendarMonth.getMonth();
  const firstDay = new Date(monthYear, monthIndex, 1);
  const daysInMonth = new Date(monthYear, monthIndex + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const calendarCells = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const goMonth = (offset) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">Unable to load some data</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase">Evaluations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalEvaluations || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase">Upcoming</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{upcomingSessions.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase">Attendance</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.attendanceRate || 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit max-w-sm w-full">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <h2 className="font-bold text-gray-900">
                {calendarMonth.toLocaleDateString("en-MY", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <p className="text-[11px] text-gray-500">Your scheduled sessions</p>
            </div>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-500 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, index) => {
                const key = day
                  ? `${monthYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  : "";
                const count = key ? sessionsByDate[key]?.length || 0 : 0;
                const isToday = key === todayKey;
                const isSelected = key === selectedDateKey;

                return (
                  <button
                    key={`${key || 'empty'}-${index}`}
                    type="button"
                    disabled={!day}
                    onClick={() => day && setSelectedDateKey(key)}
                    className={`h-12 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center transition-colors ${
                      !day
                        ? "border-transparent bg-transparent cursor-default"
                        : isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : isToday
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : count > 0
                              ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {day && <span>{day}</span>}
                    {count > 0 && (
                      <span
                        className={`mt-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                          isSelected ? "bg-white text-indigo-700" : "bg-green-600 text-white"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-bold text-gray-900">Selected Day</h2>
              <p className="text-xs text-gray-500">
                {formatDisplayDate(selectedDateKey)} · {selectedDateSessions.length} session(s)
              </p>
            </div>
            <div className="p-4 max-h-[430px] overflow-y-auto space-y-3">
              {selectedDateSessions.length ? (
                selectedDateSessions.map((session) => (
                  <CompactSessionCard key={session._id || session.id} session={session} />
                ))
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <Calendar className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  No sessions on this date.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-bold text-gray-900">Upcoming Sessions</h2>
              <p className="text-xs text-gray-500">{upcomingSessions.length} session(s)</p>
            </div>
            <div className="p-4 max-h-[430px] overflow-y-auto space-y-3">
              {upcomingSessions.length ? (
                upcomingSessions.slice(0, 8).map((session) => (
                  <CompactSessionCard key={session._id || session.id} session={session} />
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">No upcoming scheduled sessions.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/student/reports" className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900">Official Feedback</div>
              <div className="text-sm text-gray-500">View completed evaluations</div>
            </div>
          </a>
          <a href="/student/schedule" className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900">Full Schedule</div>
              <div className="text-sm text-gray-500">Calendar and all sessions</div>
            </div>
          </a>
          <a href="/student/attendance" className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900">Attendance</div>
              <div className="text-sm text-gray-500">Mark or view attendance</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
