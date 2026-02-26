import React, { useState, useEffect } from 'react';
import { Save, Edit, Eye, FileText } from 'lucide-react';
import { timetableAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function PanelPreReviewNotes({ session, onUpdate }) {
  const { user } = useAuth();
  const isPanel = user?.role === 'panel' || user?.role === 'admin';

  const [notes, setNotes] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Find current panel's notes
  const myNotes = session.panelNotes?.find(
    note => note.panelId?._id === user?.id || note.panelId === user?.id
  );

  useEffect(() => {
    if (myNotes) {
      setNotes(myNotes.notes);
      setIsDraft(myNotes.isDraft);
    }
  }, [myNotes]);

  const handleSave = async (saveAsDraft = false) => {
    if (!notes.trim()) {
      alert('Please write some notes before saving');
      return;
    }

    try {
      setSaving(true);
      await timetableAPI.addNotes(session._id, {
        notes: notes.trim(),
        isDraft: saveAsDraft,
      });

      alert(saveAsDraft ? '✅ Notes saved as draft!' : '✅ Notes finalized!');
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Save notes error:', error);
      alert('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  if (!isPanel) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Pre-Review Notes</h3>
          {myNotes && (
            <span className={`px-2 py-1 text-xs rounded-full ${
              myNotes.isDraft 
                ? 'bg-yellow-100 text-yellow-700' 
                : 'bg-green-100 text-green-700'
            }`}>
              {myNotes.isDraft ? 'Draft' : 'Finalized'}
            </span>
          )}
        </div>

        {myNotes && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <Edit className="w-4 h-4" />
            Edit Notes
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
        <p className="font-semibold mb-1">📝 Pre-Review Notes:</p>
        <p>Review student documents in advance and write your initial thoughts here. These notes are private and only visible to you until finalized.</p>
      </div>

      {/* Notes Display/Edit */}
      {myNotes && !isEditing ? (
        /* View Mode */
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="prose max-w-none">
            <p className="text-gray-800 whitespace-pre-wrap">{myNotes.notes}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-300 text-xs text-gray-600">
            <p>Last updated: {new Date(myNotes.updatedAt).toLocaleString('en-MY')}</p>
          </div>
        </div>
      ) : (
        /* Edit Mode */
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            rows="10"
            placeholder="Write your pre-review notes here...

Examples:
• Initial observations from reading the report
• Questions to ask during presentation
• Areas that need more clarification
• Preliminary assessment notes
• Points to discuss with other panel members"
          />

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {notes.length} characters
            </div>

            <div className="flex gap-3">
              {isEditing && myNotes && (
                <button
                  onClick={() => {
                    setNotes(myNotes.notes);
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}

              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-4 py-2 border border-yellow-500 text-yellow-700 rounded-lg hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Draft
              </button>

              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Finalize Notes
              </button>
            </div>
          </div>

          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
            <p className="font-semibold mb-1">💡 Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Draft:</strong> Save as draft while you're still reviewing. You can edit later.</li>
              <li><strong>Finalize:</strong> Finalize when you've completed your pre-review. You can still edit if needed.</li>
              <li><strong>Privacy:</strong> Your notes are private and only visible to you.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Other Panel Notes (Read-only, for admin) */}
      {user?.role === 'admin' && session.panelNotes && session.panelNotes.length > 1 && (
        <div className="mt-6 pt-6 border-t border-gray-300">
          <h4 className="font-semibold text-gray-900 mb-3">All Panel Notes:</h4>
          <div className="space-y-3">
            {session.panelNotes.map((note) => (
              <div key={note._id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{note.panelId?.name}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    note.isDraft 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {note.isDraft ? 'Draft' : 'Finalized'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.notes}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(note.updatedAt).toLocaleString('en-MY')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
