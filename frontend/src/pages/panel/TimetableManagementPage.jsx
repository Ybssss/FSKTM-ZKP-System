import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, MapPin, Users, Edit, Trash2, X, FileText, Search, ShieldAlert } from 'lucide-react';
import { timetableAPI, userAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TimetableManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isPanel = user?.role === 'panel';
  const isCoordinator = user?.role === 'coordinator';

  const [sessions, setSessions] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    sessionType: '', title: '', description: '', date: '', startTime: '', endTime: '',
    venue: '', deadline: '', requirements: '', studentId: '', status: 'scheduled', attachmentUrl: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const sessionsData = await timetableAPI.getAll();
      setSessions(sessionsData.timetables || []);

      if (isAdmin) {
        const usersData = await userAPI.getAll();
        setAllStudents((usersData.users || usersData).filter(u => u.role === 'student'));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.studentId) return alert('Please select a student');

    try {
      const selectedStudent = allStudents.find(s => s._id === formData.studentId);
      const activePanels = (selectedStudent?.assignedPanels || [])
        .filter(ap => !ap.endDate || new Date(ap.endDate) > new Date())
        .map(ap => ap.panelId._id || ap.panelId);

      const sessionData = {
        ...formData,
        students: [formData.studentId],
        panels: editingSession ? editingSession.panels.map(p => p._id) : activePanels,
      };

      if (editingSession) {
        await timetableAPI.update(editingSession._id, sessionData);
        alert('✅ Session updated successfully!');
      } else {
        await timetableAPI.create(sessionData);
        alert('✅ Session scheduled successfully!');
      }

      setShowModal(false); setEditingSession(null); resetForm(); loadData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save session');
    }
  };

  const handleEdit = (session) => {
    setEditingSession(session);
    setFormData({
      sessionType: session.sessionType || '', title: session.title || '', description: session.description || '',
      date: session.date ? new Date(session.date).toISOString().split('T')[0] : '', startTime: session.startTime || '',
      endTime: session.endTime || '', venue: session.venue || '', deadline: session.deadline ? new Date(session.deadline).toISOString().split('T')[0] : '',
      requirements: session.requirements || '', studentId: session.students?.[0]?._id || session.students?.[0] || '',
      status: session.status || 'scheduled', attachmentUrl: session.attachmentUrl || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    try {
      await timetableAPI.delete(id); loadData();
    } catch (error) { alert('Failed to delete session'); }
  };

  const resetForm = () => setFormData({ sessionType: '', title: '', description: '', date: '', startTime: '', endTime: '', venue: '', deadline: '', requirements: '', studentId: '', status: 'scheduled', attachmentUrl: '' });

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'ongoing': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.students?.[0]?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" /> Symposium Schedule
          </h1>
          <p className="text-gray-600 mt-1">{isAdmin ? 'Manage all symposium presentations.' : 'Your assigned evaluations.'}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-sm">
            <Plus className="w-5 h-5" /> Schedule Session
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input type="text" placeholder="Search by student or title..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-12 text-center">Loading...</div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200"><p className="text-gray-500">No sessions found.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map(session => (
            <div key={session._id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md flex flex-col h-full overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(session.status)}`}>{session.status.toUpperCase()}</span>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{session.sessionType}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-1 line-clamp-2">{session.title || 'Untitled Session'}</h3>
                <div className="flex items-center gap-2 text-indigo-700 font-medium text-sm mt-3">
                  <Users className="w-4 h-4" /> {session.students?.[0]?.name || 'No Student Assigned'}
                </div>
              </div>

              <div className="p-5 space-y-3 bg-white text-sm text-gray-600">
                <div className="flex items-center gap-3"><Calendar className="w-4 h-4 text-gray-400" /> <span>{new Date(session.date).toLocaleDateString('en-MY')}</span></div>
                <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-gray-400" /> <span>{session.startTime} - {session.endTime}</span></div>
                <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-gray-400" /> <span className="truncate">{session.venue}</span></div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
                <button onClick={() => navigate(`/panel/sessions/${session._id}`)} className="flex-1 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold hover:bg-indigo-50 flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> Command Center
                </button>
                {isAdmin && (
                  <>
                    <button onClick={() => handleEdit(session)} className="p-2 text-gray-400 hover:text-indigo-600 bg-white border border-gray-200 rounded-lg" title="Edit"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(session._id)} className="p-2 text-gray-400 hover:text-red-600 bg-white border border-gray-200 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Create/Edit Modal (Exactly as you uploaded) */}
      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8 flex flex-col max-h-[90vh]">
            <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                {editingSession ? 'Edit Session' : 'Schedule New Session'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingSession(null); resetForm(); }} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4">
              <form id="sessionForm" onSubmit={handleSubmit} className="space-y-5">
                
                {!editingSession && (
                  <div className="bg-indigo-50 text-indigo-800 text-xs p-3 rounded flex items-start gap-2 border border-indigo-100">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <p>When you select a student, the system will automatically pull in the 2 panel members you assigned to them in the Assignments tab.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Select Student *</label>
                    <select
                      value={formData.studentId}
                      onChange={(e) => {
                        const selectedStudent = allStudents.find(s => s._id === e.target.value);
                        const newTitle = formData.sessionType && selectedStudent ? `${formData.sessionType} - ${selectedStudent.name}` : formData.title;
                        setFormData({ ...formData, studentId: e.target.value, title: newTitle });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      required
                    >
                      <option value="">Choose a student...</option>
                      {allStudents.map((student) => (<option key={student._id} value={student._id}>{student.name} ({student.matricNumber})</option>))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Session Type *</label>
                    <select
                      value={formData.sessionType}
                      onChange={(e) => {
                        const selectedStudent = allStudents.find(s => s._id === formData.studentId);
                        const newTitle = e.target.value && selectedStudent ? `${e.target.value} - ${selectedStudent.name}` : formData.title;
                        setFormData({ ...formData, sessionType: e.target.value, title: newTitle });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      required
                    >
                      <option value="">Select session type...</option>
                      <option value="Proposal Defense">Proposal Defense</option>
                      <option value="Progress Review #1">Progress Review #1</option>
                      <option value="Progress Review #2">Progress Review #2</option>
                      <option value="Progress Review #3">Progress Review #3</option>
                      <option value="Mid-term Presentation">Mid-term Presentation</option>
                      <option value="Final Defense">Final Defense</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Session Title *</label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" placeholder="e.g., Proposal Defense - Ahmad Ibrahim" required />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border border-gray-200">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Date *</label>
                    <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Start Time *</label>
                    <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">End Time *</label>
                    <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Venue *</label>
                    <input type="text" value={formData.venue} onChange={(e) => setFormData({ ...formData, venue: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" placeholder="e.g., Seminar Room A" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500">
                      <option value="scheduled">Scheduled</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description (Optional)</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" rows="2" placeholder="Brief description..." />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                   <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Requirements (Optional)</label>
                    <textarea value={formData.requirements} onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" rows="2" placeholder="Submission requirements..." />
                  </div>
                   <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Attachment Link (Optional)</label>
                    <input type="url" value={formData.attachmentUrl} onChange={(e) => setFormData({ ...formData, attachmentUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 mb-2" placeholder="https://drive.google.com/..." />
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Submission Deadline</label>
                    <input type="date" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>

              </form>
            </div>

            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-4 justify-end rounded-b-xl z-10">
              <button type="button" onClick={() => { setShowModal(false); setEditingSession(null); resetForm(); }} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded transition-colors">Cancel</button>
              <button type="submit" form="sessionForm" className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded shadow-sm hover:bg-indigo-700 transition-colors">
                {editingSession ? 'Update Session' : 'Save Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}