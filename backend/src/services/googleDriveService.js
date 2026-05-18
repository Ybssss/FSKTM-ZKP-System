const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!folderId) {
  throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing from .env");
}

const auth = new google.auth.GoogleAuth({
  keyFile: keyPath,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

const uploadToGoogleDrive = async (file) => {
  if (!file) {
    throw new Error("No file provided for Google Drive upload.");
  }

  const fileMetadata = {
    name: `${Date.now()}-${file.originalname}`,
    parents: [folderId],
  };

  const media = {
    mimeType: file.mimetype,
    body: fs.createReadStream(file.path),
  };

  const uploaded = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id,name,webViewLink,webContentLink,size,mimeType",
  });

  await drive.permissions.create({
    fileId: uploaded.data.id,
    requestBody: {
      role: "reader",
      type: "anyone",
      /* 
      for actual implementation, we can restrict access to only users with @uthm.edu.my email domain
      type: "domain",
        role: "reader",
        domain: "uthm.edu.my" */
    },
  });

  fs.unlinkSync(file.path);

  return uploaded.data;
};

module.exports = {
  uploadToGoogleDrive,
};
