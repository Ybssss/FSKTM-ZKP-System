import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ArrowLeft,
  FileText,
  CheckCircle2,
  QrCode,
  ClipboardCheck,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Attendance Gateway State
  const [attendanceActive, setAttendanceActive] = useState(false);
  const [attendanceCode, setAttendanceCode] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");

  useEffect(() => {
    loadSessionData();
  }, [id]);

  const loadSessionData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Session Details
      const res = await api.get("/timetables/my");
      const foundSession = (res.data.data || res.data.sessions || []).find(
        (s) => s.id === id || s._id === id,
      );
      setSession(foundSession);

      // 2. Fetch all Evaluations for this session
      const evalRes = await api.get("/evaluations");
      const allEvals = evalRes.data.data || [];
      const sessionEvals = allEvals.filter(
        (e) => e.sessionId?._id === id || e.sessionId === id,
      );
      setEvaluations(sessionEvals);
    } catch (error) {
      alert("Failed to load session details");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (!score) return "text-gray-500 bg-gray-100";
    if (score >= 80) return "text-green-700 bg-green-100";
    if (score >= 65) return "text-yellow-700 bg-yellow-100";
    return "text-red-700 bg-red-100";
  };

  const toggleAttendance = () => {
    if (!attendanceActive)
      setAttendanceCode(Math.floor(100000 + Math.random() * 900000).toString());
    setAttendanceActive(!attendanceActive);
  };

  const markCoPanelAttendance = (panelName, status) => {
    alert(`Marked ${panelName} as ${status.toUpperCase()}.`);
    setAbsenceReason("");
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
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 font-semibold transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Timetable
      </button>

      {/* 1. Header & Session Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {session.rubric || session.sessionType?.replace("_", " ")}
            </h1>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-200">
              SCHEDULED
            </span>
          </div>
          {/* Quick jump to evaluation list if user is a panel */}
          {user?.role === "panel" &&
            evaluations.some(
              (e) => e.evaluatorId?._id === user.id && e.status === "PENDING",
            ) && (
              <button
                onClick={() => navigate(`/panel/evaluation?sessionId=${id}`)}
                className="mt-4 sm:mt-0 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-md transition-transform hover:scale-105"
              >
                <FileText className="w-5 h-5" /> Evaluate Now
              </button>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Date</p>
              <p className="font-semibold text-gray-900">
                {new Date(
                  session.schedule?.date || session.date,
                ).toLocaleDateString("en-MY", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Time</p>
              <p className="font-semibold text-gray-900">
                {session.schedule?.time || session.time}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Venue</p>
              <p className="font-semibold text-gray-900">
                {session.schedule?.venue || session.venue}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">
                Candidate
              </p>
              <p className="font-semibold text-gray-900">
                {session.student?.name || "TBD"}
              </p>
              <p className="text-xs text-gray-500">
                {session.student?.matricNumber}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Command Center & Attendance Gateway (FOR PANELS ONLY) */}
      {user?.role === "panel" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Gateway */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
              <QrCode className="w-5 h-5 text-indigo-600" /> Session Attendance
            </h2>
            {!attendanceActive ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-600 mb-4 text-sm font-medium">
                  Open the gateway to project the QR code for student check-in.
                </p>
                <button
                  onClick={toggleAttendance}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-sm transition-colors"
                >
                  Generate Display QR
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4 bg-indigo-50 border border-indigo-100 p-6 rounded-lg">
                <div className="bg-white p-3 rounded-xl shadow-md">
                  <QRCodeSVG
                    value={`https://fsktm-zkp.edu.my/attend/${id}?code=${attendanceCode}`}
                    size={160}
                  />
                </div>
                <div className="text-center w-full">
                  <p className="text-xs font-bold text-indigo-900 uppercase tracking-widest">
                    Manual Entry PIN
                  </p>
                  <p className="text-5xl font-black text-indigo-600 tracking-[0.25em] mt-1">
                    {attendanceCode}
                  </p>
                </div>
                <button
                  onClick={toggleAttendance}
                  className="mt-2 text-sm font-bold text-red-600 hover:text-red-800 bg-white px-4 py-2 rounded shadow-sm border border-red-100"
                >
                  Close Gateway
                </button>
              </div>
            )}
          </div>

          {/* Co-Panel Management */}
          {session.panels && session.panels.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                <Users className="w-5 h-5 text-indigo-600" /> Examiner
                Verification
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Please verify the attendance of your co-examiner(s).
              </p>

              <div className="space-y-3">
                {session.panels
                  .filter((p) => p !== user.name)
                  .map((panelName, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col gap-3"
                    >
                      <div className="font-bold text-gray-900 text-lg">
                        {panelName}
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          onClick={() =>
                            markCoPanelAttendance(panelName, "present")
                          }
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow-sm transition-colors"
                        >
                          Confirm Present
                        </button>
                        <input
                          type="text"
                          placeholder="Reason (if absent)..."
                          className="text-xs px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 w-32 flex-1"
                          onChange={(e) => setAbsenceReason(e.target.value)}
                        />
                        <button
                          onClick={() =>
                            markCoPanelAttendance(panelName, "absent")
                          }
                          className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold rounded border border-red-200 transition-colors"
                        >
                          Mark Absent
                        </button>
                      </div>
                    </div>
                  ))}
                {session.panels.length <= 1 && (
                  <p className="text-sm text-gray-500 italic text-center py-8 border-2 border-dashed rounded-lg">
                    You are the only examiner assigned.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Linked Evaluations Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" /> Examiner
            Submissions
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track the official grading progress for this session.
          </p>
        </div>

        {evaluations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No evaluation rubrics linked to this session yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {evaluations.map((ev) => (
              <div
                key={ev._id}
                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-bold text-gray-900 text-lg">
                    {ev.evaluatorId?.name || "Unknown Panel"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {ev.evaluatorId?.email}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {ev.status === "COMPLETED" ? (
                    <>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Final Score
                        </p>
                        <p
                          className={`px-4 py-1.5 rounded font-black border shadow-sm ${getScoreColor(ev.totalMarks)}`}
                        >
                          {ev.sessionType === "PROGRESS_ASSESSMENT"
                            ? "Text Feedback Only"
                            : `${ev.totalMarks?.toFixed(2)}%`}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-lg font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5" /> Submitted
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-orange-700 bg-orange-50 border border-orange-200 px-4 py-2.5 rounded-lg font-bold text-sm">
                      <Clock className="w-4 h-4" /> Awaiting Submission
                    </span>
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
