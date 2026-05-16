import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import {
  User,
  Mail,
  Shield,
  BookOpen,
  GraduationCap,
  Award,
  Users,
} from "lucide-react";

export default function StudentProfile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Fetch fresh user data to get populated supervisor
      const res = await api.get(`/users/${user.id || user._id}`);
      setProfileData(res.data.user);
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
                <p className="font-bold text-gray-900 text-lg leading-snug">
                  {displayUser.researchTitle || "No title registered yet."}
                </p>
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
              {displayUser.zkpRegistered ? (
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
