export const ZKP_PRIVATE_KEY_PREFIX = "zkp_priv";

export const parseStoredUser = (rawUser) => {
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
};

export const isRevokedSessionResponse = (code = "", message = "") =>
  code === "DEVICE_REVOKED_OR_STALE" ||
  ["revoked", "removed", "logged out", "reseeded"].some((fragment) =>
    String(message).toLowerCase().includes(fragment),
  );

export const isInvalidSessionResponse = (code = "", message = "") =>
  [
    "NO_TOKEN",
    "USER_NOT_FOUND",
    "DEVICE_REVOKED_OR_STALE",
    "TOKEN_MISSING_DEVICE",
    "TOKEN_EXPIRED",
    "INVALID_TOKEN",
  ].includes(code) || String(message).toLowerCase().includes("please login again");

export const getSessionClearKeys = ({
  storedUser = null,
  removeDeviceBinding = false,
  removePrivateKey = false,
} = {}) => {
  const userId = storedUser?.userId ? String(storedUser.userId) : "";
  const keys = ["token", "user"];

  if (removePrivateKey && userId) {
    keys.push(`${ZKP_PRIVATE_KEY_PREFIX}_${userId}`);
  }

  if (removeDeviceBinding) {
    keys.push("zkp_device_id", "zkp_trust_device");
    if (userId) {
      keys.push(`zkp_trust_device_${userId}`);
    }
  }

  return keys;
};

export const clearStoredSession = ({
  storage = window.localStorage,
  dispatcher = window,
  storedUser = parseStoredUser(storage.getItem("user")),
  removeDeviceBinding = false,
  removePrivateKey = false,
} = {}) => {
  const removedKeys = getSessionClearKeys({
    storedUser,
    removeDeviceBinding,
    removePrivateKey,
  });

  removedKeys.forEach((key) => storage.removeItem(key));
  dispatcher?.dispatchEvent?.(new Event("auth-session-cleared"));

  return { storedUser, removedKeys };
};
