import React, { useState, useEffect } from "react";
import { attendanceAPI } from "../../services/api";
import api from "../../services/api";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  UserCheck,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  QrCode,
  Camera,
} from "lucide-react";

const STATUS_STYLES = {
  present: {
    card: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-800",
    icon: "text-green-600",
  },
  absent: {
    card: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-800",
    icon: "text-red-600",
  },
  late: {
    card: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-800",
    icon: "text-amber-600",
  },
  excused: {
    card: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-800",
    icon: "text-blue-600",
  },
};

const STATUS_ICONS = {
  present: CheckCircle,
  late: Clock,
  excused: Calendar,
  absent: XCircle,
};

const formatSessionDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatAttendanceTimestamp = (record) => {
  const value = record.checkInTime || record.createdAt;
  if (!value) return "No attendance recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No attendance recorded";

  return date.toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatSessionWindow = (record) => {
  const startTime = record.timetableId?.startTime || "";
  const endTime = record.timetableId?.endTime || "";

  if (startTime && endTime) {
    return `${startTime} - ${endTime}`;
  }

  return startTime || endTime || "Time not set";
};

const getSessionTitle = (record) =>
  record.timetableId?.title ||
  record.timetableId?.sessionType?.replaceAll("_", " ") ||
  "Session";

export default function AttendancePage() {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    attendanceRate: 0,
  });

  // Input & Scanner States
  const [code, setCode] = useState("");
  const [scanMode, setScanMode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getMy();
      const records = response.attendances || [];
      setAttendanceRecords(records);

      const total = records.length;
      const present = records.filter((r) => r.status === "present").length;
      const absent = records.filter((r) => r.status === "absent").length;
      const rate = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

      setStats({ total, present, absent, attendanceRate: rate });
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const parseAttendancePayload = (rawValue) => {
    const raw = String(rawValue || "").trim();

    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Manual attendance code");
      }
      const parsedToken = parsed.token || parsed.code || parsed.pin;
      return {
        timetableId: parsed.timetableId,
        token: parsedToken,
        code: parsedToken,
      };
    } catch {
      // Not JSON, continue.
    }

    try {
      const parsedUrl = new URL(raw);
      return {
        timetableId:
          parsedUrl.searchParams.get("timetableId") ||
          parsedUrl.pathname.split("/").filter(Boolean).pop(),
        token:
          parsedUrl.searchParams.get("token") ||
          parsedUrl.searchParams.get("code"),
        code:
          parsedUrl.searchParams.get("code") ||
          parsedUrl.searchParams.get("token"),
      };
    } catch {
      // Not URL, treat as manual code.
    }

    return {
      token: raw,
      code: raw,
    };
  };

  const handleVerifyCode = async (codeToVerify) => {
    if (!codeToVerify || codeToVerify.length < 6) return;
    try {
      setVerifying(true);
      setMessage({ type: "", text: "" });
      const payload = parseAttendancePayload(codeToVerify);
      const res = await api.post("/qr/verify", payload);
      setMessage({
        type: "success",
        text: res.data.message || "Attendance marked successfully!",
      });
      setCode("");
      setScanMode(false);
      fetchAttendance();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Invalid or expired code.",
      });
    } finally {
      setVerifying(false);
    }
  };

  const onSubmitForm = (e) => {
    e.preventDefault();
    handleVerifyCode(code);
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
        <p className="text-gray-600 mt-1">
          Mark your attendance and track symposium sessions
        </p>
      </div>

      {/* ENTRY FORM WITH SCANNER TOGGLE */}
      <div className="bg-white rounded-xl border border-indigo-100 p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10"></div>
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            {scanMode ? (
              <Camera className="w-8 h-8" />
            ) : (
              <QrCode className="w-8 h-8" />
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Mark Attendance
          </h2>

          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => setScanMode(false)}
              className={`px-4 py-2 font-bold text-sm rounded-lg ${!scanMode ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Enter Code
            </button>
            <button
              onClick={() => setScanMode(true)}
              className={`px-4 py-2 font-bold text-sm rounded-lg ${scanMode ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Scan QR
            </button>
          </div>

          {scanMode ? (
            <div className="rounded-xl overflow-hidden border-4 border-indigo-100 aspect-square mb-4">
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0) {
                    const scannedText = result[0].rawValue;
                    setCode(scannedText);
                    handleVerifyCode(scannedText);
                  }
                }}
              />
            </div>
          ) : (
            <form onSubmit={onSubmitForm} className="space-y-4">
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full text-center text-4xl tracking-[0.5em] font-black p-4 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
              />
              <button
                type="submit"
                disabled={verifying || code.length < 6}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
              >
                {verifying ? "Verifying..." : "Submit Code"}
              </button>
            </form>
          )}

          {message.text && (
            <div
              className={`mt-4 p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
            >
              {message.type === "success" ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              {message.text}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards (Keep exactly as they were in your upload) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between mb-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-6 h-6 text-gray-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600 mt-1">Total Sessions</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.present}
          </div>
          <div className="text-sm text-gray-600 mt-1">Present</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.absent}</div>
          <div className="text-sm text-gray-600 mt-1">Absent</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <UserCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.attendanceRate}%
          </div>
          <div className="text-sm text-gray-600 mt-1">Attendance Rate</div>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Attendance History
          </h2>
        </div>
        <div className="p-6">
          {attendanceRecords.length > 0 ? (
            <div className="space-y-3">
              {attendanceRecords.map((record) => {
                const statusKey = record.status || "absent";
                const styles = STATUS_STYLES[statusKey] || STATUS_STYLES.absent;
                const Icon = STATUS_ICONS[statusKey] || XCircle;

                return (
                <div
                  key={record._id}
                  className={`flex items-start justify-between gap-4 p-4 rounded-lg border-2 ${styles.card}`}
                >
                  <div className="flex items-center gap-4">
                    <Icon className={`w-6 h-6 ${styles.icon}`} />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {getSessionTitle(record)}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {record.timetableId?.batchName && (
                          <span className="rounded border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                            Batch: {record.timetableId.batchName}
                          </span>
                        )}
                        {record.timetableId?.rubricId?.name && (
                          <span className="rounded border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700">
                            Rubric: {record.timetableId.rubricId.name}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1 font-semibold">
                          <Calendar className="w-3 h-3" />
                          {formatSessionDate(record.timetableId?.date)}
                        </span>
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="w-3 h-3" />
                          {formatSessionWindow(record)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatAttendanceTimestamp(record)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-3 py-1 rounded-lg text-sm font-semibold ${styles.badge}`}
                    >
                      {record.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <UserCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">
                No Records
              </h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
