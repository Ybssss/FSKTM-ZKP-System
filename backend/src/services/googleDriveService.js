const {
  uploadStoredFile,
  deleteStoredFile,
  streamStoredFile,
} = require("./fileStorageService");

module.exports = {
  uploadToGoogleDrive: uploadStoredFile,
  deleteFromGoogleDrive: deleteStoredFile,
  streamStoredFile,
};
