export const HISTORICAL_REQUESTS_UPDATED_EVENT =
  "historical-requests-updated";

export const emitHistoricalRequestsUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HISTORICAL_REQUESTS_UPDATED_EVENT));
};
