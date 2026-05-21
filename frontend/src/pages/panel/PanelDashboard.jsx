import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  MapPin,
  Settings,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";

export default function PanelDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    loadData();
  }, []);

  const getDateOnly = (session) => {
    const raw = session?.schedule?.date || session?.date || "";
    if (!raw) return "";
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return String(raw).slice(0, 10);
  };

  const getStartTime = (session) =>
    session?.schedule?.time || session?.time || session?.startTime || "";

  const getEndTime = (session) => session?.endTime || "";

  const getStudentName = (session) => {
    const student = session?.student || session?.students?.[0];
    return student?.name || student?.userId || "Student not loaded";
  };

  const getSessionTitle = (session) =>
    session?.title ||
    session?.rubric?.name ||
    String(session?.sessionType || "Session").replaceAll("_", " ");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get("/timetables/my");
      const allSessions =
        response.data?.data || response.data?.sessions || response.data?.timetables || [];

      setSessions(allSessions);
    } catch (error) {
      console.error("❌ Error loading dashboard:", error);
      setError(error.response?.data?.message || error.message || "Failed to load sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const upcomingSessions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sessions
      .filter((session) => {
        const dateOnly = getDateOnly(session);
        if (!dateOnly) return false;
        const date = new Date(`${dateOnly}T00:00:00`);
        return date >= today && String(session.status || "").toLowerCase() !== "cancelled";
      })
      .sort((a, b) => {
        const dateDiff = new Date(getDateOnly(a)) - new Date(getDateOnly(b));
        if (dateDiff !== 0) return dateDiff;
        return String(getStartTime(a)).localeCompare(String(getStartTime(b)));
      });
  }, [sessions]);

  const monthLabel = calendarMonth.toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const dateOnly = date.toISOString().slice(0, 10);
      return {
        date,
        dateOnly,
        inCurrentMonth: date.getMonth() === month,
        isToday: dateOnly === new Date().toISOString().slice(0, 10),
      };
    });
  }, [calendarMonth]);

  const sessionsByDate = useMemo(() => {
    const grouped = new Map();
    sessions.forEach((session) => {
      const dateOnly = getDateOnly(session);
      if (!dateOnly) return;
      if (!grouped.has(dateOnly)) grouped.set(dateOnly, []);
      grouped.get(dateOnly).push(session);
    });

    grouped.forEach((items) => {
      items.sort((a, b) => String(getStartTime(a)).localeCompare(String(getStartTime(b))));
    });

    return grouped;
  }, [sessions]);

  const shiftMonth = (direction) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const goToSession = (session) => {
    const sessionId = session?._id || session?.id;
    if (!sessionId) return;

    if (isAdmin) {
      navigate(`/panel/sessions/${sessionId}`);
    } else {
      navigate(`/panel/evaluation?sessionId=${sessionId}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
            <div className="h-8 bg-gray-200 rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600 mt-2">Here is your session calendar and upcoming work.</p>
        </div>
        <Link
          to="/panel/sessions"
          className="inline-flex items-center justify-center gap-1 text-sm text-indigo-700 hover:text-indigo-900 font-bold bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100"
        >
          Open Session Management <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Unable to Load Sessions</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
            <button
              onClick={loadData}
              className="mt-2 text-xs text-red-700 underline hover:text-red-800"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" /> Calendar
            </h2>
            <p className="text-xs text-gray-500 mt-1">Admin sees all sessions; panels see assigned sessions.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-2 rounded-lg border bg-white hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-[150px] text-center font-bold text-gray-900">{monthLabel}</div>
            <button
              onClick={() => shiftMonth(1)}
              className="p-2 rounded-lg border bg-white hover:bg-gray-50"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-7 bg-gray-100 text-[11px] font-bold uppercase text-gray-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        <div className="hidden md:grid grid-cols-7 border-t border-gray-200">
          {calendarDays.map((day) => {
            const daySessions = sessionsByDate.get(day.dateOnly) || [];
            return (
              <div
                key={day.dateOnly}
                className={`min-h-[130px] p-2 border-r border-b border-gray-200 last:border-r-0 ${
                  day.inCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"
                } ${day.isToday ? "ring-2 ring-inset ring-indigo-300" : ""}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold">{day.date.getDate()}</span>
                  {daySessions.length > 0 && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold rounded-full px-2 py-0.5">
                      {daySessions.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1 max-h-[90px] overflow-y-auto pr-1">
                  {daySessions.slice(0, 4).map((session) => (
                    <button
                      key={session._id || session.id}
                      onClick={() => goToSession(session)}
                      className="w-full text-left rounded bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 p-1.5"
                    >
                      <p className="text-[11px] font-bold text-indigo-900 truncate">
                        {getStartTime(session)} {getSessionTitle(session)}
                      </p>
                      <p className="text-[10px] text-indigo-700 truncate">{getStudentName(session)}</p>
                    </button>
                  ))}
                  {daySessions.length > 4 && (
                    <p className="text-[10px] text-gray-500 font-bold">+{daySessions.length - 4} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="md:hidden divide-y divide-gray-100 max-h-[460px] overflow-y-auto">
          {calendarDays
            .filter((day) => day.inCurrentMonth && (sessionsByDate.get(day.dateOnly) || []).length > 0)
            .map((day) => (
              <div key={day.dateOnly} className="p-3">
                <p className="font-bold text-sm text-gray-900 mb-2">
                  {day.date.toLocaleDateString("en-MY", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <div className="space-y-2">
                  {(sessionsByDate.get(day.dateOnly) || []).map((session) => (
                    <button
                      key={session._id || session.id}
                      onClick={() => goToSession(session)}
                      className="w-full text-left rounded-lg bg-indigo-50 border border-indigo-100 p-3"
                    >
                      <p className="font-bold text-indigo-900 text-sm">{getSessionTitle(session)}</p>
                      <p className="text-xs text-indigo-700 mt-1">
                        {getStartTime(session)}{getEndTime(session) ? ` - ${getEndTime(session)}` : ""} · {getStudentName(session)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          {calendarDays.every((day) => !day.inCurrentMonth || (sessionsByDate.get(day.dateOnly) || []).length === 0) && (
            <div className="p-8 text-center text-gray-500 font-semibold">No sessions in this month.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Upcoming Sessions</h2>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {upcomingSessions.length} upcoming
          </span>
        </div>

        {upcomingSessions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Your schedule is clear.</p>
            <p className="text-sm text-gray-500 mt-1">No upcoming sessions assigned at the moment.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {upcomingSessions.slice(0, 12).map((session) => {
              const sessionId = session.id || session._id;
              return (
                <div
                  key={sessionId}
                  className="p-4 sm:p-5 border border-gray-200 rounded-xl hover:shadow-md hover:border-indigo-300 transition-all bg-white flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                        {getSessionTitle(session)}
                      </h3>
                      <span className="bg-green-100 text-green-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                        Upcoming
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-indigo-700 mb-3 bg-indigo-50 inline-block px-2 py-1 rounded">
                      <Users className="w-3 h-3 inline mr-1" /> {getStudentName(session)}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">
                          {new Date(`${getDateOnly(session)}T00:00:00`).toLocaleDateString("en-MY", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">
                          {getStartTime(session)}{getEndTime(session) ? ` - ${getEndTime(session)}` : ""}
                        </span>
                      </div>
                      {(session.schedule?.venue || session.venue) && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate">{session.schedule?.venue || session.venue}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 md:border-l md:pl-4 pt-4 md:pt-0 border-t md:border-t-0">
                    {isAdmin ? (
                      <button
                        onClick={() => navigate(`/panel/sessions/${sessionId}`)}
                        className="flex items-center justify-center gap-2 w-full md:w-auto px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4" /> Manage Session
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/panel/evaluation?sessionId=${sessionId}`)}
                        className="flex items-center justify-center gap-2 w-full md:w-auto px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-lg shadow-sm transition-colors"
                      >
                        <FileText className="w-4 h-4" /> Evaluate Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
