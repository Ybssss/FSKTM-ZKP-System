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
  const header = String(value || "");
  const encodedMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  const match = encodedMatch || plainMatch;
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch (_) {
    return match[1];
  }
};

export const getDocumentFileName = (document) =>
  document?.originalFileName ||
  document?.fileName ||
  document?.name ||
  document?.title ||
  "";

export const openAuthenticatedFile = async (document, { download = false } = {}) => {
  const url = document?.url;
  const apiPath = apiPathFromUrl(url);
  const preferredName = getDocumentFileName(document);

  if (!apiPath) {
    if (download) {
      const link = window.document.createElement("a");
      link.href = url;
      link.download = preferredName;
      link.rel = "noopener noreferrer";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return;
  }

  if (!download) {
    const popup = window.open("", "_blank");
    if (popup) popup.opener = null;

    try {
      const ticketResponse = await api.post(`${apiPath}/view-ticket`);
      const viewUrl = ticketResponse.data?.url;

      if (!viewUrl) {
        throw new Error("File viewer URL was not returned.");
      }

      if (popup) {
        popup.location.href = viewUrl;
      } else {
        window.open(viewUrl, "_blank", "noopener,noreferrer");
      }
      return;
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      throw error;
    }
  }

  const response = await api.get(apiPath, { responseType: "blob" });
  const contentType =
    response.headers?.["content-type"] ||
    document?.mimeType ||
    response.data?.type ||
    "application/octet-stream";
  const blob = new Blob([response.data], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);
  const filename =
    filenameFromDisposition(response.headers?.["content-disposition"]) ||
    preferredName ||
    "document";

  if (download) {
    const link = window.document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  }
};
