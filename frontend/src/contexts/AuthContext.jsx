import React, { createContext, useContext, useState, useEffect } from "react";
import zkp from "../utils/zkp";
import { authAPI } from "../services/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");

      if (token && userData) {
        setUser(JSON.parse(userData));
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userId, trustDevice = false) => {
    try {
      console.log("🔐 Starting ZKP login...");

      const hasKeys = zkp.hasKeysForUser(userId);
      if (!hasKeys) {
        throw new Error("No cryptographic keys found for this device.");
      }

      let deviceId = localStorage.getItem("zkp_device_id");
      if (!deviceId) {
        deviceId = "dev_" + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("zkp_device_id", deviceId);
      }

      console.log("📝 Requesting challenge...");
      const challengeResponse = await authAPI.getChallenge(userId);

      console.log("🔑 Generating Proof using zkp.js...");
      // X-RAY: We capture exactly what zkp.js spits out
      const proofObject = await zkp.generateProof(
        userId,
        challengeResponse.challenge,
      );
      console.log("📦 SHAPE OF GENERATED PROOF:", proofObject);

      if (typeof proofObject === "string") {
        console.error(
          "🚨 ALERT: zkp.js generated a string! Your browser is still running the old RSA/HMAC code!",
        );
      } else if (proofObject.R && proofObject.s) {
        console.log(
          "✅ SUCCESS: zkp.js generated a valid Elliptic Curve { R, s } object!",
        );
      }

      console.log("🔍 Verifying proof with server...");
      const verifyResponse = await authAPI.verify(
        userId,
        proofObject,
        trustDevice,
        deviceId,
      );

      if (!verifyResponse.success)
        throw new Error(verifyResponse.message || "Authentication failed");

      localStorage.setItem("token", verifyResponse.token);
      localStorage.setItem("user", JSON.stringify(verifyResponse.user));
      setUser(verifyResponse.user);

      return { success: true, user: verifyResponse.user };
    } catch (error) {
      throw error;
    }
  };

  const register = async (userId, registrationCode) => {
    try {
      console.log("🔐 Starting ZKP registration...");

      console.log("📝 Generating cryptographic keys...");
      const keyPair = await zkp.generateKeyPair();
      console.log("📦 SHAPE OF GENERATED KEYS:", keyPair);

      await zkp.storePrivateKey(userId, keyPair.privateKey);

      const publicKey = await zkp.exportPublicKey(keyPair.publicKey);

      console.log("🌐 Registering with server...");
      const response = await authAPI.register(
        userId,
        publicKey,
        registrationCode,
      );

      if (!response.success) {
        throw new Error(response.message || "Registration failed");
      }

      return { success: true };
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    const userId = user?.userId;
    const trustDevice =
      localStorage.getItem(`zkp_trust_device_${userId}`) === "true";
    if (!trustDevice && userId) zkp.deleteKeys(userId);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const forceLogout = () => {
    const userId = user?.userId;
    if (userId) zkp.deleteKeys(userId);
    localStorage.removeItem(`zkp_trust_device_${userId}`);
    localStorage.removeItem("zkp_trust_device");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    forceLogout,
    checkAuth,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
