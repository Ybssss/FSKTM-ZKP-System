const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive.file"];
const DEFAULT_KEY_PATH = path.join(
  __dirname,
  "../config/fluid-catfish-354607-8e98018544b3.json",
);

let driveClient = null;

const parseJsonCredentials = (rawValue) => {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed.private_key) {
      parsed.private_key = String(parsed.private_key).replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid Google service account JSON: ${error.message}`);
  }
};

const getCredentials = () => {
  const rawJson =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  const parsedJson = parseJsonCredentials(rawJson);
  if (parsedJson) return { credentials: parsedJson };

  const explicitKeyPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (explicitKeyPath) {
    const resolvedPath = path.resolve(explicitKeyPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Google service account key file not found: ${resolvedPath}`);
    }
    return { keyFile: resolvedPath };
  }

  if (fs.existsSync(DEFAULT_KEY_PATH)) {
    return { keyFile: DEFAULT_KEY_PATH };
  }

  throw new Error(
    "Google Drive credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY.",
  );
};

const getFolderId = () => {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing from environment variables.");
  }
  return folderId;
};

const getDriveClient = () => {
  if (driveClient) return driveClient;

  const authOptions = getCredentials();
  const auth = new google.auth.GoogleAuth({
    ...authOptions,
    scopes: DRIVE_SCOPE,
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
};

const safeUnlink = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not remove temp upload file ${filePath}:`, error.message);
    }
  }
};

const uploadToGoogleDrive = async (file) => {
  if (!file) {
    throw new Error("No file provided for Google Drive upload.");
  }

  if (!file.path || !fs.existsSync(file.path)) {
    throw new Error("Uploaded temp file is missing before Google Drive upload.");
  }

  const drive = getDriveClient();
  const folderId = getFolderId();
  const safeOriginalName = String(file.originalname || "uploaded-file").replace(
    /[\\/:*?"<>|]/g,
    "_",
  );

  try {
    const uploaded = await drive.files.create({
      requestBody: {
        name: `${Date.now()}-${safeOriginalName}`,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimetype || "application/octet-stream",
        body: fs.createReadStream(file.path),
      },
      fields: "id,name,webViewLink,webContentLink,size,mimeType",
    });

    try {
      await drive.permissions.create({
        fileId: uploaded.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
    } catch (permissionError) {
      console.warn(
        "Google Drive upload succeeded but public permission failed:",
        permissionError.message,
      );
    }

    return uploaded.data;
  } finally {
    await safeUnlink(file.path);
  }
};

const deleteFromGoogleDrive = async (driveFileId) => {
  if (!driveFileId) return false;

  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId: driveFileId });
    return true;
  } catch (error) {
    if (error.code === 404) return false;
    console.warn("Failed to delete Google Drive file:", error.message);
    return false;
  }
};

module.exports = {
  uploadToGoogleDrive,
  deleteFromGoogleDrive,
};
