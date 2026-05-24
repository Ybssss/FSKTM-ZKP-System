const fs = require("fs");
const mongoose = require("mongoose");
const { GridFSBucket, ObjectId } = require("mongodb");

const BUCKET_NAME = process.env.GRIDFS_BUCKET_NAME || "session_materials";

const getBucket = () => {
  if (!mongoose.connection || !mongoose.connection.db) {
    throw new Error("MongoDB connection is not ready for file storage.");
  }

  return new GridFSBucket(mongoose.connection.db, {
    bucketName: BUCKET_NAME,
  });
};

const safeUnlink = (filePath) => {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.warn("Could not remove temporary upload file:", error.message);
  }
};

const sanitizeFilename = (value = "document") =>
  String(value)
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 160) || "document";

const contentDispositionName = (value = "document") =>
  String(value || "document")
    .normalize("NFKC")
    .replace(/[\r\n"]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 180) || "document";

const uploadStoredFile = async (file) => {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const bucket = getBucket();
  const originalName = file.originalname || "document";
  const filename = `${Date.now()}-${sanitizeFilename(originalName)}`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.mimetype || "application/octet-stream",
      metadata: {
        originalName,
        mimeType: file.mimetype || "application/octet-stream",
        size: file.size || 0,
        uploadedAt: new Date(),
        storageProvider: "gridfs",
      },
    });

    const readStream = fs.createReadStream(file.path);

    readStream.on("error", (error) => {
      safeUnlink(file.path);
      reject(error);
    });

    uploadStream.on("error", (error) => {
      safeUnlink(file.path);
      reject(error);
    });

    uploadStream.on("finish", () => {
      safeUnlink(file.path);

      const fileId = String(uploadStream.id);
      const fileUrl = `/api/timetables/documents/file/${fileId}`;

      resolve({
        id: fileId,
        name: filename,
        originalName,
        mimeType: file.mimetype || "application/octet-stream",
        size: String(file.size || ""),
        webViewLink: fileUrl,
        webContentLink: fileUrl,
        storageProvider: "gridfs",
      });
    });

    readStream.pipe(uploadStream);
  });
};

const deleteStoredFile = async (fileId) => {
  if (!fileId || !ObjectId.isValid(fileId)) return;

  const bucket = getBucket();

  try {
    await bucket.delete(new ObjectId(fileId));
  } catch (error) {
    if (error.codeName !== "FileNotFound" && error.message !== "File not found") {
      console.warn("Failed to delete stored file:", error.message);
    }
  }
};

const getStoredFileInfo = async (fileId) => {
  if (!fileId || !ObjectId.isValid(fileId)) return null;

  const bucket = getBucket();
  const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
  const file = files[0];

  if (!file) return null;

  return {
    id: String(file._id),
    name: file.filename,
    originalName: file.metadata?.originalName || file.filename || "",
    mimeType:
      file.contentType || file.metadata?.mimeType || "application/octet-stream",
    size: String(file.length || file.metadata?.size || ""),
  };
};

const streamStoredFile = async (fileId, res) => {
  if (!ObjectId.isValid(fileId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid file ID.",
    });
  }

  const bucket = getBucket();
  const objectId = new ObjectId(fileId);
  const files = await bucket.find({ _id: objectId }).toArray();

  if (!files.length) {
    return res.status(404).json({
      success: false,
      message: "File not found.",
    });
  }

  const file = files[0];
  const originalName = file.metadata?.originalName || file.filename || "document";
  const fallbackName = contentDispositionName(originalName);
  const encodedName = encodeURIComponent(originalName);
  const mimeType =
    file.contentType || file.metadata?.mimeType || "application/octet-stream";

  res.setHeader("Content-Type", mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
  );

  bucket.openDownloadStream(objectId).pipe(res);
};

module.exports = {
  uploadStoredFile,
  deleteStoredFile,
  getStoredFileInfo,
  streamStoredFile,
};
