import React, { useState, useEffect } from 'react';
import { QrCode, Calendar, Clock, MapPin, Download, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { timetableAPI, qrAPI } from '../../services/api';

export default function QRCodePage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await timetableAPI.getAll();
      
      // Filter upcoming sessions only
      const upcoming = (data.timetables || []).filter(
        t => new Date(t.date) >= new Date() && t.status === 'scheduled'
      );
      
      setSessions(upcoming);
      console.log('✅ Loaded', upcoming.length, 'upcoming sessions');
    } catch (error) {
      console.error('Error loading sessions:', error);
      alert('Failed to load sessions. Make sure sessions are created in Session Management.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async (session) => {
    try {
      setGenerating(true);
      setSelectedSession(session);
      
      console.log('📱 Generating QR for session:', session._id);

      // Call backend to generate QR with verification token
      const response = await qrAPI.generate(session._id);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to generate QR');
      }

      const qrPayload = response.qrData;
      setQrData(qrPayload);

      // Generate QR code image
      const qrCodeImage = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 300,
        margin: 2,
        color: {
          dark: '#10B981',
          light: '#FFFFFF',
        },
      });

      setQrImage(qrCodeImage);
      console.log('✅ QR code generated successfully');
    } catch (error) {
      console.error('❌ Generate QR error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to generate QR code');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrImage || !selectedSession) return;

    const link = document.createElement('a');
    link.download = `QR_${selectedSession.sessionType}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = qrImage;
    link.click();
  };

  return (
    <>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">QR Code Generator</h1>
          <p className="text-gray-600 mt-2">Generate QR codes for attendance tracking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Upcoming Sessions</h2>
              <p className="text-sm text-gray-600 mt-1">
                Select a session to generate QR code
              </p>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Loading sessions...</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No upcoming sessions</p>
                  <p className="text-sm text-gray-400">
                    Create sessions in Session Management first
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {sessions.map((session) => (
                    <div
                      key={session._id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedSession?._id === session._id
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                      }`}
                      onClick={() => handleGenerateQR(session)}
                    >
                      <h3 className="font-semibold text-gray-900 mb-2">
                        {session.sessionType}
                      </h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(session.date).toLocaleDateString('en-MY', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {session.startTime} - {session.endTime}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {session.venue}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* QR Code Display */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Generated QR Code</h2>
              {selectedSession && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedSession.sessionType}
                </p>
              )}
            </div>

            <div className="p-6">
              {generating ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Generating QR code...</p>
                </div>
              ) : qrImage && selectedSession ? (
                <div className="text-center">
                  <div className="bg-gray-50 rounded-lg p-6 mb-6 inline-block">
                    <img
                      src={qrImage}
                      alt="QR Code"
                      className="w-80 h-80 mx-auto"
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                    <h4 className="font-semibold text-blue-900 text-sm mb-2">
                      Session Details:
                    </h4>
                    <div className="text-xs text-blue-700 space-y-1">
                      <div><span className="font-medium">Type:</span> {selectedSession.sessionType}</div>
                      <div><span className="font-medium">Date:</span> {new Date(selectedSession.date).toLocaleDateString('en-MY')}</div>
                      <div><span className="font-medium">Time:</span> {selectedSession.startTime} - {selectedSession.endTime}</div>
                      <div><span className="font-medium">Venue:</span> {selectedSession.venue}</div>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadQR}
                    className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download QR Code
                  </button>

                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                    <p className="text-xs text-yellow-800">
                      <span className="font-semibold">Note:</span> Display this QR code at the venue. 
                      Students will scan it to mark their attendance. Each QR code is unique and valid 
                      only for this specific session.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No QR code generated</p>
                  <p className="text-sm text-gray-400">
                    Select a session from the left to generate
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-3">How to use QR codes:</h3>
          <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
            <li>Create a session in <strong>Session Management</strong> first</li>
            <li>Select the session from the list above</li>
            <li>Click to generate the QR code</li>
            <li>Download and display the QR code at the presentation venue</li>
            <li>Students scan the QR code with their phones to mark attendance</li>
            <li>Each QR code is unique and valid only for its specific session</li>
          </ol>
        </div>
      </div>
    </>
  );
}
