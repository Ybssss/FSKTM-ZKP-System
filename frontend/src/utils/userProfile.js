export const getUserProfileId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value._id || value.id || "";
};

export const getUserDisplayName = (value, fallback = "Unknown User") => {
  if (!value) return fallback;
  if (typeof value === "string") return fallback;
  return value.name || value.userId || value.matricNumber || value.email || fallback;
};
