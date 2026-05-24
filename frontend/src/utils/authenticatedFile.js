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

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const canPreviewInBrowser = (contentType) => {
  const type = String(contentType || "").toLowerCase();
  return (
    type.startsWith("image/") ||
    type.startsWith("text/") ||
    type === "application/pdf"
  );
};

const buildPreviewMarkup = ({ objectUrl, contentType, filename }) => {
  const safeUrl = escapeHtml(objectUrl);
  const safeName = escapeHtml(filename);
  const type = String(contentType || "").toLowerCase();

  if (type.startsWith("image/")) {
    return `<main class="preview image-preview"><img src="${safeUrl}" alt="${safeName}" /></main>`;
  }

  if (canPreviewInBrowser(type)) {
    const viewerUrl = type === "application/pdf" ? `${safeUrl}#navpanes=0` : safeUrl;
    return `<main class="preview"><iframe src="${viewerUrl}" title="${safeName}"></iframe></main>`;
  }

  return `
    <main class="fallback">
      <div>
        <h2>Preview is not available for this file type</h2>
        <p>The file was loaded successfully. Download it with the original filename to open it in the correct application.</p>
      </div>
    </main>`;
};

const writeViewerPage = ({ popup, objectUrl, contentType, filename }) => {
  if (!popup) return false;

  try {
    const safeName = escapeHtml(filename || "document");
    const safeType = escapeHtml(contentType || "application/octet-stream");
    const safeUrl = escapeHtml(objectUrl);
    const previewMarkup = buildPreviewMarkup({ objectUrl, contentType, filename });

    popup.document.open();
    popup.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeName}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      background: #f3f4f6;
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 18px;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }
    .file-name {
      min-width: 0;
      font-size: 15px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }
    .file-type {
      margin-top: 3px;
      color: #6b7280;
      font-size: 12px;
      font-weight: 700;
    }
    a {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 9px 13px;
      border-radius: 8px;
      background: #2563eb;
      color: #ffffff;
      font-size: 13px;
      font-weight: 800;
      text-decoration: none;
    }
    .preview {
      flex: 1;
      min-height: 0;
      padding: 12px;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #ffffff;
    }
    .image-preview {
      display: grid;
      place-items: center;
      overflow: auto;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14);
    }
    .fallback {
      flex: 1;
      display: grid;
      place-items: center;
      padding: 24px;
      text-align: center;
    }
    .fallback div {
      max-width: 520px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #ffffff;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
    }
    .fallback h2 {
      margin: 0 0 8px;
      font-size: 18px;
    }
    .fallback p {
      margin: 0;
      color: #4b5563;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="file-name">${safeName}</div>
      <div class="file-type">${safeType}</div>
    </div>
    <a href="${safeUrl}" download="${safeName}">Download</a>
  </header>
  ${previewMarkup}
</body>
</html>`);
    popup.document.close();
    return true;
  } catch (_) {
    return false;
  }
};

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

  if (popup) {
    const wroteViewer = writeViewerPage({
      popup,
      objectUrl,
      contentType,
      filename,
    });

    if (!wroteViewer) popup.location.href = objectUrl;

    const cleanup = window.setInterval(() => {
      if (popup.closed) {
        URL.revokeObjectURL(objectUrl);
        window.clearInterval(cleanup);
      }
    }, 5000);
  } else {
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
};
