import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import SessionDocuments from '../../components/SessionDocuments';
import PanelPreReviewNotes from '../../components/PanelPreReviewNotes';
import { Calendar, Clock, MapPin, Users, ArrowLeft, AlertCircle, QrCode, FileText } from 'lucide-react';
import { timetableAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Attendance Gateway State
  const [attendanceActive, setAttendanceActive] = useState(false);
  const [attendanceCode, setAttendanceCode] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');

  useEffect(() => { loadSession(); }, [id]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const data = await timetableAPI.getById(id);
      setSession(data.timetable);
    } catch (error) {
      alert('Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = () => {
    if (!attendanceActive) setAttendanceCode(Math.floor(100000 + Math.random() * 900000).toString());
    setAttendanceActive(!attendanceActive);
  };

  const markCoPanelAttendance = (panelId, status) => {
    // Future API Hook
    alert(`Marked panel attendance as ${status.toUpperCase()}. (API pending)`);
    setAbsenceReason('');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'ongoing': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) return <div className="text-center p-12">Loading...</div>;
  if (!session) return <div className="text-center p-12 text-red-600">Session not found</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      {/* 1. Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{session.title || session.sessionType}</h1>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(session.status)}`}>{session.status}</span>
          </div>
          {['panel', 'coordinator'].includes(user?.role) && (
            <button 
              onClick={() => navigate(`/panel/evaluation/new?student=${session.students?.[0]?._id}`)}
              className="mt-4 sm:mt-0 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-sm"
            >
              <FileText className="w-5 h-5" /> Start Evaluation
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mt-4">
          <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-gray-400" /> {new Date(session.date).toLocaleDateString()}</div>
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-gray-400" /> {session.startTime} - {session.endTime}</div>
          <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-gray-400" /> {session.venue}</div>
          <div className="flex items-center gap-2"><Users className="w-5 h-5 text-gray-400" /> {session.students?.[0]?.name || 'No Student'}</div>
        </div>
      </div>

      {/* 2. Command Center */}
      {(user?.role === 'panel' || user?.role === 'admin') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Gateway */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-indigo-600" /> Attendance Gateway
            </h2>
            {!attendanceActive ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-600 mb-4 text-sm">Open the gateway to allow students and co-panels to sign in.</p>
                <button onClick={toggleAttendance} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">Generate QR & Code</button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4 bg-indigo-50 p-6 rounded-lg">
                <div className="bg-white p-3 rounded-xl shadow-sm"><QRCodeSVG value={`https://fsktm-zkp.edu.my/attend/${id}?code=${attendanceCode}`} size={140} /></div>
                <div className="text-center w-full">
                  <p className="text-xs font-bold text-indigo-900 uppercase">Manual Entry Code</p>
                  <p className="text-4xl font-black text-indigo-600 tracking-[0.25em]">{attendanceCode}</p>
                </div>
                <button onClick={toggleAttendance} className="text-sm font-semibold text-red-600 hover:text-red-800 underline">Close Gateway</button>
              </div>
            )}
          </div>

          {/* Co-Panel Management */}
          {session.panels && session.panels.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> Co-Panel Verification</h2>
              <div className="space-y-3">
                {session.panels.filter(p => p._id !== user.id).map((panel) => (
                  <div key={panel._id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="font-bold text-gray-900 mb-2">{panel.name} <span className="text-xs font-normal text-gray-500">({panel.userId})</span></div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button onClick={() => markCoPanelAttendance(panel._id, 'present')} className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded">Confirm Present</button>
                      <input type="text" placeholder="Reason (if absent)..." className="text-xs px-2 py-1.5 border rounded w-32" onChange={(e) => setAbsenceReason(e.target.value)} />
                      <button onClick={() => markCoPanelAttendance(panel._id, 'absent')} className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded border border-red-200">Mark Absent</button>
                    </div>
                  </div>
                ))}
                {session.panels.length <= 1 && <p className="text-sm text-gray-500 italic text-center py-4">No other panels assigned.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Existing Components */}
      <div className="mb-6"><SessionDocuments session={session} onUpdate={loadSession} /></div>
      {['panel', 'coordinator'].includes(user?.role) && (
        <div className="mb-6"><PanelPreReviewNotes session={session} onUpdate={loadSession} /></div>
      )}
    </div>
  );
}