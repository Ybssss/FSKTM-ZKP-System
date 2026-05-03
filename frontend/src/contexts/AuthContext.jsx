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

      // Check for existing device ID, or create a new one
      let deviceId = localStorage.getItem("zkp_device_id");
      if (!deviceId) {
        deviceId = "dev_" + Math.random().toString(36).substring(2, 15);
      }

      console.log("📝 Requesting challenge...");
      const challengeResponse = await authAPI.getChallenge(userId);

      console.log("🔑 Generating Proof using zkp.js...");
      const proofObject = await zkp.generateProof(
        userId,
        challengeResponse.challenge,
      );

      console.log("🔍 Verifying proof with server...");
      const verifyResponse = await authAPI.verify(
        userId,
        proofObject,
        trustDevice,
        deviceId,
      );

      if (!verifyResponse.success)
        throw new Error(verifyResponse.message || "Authentication failed");

      // Save the exact device ID the server verified/created
      localStorage.setItem(
        "zkp_device_id",
        verifyResponse.user.deviceId || deviceId,
      );
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

      // 1. Generate keys IN MEMORY first (Do not save to localStorage yet!)
      console.log("📝 Generating cryptographic keys...");
      const keyPair = await zkp.generateKeyPair();
      const publicKey = await zkp.exportPublicKey(keyPair.publicKey);

      // 2. Send the public key to the backend FIRST
      console.log("🌐 Registering with server...");
      const response = await authAPI.register(
        userId,
        publicKey,
        registrationCode,
      );

      // 3. If the backend rejects it (e.g., "User already registered")
      if (!response.success) {
        // We throw an error and STOP. The old key in localStorage is safely preserved!
        throw new Error(response.message || "Registration failed");
      }

      // 4. 🔴 THE FIX: ONLY save the private key locally IF the server succeeded
      await zkp.storePrivateKey(userId, keyPair.privateKey);

      return { success: true };
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    let userId = user?.userId;
    if (!userId) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) userId = JSON.parse(storedUser).userId;
    }

    const trustDevice =
      localStorage.getItem(`zkp_trust_device_${userId}`) === "true";

    // If it is a temporary/untrusted session (like a public lab computer)
    if (!trustDevice && userId) {
      console.log("Wiping temporary ZKP keys and device trace...");
      zkp.deleteKeys(userId); // They must pair again!
      localStorage.removeItem("zkp_device_id"); // Destroy the device trace
    }

    // Standard session cleanup
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
