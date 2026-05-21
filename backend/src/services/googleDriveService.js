const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DEFAULT_LOCAL_KEY_PATH = path.join(
  __dirname,
  "../config/fluid-catfish-354607-8e98018544b3.json",
);

let cachedDrive = null;

const parseJsonEnv = (rawValue, sourceName) => {
  if (!rawValue) return null;

  try {
    const credentials = JSON.parse(rawValue);

    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
    }

    return credentials;
  } catch (error) {
    throw new Error(`${sourceName} is not valid JSON: ${error.message}`);
  }
};

const resolveKeyFilePath = () => {
  const configuredPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "";

  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
  }

  return DEFAULT_LOCAL_KEY_PATH;
};

const getAuthOptions = () => {
  const jsonCredentials =
    parseJsonEnv(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "GOOGLE_SERVICE_ACCOUNT_JSON") ||
    parseJsonEnv(process.env.GOOGLE_CREDENTIALS_JSON, "GOOGLE_CREDENTIALS_JSON") ||
    parseJsonEnv(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      "GOOGLE_APPLICATION_CREDENTIALS_JSON",
    );

  if (jsonCredentials) {
    return {
      credentials: jsonCredentials,
      scopes: [DRIVE_SCOPE],
    };
  }

  const keyFile = resolveKeyFilePath();

  if (!fs.existsSync(keyFile)) {
    throw new Error(
      `Google service account key file not found: ${keyFile}. ` +
        "On Render, prefer GOOGLE_SERVICE_ACCOUNT_JSON with the full service account JSON.",
    );
  }

  return {
    keyFile,
    scopes: [DRIVE_SCOPE],
  };
};

const getDriveClient = () => {
  if (cachedDrive) return cachedDrive;

  const auth = new google.auth.GoogleAuth(getAuthOptions());
  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
};

const ensureFolderId = () => {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing from backend environment variables.");
  }

  return folderId;
};

const safeUnlink = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (_) {
    // Ignore temp-file cleanup errors.
  }
};

const uploadToGoogleDrive = async (file) => {
  if (!file) {
    throw new Error("No file received. Make sure timetable route uses multer upload.single('file').");
  }

  if (!file.path) {
    throw new Error("Uploaded file is missing a temporary file path.");
  }

  const folderId = ensureFolderId();
  const drive = getDriveClient();
  const safeOriginalName = String(file.originalname || "material")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .trim();

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
      supportsAllDrives: true,
    });

    await drive.permissions.create({
      fileId: uploaded.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });

    return uploaded.data;
  } catch (error) {
    throw new Error(
      `Google Drive upload failed: ${error.message}. ` +
        "Check GOOGLE_DRIVE_FOLDER_ID, service account JSON, and folder sharing permission.",
    );
  } finally {
    await safeUnlink(file.path);
  }
};

const deleteFromGoogleDrive = async (fileId) => {
  if (!fileId) return;

  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (error) {
    console.warn(`Google Drive delete skipped/failed for ${fileId}: ${error.message}`);
  }
};

module.exports = {
  uploadToGoogleDrive,
  deleteFromGoogleDrive,
};
