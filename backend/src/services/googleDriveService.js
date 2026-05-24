const {
  uploadStoredFile,
  deleteStoredFile,
  getStoredFileInfo,
  streamStoredFile,
} = require("./fileStorageService");

module.exports = {
  uploadToGoogleDrive: uploadStoredFile,
  deleteFromGoogleDrive: deleteStoredFile,
  getStoredFileInfo,
  streamStoredFile,
};
