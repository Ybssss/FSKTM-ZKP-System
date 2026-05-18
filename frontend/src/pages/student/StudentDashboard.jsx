import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  analyticsAPI,
  evaluationAPI,
  timetableAPI,
  userAPI,
  attendanceAPI,
} from "../../services/api";
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  MapPin,
} from "lucide-react";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    averageScore: 0,
    upcomingSessions: 0,
    attendanceRate: 0,
  });
  const [recentEvaluations, setRecentEvaluations] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [assignedPanels, setAssignedPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("📊 Loading student dashboard data...");

      // Try to get analytics data first
      try {
        const analyticsResponse = await analyticsAPI.getStudentStats();
        console.log("✅ Analytics response:", analyticsResponse);

        if (analyticsResponse.success && analyticsResponse.stats) {
          setStats(analyticsResponse.stats);
          setRecentEvaluations(analyticsResponse.stats.recentFeedback || []);
        }
      } catch (error) {
        console.log("⚠️ Analytics not available, using fallback method");

        // Fallback: Fetch data manually
        await fetchDataManually();
      }

      // Fetch assigned panels (separate from analytics)
      try {
        const studentResponse = await userAPI.getById(user.id);
        const studentData = studentResponse.user;

        const activePanels =
          studentData.assignedPanels?.filter((assignment) => {
            if (!assignment.endDate) return true;
            return new Date(assignment.endDate) >= new Date();
          }) || [];

        setAssignedPanels(activePanels);
      } catch (error) {
        console.log("Could not fetch assigned panels:", error.message);
      }

      // Fetch upcoming sessions
      try {
        const sessionsResponse = await timetableAPI.getMy();
        const sessions =
          sessionsResponse.timetables ||
          sessionsResponse.sessions ||
          sessionsResponse.data ||
          [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = sessions
          .filter((s) => {
            if (!s.date) return false;
            const sessionDate = new Date(s.date);
            if (Number.isNaN(sessionDate.getTime())) return false;
            sessionDate.setHours(0, 0, 0, 0);
            return sessionDate >= today;
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        setUpcomingSessions(upcoming.slice(0, 5));
      } catch (error) {
        console.log("Could not fetch timetables:", error.message);
      }
      try {
        const attendanceResponse = await attendanceAPI.getMy();
        const records = attendanceResponse.attendances || [];
        const total = records.length;
        const present = records.filter((r) => r.status === "present").length;
        const attendanceRate =
          total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;

        setStats((prev) => ({
          ...prev,
          attendanceRate,
        }));
      } catch (error) {
        console.log("Could not fetch attendance:", error.message);
      }
    } catch (error) {
      console.error("❌ Error fetching dashboard data:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataManually = async () => {
    try {
      // Fetch evaluations manually
      let evaluations = [];
      try {
        const evalResponse = await evaluationAPI.getByStudent(user.id);
        evaluations = evalResponse.evaluations || [];
      } catch (error) {
        try {
          const evalResponse = await evaluationAPI.getAll();
          evaluations = (evalResponse.evaluations || []).filter(
            (e) => e.studentId === user.id || e.studentId?._id === user.id,
          );
        } catch (error2) {
          console.log("Could not fetch evaluations");
        }
      }

      const submittedEvals = evaluations.filter(
        (e) => e.status === "submitted",
      );
      const avgScore =
        submittedEvals.length > 0
          ? submittedEvals.reduce((sum, e) => sum + (e.overallScore || 0), 0) /
            submittedEvals.length
          : 0;

      setStats((prev) => ({
        ...prev,
        totalEvaluations: submittedEvals.length,
        averageScore: avgScore.toFixed(1),
      }));

      setRecentEvaluations(submittedEvals.slice(0, 3));
    } catch (error) {
      console.error("Error in manual fetch:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startOffset = firstDayOfMonth.getDay();

  const sessionsByDay = upcomingSessions.reduce((acc, session) => {
    if (!session.date) return acc;

    const sessionDate = new Date(session.date);
    if (Number.isNaN(sessionDate.getTime())) return acc;

    if (
      sessionDate.getMonth() === currentMonth &&
      sessionDate.getFullYear() === currentYear
    ) {
      const day = sessionDate.getDate();
      acc[day] = (acc[day] || 0) + 1;
    }

    return acc;
  }, {});

  const calendarCells = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              Unable to load some data
            </p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Upcoming Sessions ONLY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 lg:col-span-1">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" /> This Month
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {today.toLocaleDateString("en-MY", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, index) => {
                const isToday = day === today.getDate();
                const hasSession = day && sessionsByDay[day];

                return (
                  <div
                    key={index}
                    className={`h-10 rounded-lg flex flex-col items-center justify-center text-sm border ${
                      !day
                        ? "border-transparent"
                        : isToday
                          ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                          : hasSession
                            ? "bg-green-50 text-green-700 border-green-200 font-bold"
                            : "bg-white text-gray-700 border-gray-100"
                    }`}
                  >
                    {day && <span>{day}</span>}
                    {hasSession && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                          isToday ? "bg-white" : "bg-green-500"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Green dates indicate scheduled upcoming sessions.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> Upcoming Sessions
            </h2>
          </div>

          <div className="p-6">
            {upcomingSessions.length > 0 ? (
              <div className="space-y-4">
                {upcomingSessions.map((session) => (
                  <div
                    key={session._id}
                    className="p-5 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-bold text-gray-900 text-lg">
                      {session.title ||
                        session.sessionType?.replaceAll("_", " ")}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1 font-medium bg-gray-100 px-3 py-1 rounded-full">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        {new Date(session.date).toLocaleDateString("en-MY", {
                          weekday: "short",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>

                      <span className="flex items-center gap-1 font-medium bg-gray-100 px-3 py-1 rounded-full">
                        <Clock className="w-4 h-4 text-blue-500" />
                        {session.startTime || session.time || "Time TBA"}
                      </span>

                      {session.venue && (
                        <span className="flex items-center gap-1 font-medium bg-gray-100 px-3 py-1 rounded-full">
                          <MapPin className="w-4 h-4 text-red-500" />
                          {session.venue}
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <a
                        href={`/student/sessions/${session._id}`}
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
                      >
                        View Session Details
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">
                  No upcoming scheduled sessions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions (Removed Progress) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/student/reports"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
          >
            <div className="p-3 bg-indigo-100 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900">Official Feedback</div>
              <div className="text-sm text-gray-500">
                View your completed evaluations
              </div>
            </div>
          </a>
          <a
            href="/student/schedule"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
          >
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900">Full Schedule</div>
              <div className="text-sm text-gray-500">
                View past and future timetables
              </div>
            </div>
          </a>
          <a
            href="/student/attendance"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
          >
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900">Attendance</div>
              <div className="text-sm text-gray-500">
                Mark attendance or view attendance history
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
