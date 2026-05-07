import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Calendar, MapPin, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../services/api"; // 👈 Make sure this uses your base API instance

export default function PanelDashboard() {
  const { user } = useAuth();
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch user's sessions using your existing timetable route
      const response = await api.get("/timetables/my");

      // Handle the data structure (whether the backend sends .data or .sessions)
      const allSessions = response.data?.data || response.data?.sessions || [];

      // 2. Filter for upcoming sessions
      const now = new Date();
      // Set to midnight so today's sessions don't disappear if the time has passed
      now.setHours(0, 0, 0, 0);

      const upcoming = allSessions
        .filter((session) => {
          // Look for 'date' or inside the 'schedule' object depending on your backend
          const sessionDateStr = session.schedule?.date || session.date;
          if (!sessionDateStr) return false;

          const sessionDate = new Date(sessionDateStr);
          return sessionDate >= now;
        })
        .sort((a, b) => {
          const dateA = new Date(a.schedule?.date || a.date);
          const dateB = new Date(b.schedule?.date || b.date);
          return dateA - dateB;
        });

      setUpcomingSessions(upcoming);
    } catch (error) {
      console.error("❌ Error loading dashboard:", error);
      setError(error.message || "Failed to load upcoming sessions");
      setUpcomingSessions([]);
    } finally {
      setLoading(false);
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
            <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600 mt-2">Your upcoming sessions</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              Unable to Load Sessions
            </p>
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

      {/* Upcoming Sessions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Upcoming Sessions
          </h2>
          <Link
            to="/panel/sessions"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {upcomingSessions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No upcoming sessions</p>
            <p className="text-sm text-gray-500">
              Check back later for scheduled sessions
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingSessions.slice(0, 5).map((session) => (
              <div
                key={session.id || session._id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {session.rubric || session.sessionType?.replace("_", " ")}
                    </h3>
                    <p className="text-sm font-bold text-indigo-700 mt-1">
                      Student: {session.student?.name || "TBD"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      {new Date(
                        session.schedule?.date || session.date,
                      ).toLocaleDateString("en-MY", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{session.schedule?.time || session.time}</span>
                  </div>
                  {(session.schedule?.venue || session.venue) && (
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{session.schedule?.venue || session.venue}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
