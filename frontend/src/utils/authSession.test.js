import test from "node:test";
import assert from "node:assert/strict";

import {
  clearStoredSession,
  getSessionClearKeys,
  isInvalidSessionResponse,
  isRevokedSessionResponse,
  parseStoredUser,
} from "./authSession.js";

test("parseStoredUser returns null for invalid JSON", () => {
  assert.equal(parseStoredUser("{bad json"), null);
  assert.equal(parseStoredUser(""), null);
});

test("session response helpers classify revoked and expired responses", () => {
  assert.equal(
    isRevokedSessionResponse(
      "DEVICE_REVOKED_OR_STALE",
      "Session revoked or stale.",
    ),
    true,
  );
  assert.equal(
    isInvalidSessionResponse("TOKEN_EXPIRED", "Session expired. Please login again."),
    true,
  );
  assert.equal(isRevokedSessionResponse("TOKEN_EXPIRED", "Session expired."), false);
});

test("getSessionClearKeys includes device and private key cleanup only when required", () => {
  const storedUser = { userId: "AW240001" };
  assert.deepEqual(
    getSessionClearKeys({
      storedUser,
      removeDeviceBinding: true,
      removePrivateKey: true,
    }),
    [
      "token",
      "user",
      "zkp_priv_AW240001",
      "zkp_device_id",
      "zkp_trust_device",
      "zkp_trust_device_AW240001",
    ],
  );
});

test("clearStoredSession removes only auth-related keys and dispatches an event", () => {
  const removed = [];
  const storage = {
    data: new Map([
      ["token", "jwt"],
      ["user", JSON.stringify({ userId: "panel_zkp" })],
      ["zkp_priv_panel_zkp", "secret"],
      ["zkp_device_id", "dev_1"],
      ["unrelated", "keep"],
    ]),
    getItem(key) {
      return this.data.has(key) ? this.data.get(key) : null;
    },
    removeItem(key) {
      removed.push(key);
      this.data.delete(key);
    },
  };

  const events = [];
  const dispatcher = {
    dispatchEvent(event) {
      events.push(event.type);
    },
  };

  const result = clearStoredSession({
    storage,
    dispatcher,
    removeDeviceBinding: true,
    removePrivateKey: true,
  });

  assert.deepEqual(result.removedKeys, [
    "token",
    "user",
    "zkp_priv_panel_zkp",
    "zkp_device_id",
    "zkp_trust_device",
    "zkp_trust_device_panel_zkp",
  ]);
  assert.deepEqual(events, ["auth-session-cleared"]);
  assert.equal(storage.getItem("token"), null);
  assert.equal(storage.getItem("user"), null);
  assert.equal(storage.getItem("zkp_priv_panel_zkp"), null);
  assert.equal(storage.getItem("zkp_device_id"), null);
  assert.equal(storage.getItem("unrelated"), "keep");
  assert.deepEqual(removed, result.removedKeys);
});
