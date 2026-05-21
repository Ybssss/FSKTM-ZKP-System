import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, Clock, FileText, MapPin, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function PanelDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [sessions, setSessions] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get("/timetables/my");
      const allSessions = response.data?.data || response.data?.sessions || response.data?.timetables || [];

      const sorted = [...allSessions].sort((a, b) => {
        const dateA = new Date(`${a.schedule?.date || a.date}T${a.startTime || a.time || "00:00"}`);
        const dateB = new Date(`${b.schedule?.date || b.date}T${b.startTime || b.time || "00:00"}`);
        return dateA - dateB;
      });

      setSessions(sorted);
    } catch (error) {
      console.error("❌ Error loading dashboard:", error);
      setError(error.response?.data?.message || error.message || "Failed to load sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const getSessionDate = (session) => session.schedule?.date || session.date;
  const getStudentName = (session) =>
    session.student?.name || session.students?.[0]?.name || session.title || "Session";

  const formatDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  };

  const todayKey = formatDateKey(new Date());

  const upcomingSessions = useMemo(() => {
    return sessions
      .filter((session) => formatDateKey(getSessionDate(session)) >= todayKey)
      .slice(0, 8);
  }, [sessions, todayKey]);

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const firstWeekday = monthStart.getDay();
  const calendarCells = [];

  for (let i = 0; i < firstWeekday; i += 1) calendarCells.push(null);
  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    calendarCells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
  }

  const sessionsByDay = useMemo(() => {
    const map = new Map();
    sessions.forEach((session) => {
      const key = formatDateKey(getSessionDate(session));
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(session);
    });
    return map;
  }, [sessions]);

  const moveMonth = (offset) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
            <div className="h-8 bg-gray-200 rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-1 sm:px-0">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Here is your schedule calendar and upcoming evaluation work.</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => navigate("/panel/sessions")}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" /> Manage Sessions
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Unable to Load Sessions</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
            <button onClick={loadData} className="mt-2 text-xs font-bold text-red-700 underline">Retry</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase">Total Sessions</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{sessions.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase">Upcoming</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{upcomingSessions.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase">This Month</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {[...sessionsByDay.entries()].filter(([key]) => key.startsWith(calendarMonth.toISOString().slice(0, 7))).reduce((total, [, list]) => total + list.length, 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50">
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-600" /> Calendar</h2>
              <p className="text-xs text-gray-500 font-semibold">Tap a session from the list below to open details.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => moveMonth(-1)} className="px-3 py-1 rounded-lg bg-white border font-bold text-sm">Prev</button>
              <p className="min-w-[150px] text-center font-bold text-sm">
                {calendarMonth.toLocaleDateString("en-MY", { month: "long", year: "numeric" })}
              </p>
              <button onClick={() => moveMonth(1)} className="px-3 py-1 rounded-lg bg-white border font-bold text-sm">Next</button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] sm:text-xs font-bold text-gray-500 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-2 border-r last:border-r-0">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarCells.map((date, index) => {
              const key = date ? formatDateKey(date) : `empty-${index}`;
              const daySessions = date ? sessionsByDay.get(key) || [] : [];
              const isToday = key === todayKey;

              return (
                <div key={key} className={`min-h-[76px] sm:min-h-[110px] border-r border-b last:border-r-0 p-1 sm:p-2 ${isToday ? "bg-indigo-50" : "bg-white"}`}>
                  {date && (
                    <>
                      <p className={`text-xs font-bold ${isToday ? "text-indigo-700" : "text-gray-700"}`}>{date.getDate()}</p>
                      <div className="mt-1 space-y-1">
                        {daySessions.slice(0, 3).map((session) => (
                          <Link key={session._id || session.id} to={`/panel/sessions/${session._id || session.id}`} className="block rounded bg-indigo-100 text-indigo-800 text-[10px] sm:text-xs px-1 py-0.5 font-semibold truncate">
                            {session.startTime || session.time || ""} {getStudentName(session)}
                          </Link>
                        ))}
                        {daySessions.length > 3 && <p className="text-[10px] text-gray-500 font-bold">+{daySessions.length - 3} more</p>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="font-bold text-gray-900">Upcoming Sessions</h2>
            <p className="text-xs text-gray-500 font-semibold">Compact mobile-friendly list.</p>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
            {upcomingSessions.length === 0 ? (
              <div className="p-8 text-center text-gray-500 font-semibold">No upcoming sessions.</div>
            ) : (
              upcomingSessions.map((session) => (
                <Link key={session._id || session.id} to={`/panel/sessions/${session._id || session.id}`} className="block p-4 hover:bg-gray-50">
                  <p className="font-bold text-gray-900 text-sm">{getStudentName(session)}</p>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <p className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {new Date(getSessionDate(session)).toLocaleDateString("en-MY")}</p>
                    <p className="flex items-center gap-2"><Clock className="w-4 h-4" /> {session.startTime || session.time || "-"} - {session.endTime || "-"}</p>
                    <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {session.venue || session.googleMeetLink || "-"}</p>
                    <p className="flex items-center gap-2"><FileText className="w-4 h-4" /> {session.sessionType || "Session"}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
