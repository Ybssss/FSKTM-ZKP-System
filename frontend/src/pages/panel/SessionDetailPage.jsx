import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ArrowLeft,
  FileText,
  QrCode,
  ClipboardCheck,
  Video,
  Lock,
  History,
  Eye,
  ShieldAlert,
  Upload,
  Trash2,
  ExternalLink,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { openAuthenticatedFile } from "../../utils/authenticatedFile";

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const isPanel = user?.role === "panel";
  const isStudent = user?.role === "student";
  const isStaff = isAdmin || isPanel;

  const [session, setSession] = useState(null);
  const [evaluations, setEvaluations] = useState([]);

  const [historicalEvals, setHistoricalEvals] = useState([]);
  const [permissions, setPermissions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [attendanceActive, setAttendanceActive] = useState(false);
  const [attendanceCode, setAttendanceCode] = useState("");
  const [attendanceQrImage, setAttendanceQrImage] = useState("");
  const [attendanceExpiresAt, setAttendanceExpiresAt] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  const [materialForm, setMaterialForm] = useState({
    title: "",
    type: "other",
    description: "",
    file: null,
  });

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
      if (isStaff) {
        try {
          const attendanceRes = await api.get(`/attendance/timetable/${id}`);
          setAttendanceRecords(attendanceRes.data.attendances || []);
        } catch (error) {
          console.warn("Could not load attendance records.");
        }
      }
      if (isStudent) {
        return;
      }

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
              return (
                eSessionId !== id.toString() &&
                (e.status === "COMPLETED" || e.accessGranted === false)
              );
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
        currentSessionId: id,
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

  const getPermissionTargetId = (permission) =>
    typeof permission.targetEvaluationId === "object"
      ? permission.targetEvaluationId?._id
      : permission.targetEvaluationId;

  const getRequestForEvaluation = (evaluationId) =>
    permissions.find(
      (permission) =>
        String(getPermissionTargetId(permission)) === String(evaluationId) &&
        permission.status !== "WITHDRAWN",
    );

  const handleRequestAllHistory = async () => {
    try {
      const studentId = session.student?._id || session.student;

      if (!studentId) {
        alert("Student information is missing.");
        return;
      }

      const res = await api.post(
        "/feedback/permissions/request-student-history",
        {
          studentId,
          currentSessionId: id,
        },
      );

      if (res.data.success) {
        setPermissions((prev) => [...prev, ...(res.data.permissions || [])]);
        alert(
          `✅ ${res.data.createdCount} historical access request(s) created under batch ${res.data.batchId}.`,
        );
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to request all historical evaluations.",
      );
    }
  };

  const getScoreColor = (score) => {
    if (!score && score !== 0) return "text-gray-500 bg-gray-100";
    if (score >= 80) return "text-green-700 bg-green-100";
    if (score >= 65) return "text-yellow-700 bg-yellow-100";
    return "text-red-700 bg-red-100";
  };

  const toggleAttendance = async () => {
    if (attendanceActive) {
      setAttendanceActive(false);
      setAttendanceCode("");
      setAttendanceQrImage("");
      setAttendanceExpiresAt("");
      return;
    }

    try {
      const res = await api.post(`/qr/generate/${id}`);

      setAttendanceCode(res.data.token || "");
      setAttendanceQrImage(res.data.qrCode || "");
      setAttendanceExpiresAt(res.data.expiresAt || "");
      setAttendanceActive(true);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to generate attendance QR.",
      );
    }
  };

  const getOnlineMeetingUrl = (value) => {
    const rawValue = String(value || "").trim();

    if (!rawValue) return "";

    const normalizedUrl = /^https?:\/\//i.test(rawValue)
      ? rawValue
      : `https://${rawValue}`;

    try {
      new URL(normalizedUrl);
      return normalizedUrl;
    } catch (_) {
      return "";
    }
  };

  const isAssignedEvaluator = evaluations.some(
    (e) => e.evaluatorId?._id === user.id || e.evaluatorId === user.id,
  );
  const canViewGateway = isStaff && (isAdmin || isAssignedEvaluator || isPanel);

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

  const resetMaterialForm = () => {
    setMaterialForm({
      title: "",
      type: "other",
      description: "",
      file: null,
    });
  };

  const handleMaterialUpload = async (e) => {
    e.preventDefault();

    try {
      if (!materialForm.file) {
        alert("Please choose a file first.");
        return;
      }

      const cleanTitle = materialForm.title.replace(/\s+/g, " ").trim();

      if (!cleanTitle) {
        alert("Please enter a material title.");
        return;
      }

      const formData = new FormData();
      formData.append("file", materialForm.file);
      formData.append("title", cleanTitle);
      formData.append("type", materialForm.type);
      formData.append("description", materialForm.description || "");

      setUploadingMaterial(true);

      const res = await api.post(`/timetables/${id}/documents`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success) {
        setSession(res.data.timetable);
        resetMaterialForm();
        alert("Material uploaded successfully.");
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to upload material.",
      );
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleMaterialDelete = async (documentId) => {
    if (!window.confirm("Delete this material from the session?")) return;

    try {
      const res = await api.delete(`/timetables/${id}/documents/${documentId}`);

      if (res.data.success) {
        setSession(res.data.timetable);
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to delete material.",
      );
    }
  };

  const handleMaterialOpen = async (doc) => {
    try {
      await openAuthenticatedFile(doc);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to open material.",
      );
    }
  };

  const canUploadMaterial =
    isStudent &&
    session?.student &&
    String(session.student._id || session.student) === String(user?.id);

  const canDeleteMaterial = (doc) => {
    const uploadedById =
      typeof doc.uploadedBy === "object" ? doc.uploadedBy?._id : doc.uploadedBy;

    return isAdmin || String(uploadedById) === String(user?.id);
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

  const sessionDateValue = session.schedule?.date || session.date;
  const sessionDate = sessionDateValue ? new Date(sessionDateValue) : null;
  const hasValidSessionDate =
    sessionDate && !Number.isNaN(sessionDate.getTime());
  const onlineMeetingRawValue = session.schedule?.venue || session.venue || "";
  const onlineMeetingUrl = getOnlineMeetingUrl(onlineMeetingRawValue);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <button
        onClick={() =>
          navigate(isStudent ? "/student/schedule" : "/panel/sessions")
        }
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 font-semibold transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        {isStudent ? "Back to Schedule" : "Back to Timetable"}
      </button>

      {/* SESSION HEADER INFO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {session.rubricId?.name ||
                session.rubric ||
                session.sessionType?.replaceAll("_", " ") ||
                "Session Details"}
            </h1>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-200">
              {isFutureSession ? "UPCOMING SESSION" : "IN PROGRESS / PAST"}
            </span>
          </div>

          {isStaff &&
            (() => {
              const myPendingEval = evaluations.find(
                (e) =>
                  (e.evaluatorId?._id === user.id ||
                    e.evaluatorId === user.id) &&
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
                {hasValidSessionDate
                  ? sessionDate.toLocaleDateString("en-MY", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Date TBA"}
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
                {session.schedule?.time ||
                  session.time ||
                  (session.startTime
                    ? `${session.startTime}${session.endTime ? ` - ${session.endTime}` : ""}`
                    : "Time TBA")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">
                Online Meeting
              </p>
              <div className="font-semibold text-gray-900">
                {onlineMeetingUrl ? (
                  <a
                    href={onlineMeetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Video className="w-4 h-4" /> Join Online Meeting
                  </a>
                ) : (
                  <span className="text-gray-500">Meeting link TBA</span>
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

      {/* QUICK ACTIONS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {onlineMeetingUrl && (
            <a
              href={onlineMeetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-bold border border-blue-100 hover:bg-blue-100 flex items-center gap-2"
            >
              <Video className="w-4 h-4" />
              Join Meeting
            </a>
          )}

          {isStudent && (
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("session-material-upload")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="px-4 py-3 bg-indigo-50 text-indigo-700 rounded-lg font-bold border border-indigo-100 hover:bg-indigo-100 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Material
            </button>
          )}

          {isStaff && evaluations.some((e) => e.status === "PENDING") && (
            <button
              type="button"
              onClick={() => {
                const pendingEval = evaluations.find(
                  (e) => e.status === "PENDING",
                );
                if (pendingEval) goToEvaluation(pendingEval._id);
              }}
              className="px-4 py-3 bg-green-50 text-green-700 rounded-lg font-bold border border-green-100 hover:bg-green-100 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Evaluate Now
            </button>
          )}

          {isStaff && historicalEvals.length > 0 && (
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("historical-feedback-vault")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="px-4 py-3 bg-gray-50 text-gray-700 rounded-lg font-bold border border-gray-200 hover:bg-gray-100 flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              Historical Vault
            </button>
          )}
        </div>
        {isStaff &&
          historicalEvals.some((ev) => {
            const request = getRequestForEvaluation(ev._id);
            return (
              !ev.accessGranted &&
              request?.status !== "PENDING" &&
              request?.status !== "APPROVED"
            );
          }) && (
            <button
              type="button"
              onClick={handleRequestAllHistory}
              className="px-4 py-3 bg-purple-50 text-purple-700 rounded-lg font-bold border border-purple-100 hover:bg-purple-100 flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Request All History
            </button>
          )}
      </div>

      {/* PANEL EXAMINERS - visible to students and staff */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-600" /> Panel Examiners
        </h2>

        {session.panels?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {session.panels.map((panel, index) => (
              <div
                key={panel._id || panel.userId || index}
                className="p-4 rounded-lg border border-gray-200 bg-gray-50"
              >
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Panel {index + 1}
                </p>
                <p className="font-bold text-gray-900 mt-1">
                  {panel.name || "Panel name unavailable"}
                </p>
                {panel.email && (
                  <p className="text-sm text-gray-600 mt-1">{panel.email}</p>
                )}
                {panel.expertiseTags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {panel.expertiseTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded border border-indigo-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            Panel examiners are not assigned yet.
          </p>
        )}
      </div>

      {/* SESSION MATERIALS */}
      <div
        id="session-material-upload"
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Helpful Materials for This Session
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Students may upload supporting files for panel review.
            </p>
          </div>
        </div>

        {canUploadMaterial && (
          <form
            onSubmit={handleMaterialUpload}
            className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={materialForm.title}
                onChange={(e) =>
                  setMaterialForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                maxLength={120}
                placeholder="Material title, e.g. Proposal slides"
                className="w-full border border-indigo-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500"
              />

              <select
                value={materialForm.type}
                onChange={(e) =>
                  setMaterialForm((prev) => ({
                    ...prev,
                    type: e.target.value,
                  }))
                }
                className="w-full border border-indigo-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="report">Report</option>
                <option value="slides">Slides</option>
                <option value="supplementary">Supplementary</option>
                <option value="other">Other</option>
              </select>
            </div>

            <textarea
              value={materialForm.description}
              onChange={(e) =>
                setMaterialForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={2}
              placeholder="Optional description"
              className="w-full border border-indigo-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500"
            />

            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
              onChange={(e) =>
                setMaterialForm((prev) => ({
                  ...prev,
                  file: e.target.files?.[0] || null,
                }))
              }
              className="w-full text-sm bg-white border border-indigo-200 rounded-lg p-3"
            />

            <button
              type="submit"
              disabled={uploadingMaterial}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-400"
            >
              <Upload className="w-4 h-4" />
              {uploadingMaterial ? "Uploading..." : "Upload Material"}
            </button>
          </form>
        )}

        {session.studentDocuments?.length > 0 ? (
          <div className="space-y-3">
            {session.studentDocuments.map((doc) => (
              <div
                key={doc._id}
                className="p-4 rounded-lg border border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{doc.title}</p>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded uppercase">
                      {doc.type || "other"}
                    </span>
                  </div>

                  {doc.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {doc.description}
                    </p>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    Uploaded by{" "}
                    {doc.uploadedBy?.name ||
                      doc.uploadedBy?.userId ||
                      "student"}{" "}
                    {doc.uploadedAt
                      ? `on ${new Date(doc.uploadedAt).toLocaleDateString("en-MY")}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMaterialOpen(doc)}
                    className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </button>

                  {canDeleteMaterial(doc) && (
                    <button
                      type="button"
                      onClick={() => handleMaterialDelete(doc._id)}
                      className="inline-flex items-center gap-1 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-bold hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6">
            No materials uploaded yet.
          </div>
        )}
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
                  {attendanceQrImage ? (
                    <img
                      src={attendanceQrImage}
                      alt="Attendance QR Code"
                      className="w-[200px] h-[200px]"
                    />
                  ) : (
                    <p className="text-sm text-gray-500">
                      QR code unavailable.
                    </p>
                  )}
                </div>
                <div className="text-center w-full">
                  <p className="text-xs font-bold text-indigo-900 uppercase tracking-widest">
                    Manual Entry PIN
                  </p>
                  <p className="text-5xl font-black text-indigo-600 tracking-[0.25em] mt-1">
                    {attendanceCode}
                  </p>
                </div>
                {attendanceExpiresAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Expires at:{" "}
                    {new Date(attendanceExpiresAt).toLocaleString("en-MY")}
                  </p>
                )}
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

      {isStaff && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-green-600" />
            Attendance Status
          </h2>

          {attendanceRecords.length > 0 ? (
            <div className="space-y-3">
              {attendanceRecords.map((record) => (
                <div
                  key={record._id}
                  className="flex items-center justify-between p-4 rounded-lg border border-green-200 bg-green-50"
                >
                  <div>
                    <p className="font-bold text-gray-900">
                      {record.studentId?.name || "Student"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {record.studentId?.matricNumber || ""}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-green-700 uppercase">
                      {record.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      {record.checkInTime
                        ? new Date(record.checkInTime).toLocaleString("en-MY")
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
              No attendance has been marked for this session yet.
            </p>
          )}
        </div>
      )}

      {isStaff && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* CURRENT SESSION EXAMINER SUBMISSIONS */}
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
      )}

      {isStaff && (
        <div
          id="historical-feedback-vault"
          className="bg-gray-900 rounded-xl shadow-lg border border-gray-700 overflow-hidden mt-8"
        >
          {/* HISTORICAL FEEDBACK VAULT */}
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" /> Historical
              Feedback Vault
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
                const request = getRequestForEvaluation(ev._id);

                return (
                  <div
                    key={ev._id}
                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900 hover:bg-gray-800 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-gray-100 text-lg flex items-center gap-2">
                        {ev.sessionType?.replaceAll("_", " ") || "Evaluation"}
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
                      {isGranted || request?.status === "APPROVED" ? (
                        ev.sessionId?.studentDocuments?.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                              Approved Student Materials
                            </p>

                            {ev.sessionId.studentDocuments.map((doc) => (
                              <button
                                type="button"
                                key={doc._id}
                                onClick={() => handleMaterialOpen(doc)}
                                className="block text-left text-sm text-indigo-300 hover:text-indigo-200 hover:underline"
                              >
                                {doc.title || "Student material"}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mt-3">
                            No student materials attached to this historical
                            session.
                          </p>
                        )
                      ) : (
                        ev.studentDocumentsCount > 0 && (
                          <p className="text-xs text-yellow-400 mt-3">
                            {ev.studentDocumentsCount} student material(s)
                            locked until permission is approved.
                          </p>
                        )
                      )}
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
      )}
    </div>
  );
}
