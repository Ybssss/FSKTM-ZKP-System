import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Shield,
  Key,
  AlertCircle,
  CheckCircle,
  Loader,
  Smartphone,
  UserCheck,
} from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [userId, setUserId] = useState("");
  const [registrationCode, setRegistrationCode] = useState(""); // NEW STATE
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("🔐 Starting registration for:", userId);

      // Pass the registrationCode to the AuthContext
      await register(userId, registrationCode);

      console.log("✅ Registration successful!");
      setSuccess(true);
    } catch (error) {
      console.error("❌ Registration error:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Key className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Device Registration
          </h1>
          <p className="text-gray-600 mt-2">
            Bind this device to your identity
          </p>
        </div>

        {!success ? (
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID *
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g., ADM001, STU001"
                required
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 uppercase"
              />
            </div>

            {/* NEW: Registration Code Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Code *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserCheck className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={registrationCode}
                  onChange={(e) => setRegistrationCode(e.target.value)}
                  placeholder="Provided by Admin (e.g., REG-1234)"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 font-medium">{error}</div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 text-sm">
                🔐 First-Time Setup
              </h3>
              <p className="text-xs text-blue-800 leading-relaxed">
                For security, your first device binding requires an
                authorization code from the System Administrator. This proves
                you own this User ID.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !userId || !registrationCode}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" /> Binding...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" /> Authenticate & Bind Device
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Device Bound!
              </h2>
              <p className="text-sm text-gray-600">
                Your identity is securely tied to this browser.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2 text-sm">
                <Smartphone className="w-4 h-4 text-indigo-500" />
                No password required
              </h3>
              <p className="text-xs text-gray-700">
                You can now log in using just your User ID. The cryptography
                happens automatically in the background.
              </p>
            </div>

            <button
              onClick={handleGoToLogin}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        )}

        {!success && (
          <div className="mt-6 text-center">
            <button
              onClick={handleGoToLogin}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Already registered? Login here
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
