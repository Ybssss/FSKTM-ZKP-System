import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { User, Mail, BookOpen, GraduationCap, Shield, Key } from "lucide-react";

export default function StudentProfile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      // Fetch fresh, complete data directly from the DB
      const res = await api.get("/auth/me");
      setProfileData(res.data.user || user);
    } catch (error) {
      console.error("Failed to load profile:", error);
      setProfileData(user); // Fallback to context
    } finally {
      setLoading(false);
    }
  };

  const formatRole = (roleStr) => {
    if (!roleStr) return "User";
    if (roleStr === "superadmin") return "Super Admin";
    return roleStr.charAt(0).toUpperCase() + roleStr.slice(1);
  };

  if (loading)
    return (
      <div className="p-12 text-center text-gray-500">Loading profile...</div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <User className="w-8 h-8 text-indigo-600" /> My Profile
        </h1>
        <p className="text-gray-600 mt-1">
          Manage your account information and security.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-6 mb-8 border-b border-gray-100 pb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-inner">
            {profileData?.name?.charAt(0) || "U"}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {profileData?.name || "Loading..."}
            </h2>
            <p className="text-gray-500 mt-1 font-mono">
              {profileData?.userId}
            </p>
            <span className="inline-block mt-3 px-4 py-1.5 bg-indigo-100 text-indigo-800 text-sm font-bold uppercase tracking-widest rounded-lg border border-indigo-200">
              {formatRole(profileData?.role)}
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" /> Directory
            Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                Email Address
              </p>
              {/* 🔴 FIXED: Email now reliably displays from DB fetch */}
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />{" "}
                {profileData?.email || "No Email Available"}
              </p>
            </div>

            {profileData?.role === "student" && profileData?.matricNumber && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Matric Number
                </p>
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-gray-400" />{" "}
                  {profileData.matricNumber}
                </p>
              </div>
            )}
          </div>
        </div>

        {profileData?.role === "panel" && profileData?.expertiseTags && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Areas of Expertise
            </h3>
            <div className="flex flex-wrap gap-2">
              {profileData.expertiseTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-blue-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" /> Security Status
          </h3>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-full shadow-sm">
                <Key className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-green-900 text-lg">
                  Zero-Knowledge Proof Authentication
                </h4>
                <p className="text-sm text-green-800 mt-1 mb-3">
                  Your account is secured with cryptographic device keys. No
                  password needed!
                </p>
                <span className="inline-flex items-center gap-1.5 font-bold text-green-700 bg-green-100 px-3 py-1 rounded-md border border-green-300 text-sm">
                  ✓ Identity Registered & Verified
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
