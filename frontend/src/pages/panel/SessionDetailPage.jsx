import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, Users, ArrowLeft } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, [id]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const res = await api.get("/timetables/my");
      // Find the specific session
      const foundSession = (res.data.data || []).find(
        (s) => s.id === id || s._id === id,
      );
      setSession(foundSession);
    } catch (error) {
      alert("Failed to load session details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center p-12">Loading...</div>;
  if (!session)
    return (
      <div className="text-center p-12 text-red-600">Session not found</div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
      >
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {session.rubric || session.sessionType}
            </h1>
            <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">
              SCHEDULED
            </span>
          </div>
          {/*Points panel to their pending evaluations list */}
          {["panel", "coordinator"].includes(user?.role) && (
            <button
              onClick={() =>
                navigate(
                  `/panel/evaluation?sessionId=${session.id || session._id}`,
                )
              }
              className="mt-4 sm:mt-0 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-sm"
            >
              <FileText className="w-5 h-5" /> Start Evaluation
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mt-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />{" "}
            {new Date(session.schedule?.date).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" /> {session.schedule?.time}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-400" />{" "}
            {session.schedule?.venue}
          </div>
          {/* 👈 FIXED: Student name correctly mapped */}
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />{" "}
            {session.student?.name || "No Student"}
          </div>
        </div>
      </div>
    </div>
  );
}
