import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { userAPI } from "../../services/api";
import {
  User,
  Mail,
  Shield,
  BookOpen,
  GraduationCap,
  Users,
  CheckCircle2,
  Briefcase,
  CalendarDays,
  Smartphone,
  Edit3,
  Save,
  X,
} from "lucide-react";

const normalizeText = (value = "") =>
  String(value).normalize("NFKC").replace(/\s+/g, " ").trim();

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function StudentProfile() {
  const { user } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [isEditingResearch, setIsEditingResearch] = useState(false);
  const [researchTitle, setResearchTitle] = useState("");
  const [researchAbstract, setResearchAbstract] = useState("");
  const [savingResearch, setSavingResearch] = useState(false);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      const res = await userAPI.getMyProfile();
      const freshUser = res.user || {};

      setProfileData(freshUser);
      setResearchTitle(freshUser.researchTitle || "");
      setResearchAbstract(freshUser.researchAbstract || "");
    } catch (error) {
      console.error("Failed to load profile", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to load profile. Please refresh and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const displayUser = profileData || user || {};

  const originalTitle = useMemo(
    () => normalizeText(displayUser.researchTitle || ""),
    [displayUser.researchTitle],
  );

  const originalAbstract = useMemo(
    () => normalizeText(displayUser.researchAbstract || ""),
    [displayUser.researchAbstract],
  );

  const cleanTitle = normalizeText(researchTitle);
  const cleanAbstract = normalizeText(researchAbstract);

  const titleTooShort = cleanTitle.length > 0 && cleanTitle.length < 5;
  const titleTooLong = cleanTitle.length > 300;
  const abstractTooLong = cleanAbstract.length > 5000;

  const researchChanged =
    cleanTitle !== originalTitle || cleanAbstract !== originalAbstract;

  const canSaveResearch =
    isEditingResearch &&
    cleanTitle.length >= 5 &&
    cleanTitle.length <= 300 &&
    cleanAbstract.length <= 5000 &&
    researchChanged &&
    !savingResearch;

  const isZkpSecured =
    displayUser.zkpRegistered === true || displayUser.zkpActive === true;

  const supervisorName = (() => {
    const supervisor = displayUser.supervisorId;
    if (!supervisor) return "Not Assigned";
    if (typeof supervisor === "object" && supervisor.name) return supervisor.name;
    return "Pending System Link";
  })();

  const assignedPanels = Array.isArray(displayUser.assignedPanels)
    ? displayUser.assignedPanels
        .map((assignment) => assignment.panelId || assignment)
        .filter(Boolean)
    : [];
  const isStaffProfile = ["admin", "panel"].includes(displayUser.role);
  const expertiseTags = Array.isArray(displayUser.expertiseTags)
    ? displayUser.expertiseTags.filter(Boolean)
    : [];
  const assignedStudents = Array.isArray(displayUser.assignedStudents)
    ? displayUser.assignedStudents
    : [];
  const activeDevices = Array.isArray(displayUser.authenticatedDevices)
    ? displayUser.authenticatedDevices.filter((device) => device.isActive !== false)
    : [];
  const trustedDeviceCount = activeDevices.filter((device) => device.trusted).length;

  const cancelResearchEdit = () => {
    setResearchTitle(displayUser.researchTitle || "");
    setResearchAbstract(displayUser.researchAbstract || "");
    setIsEditingResearch(false);
    setMessage({ type: "", text: "" });
  };

  const saveResearchDetails = async () => {
    try {
      setMessage({ type: "", text: "" });

      if (!cleanTitle) {
        setMessage({
          type: "error",
          text: "Research project title cannot be empty.",
        });
        return;
      }

      if (cleanTitle.length < 5) {
        setMessage({
          type: "error",
          text: "Research project title must be at least 5 characters.",
        });
        return;
      }

      if (cleanTitle.length > 300) {
        setMessage({
          type: "error",
          text: "Research project title must not exceed 300 characters.",
        });
        return;
      }

      if (cleanAbstract.length > 5000) {
        setMessage({
          type: "error",
          text: "Research abstract must not exceed 5000 characters.",
        });
        return;
      }

      if (!researchChanged) {
        setMessage({
          type: "error",
          text: "No changes detected. Please edit the title or abstract before saving.",
        });
        return;
      }

      setSavingResearch(true);

      let latestUser = displayUser;

      if (cleanTitle !== originalTitle) {
        const titleRes = await userAPI.updateMyResearchTitle(cleanTitle);
        latestUser = titleRes.user || latestUser;
      }

      if (cleanAbstract !== originalAbstract) {
        const abstractRes = await userAPI.updateMyResearchAbstract(cleanAbstract);
        latestUser = abstractRes.user || latestUser;
      }

      setProfileData(latestUser);
      setResearchTitle(latestUser.researchTitle || cleanTitle);
      setResearchAbstract(latestUser.researchAbstract || cleanAbstract);
      setIsEditingResearch(false);
      setMessage({
        type: "success",
        text: "Research title and abstract updated successfully.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to update research details. Please try again.",
      });
    } finally {
      setSavingResearch(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <User className="w-8 h-8 text-indigo-600" /> My Profile
        </h1>
        <p className="text-gray-600 mt-2">
          {displayUser.role === "student"
            ? "View your personal details and update your research information."
            : "View your staff identity, expertise profile, and account security status."}
        </p>
      </div>

      {message.text && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold border ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-indigo-600 h-24" />
            <div className="px-6 pb-6 relative">
              <div className="w-20 h-20 bg-white rounded-full p-1 absolute -top-10 left-6 shadow-md">
                <div className="w-full h-full bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-3xl font-bold">
                  {displayUser.name?.charAt(0) || "U"}
                </div>
              </div>

              <div className="pt-12">
                <h2 className="text-xl font-bold text-gray-900">
                  {displayUser.name || "User"}
                </h2>
                <p className="text-indigo-600 font-mono font-bold break-all">
                  {displayUser.userId || displayUser.matricNumber || "-"}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm break-all">{displayUser.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm uppercase tracking-wider font-bold">
                      {displayUser.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {displayUser.role === "student" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b pb-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  Academic Details
                </h3>

                {!isEditingResearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingResearch(true);
                      setMessage({ type: "", text: "" });
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
                  >
                    <Edit3 className="w-4 h-4" /> Edit Title & Abstract
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={cancelResearchEdit}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Matric Number
                  </p>
                  <p className="font-mono font-bold text-gray-900 text-lg break-all">
                    {displayUser.matricNumber || displayUser.userId || "-"}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Programme
                  </p>
                  <p className="font-semibold text-gray-900">
                    {displayUser.program || "-"}
                  </p>
                </div>
              </div>

              <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100 mb-6">
                <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Research Project Title
                </p>

                {isEditingResearch ? (
                  <>
                    <textarea
                      value={researchTitle}
                      onChange={(e) => setResearchTitle(e.target.value)}
                      maxLength={300}
                      rows={3}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-medium ${
                        titleTooShort || titleTooLong
                          ? "border-red-300 bg-red-50"
                          : "border-indigo-200 bg-white"
                      }`}
                      placeholder="Enter your research project title"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
                      <p
                        className={`text-xs font-medium ${
                          titleTooShort || titleTooLong
                            ? "text-red-600"
                            : "text-gray-500"
                        }`}
                      >
                        {cleanTitle.length}/300 characters
                        {titleTooShort ? " · minimum 5 characters" : ""}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="font-bold text-gray-900 text-lg leading-snug whitespace-pre-wrap">
                    {displayUser.researchTitle || "No title registered yet."}
                  </p>
                )}
              </div>

              <div className="bg-blue-50 p-5 rounded-lg border border-blue-100 mb-6">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-2">
                  Research Abstract / Summary
                </p>

                {isEditingResearch ? (
                  <>
                    <textarea
                      value={researchAbstract}
                      onChange={(e) => setResearchAbstract(e.target.value)}
                      maxLength={5000}
                      rows={8}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                        abstractTooLong
                          ? "border-red-300 bg-red-50"
                          : "border-blue-200 bg-white"
                      }`}
                      placeholder="Enter your research abstract or project summary. This helps the admin and expertise matcher understand your research area."
                    />
                    <p
                      className={`text-xs mt-2 font-medium ${
                        abstractTooLong ? "text-red-600" : "text-gray-500"
                      }`}
                    >
                      {cleanAbstract.length}/5000 characters
                    </p>
                  </>
                ) : (
                  <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                    {displayUser.researchAbstract ||
                      "No abstract or project summary submitted yet."}
                  </p>
                )}
              </div>

              {isEditingResearch && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveResearchDetails}
                    disabled={!canSaveResearch}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {savingResearch ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Assigned Supervisor
                  </p>
                  <p className="font-bold text-gray-900 text-lg">
                    {supervisorName}
                  </p>
                </div>

                <div className="bg-purple-50 p-5 rounded-lg border border-purple-100">
                  <p className="text-xs font-bold text-purple-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Default Panels
                  </p>
                  {assignedPanels.length > 0 ? (
                    <div className="space-y-1">
                      {assignedPanels.map((panel, index) => (
                        <p
                          key={panel._id || panel.userId || index}
                          className="font-semibold text-gray-900"
                        >
                          {panel.name || panel.userId || `Panel ${index + 1}`}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="font-semibold text-gray-500">
                      No default panels assigned yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {isStaffProfile && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6 border-b pb-3">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                Staff Profile
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Staff ID
                  </p>
                  <p className="font-mono font-bold text-gray-900 break-all">
                    {displayUser.userId || "-"}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Position / Profession
                  </p>
                  <p className="font-semibold text-gray-900">
                    {displayUser.profession || "-"}
                  </p>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 sm:col-span-2">
                  <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> Expertise Tags
                  </p>
                  {expertiseTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {expertiseTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 bg-white text-indigo-700 text-xs font-bold rounded border border-indigo-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-gray-500">
                      No expertise tags saved yet.
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Assigned Students
                  </p>
                  <p className="text-2xl font-black text-gray-900">
                    {assignedStudents.length}
                  </p>
                  {assignedStudents.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {assignedStudents.slice(0, 4).map((student) => (
                        <p
                          key={student._id || student.userId}
                          className="text-sm font-semibold text-gray-700 truncate"
                        >
                          {student.name || student.userId}
                        </p>
                      ))}
                      {assignedStudents.length > 4 && (
                        <p className="text-xs font-bold text-blue-700">
                          +{assignedStudents.length - 4} more
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <p className="text-xs font-bold text-green-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> Active Devices
                  </p>
                  <p className="text-2xl font-black text-gray-900">
                    {activeDevices.length}
                  </p>
                  <p className="text-xs font-semibold text-gray-600 mt-1">
                    {trustedDeviceCount} trusted device(s)
                  </p>
                  {activeDevices.slice(0, 3).map((device) => (
                    <p
                      key={device.deviceId || device.createdAt}
                      className="text-xs text-gray-600 mt-2 truncate"
                    >
                      {device.deviceName || "Unknown device"} ·{" "}
                      {formatDateTime(device.lastLogin)}
                    </p>
                  ))}
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 sm:col-span-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Account Timeline
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 font-bold">Created</p>
                      <p className="font-semibold text-gray-900">
                        {formatDateTime(displayUser.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-bold">Last Updated</p>
                      <p className="font-semibold text-gray-900">
                        {formatDateTime(displayUser.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6 border-b pb-2">
              <Shield className="w-5 h-5 text-green-600" /> Security Status
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <p className="font-bold text-gray-900">
                  Zero-Knowledge Proof Identity
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Your cryptographic keys secure your account without storing a password.
                </p>
              </div>

              {isZkpSecured ? (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1 w-fit">
                  <CheckCircle2 className="w-3 h-3" /> Secured
                </span>
              ) : (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-bold uppercase tracking-wider rounded-full w-fit">
                  Pending Setup
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
