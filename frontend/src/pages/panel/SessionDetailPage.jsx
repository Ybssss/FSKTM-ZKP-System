import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  Video,
  Lock,
  History,
  Eye,
  ShieldAlert,
  Edit,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [session, setSession] = useState(null);
  const [evaluations, setEvaluations] = useState([]);

  const [historicalEvals, setHistoricalEvals] = useState([]);
  const [permissions, setPermissions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [attendanceActive, setAttendanceActive] = useState(false);
  const [attendanceCode, setAttendanceCode] = useState("");

  useEffect(() => {
    loadSessionData();
  }, [id]);

  const loadSessionData = async () => {
    try {
      setLoading(true);

      const res = await api.get("/timetables/my");
      const foundSession = (
        res.data.data ||
        res.data.sessions ||
        res.data.timetables ||
        []
      ).find((s) => s.id === id || s._id === id);
      setSession(foundSession);

      const evalRes = await api.get("/evaluations");
      const allEvals = evalRes.data.data || evalRes.data.evaluations || [];
      const sessionEvals = allEvals.filter(
        (e) => e.sessionId?._id === id || e.sessionId === id,
      );
      setEvaluations(sessionEvals);

      if (foundSession?.student?._id || foundSession?.student) {
        const studentId = foundSession.student._id || foundSession.student;

        try {
          const histRes = await api.get(
            `/feedback/search?studentId=${studentId}`,
          );
          const pastEvs = histRes.data.evaluations || [];

          // 🔴 FIX: Strictly filter out the current session from the Historical Vault
          const pastCompleted = pastEvs
            .filter((e) => {
              const eSessionId =
                e.sessionId?._id?.toString() || e.sessionId?.toString();
              return eSessionId !== id.toString() && e.status === "COMPLETED";
            })
            .sort(
              (a, b) =>
                new Date(b.updatedAt || b.date) -
                new Date(a.updatedAt || a.date),
            );

          setHistoricalEvals(pastCompleted);
        } catch (error) {
          console.warn("Could not load historical evals.");
        }

        try {
          const permRes = await api.get("/feedback/permissions/my");
          setPermissions(permRes.data.requests || []);
        } catch (error) {
          console.warn("Permissions route not mounted yet.");
        }
      }
    } catch (error) {
      alert("Failed to load session details");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (ev) => {
    try {
      const payload = {
        targetEvaluationId: ev._id,
        owningPanelId: ev.evaluatorId?._id || ev.evaluatorId,
        studentId: session.student?._id || session.student,
      };

      const res = await api.post("/feedback/permissions/request", payload);
      if (res.data.success) {
        setPermissions([...permissions, res.data.permission]);
        alert(
          "✅ Request sent successfully to the original author and admins.",
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send request.");
    }
  };

  const getScoreColor = (score) => {
    if (!score && score !== 0) return "text-gray-500 bg-gray-100";
    if (score >= 80) return "text-green-700 bg-green-100";
    if (score >= 65) return "text-yellow-700 bg-yellow-100";
    return "text-red-700 bg-red-100";
  };

  const toggleAttendance = () => {
    if (!attendanceActive)
      setAttendanceCode(Math.floor(100000 + Math.random() * 900000).toString());
    setAttendanceActive(!attendanceActive);
  };

  const isUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const isAssignedEvaluator = evaluations.some(
    (e) => e.evaluatorId?._id === user.id || e.evaluatorId === user.id,
  );
  const canViewGateway =
    isAdmin || isAssignedEvaluator || user?.role === "panel";

  const isFutureSession = session
    ? new Date(
        `${session.date}T${session.time || session.startTime || "23:59"}`,
      ) > new Date()
    : false;

  // Function to navigate securely with return state
  const goToEvaluation = (evalId) => {
    navigate(`/panel/evaluation/${evalId}`, {
      state: { returnUrl: location.pathname },
    });
  };

  if (loading)
    return (
      <div className="text-center p-12 font-bold text-gray-500">
        Loading session data...
      </div>
    );
  if (!session)
    return (
      <div className="text-center p-12 text-red-600 font-bold">
        Session not found
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <button
        onClick={() => navigate("/panel/sessions")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 font-semibold transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Timetable
      </button>

      {/* SESSION HEADER INFO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {session.rubricId?.name ||
                session.rubric ||
                session.sessionType?.replace("_", " ")}
            </h1>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-200">
              {isFutureSession ? "UPCOMING SESSION" : "IN PROGRESS / PAST"}
            </span>
          </div>

          {(() => {
            const myPendingEval = evaluations.find(
              (e) =>
                (e.evaluatorId?._id === user.id || e.evaluatorId === user.id) &&
                e.status === "PENDING",
            );
            return myPendingEval ? (
              <button
                onClick={() => goToEvaluation(myPendingEval._id)}
                className="mt-4 sm:mt-0 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-md transition-transform hover:scale-105"
              >
                <FileText className="w-5 h-5" /> Evaluate Now
              </button>
            ) : null;
          })()}
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
                {session.schedule?.time || session.time || session.startTime}
                {session.endTime ? ` - ${session.endTime}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">
                Venue / Link
              </p>
              <div className="font-semibold text-gray-900">
                {isUrl(session.schedule?.venue || session.venue) ? (
                  <a
                    href={session.schedule?.venue || session.venue}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Video className="w-4 h-4" /> Join Online
                  </a>
                ) : (
                  session.schedule?.venue || session.venue || "TBD"
                )}
              </div>
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
              <p className="font-semibold text-gray-900 leading-tight">
                {session.student?.name || "TBD"}
              </p>
              <p className="text-xs font-bold text-gray-500">
                {session.student?.matricNumber}
              </p>
            </div>
          </div>
        </div>
      </div>

      {canViewGateway && (
        <div className="w-full max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
              <QrCode className="w-5 h-5 text-indigo-600" /> Student Attendance
              Gateway
            </h2>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Open this gateway so the student can scan it with their device to
              securely check in.
            </p>

            {!attendanceActive ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <button
                  onClick={toggleAttendance}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-sm transition-colors"
                >
                  Generate Display QR
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4 bg-indigo-50 border border-indigo-100 p-6 rounded-lg">
                <div className="bg-white p-4 rounded-xl shadow-md">
                  <QRCodeSVG
                    value={`https://fsktm-zkp.edu.my/attend/${id}?code=${attendanceCode}`}
                    size={200}
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
        </div>
      )}

      {/* CURRENT SESSION EXAMINER SUBMISSIONS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" /> Current
            Session Submissions
          </h2>
        </div>

        {evaluations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 font-bold">
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
                            ? "Text Feedback"
                            : `${ev.totalMarks?.toFixed(2)}%`}
                        </p>
                      </div>

                      {/* 🔴 NEW: Allows panel to view/update their current session eval */}
                      <button
                        onClick={() => goToEvaluation(ev._id)}
                        className="ml-2 flex items-center gap-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors"
                      >
                        <Eye className="w-4 h-4" /> View / Edit
                      </button>
                    </>
                  ) : (
                    <span
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-bold text-sm ${isFutureSession ? "text-gray-700 bg-gray-100 border border-gray-300" : "text-orange-700 bg-orange-50 border border-orange-200"}`}
                    >
                      {isFutureSession ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      {isFutureSession
                        ? "Session Not Yet Started"
                        : "Pending Submission"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORICAL FEEDBACK VAULT */}
      <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-700 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" /> Historical Feedback
            Vault
          </h2>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-800 px-3 py-1 rounded-full border border-gray-700 hidden sm:block">
            Anti-Plagiarism & Progression Check
          </span>
        </div>

        {historicalEvals.length === 0 ? (
          <div className="p-8 text-center text-gray-400 font-medium">
            No previous completed evaluations found for this candidate.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {historicalEvals.map((ev) => {
              const isOwner =
                ev.evaluatorId?._id === user.id || ev.evaluatorId === user.id;
              const isGranted = isAdmin || isOwner;
              const request = permissions.find(
                (p) => p.targetEvaluationId === ev._id,
              );

              return (
                <div
                  key={ev._id}
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900 hover:bg-gray-800 transition-colors"
                >
                  <div>
                    <p className="font-bold text-gray-100 text-lg flex items-center gap-2">
                      {ev.sessionType?.replace("_", " ")}
                      {!isGranted && request?.status !== "APPROVED" && (
                        <Lock className="w-4 h-4 text-gray-500" />
                      )}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Evaluator:{" "}
                      <span className="text-gray-300 font-semibold">
                        {ev.evaluatorId?.name || "Unknown"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Date:{" "}
                      {new Date(ev.updatedAt || ev.date).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {isGranted || request?.status === "APPROVED" ? (
                      <button
                        onClick={() => goToEvaluation(ev._id)}
                        className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-md"
                      >
                        <Eye className="w-4 h-4" /> View Full Report
                      </button>
                    ) : request?.status === "PENDING" ? (
                      <span className="px-5 py-2.5 bg-gray-800 text-yellow-500 font-bold rounded-lg border border-gray-700 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Request Pending...
                      </span>
                    ) : request?.status === "REJECTED" ? (
                      <span className="px-5 py-2.5 bg-gray-800 text-red-500 font-bold rounded-lg border border-gray-700 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> Access Denied
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRequestAccess(ev)}
                        className="px-5 py-2.5 bg-gray-800 text-indigo-400 font-bold rounded-lg hover:bg-gray-700 border border-gray-700 transition-colors flex items-center gap-2"
                      >
                        <Lock className="w-4 h-4" /> Request Access
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
