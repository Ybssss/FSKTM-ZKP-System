import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api"; // 👈 FIXED IMPORT
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  MapPin,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
} from "lucide-react";

export default function SchedulePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      // 👈 FIXED AXIOS CALL
      const response = await api.get("/timetables/my");
      const sessionsData =
        response.data.timetables || response.data.sessions || [];
      setSessions(sessionsData);
    } catch (error) {
      console.error("❌ Error fetching sessions:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (sessionId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingDoc(sessionId);
      const formData = new FormData();
      formData.append("document", file);
      formData.append("title", file.name);
      formData.append("description", "Student submission");

      // 👈 FIXED UPLOAD CALL
      await api.post(`/timetables/${sessionId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Document uploaded successfully!");
      await fetchSessions();
    } catch (error) {
      console.error("❌ Upload failed:", error);
      alert("Failed to upload document: " + error.message);
    } finally {
      setUploadingDoc(null);
    }
  };

  const isDeadlinePassed = (deadline) =>
    deadline && new Date(deadline) < new Date();
  const isUpcoming = (date) => new Date(date) >= new Date();
  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-900 font-semibold mb-2">
          Error Loading Schedule
        </h3>
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchSessions}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const upcomingSessions = sessions.filter((s) => isUpcoming(s.date));
  const pastSessions = sessions.filter((s) => !isUpcoming(s.date));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
        <p className="text-gray-600 mt-1">
          View your symposium sessions and upload required documents
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Upcoming Sessions ({upcomingSessions.length})
        </h2>
        {upcomingSessions.length > 0 ? (
          <div className="space-y-4">
            {upcomingSessions.map((session) => (
              <div
                key={session._id}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {session.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {session.sessionType}
                    </p>
                  </div>
                  {session.deadline && !isDeadlinePassed(session.deadline) && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium border border-orange-200">
                      <AlertCircle className="w-4 h-4" />
                      Deadline:{" "}
                      {new Date(session.deadline).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <span className="text-sm">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-5 h-5 text-green-600" />
                    <span className="text-sm">
                      {session.startTime} - {session.endTime}
                    </span>
                  </div>
                  {session.venue && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-5 h-5 text-red-600" />
                      <span className="text-sm">{session.venue}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                    Your Documents:
                  </h4>
                  {session.studentDocuments?.filter(
                    (d) =>
                      d.uploadedBy === user.id || d.uploadedBy?._id === user.id,
                  ).length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {session.studentDocuments
                        .filter(
                          (d) =>
                            d.uploadedBy === user.id ||
                            d.uploadedBy?._id === user.id,
                        )
                        .map((doc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-gray-600" />{" "}
                              <p className="text-sm font-medium text-gray-900">
                                {doc.title}
                              </p>
                            </div>
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mb-3">
                      No documents uploaded yet
                    </p>
                  )}

                  {!isDeadlinePassed(session.deadline) && (
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors text-sm">
                      {uploadingDoc === session._id ? (
                        <span>Uploading...</span>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Upload Document</span>
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(session._id, e)}
                        disabled={uploadingDoc === session._id}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 bg-white p-6 rounded-xl border border-gray-200 text-center">
            No upcoming sessions scheduled.
          </p>
        )}
      </div>

      {pastSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Past Sessions ({pastSessions.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {pastSessions.map((session) => (
              <div
                key={session._id}
                className={`border-b border-gray-100 last:border-0 ${expandedId === session._id ? "bg-blue-50/50" : "bg-white"}`}
              >
                <div
                  onClick={() => toggleExpand(session._id)}
                  className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {session.title || session.sessionType}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />{" "}
                      {new Date(session.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-gray-500">
                    <span className="hidden sm:block text-sm font-medium">
                      {session.startTime}
                    </span>
                    {expandedId === session._id ? (
                      <ChevronUp className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>

                {expandedId === session._id && (
                  <div className="px-5 pb-5 pt-2 animate-in slide-in-from-top-2">
                    <div className="bg-white p-4 rounded-lg border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-4 shadow-sm">
                      <div>
                        <p className="text-xs font-bold text-blue-500 uppercase mb-1">
                          Time & Location
                        </p>
                        <p className="text-sm text-gray-800 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />{" "}
                          {session.startTime} - {session.endTime}
                        </p>
                        <p className="text-sm text-gray-800 flex items-center gap-2 mt-1">
                          <MapPin className="w-4 h-4 text-gray-400" />{" "}
                          {session.venue}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-500 uppercase mb-1">
                          Assigned Panels
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {session.panels?.map((p) => (
                            <span
                              key={p._id}
                              className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200 flex items-center gap-1"
                            >
                              <Users className="w-3 h-3" /> {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() =>
                          navigate(`/student/sessions/${session._id}`)
                        }
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        View Full Details & Documents{" "}
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
