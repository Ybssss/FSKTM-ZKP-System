import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import zkp from "../utils/zkp";
import api from "../services/api";
import { Shield, Smartphone, AlertCircle, Monitor, Lock } from "lucide-react";
import DevicePairingModal from "../components/DevicePairingModal";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPairingModal, setShowPairingModal] = useState(false);

  const [trustDevice, setTrustDevice] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("revoked") === "true") {
      setError(
        "Your access from this device was remotely revoked. Cryptographic keys have been securely erased from this browser to protect your account.",
      );
      window.history.replaceState({}, document.title, "/login");
    }
  }, []);

  // Idiot-proof warning when unchecking the box
  const handleTrustChange = (e) => {
    const isChecked = e.target.checked;
    if (!isChecked) {
      const confirm = window.confirm(
        "🚨 WARNING: If you uncheck this, your ZKP keys will be deleted when you log out. If this is your ONLY device, you will be permanently locked out until an Admin resets your account. Are you sure you are on a public/shared computer?",
      );
      if (!confirm) return; // Revert if they click Cancel
    }
    setTrustDevice(isChecked);
  };

  const handleStandardZkpLogin = async (userIdToUse = userId) => {
    setLoading(true);
    setError("");

    try {
      const checkResponse = await api.post("/auth/check-registration", {
        userId: userIdToUse,
      });

      if (!checkResponse.data.userExists) {
        setError(
          "User not found. Please contact admin to create your account first.",
        );
        setLoading(false);
        return;
      }

      if (!checkResponse.data.registered) {
        setError(
          `You haven't registered your ZKP identity yet. Please register first.`,
        );
        setTimeout(() => {
          const shouldRedirect = window.confirm(
            "You need to register your ZKP identity first.\n\nClick OK to go to the Register page now.",
          );
          if (shouldRedirect) navigate("/register");
        }, 500);
        setLoading(false);
        return;
      }

      const hasKeys = zkp.hasKeysForUser(userIdToUse);
      if (!hasKeys) {
        setError(
          `No cryptographic keys found for ${userIdToUse} on this device.`,
        );
        setLoading(false);
        return;
      }

      // Save trust status to local storage for persistence
      localStorage.setItem("zkp_trust_device", trustDevice ? "true" : "false");
      localStorage.setItem(
        `zkp_trust_device_${userIdToUse}`,
        trustDevice ? "true" : "false",
      );

      // 🔴 FIX: Explicitly passing 'trustDevice' to the Context
      const result = await login(userIdToUse, trustDevice);

      if (result.user.role === "student") {
        navigate("/student/dashboard");
      } else if (
        ["superadmin", "admin", "coordinator", "panel", "supervisor"].includes(
          result.user.role,
        )
      ) {
        navigate("/panel/dashboard");
      } else {
        navigate("/");
      }
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleStandardZkpLogin(userId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">FSKTM Symposium</h1>
          <p className="text-gray-600 mt-2">Passwordless ZKP Authentication</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setError("");
              }}
              placeholder="Enter your user ID (e.g., STU001, ADMIN001)"
              required
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 uppercase"
            />
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={handleTrustChange}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {trustDevice ? (
                    <Monitor className="w-4 h-4 text-green-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-orange-600" />
                  )}
                  <span className="font-semibold text-sm text-gray-900">
                    Trust this device
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {trustDevice ? (
                    <>
                      <span className="font-medium text-green-700">
                        ✓ Keys will be saved
                      </span>{" "}
                      - Recommended for personal computers.
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-orange-700">
                        ⚠ Keys deleted on logout
                      </span>{" "}
                      - Recommended for public/shared computers.
                    </>
                  )}
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm text-red-800 font-medium">{error}</div>
                {error.includes("No cryptographic keys found") && (
                  <div className="mt-4 border-t border-red-200 pt-3">
                    <p className="text-sm text-red-900 font-medium mb-2">
                      Are you logged in on your phone?
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPairingModal(true)}
                      className="w-full py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Smartphone className="w-4 h-4" /> Sync Keys via QR / Code
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !userId}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <Shield className="w-5 h-5" />
            )}
            <span>Login with ZKP</span>
          </button>
        </form>

        <div className="mt-6 space-y-3 text-center">
          <button
            onClick={() => navigate("/register")}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            First time? Register your ZKP identity →
          </button>
        </div>
      </div>

      <DevicePairingModal
        isOpen={showPairingModal}
        onClose={() => setShowPairingModal(false)}
        userId={userId}
        onSuccess={() => handleStandardZkpLogin(userId)}
      />
    </div>
  );
}
