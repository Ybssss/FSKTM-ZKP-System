import api from "../services/api";

const apiPathFromUrl = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/api/")) return raw.slice(4);
  if (raw.startsWith("/")) return raw;

  try {
    const parsed = new URL(raw);
    const apiIndex = parsed.pathname.indexOf("/api/");
    if (apiIndex >= 0) return `${parsed.pathname.slice(apiIndex + 4)}${parsed.search}`;
  } catch (_) {
    return "";
  }

  return "";
};

const filenameFromDisposition = (value) => {
  const match = String(value || "").match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch (_) {
    return match[1];
  }
};

export const openAuthenticatedFile = async (document, { download = false } = {}) => {
  const url = document?.url;
  const apiPath = apiPathFromUrl(url);

  if (!apiPath) {
    if (download) {
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document?.title || "";
      link.rel = "noopener noreferrer";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return;
  }

  const popup = download ? null : window.open("", "_blank");
  if (popup) popup.opener = null;
  const response = await api.get(apiPath, { responseType: "blob" });
  const contentType =
    response.headers?.["content-type"] ||
    document?.mimeType ||
    response.data?.type ||
    "application/octet-stream";
  const blob = new Blob([response.data], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);

  if (download) {
    const link = window.document.createElement("a");
    link.href = objectUrl;
    link.download =
      filenameFromDisposition(response.headers?.["content-disposition"]) ||
      document?.title ||
      "document";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  }

  if (popup) {
    popup.location.href = objectUrl;
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  } else {
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
};
