import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Calendar, MapPin, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { timetableAPI } from "../../services/api";

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

      console.log("📅 Loading upcoming sessions...");

      // Fetch user's sessions
      const response = await timetableAPI.getMy();

      console.log("✅ Sessions response:", response);

      if (response.success && response.data) {
        // Filter for upcoming sessions (date >= today)
        const now = new Date();
        const upcoming = response.data
          .filter((session) => {
            const sessionDate = new Date(session.date);
            return sessionDate >= now;
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        setUpcomingSessions(upcoming);
        console.log("✅ Dashboard data loaded successfully");
      } else {
        throw new Error("Invalid response from sessions API");
      }
    } catch (error) {
      console.error("❌ Error loading dashboard:", error);
      setError(error.message);
      setUpcomingSessions([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
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
            View all
            <ArrowRight className="w-4 h-4" />
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
                key={session._id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {session.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {session.sessionType}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      {new Date(session.date).toLocaleDateString("en-MY", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>
                      {session.startTime} - {session.endTime}
                    </span>
                  </div>
                  {session.venue && (
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{session.venue}</span>
                    </div>
                  )}
                  {session.description && (
                    <div className="col-span-2 text-xs text-gray-500 line-clamp-2">
                      {session.description}
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
