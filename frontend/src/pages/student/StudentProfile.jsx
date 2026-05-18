import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { userAPI } from "../../services/api";
import {
  User,
  Mail,
  Shield,
  BookOpen,
  GraduationCap,
  Users,
  CheckCircle2, // 👈 ADD THIS LINE
} from "lucide-react";

export default function StudentProfile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [researchTitle, setResearchTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Fetch fresh user data to get populated supervisor
      const res = await userAPI.getMyProfile();
      setProfileData(res.user);
      setResearchTitle(res.user?.researchTitle || "");
    } catch (error) {
      console.error("Failed to load profile", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const displayUser = profileData || user;
  const isZkpSecured =
    displayUser.zkpRegistered === true || displayUser.zkpActive === true;
  const normalizedTitle = researchTitle.replace(/\s+/g, " ").trim();
  const originalTitle = String(displayUser.researchTitle || "")
    .replace(/\s+/g, " ")
    .trim();

  const titleTooShort =
    normalizedTitle.length > 0 && normalizedTitle.length < 5;
  const titleTooLong = normalizedTitle.length > 300;
  const titleUnchanged = normalizedTitle === originalTitle;
  const canSaveTitle =
    normalizedTitle.length >= 5 &&
    normalizedTitle.length <= 300 &&
    !titleUnchanged &&
    !savingTitle;

  // Safely extract supervisor name
  let svName = "Not Assigned";
  if (displayUser.supervisorId) {
    if (
      typeof displayUser.supervisorId === "object" &&
      displayUser.supervisorId.name
    ) {
      svName = displayUser.supervisorId.name;
    } else {
      svName = "Pending System Link";
    }
  }

  const saveResearchTitle = async () => {
    try {
      const cleanTitle = researchTitle.replace(/\s+/g, " ").trim();

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

      if (cleanTitle === originalTitle) {
        setMessage({
          type: "error",
          text: "No changes detected. Please edit the title before saving.",
        });
        return;
      }

      const confirmed = window.confirm(
        "Save this as your Research Project Title?",
      );

      if (!confirmed) return;

      setSavingTitle(true);

      const res = await userAPI.updateMyResearchTitle(cleanTitle);

      setProfileData(res.user);
      setResearchTitle(res.user?.researchTitle || "");
      setMessage({
        type: "success",
        text: "Research project title updated successfully.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to update research project title.",
      });
    } finally {
      setSavingTitle(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <User className="w-8 h-8 text-indigo-600" /> My Profile
        </h1>
        <p className="text-gray-600 mt-2">
          View your personal details and academic status.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: ID Card */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-indigo-600 h-24"></div>
            <div className="px-6 pb-6 relative">
              <div className="w-20 h-20 bg-white rounded-full p-1 absolute -top-10 left-6 shadow-md">
                <div className="w-full h-full bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-3xl font-bold">
                  {displayUser.name?.charAt(0) || "U"}
                </div>
              </div>
              <div className="pt-12">
                <h2 className="text-xl font-bold text-gray-900">
                  {displayUser.name}
                </h2>
                <p className="text-indigo-600 font-mono font-bold">
                  {displayUser.userId}
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{displayUser.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm uppercase tracking-wider font-bold">
                      {displayUser.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="md:col-span-2 space-y-6">
          {/* 🔴 NEW: Academic Details Card for Students */}
          {displayUser.role === "student" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6 border-b pb-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" /> Academic
                Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Matric Number
                  </p>
                  <p className="font-mono font-bold text-gray-900 text-lg">
                    {displayUser.matricNumber || displayUser.userId}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Programme
                  </p>
                  <p className="font-semibold text-gray-900">
                    {displayUser.program || "Bachelor of Computer Science"}
                  </p>
                </div>
              </div>

              <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100 mb-6">
                <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Research Project Title
                </p>

                <textarea
                  value={researchTitle}
                  onChange={(e) => {
                    setResearchTitle(e.target.value);
                    setMessage({ type: "", text: "" });
                  }}
                  maxLength={300}
                  rows={3}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-medium ${
                    titleTooShort || titleTooLong
                      ? "border-red-300 bg-red-50"
                      : "border-indigo-200"
                  }`}
                  placeholder="Enter your research project title"
                />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                  <div>
                    <p
                      className={`text-xs font-medium ${
                        titleTooLong ? "text-red-600" : "text-gray-500"
                      }`}
                    >
                      {normalizedTitle.length}/300 characters
                    </p>

                    {titleTooShort && (
                      <p className="text-xs text-red-600 mt-1">
                        Title must be at least 5 characters.
                      </p>
                    )}

                    {titleUnchanged && normalizedTitle.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        No changes detected.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={saveResearchTitle}
                    disabled={!canSaveTitle}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {savingTitle ? "Saving..." : "Save Title"}
                  </button>
                </div>

                {message.text && (
                  <div
                    className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                      message.type === "success"
                        ? "bg-green-100 text-green-800 border border-green-200"
                        : "bg-red-100 text-red-800 border border-red-200"
                    }`}
                  >
                    {message.text}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Assigned Supervisor
                </p>
                <p className="font-bold text-gray-900 text-lg">{svName}</p>
              </div>
            </div>
          )}

          {/* Security Status Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6 border-b pb-2">
              <Shield className="w-5 h-5 text-green-600" /> Security Status
            </h3>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <p className="font-bold text-gray-900">
                  Zero-Knowledge Proof Identity
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Your cryptographic keys are currently active and securing your
                  account.
                </p>
              </div>
              {isZkpSecured ? (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Secured
                </span>
              ) : (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-bold uppercase tracking-wider rounded-full">
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
