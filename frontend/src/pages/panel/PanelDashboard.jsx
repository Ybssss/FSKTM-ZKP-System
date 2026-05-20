import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  Calendar,
  MapPin,
  Clock,
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

      const response = await api.get("/timetables/my");
      const allSessions = response.data?.data || response.data?.sessions || [];

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const upcoming = allSessions
        .filter((session) => {
          const sessionDateStr = session.schedule?.date || session.date;
          if (!sessionDateStr) return false;
          return new Date(sessionDateStr) >= now;
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
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600 mt-2">Here is what is happening soon.</p>
      </div>

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

      {/* Upcoming Sessions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Upcoming Sessions
          </h2>
          <Link
            to="/panel/sessions"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            View full calendar <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {upcomingSessions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Your schedule is clear.</p>
            <p className="text-sm text-gray-500 mt-1">
              No upcoming sessions assigned to you at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingSessions.slice(0, 5).map((session) => {
              const sessionId = session.id || session._id;

              return (
                <div
                  key={sessionId}
                  className="p-5 border border-gray-200 rounded-xl hover:shadow-md hover:border-indigo-300 transition-all bg-white flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Side: Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        {session.rubric ||
                          session.sessionType?.replace("_", " ")}
                      </h3>
                      <span className="bg-green-100 text-green-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                        Upcoming
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-indigo-700 mb-3 bg-indigo-50 inline-block px-2 py-1 rounded">
                      Student: {session.student?.name || "TBD"}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">
                          {new Date(
                            session.schedule?.date || session.date,
                          ).toLocaleDateString("en-MY", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">
                          {session.schedule?.time || session.time}
                        </span>
                      </div>
                      {(session.schedule?.venue || session.venue) && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>
                            {session.schedule?.venue || session.venue}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Quick Actions */}
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
                        onClick={() =>
                          navigate(`/panel/evaluation?sessionId=${sessionId}`)
                        }
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
