import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from "react";
import zkp from "../utils/zkp";
import { authAPI } from "../services/api";
import {
  clearStoredSession,
  isRevokedSessionResponse,
  parseStoredUser,
} from "../utils/authSession";

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
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

  const clearLocalSession = useCallback(({
    clearDeviceBinding = false,
    clearKeys = false,
  } = {}) => {
    clearStoredSession({
      storedUser: parseStoredUser(localStorage.getItem("user")),
      removeDeviceBinding: clearDeviceBinding,
      removePrivateKey: clearKeys,
    });
    setUser(null);
  }, []);

  const checkAuth = useCallback(async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");

      if (!token || !userData) {
        setUser(null);
        return;
      }

      let parsedUser = null;
      try {
        parsedUser = JSON.parse(userData);
      } catch {
        clearLocalSession();
        return;
      }

      const response = await authAPI.getMe();
      const freshUser = response.user || parsedUser;

      localStorage.setItem("user", JSON.stringify(freshUser));
      setUser(freshUser);
    } catch (error) {
      if (error.response?.status === 401) {
        const code = String(error.response.data?.code || "");
        const message = String(error.response.data?.message || "");
        const revoked = isRevokedSessionResponse(code, message);

        clearLocalSession({
          clearDeviceBinding: revoked,
          clearKeys: revoked,
        });
        return;
      }

      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [clearLocalSession]);

  useEffect(() => {
    checkAuth();

    const handleSessionCleared = () => {
      setUser(null);
      setLoading(false);
    };

    window.addEventListener("auth-session-cleared", handleSessionCleared);

    return () => {
      window.removeEventListener("auth-session-cleared", handleSessionCleared);
    };
  }, [checkAuth]);

  const login = async (userId, trustDevice = false, recaptchaToken = "") => {
    try {
      const hasKeys = zkp.hasKeysForUser(userId);
      if (!hasKeys) {
        throw new Error("No cryptographic keys found for this device.");
      }

      // Reuse the local device identifier so the backend can update the same trusted-device record.
      let deviceId = localStorage.getItem("zkp_device_id");
      if (!deviceId) {
        deviceId = "dev_" + Math.random().toString(36).substring(2, 15);
      }

      const challengeResponse = await authAPI.getChallenge(
        userId,
        recaptchaToken,
      );

      const proofObject = await zkp.generateProof(
        userId,
        challengeResponse.challenge,
      );

      const forceTrusted = trustDevice === true || trustDevice === "true";

      const verifyResponse = await authAPI.verify(
        userId,
        proofObject,
        forceTrusted,
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
      console.error("ZKP login failed:", error);
      throw error;
    }
  };

  const register = async (userId, registrationCode) => {
    try {
      // Generate the keys in memory first so a failed registration cannot overwrite a valid local key.
      const keyPair = await zkp.generateKeyPair();
      const publicKey = await zkp.exportPublicKey(keyPair.publicKey);

      const response = await authAPI.register(
        userId,
        publicKey,
        registrationCode,
      );

      if (!response.success) {
        throw new Error(response.message || "Registration failed");
      }

      await zkp.storePrivateKey(userId, keyPair.privateKey);

      return { success: true };
    } catch (error) {
      console.error("ZKP registration failed:", error);
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

    // Untrusted sessions behave like public-lab access and wipe the local key on logout.
    if (!trustDevice && userId) {
      zkp.deleteKeys(userId);
      localStorage.removeItem("zkp_device_id");
    }

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
