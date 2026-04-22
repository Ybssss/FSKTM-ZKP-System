import React, { useState } from "react";
import axios from "axios";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

const PasswordlessLogin = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Update this to match your Express backend URL
  const API_BASE_URL = "http://localhost:5000/api/auth";

  // ==========================================
  // 1. REGISTER DEVICE (First-time setup)
  // ==========================================
  const handleRegisterDevice = async () => {
    if (!email)
      return setMessage({ type: "error", text: "Please enter your email." });
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // Step 1: Get Registration Challenge from Backend
      const challengeRes = await axios.post(
        `${API_BASE_URL}/register/challenge`,
        { email },
      );
      const options = challengeRes.data;

      // Step 2: Trigger the Fingerprint/FaceID Popup on the browser
      let registrationResponse;
      try {
        registrationResponse = await startRegistration(options);
      } catch (err) {
        throw new Error(
          "Device registration cancelled or failed on the device.",
        );
      }

      // Step 3: Send the cryptographic proof back to Backend
      const verifyRes = await axios.post(`${API_BASE_URL}/register/verify`, {
        email,
        registrationResponse,
      });

      setMessage({ type: "success", text: verifyRes.data.message });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 2. LOGIN (Daily use)
  // ==========================================
  const handleLogin = async () => {
    if (!email)
      return setMessage({ type: "error", text: "Please enter your email." });
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // Step 1: Get Login Challenge from Backend
      const challengeRes = await axios.post(`${API_BASE_URL}/login/challenge`, {
        email,
      });
      const options = challengeRes.data;

      // Step 2: Trigger the Fingerprint/FaceID Popup on the browser
      let authenticationResponse;
      try {
        authenticationResponse = await startAuthentication(options);
      } catch (err) {
        throw new Error("Authentication cancelled or failed on the device.");
      }

      // Step 3: Send the cryptographic proof back to Backend to get JWT Token
      const verifyRes = await axios.post(`${API_BASE_URL}/login/verify`, {
        email,
        authenticationResponse,
      });

      // SUCCESS! Store the token and redirect
      const { token, user } = verifyRes.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      setMessage({ type: "success", text: "Login successful! Redirecting..." });

      // Redirect based on role (Example)
      setTimeout(() => {
        window.location.href =
          user.role === "PANEL" ? "/panel-dashboard" : "/admin-dashboard";
      }, 1000);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          FSKTM ZKP System
        </h2>

        <p className="text-sm text-gray-600 text-center mb-6">
          Log in securely using your device's fingerprint or FaceID. No
          passwords required.
        </p>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Email Address
          </label>
          <input
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            placeholder="e.g., samihah@uthm.edu.my"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        {message.text && (
          <div
            className={`p-3 mb-4 text-sm rounded ${message.type === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
          >
            {message.text}
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300 transition duration-200"
          >
            {loading ? "Processing..." : "Login with Biometrics"}
          </button>

          <div className="text-center mt-2">
            <span className="text-xs text-gray-500">
              First time using this device?
            </span>
          </div>

          <button
            onClick={handleRegisterDevice}
            disabled={loading}
            className="w-full bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-300 disabled:bg-gray-100 transition duration-200"
          >
            Register This Device
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordlessLogin;
