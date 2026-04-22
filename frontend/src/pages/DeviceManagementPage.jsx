import React, { useState, useEffect } from "react";
import { authAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import zkp from "../utils/zkp";
import {
  Monitor,
  Smartphone,
  Laptop,
  Trash2,
  Shield,
  AlertTriangle,
  CheckCircle,
  QrCode,
  Key,
  X,
} from "lucide-react";
import DeviceScanner from "../components/DeviceScanner";

export default function DeviceManagementPage() {
  const { user } = useAuth(); // Fetch current user context

  // Devices State
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals State
  const [showScanner, setShowScanner] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Manual Sync Form State
  const [syncCode, setSyncCode] = useState("");
  const [syncStatus, setSyncStatus] = useState(""); // '', 'processing', 'success', 'error'

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getMyDevices();
      setDevices(response.devices || []);
    } catch (error) {
      console.error("❌ Fetch devices error:", error);
      setError("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId, deviceName) => {
    if (
      !window.confirm(
        `Remove ${deviceName}? You'll need to re-authenticate on that device.`,
      )
    )
      return;

    try {
      await authAPI.removeDevice(deviceId);
      alert(`✅ ${deviceName} removed successfully`);
      fetchDevices();
    } catch (error) {
      console.error("❌ Remove device error:", error);
      alert("Failed to remove device");
    }
  };

  const handleLogoutAllDevices = async () => {
    if (
      !window.confirm(
        "⚠️ Logout from ALL devices? You will be logged out immediately.",
      )
    )
      return;

    try {
      // Assuming you have this endpoint, otherwise just remove all other devices and force logout locally
      await authAPI.logoutAllDevices();
      alert("✅ Logged out from all devices");
      window.location.href = "/login";
    } catch (error) {
      console.error("❌ Logout all error:", error);
      alert("Failed to logout from all devices");
    }
  };

  const handleSyncSubmit = async (e) => {
    e.preventDefault();
    setSyncStatus("processing");

    try {
      // 1. Fetch PC's Temp Public Key using the 6-digit code
      const res = await authAPI.getTempPublicKey(syncCode);

      // 2. Get my real private key from local storage
      const myPrivateKey = await zkp.getRawPrivateKeyString(user.userId);

      if (!myPrivateKey) {
        throw new Error("Could not find your secure keys on this device.");
      }

      // 3. Encrypt it using the PC's temp key
      const encryptedPayload = await zkp.encryptPayload(
        res.tempPublicKeyBase64,
        myPrivateKey,
      );

      // 4. Send the encrypted package to the server
      await authAPI.submitEncryptedKey(syncCode, encryptedPayload);

      setSyncStatus("success");
      setTimeout(() => {
        setShowSyncModal(false);
        setSyncStatus("");
        setSyncCode("");
      }, 2000);
    } catch (error) {
      setSyncStatus("error");
      alert(
        error.response?.data?.message ||
          error.message ||
          "Failed to sync keys. Check the code.",
      );
    }
  };

  const getDeviceIcon = (deviceName) => {
    if (!deviceName || typeof deviceName !== "string") {
      return <Monitor className="w-5 h-5" />;
    }
    if (
      deviceName.includes("Android") ||
      deviceName.includes("iOS") ||
      deviceName.includes("iPhone")
    ) {
      return <Smartphone className="w-5 h-5" />;
    } else if (
      deviceName.includes("Windows") ||
      deviceName.includes("Mac") ||
      deviceName.includes("Linux")
    ) {
      return <Laptop className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  const getStatusColor = (isActive) =>
    isActive ? "text-green-600 bg-green-50" : "text-gray-600 bg-gray-50";
  const getStatusText = (isActive) => (isActive ? "Active" : "Inactive");

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Device Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage devices authenticated with your account
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowScanner(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Scan QR
          </button>

          <button
            onClick={() => setShowSyncModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Key className="w-4 h-4" />
            Sync with Code
          </button>

          <button
            onClick={handleLogoutAllDevices}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Logout All
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Security Notice
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 ml-6 list-disc">
          <li>
            To login on a new computer, click <strong>Scan QR</strong> or{" "}
            <strong>Sync with Code</strong>.
          </li>
          <li>Remove devices you no longer use or recognize.</li>
          <li>"Logout All" will force logout everywhere immediately.</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Devices List */}
      <div className="grid gap-4">
        {devices.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Devices Found
            </h3>
            <p className="text-gray-600">
              Your authenticated devices will appear here
            </p>
          </div>
        ) : (
          devices.map((device) => (
            <div
              key={device.deviceId}
              className={`bg-white rounded-lg border-2 p-6 transition-colors ${
                device.isCurrent
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Device Icon */}
                  <div
                    className={`p-3 rounded-lg ${device.isCurrent ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600"}`}
                  >
                    {getDeviceIcon(device.deviceName)}
                  </div>

                  {/* Device Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {device.deviceName}
                      </h3>
                      {device.isCurrent && (
                        <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-semibold rounded">
                          Current Device
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(device.isActive)}`}
                      >
                        {getStatusText(device.isActive)}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        {device.trustStatus ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                        )}
                        <span>
                          {device.trustStatus
                            ? "Trusted Device (Keys Saved)"
                            : "Untrusted Device (Temporary Session)"}
                        </span>
                      </div>
                      <p>IP Address: {device.ipAddress}</p>
                      <p>
                        Last Login:{" "}
                        {new Date(device.lastLogin).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  {!device.isCurrent ? (
                    <button
                      onClick={() =>
                        handleRemoveDevice(device.deviceId, device.deviceName)
                      }
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove this device"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  ) : (
                    <p className="text-xs text-gray-500 italic text-right">
                      Current
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* QR Scanner Modal */}
      {showScanner && <DeviceScanner onClose={() => setShowScanner(false)} />}

      {/* 6-DIGIT MANUAL SYNC MODAL */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center relative">
            <button
              onClick={() => {
                setShowSyncModal(false);
                setSyncStatus("");
                setSyncCode("");
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
            <Smartphone className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Sync to New Device
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Enter the 6-digit code displayed on the screen of the new computer
              to securely transfer your login.
            </p>

            {syncStatus === "success" ? (
              <div className="py-4 text-green-600 font-bold flex flex-col items-center">
                <CheckCircle className="w-12 h-12 mb-3" /> Keys transferred
                securely!
              </div>
            ) : (
              <form onSubmit={handleSyncSubmit} className="space-y-4">
                <input
                  type="text"
                  maxLength="6"
                  value={syncCode}
                  onChange={(e) =>
                    setSyncCode(e.target.value.replace(/\D/g, ""))
                  } // Only allow numbers
                  placeholder="000000"
                  required
                  className="w-full text-center text-4xl font-mono tracking-widest py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                />
                <button
                  type="submit"
                  disabled={
                    syncStatus === "processing" || syncCode.length !== 6
                  }
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {syncStatus === "processing"
                    ? "Encrypting & Sending..."
                    : "Authorize Login"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
