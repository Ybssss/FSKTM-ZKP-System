import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Calendar, Clock, FileText, MapPin } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import UserProfileLink from "../../components/UserProfileLink";

const dateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const parseEndDateTime = (session) => {
  const key = dateKey(session.schedule?.date || session.date);
  const end = session.endTime || session.schedule?.endTime || session.startTime || session.time || "23:59";
  const dt = new Date(`${key}T${end}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const getStudent = (session) => session.student || session.students?.[0] || null;

export default function PanelDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [sessions, setSessions] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionRes = await api.get(isAdmin ? "/timetables" : "/timetables/my");
      const loadedSessions = sessionRes.data?.timetables || sessionRes.data?.data || sessionRes.data?.sessions || [];
      setSessions(loadedSessions);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError(err.response?.data?.message || err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const upcomingSessions = useMemo(() => {
    const now = new Date();
    return sessions
      .filter((session) => {
        const end = parseEndDateTime(session);
        return end && end >= now && session.status !== "cancelled";
      })
      .sort((a, b) => parseEndDateTime(a) - parseEndDateTime(b));
  }, [sessions]);

  const sessionsByDate = useMemo(() => {
    const map = new Map();
    upcomingSessions.forEach((session) => {
      const key = dateKey(session.schedule?.date || session.date);
      if (!key) return;
      map.set(key, [...(map.get(key) || []), session]);
    });
    return map;
  }, [upcomingSessions]);

  const selectedSessions = sessionsByDate.get(selectedDate) || [];

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let day = 1; day <= days; day += 1) cells.push(new Date(year, month, day));
    return cells;
  }, [calendarMonth]);

  const openSessionAction = (session) => {
    const sessionId = session._id || session.id;
    navigate(`/panel/sessions/${sessionId}`);
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500 font-semibold">Loading dashboard...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
        <p className="text-gray-600 mt-2">Here is what is happening soon.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div><p className="font-bold text-red-800">Unable to load dashboard</p><p className="text-sm text-red-700">{error}</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
            <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="px-2 py-1 border rounded">←</button>
            <div className="text-center">
              <h2 className="font-bold text-gray-900">{calendarMonth.toLocaleDateString("en-MY", { month: "long", year: "numeric" })}</h2>
              <p className="text-xs text-gray-500">Compact Calendar</p>
            </div>
            <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="px-2 py-1 border rounded">→</button>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-500 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="h-11" />;
                const key = dateKey(day);
                const count = sessionsByDate.get(key)?.length || 0;
                const isToday = key === dateKey(new Date());
                const isSelected = key === selectedDate;
                return (
                  <button key={key} onClick={() => setSelectedDate(key)} className={`h-11 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center ${isSelected ? "bg-indigo-600 text-white border-indigo-600" : isToday ? "bg-indigo-50 text-indigo-700 border-indigo-200" : count ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-gray-700 border-gray-100"}`}>
                    <span>{day.getDate()}</span>
                    {count > 0 && <span className={`mt-0.5 rounded-full px-1.5 text-[10px] ${isSelected ? "bg-white text-indigo-700" : "bg-green-600 text-white"}`}>{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <div>
              <h2 className="font-bold text-gray-900">Selected Day Sessions</h2>
              <p className="text-sm text-gray-500">{selectedDate}</p>
            </div>
            <Link to="/panel/sessions" className="text-sm text-indigo-700 font-bold flex gap-1 items-center">Session Management <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <div className="p-4 max-h-[360px] overflow-y-auto space-y-3">
            {selectedSessions.length === 0 && <p className="text-center text-gray-500 py-10">No upcoming sessions on this date.</p>}
            {selectedSessions.map((session) => {
              const student = getStudent(session);
              const sessionId = session._id || session.id;
              return (
                <div key={sessionId} className="p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition bg-white">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900">{session.title || session.sessionType?.replaceAll("_", " ")}</h3>
                      <p className="text-sm font-semibold">
                        <UserProfileLink
                          user={student}
                          fallback="Student TBA"
                          className="font-semibold"
                        />
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-600">
                        <span className="px-2 py-1 bg-gray-100 rounded-full flex gap-1 items-center"><Clock className="w-3 h-3" />{session.startTime || session.time} - {session.endTime || ""}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-full flex gap-1 items-center"><MapPin className="w-3 h-3" />{session.venue || session.googleMeetLink || "Online"}</span>
                      </div>
                    </div>
                    <button onClick={() => openSessionAction(session)} className="px-4 py-2 rounded-lg text-white font-bold text-sm bg-gray-700">{isAdmin ? "Manage" : "View"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-600" /> Upcoming Sessions</h2>
          <span className="text-sm text-gray-500">Next {Math.min(6, upcomingSessions.length)}</span>
        </div>
        <div className="divide-y divide-gray-100">
          {upcomingSessions.slice(0, 6).map((session) => {
            const student = getStudent(session);
            const sessionId = session._id || session.id;
            return (
              <div key={sessionId} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-gray-50">
                <div>
                  <h3 className="font-bold text-gray-900 flex gap-2 items-center"><FileText className="w-4 h-4 text-indigo-500" />{session.title || session.sessionType?.replaceAll("_", " ")}</h3>
                  <p className="text-sm">
                    <UserProfileLink
                      user={student}
                      fallback="Student TBA"
                      className="font-semibold"
                    />
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-600">
                    <span>{dateKey(session.date)}</span><span>{session.startTime || session.time}</span><span>{session.venue || session.googleMeetLink || "Online"}</span>
                  </div>
                </div>
                <button onClick={() => openSessionAction(session)} className="px-4 py-2 rounded-lg text-white font-bold text-sm bg-gray-700">{isAdmin ? "Manage" : "View"}</button>
              </div>
            );
          })}
          {upcomingSessions.length === 0 && <div className="p-12 text-center text-gray-500">No upcoming sessions.</div>}
        </div>
      </div>
    </div>
  );
}
