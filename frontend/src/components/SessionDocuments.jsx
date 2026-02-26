import React, { useState } from 'react';
import { Upload, FileText, Download, Trash2, Eye, Plus, X, Paperclip } from 'lucide-react';
import { timetableAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function SessionDocuments({ session, onUpdate }) {
  const { user } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    url: '',
    type: 'report',
    description: '',
    fileSize: '',
  });

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.url) {
      alert('Please provide title and URL');
      return;
    }

    try {
      setUploading(true);
      await timetableAPI.uploadDocument(session._id, formData);
      
      alert('✅ Document uploaded successfully!');
      setShowUploadModal(false);
      setFormData({
        title: '',
        url: '',
        type: 'report',
        description: '',
        fileSize: '',
      });
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await timetableAPI.deleteDocument(session._id, documentId);
      alert('✅ Document deleted successfully!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete document');
    }
  };

  const getDocumentIcon = (type) => {
    switch (type) {
      case 'report':
        return '📄';
      case 'slides':
        return '📊';
      case 'supplementary':
        return '📎';
      default:
        return '📁';
    }
  };

  const getDocumentTypeLabel = (type) => {
    switch (type) {
      case 'report':
        return 'Research Report';
      case 'slides':
        return 'Presentation Slides';
      case 'supplementary':
        return 'Supplementary Material';
      default:
        return 'Other Document';
    }
  };

  const canUpload = user?.role === 'student' || user?.role === 'panel' || user?.role === 'admin';
  const canDelete = (document) => {
    return user?.role === 'admin' || document.uploadedBy?._id === user?.id;
  };

  const documents = session.studentDocuments || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Session Documents</h3>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
            {documents.length}
          </span>
        </div>

        {canUpload && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Upload Document
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-semibold mb-1">📤 Document Upload:</p>
        <p>Upload your research report, presentation slides, and other materials here. Panel members can review documents before the session.</p>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>No documents uploaded yet</p>
          {canUpload && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Upload your first document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((document) => (
            <div
              key={document._id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-3xl">{getDocumentIcon(document.type)}</div>
                  
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{document.title}</h4>
                    
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {getDocumentTypeLabel(document.type)}
                      </span>
                      {document.fileSize && (
                        <span>{document.fileSize}</span>
                      )}
                      <span>
                        Uploaded by: {document.uploadedBy?.name || 'Unknown'}
                      </span>
                      <span>
                        {new Date(document.uploadedAt).toLocaleDateString('en-MY')}
                      </span>
                    </div>

                    {document.description && (
                      <p className="text-sm text-gray-600 mt-2">{document.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View document"
                  >
                    <Eye className="w-5 h-5" />
                  </a>

                  <a
                    href={document.url}
                    download
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Download document"
                  >
                    <Download className="w-5 h-5" />
                  </a>

                  {canDelete(document) && (
                    <button
                      onClick={() => handleDelete(document._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Upload Document</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-6">
              {/* Document Title */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Document Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Progress Report - Chapter 1-3"
                  required
                />
              </div>

              {/* Document Type */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Document Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="report">Research Report</option>
                  <option value="slides">Presentation Slides</option>
                  <option value="supplementary">Supplementary Material</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Document URL */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Document URL *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://drive.google.com/file/..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload to Google Drive and paste the shareable link here
                </p>
              </div>

              {/* File Size */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  File Size (optional)
                </label>
                <input
                  type="text"
                  value={formData.fileSize}
                  onChange={(e) => setFormData({ ...formData, fileSize: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2.5 MB"
                />
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Brief description of the document..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
