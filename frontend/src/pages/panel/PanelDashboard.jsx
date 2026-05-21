import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  AlertCircle,
  ArrowRight,
  FileText,
  Settings,
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
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    loadData();
  }, []);

  const normalizeDateKey = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toISOString().slice(0, 10);
  };

  const getSessionDate = (session) =>
    session.schedule?.date || session.date || session.startDate || "";

  const getSessionTime = (session) =>
    session.schedule?.time || session.time || session.startTime || "";

  const getStudentName = (session) => {
    const student = session.student || session.students?.[0];
    return student?.name || student?.userId || "Student TBA";
  };

  const getSessionTitle = (session) =>
    session.title || session.rubric || session.sessionType?.replaceAll("_", " ") || "Session";

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      let allSessions = [];

      try {
        const myResponse = await api.get("/timetables/my");
        allSessions =
          myResponse.data?.data ||
          myResponse.data?.sessions ||
          myResponse.data?.timetables ||
          [];
      } catch (myError) {
        if (!isAdmin) throw myError;
      }

      if (isAdmin && allSessions.length === 0) {
        const adminResponse = await api.get("/timetables");
        allSessions =
          adminResponse.data?.data ||
          adminResponse.data?.sessions ||
          adminResponse.data?.timetables ||
          [];
      }

      allSessions = [...allSessions].sort((a, b) => {
        const dateA = new Date(`${normalizeDateKey(getSessionDate(a))}T${getSessionTime(a) || "00:00"}`);
        const dateB = new Date(`${normalizeDateKey(getSessionDate(b))}T${getSessionTime(b) || "00:00"}`);
        return dateA - dateB;
      });

      setSessions(allSessions);
    } catch (error) {
      console.error("❌ Error loading dashboard:", error);
      setError(
        error.response?.data?.message || error.message || "Failed to load sessions",
      );
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const sessionsByDate = useMemo(() => {
    const grouped = {};
    sessions.forEach((session) => {
      const key = normalizeDateKey(getSessionDate(session));
      if (!key) return;
      grouped[key] = grouped[key] || [];
      grouped[key].push(session);
    });
    return grouped;
  }, [sessions]);

  const upcomingSessions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sessions
      .filter((session) => {
        const dateKey = normalizeDateKey(getSessionDate(session));
        if (!dateKey) return false;
        return new Date(`${dateKey}T00:00`) >= today;
      })
      .slice(0, 6);
  }, [sessions]);

  const selectedDateSessions = sessionsByDate[selectedDate] || [];

  const monthLabel = calendarMonth.toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });

  const monthDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    const startOffset = firstDay.getDay();
    for (let i = 0; i < startOffset; i += 1) days.push(null);

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      days.push(new Date(year, month, day));
    }

    while (days.length % 7 !== 0) days.push(null);

    return days;
  }, [calendarMonth]);

  const changeMonth = (offset) => {
    setCalendarMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1),
    );
  };

  const renderSessionCard = (session) => {
    const sessionId = session.id || session._id;
    const dateKey = normalizeDateKey(getSessionDate(session));

    return (
      <div
        key={sessionId}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
              {getSessionTitle(session)}
            </h3>
            <p className="text-xs font-semibold text-indigo-700 mt-1">
              {getStudentName(session)}
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-2">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {dateKey || "No date"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {getSessionTime(session) || "No time"}
              </span>
              {(session.schedule?.venue || session.venue || session.googleMeetLink) && (
                <span className="inline-flex items-center gap-1 max-w-full truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {session.schedule?.venue || session.venue || session.googleMeetLink}
                  </span>
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() =>
              isAdmin
                ? navigate(`/panel/sessions/${sessionId}`)
                : navigate(`/panel/evaluation?sessionId=${sessionId}`)
            }
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold w-full sm:w-auto ${
              isAdmin
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {isAdmin ? <Settings className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            {isAdmin ? "Manage" : "Evaluate"}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">
          Compact calendar and upcoming evaluation sessions.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">Unable to Load Sessions</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4 items-start">
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 w-full xl:max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-extrabold text-gray-900">{monthLabel}</h2>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-500 uppercase mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((date, index) => {
              if (!date) return <div key={`blank-${index}`} className="h-11" />;

              const dateKey = date.toISOString().slice(0, 10);
              const count = sessionsByDate[dateKey]?.length || 0;
              const isSelected = dateKey === selectedDate;
              const isToday = dateKey === new Date().toISOString().slice(0, 10);

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDate(dateKey)}
                  className={`h-11 rounded-lg border text-xs font-bold flex flex-col items-center justify-center transition-colors ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : isToday
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{date.getDate()}</span>
                  {count > 0 && (
                    <span
                      className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] leading-none ${
                        isSelected ? "bg-white text-indigo-700" : "bg-indigo-600 text-white"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Selected Day</h2>
              <p className="text-sm text-gray-500">{selectedDate}</p>
            </div>
            <Link
              to="/panel/sessions"
              className="text-sm text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1 bg-indigo-50 px-3 py-2 rounded-lg w-full sm:w-auto justify-center"
            >
              Session Management <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {selectedDateSessions.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-600">No sessions on this day.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {selectedDateSessions.map(renderSessionCard)}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Upcoming Sessions</h2>
          <span className="text-xs font-bold text-gray-500">Next {upcomingSessions.length}</span>
        </div>

        {upcomingSessions.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Your schedule is clear.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {upcomingSessions.map(renderSessionCard)}
          </div>
        )}
      </section>
    </div>
  );
}
