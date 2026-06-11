import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  ExternalLink,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import UserProfileLink from "../../components/UserProfileLink";

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

const getSessionId = (session) => session?._id || session?.id;

const getSessionTitle = (session) =>
  session?.title || SESSION_TYPE_LABELS[session?.sessionType] || "Session";

const getSessionSearchText = (session) =>
  [
    session.title,
    session.sessionType,
    SESSION_TYPE_LABELS[session.sessionType],
    session.batchName,
    session.batchId,
    session.venue,
    session.googleMeetLink,
    ...(session.panels || []).map((panel) => panel?.name || panel?.email || ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const sortSessions = (items = []) =>
  [...items].sort((a, b) => {
    const dateDiff = formatDateKey(a.date).localeCompare(formatDateKey(b.date));
    if (dateDiff !== 0) return dateDiff;
    return String(a.startTime || a.time || "").localeCompare(
      String(b.startTime || b.time || ""),
    );
  });

function SessionCard({ session, compact = false }) {
  const navigate = useNavigate();
  const sessionId = getSessionId(session);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 truncate">
            {getSessionTitle(session)}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {SESSION_TYPE_LABELS[session.sessionType] || session.sessionType || "Session"}
            {session.batchName ? ` · ${session.batchName}` : ""}
          </p>
        </div>
        <button
          onClick={() => navigate(`/student/sessions/${sessionId}`)}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
        >
          View <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className={`grid grid-cols-1 ${compact ? "" : "sm:grid-cols-2"} gap-2 mt-4 text-sm text-gray-700`}
      >
        <span className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          {formatDisplayDate(session.date)}
        </span>
        <span className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <Clock className="w-4 h-4 text-blue-600" />
          {session.startTime || session.time || "TBA"} - {session.endTime || "TBA"}
        </span>
        {(session.venue || session.googleMeetLink) && (
          <span className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 sm:col-span-2 break-all">
            <MapPin className="w-4 h-4 text-red-600 shrink-0" />
            {session.venue || session.googleMeetLink}
          </span>
        )}
      </div>

      {session.panels?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {session.panels.map((panel) => (
            <span
              key={panel?._id || panel?.id || panel?.email || panel}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold"
            >
              <Users className="w-3 h-3" />{" "}
              <UserProfileLink
                user={panel}
                fallback={panel?.email || panel || "Panel"}
                className="font-semibold"
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    formatDateKey(new Date()),
  );

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/timetables/my");
      const sessionsData =
        response.data.timetables ||
        response.data.sessions ||
        response.data.data ||
        [];
      setSessions(sortSessions(sessionsData));
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const todayKey = formatDateKey(new Date());

  const filteredSessions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => getSessionSearchText(session).includes(query));
  }, [sessions, searchTerm]);

  const sessionsByDate = useMemo(() => {
    return filteredSessions.reduce((acc, session) => {
      const key = formatDateKey(session.date);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(session);
      return acc;
    }, {});
  }, [filteredSessions]);

  const selectedDateSessions = sortSessions(sessionsByDate[selectedDateKey] || []);

  const upcomingSessions = useMemo(
    () =>
      sortSessions(
        filteredSessions.filter((session) => formatDateKey(session.date) >= todayKey),
      ),
    [filteredSessions, todayKey],
  );

  const pastSessions = useMemo(
    () =>
      sortSessions(
        filteredSessions.filter((session) => formatDateKey(session.date) < todayKey),
      ).reverse(),
    [filteredSessions, todayKey],
  );

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
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4" />
        <p className="text-gray-600">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h3 className="text-red-900 font-bold mb-2">Error Loading Schedule</h3>
        <p className="text-red-700 text-sm">{error}</p>
        <button
          onClick={fetchSessions}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-gray-600 mt-1">
            View your sessions in the same compact calendar style used by staff.
          </p>
        </div>

        <div className="relative w-full lg:max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sessions, batch, panel, venue..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
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
              <p className="text-[11px] text-gray-500">Tap a date to view sessions</p>
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

        <section className="space-y-4 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-bold text-gray-900">
                Selected Day · {formatDisplayDate(selectedDateKey)}
              </h2>
              <p className="text-xs text-gray-500">
                {selectedDateSessions.length} session(s)
              </p>
            </div>
            <div className="p-4 max-h-[420px] overflow-y-auto space-y-3">
              {selectedDateSessions.length ? (
                selectedDateSessions.map((session) => (
                  <SessionCard key={getSessionId(session)} session={session} compact />
                ))
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <Calendar className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  No sessions on this date.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="font-bold text-gray-900">Upcoming Sessions</h2>
                <p className="text-xs text-gray-500">{upcomingSessions.length} session(s)</p>
              </div>
              <div className="p-4 max-h-[520px] overflow-y-auto space-y-3">
                {upcomingSessions.length ? (
                  upcomingSessions.map((session) => (
                    <SessionCard key={getSessionId(session)} session={session} compact />
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No upcoming sessions.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="font-bold text-gray-900">Past Sessions</h2>
                <p className="text-xs text-gray-500">{pastSessions.length} session(s)</p>
              </div>
              <div className="p-4 max-h-[520px] overflow-y-auto space-y-3">
                {pastSessions.length ? (
                  pastSessions.map((session) => (
                    <SessionCard key={getSessionId(session)} session={session} compact />
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No past sessions.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
