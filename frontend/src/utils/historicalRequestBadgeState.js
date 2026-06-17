const STORAGE_PREFIX = "historical-request-seen";

const TRACKED_STATUSES = new Set(["APPROVED", "REJECTED"]);

const getRequestId = (request) =>
  String(request?._id || request?.id || "").trim();

const getUserStorageKey = (userKey) =>
  `${STORAGE_PREFIX}:${String(userKey || "").trim()}`;

const parseSeenState = (rawValue) => {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const readSeenState = (userKey) => {
  if (typeof window === "undefined") return {};
  if (!userKey) return {};

  return parseSeenState(window.localStorage.getItem(getUserStorageKey(userKey)));
};

const writeSeenState = (userKey, nextState) => {
  if (typeof window === "undefined") return;
  if (!userKey) return;

  window.localStorage.setItem(
    getUserStorageKey(userKey),
    JSON.stringify(nextState || {}),
  );
};

export const getRequestUpdateSignature = (request) => {
  const status = String(request?.status || "").trim().toUpperCase();
  if (!TRACKED_STATUSES.has(status)) return "";

  const changedAt =
    request?.approvedAt ||
    request?.updatedAt ||
    request?.createdAt ||
    "";

  return `${status}:${changedAt}`;
};

export const isRequestUpdateUnseen = (request, userKey) => {
  const requestId = getRequestId(request);
  const signature = getRequestUpdateSignature(request);

  if (!requestId || !signature || !userKey) return false;

  const seenState = readSeenState(userKey);
  return seenState[requestId] !== signature;
};

export const markRequestUpdateSeen = (request, userKey) => {
  const requestId = getRequestId(request);
  const signature = getRequestUpdateSignature(request);

  if (!requestId || !signature || !userKey) return false;

  const seenState = readSeenState(userKey);
  if (seenState[requestId] === signature) return false;

  writeSeenState(userKey, {
    ...seenState,
    [requestId]: signature,
  });

  return true;
};

export const countUnseenRequestUpdates = (requests, userKey, status) => {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  if (!TRACKED_STATUSES.has(normalizedStatus)) return 0;

  return (requests || []).filter(
    (request) =>
      String(request?.status || "").trim().toUpperCase() ===
        normalizedStatus && isRequestUpdateUnseen(request, userKey),
  ).length;
};
