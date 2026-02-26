import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Calendar, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { userAPI } from '../../services/api';

export default function PanelAssignmentPage() {
  const [panels, setPanels] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Updated to support two panels
  const [formData, setFormData] = useState({
    panel1Id: '',
    panel2Id: '',
    studentId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await userAPI.getAll();
      const allUsers = data.users || [];

      const panelUsers = allUsers.filter(u => u.role === 'panel');
      const studentUsers = allUsers.filter(u => u.role === 'student');

      setPanels(panelUsers);
      setStudents(studentUsers);

      // Build assignments list from student data
      const assignmentsList = [];
      studentUsers.forEach(student => {
        if (student.assignedPanels && student.assignedPanels.length > 0) {
          student.assignedPanels.forEach(assignment => {
            const panel = allUsers.find(u => 
              u._id === assignment.panelId || u._id === assignment.panelId?._id
            );
            
            if (panel) {
              assignmentsList.push({
                id: `${student._id}-${panel._id}-${assignment.startDate}`,
                panel: panel,
                student: student,
                startDate: assignment.startDate,
                endDate: assignment.endDate,
              });
            }
          });
        }
      });

      setAssignments(assignmentsList);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();

    if (!formData.panel1Id || !formData.panel2Id || !formData.studentId || !formData.startDate) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.panel1Id === formData.panel2Id) {
      alert('You must select two different panel members for the student.');
      return;
    }

    try {
      setSaving(true);

      // Pass the two panels as an array to match our updated backend logic
      await userAPI.assignPanel(
        formData.studentId, 
        [formData.panel1Id, formData.panel2Id], 
        formData.startDate, 
        formData.endDate || null
      );

      alert('✅ Panels assigned successfully!');
      
      // Reset form
      setFormData({
        panel1Id: '',
        panel2Id: '',
        studentId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
      });
      
      loadData();
    } catch (error) {
      console.error('Error assigning panel:', error);
      alert(error.response?.data?.message || 'Failed to assign panels');
    } finally {
      setSaving(false);
    }
  };

  const handleResign = async (panelId, studentId) => {
    if (!window.confirm('Are you sure you want to resign this panel from the student?')) return;

    try {
      const response = await userAPI.unassignPanel(studentId, panelId);
      
      if (response.success) {
        alert('✅ Panel resigned successfully!');
        loadData();
      } else {
        alert(response.message || 'Failed to resign panel');
      }
    } catch (error) {
      console.error('Error resigning panel:', error);
      alert('Failed to resign panel');
    }
  };

  const isActive = (assignment) => {
    if (!assignment.endDate) return true;
    return new Date(assignment.endDate) > new Date();
  };

  return (
    <>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel Assignments</h1>
          <p className="text-gray-600 mt-2">Assign exactly two panel members to supervise each student</p>
        </div>

        {/* Info Alert */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Strict 2-to-1 Assignment Rule</p>
            <p>Every student must be evaluated by exactly two distinct panel members. Ensure you select two different faculty members below. Leave the end date empty for active assignments.</p>
          </div>
        </div>

        {/* Assignment Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-green-600" />
            Assign Panels to Student
          </h2>

          <form onSubmit={handleAssign} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Student Selection (Moved to top left for better UX flow) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Student *
                </label>
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-gray-50"
                  required
                >
                  <option value="">Choose a student...</option>
                  {students.map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.name} ({student.matricNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              {/* Panel 1 Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Panel Member 1 *
                </label>
                <select
                  value={formData.panel1Id}
                  onChange={(e) => setFormData({ ...formData, panel1Id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Choose first panel...</option>
                  {panels.map((panel) => (
                    <option key={panel._id} value={panel._id} disabled={panel._id === formData.panel2Id}>
                      {panel.name} ({panel.userId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Panel 2 Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Panel Member 2 *
                </label>
                <select
                  value={formData.panel2Id}
                  onChange={(e) => setFormData({ ...formData, panel2Id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Choose second panel...</option>
                  {panels.map((panel) => (
                    <option key={panel._id} value={panel._id} disabled={panel._id === formData.panel1Id}>
                      {panel.name} ({panel.userId})
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Submit Button */}
            <div className="flex justify-end border-t border-gray-100 pt-6">
              <button
                type="submit"
                disabled={saving || panels.length < 2 || students.length === 0}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-sm"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Assigning Panels...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Confirm 2-Panel Assignment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Current Assignments Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Current Individual Assignments ({assignments.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500">Loading assignments...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assignments Yet</h3>
              <p className="text-gray-600">Assign panel members to students using the form above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Panel Member</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-semibold text-gray-900">{assignment.panel.name}</p>
                        <p className="text-sm text-gray-600">{assignment.panel.userId}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-semibold text-gray-900">{assignment.student.name}</p>
                        <p className="text-sm text-gray-600">{assignment.student.matricNumber}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Calendar className="w-4 h-4" />
                          {new Date(assignment.startDate).toLocaleDateString('en-MY')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isActive(assignment) ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                            <CheckCircle className="w-4 h-4" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
                            Ended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {isActive(assignment) && (
                          <button
                            onClick={() => handleResign(assignment.panel._id, assignment.student._id)}
                            className="inline-flex items-center gap-2 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                            title="Resign panel"
                          >
                            <Trash2 className="w-4 h-4" /> Resign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Statistics Block */}
        {assignments.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-semibold text-gray-600">Total Assignments</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{assignments.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-semibold text-gray-600">Active Assignments</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {assignments.filter(a => isActive(a)).length}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-semibold text-gray-600">Ended Assignments</p>
              <p className="text-3xl font-bold text-gray-600 mt-2">
                {assignments.filter(a => !isActive(a)).length}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}