import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { timetableAPI } from '../../services/api';
import { Calendar, Clock, MapPin, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

export default function SchedulePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📅 Fetching sessions for user:', user.id);
      
      const response = await timetableAPI.getMy();
      console.log('✅ Timetable response:', response);
      
      const sessionsData = response.timetables || response.sessions || [];
      console.log(`📊 Found ${sessionsData.length} sessions`);
      
      setSessions(sessionsData);
    } catch (error) {
      console.error('❌ Error fetching sessions:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (sessionId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingDoc(sessionId);
      const formData = new FormData();
      formData.append('document', file);
      formData.append('title', file.name);
      formData.append('description', 'Student submission');

      console.log('📤 Uploading document for session:', sessionId);
      await timetableAPI.uploadDocument(sessionId, formData);
      console.log('✅ Upload successful');
      
      alert('Document uploaded successfully!');
      await fetchSessions();
    } catch (error) {
      console.error('❌ Upload failed:', error);
      alert('Failed to upload document: ' + error.message);
    } finally {
      setUploadingDoc(null);
    }
  };

  const isDeadlinePassed = (deadline) => {
    return deadline && new Date(deadline) < new Date();
  };

  const isUpcoming = (date) => {
    return new Date(date) >= new Date();
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-900 font-semibold mb-2">Error Loading Schedule</h3>
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchSessions}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const upcomingSessions = sessions.filter(s => isUpcoming(s.date));
  const pastSessions = sessions.filter(s => !isUpcoming(s.date));

  console.log(`📊 Upcoming: ${upcomingSessions.length}, Past: ${pastSessions.length}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
        <p className="text-gray-600 mt-1">View your symposium sessions and upload required documents</p>
      </div>

      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="text-blue-900">
          📊 Status: Found <strong>{sessions.length}</strong> total sessions 
          ({upcomingSessions.length} upcoming, {pastSessions.length} past)
          {sessions.length === 0 && ' (No sessions scheduled yet)'}
        </p>
      </div>

      {/* Upcoming Sessions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Sessions ({upcomingSessions.length})</h2>
        {upcomingSessions.length > 0 ? (
          <div className="space-y-4">
            {upcomingSessions.map((session) => (
              <div key={session._id} className="bg-white rounded-lg border border-gray-200">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{session.sessionType}</p>
                    </div>
                    {session.deadline && !isDeadlinePassed(session.deadline) && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium border border-orange-200">
                        <AlertCircle className="w-4 h-4" />
                        Deadline: {new Date(session.deadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <span className="text-sm">{new Date(session.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-5 h-5 text-green-600" />
                      <span className="text-sm">{session.startTime} - {session.endTime}</span>
                    </div>
                    {session.venue && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <MapPin className="w-5 h-5 text-red-600" />
                        <span className="text-sm">{session.venue}</span>
                      </div>
                    )}
                  </div>

                  {session.description && (
                    <p className="text-gray-600 mb-4 text-sm">{session.description}</p>
                  )}

                  {session.requirements && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-blue-900 mb-2 text-sm">Requirements:</h4>
                      <p className="text-sm text-blue-800">{session.requirements}</p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">Your Documents:</h4>
                    {session.studentDocuments?.filter(d => d.uploadedBy === user.id || d.uploadedBy?._id === user.id).length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {session.studentDocuments.filter(d => d.uploadedBy === user.id || d.uploadedBy?._id === user.id).map((doc, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-gray-600" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                                <p className="text-xs text-gray-500">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mb-3">No documents uploaded yet</p>
                    )}

                    {!isDeadlinePassed(session.deadline) && (
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors text-sm">
                        {uploadingDoc === session._id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Upload Document</span>
                          </>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileUpload(session._id, e)}
                          disabled={uploadingDoc === session._id}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Upcoming Sessions</h3>
            <p className="text-gray-600">You don't have any upcoming sessions scheduled. Your coordinator will create sessions for you.</p>
          </div>
        )}
      </div>

      {/* Past Sessions */}
      {pastSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Sessions ({pastSessions.length})</h2>
          <div className="space-y-3">
            {pastSessions.map((session) => (
              <div key={session._id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{session.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{session.sessionType}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <p>{new Date(session.date).toLocaleDateString()}</p>
                    <p>{session.startTime}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
