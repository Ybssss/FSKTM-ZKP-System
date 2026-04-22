import React, { useState, useEffect } from "react";
import {
  Trash2,
  Calendar,
  Users,
  Search,
  Lightbulb,
  Target,
  AlertTriangle,
} from "lucide-react";
import { timetableAPI, userAPI } from "../../services/api"; // ✅ Fixed Import

export default function PanelAssignmentPage() {
  const [panels, setPanels] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search & Selection States
  const [studentSearch, setStudentSearch] = useState("");
  const [panelSearch, setPanelSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedPanels, setSelectedPanels] = useState([]);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Expertise Matching States
  const [researchTitle, setResearchTitle] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [matchingExpertise, setMatchingExpertise] = useState(false);
  const [selectedStudentForMatching, setSelectedStudentForMatching] =
    useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await userAPI.getAll();
      const allUsers = res.data.users || [];
      setPanels(allUsers.filter((u) => u.role === "panel"));
      setStudents(allUsers.filter((u) => u.role === "student"));
    } catch (error) {
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const togglePanel = (id) => {
    if (selectedPanels.includes(id)) {
      setSelectedPanels((prev) => prev.filter((p) => p !== id));
    } else {
      if (selectedPanels.length >= 2)
        return alert("You can only select exactly 2 panels per assignment.");
      setSelectedPanels([...selectedPanels, id]);
    }
  };

  const handleBulkAssign = async (e) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0 || selectedPanels.length !== 2) return;

    try {
      setSaving(true);
      await timetableAPI.create({
        panelIds: selectedPanels,
        studentIds: selectedStudentIds,
        startDate,
      });
      alert("✅ Panels assigned successfully!");

      // UX Feature: Remember the panel inputs for ease of bulk action, just clear students
      setSelectedStudentIds([]);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to assign panels");
    } finally {
      setSaving(false);
    }
  };

  // Expertise Matching Function
  const handleExpertiseMatching = async () => {
    if (!researchTitle.trim()) {
      alert("Please enter a research title");
      return;
    }

    try {
      setMatchingExpertise(true);
      setRecommendations([]);

      const response = await timetableAPI.matchExpertise(
        researchTitle.trim(),
        selectedStudentForMatching,
      );

      setRecommendations(response.recommendations || []);
    } catch (error) {
      alert(
        "Failed to match expertise: " +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setMatchingExpertise(false);
    }
  };

  const selectRecommendedPanels = (panelIds) => {
    setSelectedPanels(panelIds);
  };

  // UX Feature: Delete relation entirely for misinputs
  const handleDeleteRelation = async (studentId, assignedPanelsList) => {
    if (
      !window.confirm(
        "Are you sure you want to delete all panel assignments for this student?",
      )
    )
      return;
    try {
      // Unassign both panels mapped to this student
      for (const ap of assignedPanelsList) {
        const pId = ap.panelId?._id || ap.panelId;
        await userAPI.unassignPanel(studentId, pId);
      }
      loadData();
    } catch (error) {
      alert("Failed to delete relations");
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.matricNumber &&
        s.matricNumber.toLowerCase().includes(studentSearch.toLowerCase())),
  );

  const filteredPanels = panels.filter(
    (p) =>
      p.name.toLowerCase().includes(panelSearch.toLowerCase()) ||
      (p.userId && p.userId.toLowerCase().includes(panelSearch.toLowerCase())),
  );

  // UX Feature: Group Assignments by Student so both panels show together
  const groupedAssignments = students.filter(
    (s) => s.assignedPanels && s.assignedPanels.length > 0,
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Bulk Panel Assignments
        </h1>
        <p className="text-gray-600 mt-2">
          Assign exactly two panel members to multiple students at once.
        </p>
      </div>

      {/* Expertise Matching Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">
            AI-Powered Panel Matching
          </h2>
        </div>
        <p className="text-gray-600 mb-4">
          Enter a student's research title to get expert panel recommendations
          based on their expertise from UTHM Community profiles.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Research Title *
            </label>
            <input
              type="text"
              value={researchTitle}
              onChange={(e) => setResearchTitle(e.target.value)}
              placeholder="e.g., Zero-Knowledge Proof Authentication System for Academic Evaluation"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Student (Optional - for conflict checking)
            </label>
            <select
              value={selectedStudentForMatching || ""}
              onChange={(e) =>
                setSelectedStudentForMatching(e.target.value || null)
              }
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">
                Select student to avoid supervisor conflict
              </option>
              {students.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.name} ({student.matricNumber})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleExpertiseMatching}
          disabled={matchingExpertise || !researchTitle.trim()}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
        >
          {matchingExpertise ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Matching Expertise...
            </>
          ) : (
            <>
              <Target className="w-4 h-4" />
              Find Expert Panels
            </>
          )}
        </button>

        {/* Recommendations Display */}
        {recommendations.length > 0 && (
          <div className="mt-6 bg-white rounded-lg p-4 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              Recommended Panels ({recommendations.length})
            </h3>
            <div className="space-y-3">
              {recommendations.slice(0, 4).map((rec, index) => (
                <div
                  key={rec.panelId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {rec.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Match Score: {rec.match.score}%
                        </p>
                      </div>
                    </div>
                    {rec.match.matches.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {rec.match.matches.slice(0, 3).map((match, i) => (
                          <span
                            key={i}
                            className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                          >
                            {match.term}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => selectRecommendedPanels([rec.panelId])}
                    className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-sm font-medium"
                  >
                    Select This Panel
                  </button>
                </div>
              ))}
            </div>
            {recommendations.length >= 2 && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    selectRecommendedPanels(
                      recommendations.slice(0, 2).map((r) => r.panelId),
                    )
                  }
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 text-sm"
                >
                  Select Top 2 Panels
                </button>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  System automatically prevents supervisor conflicts
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Step 1: Students */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            1. Select Students
          </h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search Student Name or Matric No..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50"
            />
          </div>
          <div className="flex-1 overflow-y-auto border rounded-lg p-2 max-h-80">
            {filteredStudents.map((student) => (
              <label
                key={student._id}
                className="flex items-center space-x-3 p-3 hover:bg-gray-100 rounded cursor-pointer border-b last:border-0"
              >
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(student._id)}
                  onChange={() => toggleStudent(student._id)}
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="font-medium text-gray-800">
                  {student.name}{" "}
                  <span className="text-sm text-gray-500">
                    ({student.matricNumber})
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Step 2: Panels & Submit */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            2. Select 2 Panels
          </h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search Panel Name..."
              value={panelSearch}
              onChange={(e) => setPanelSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50"
            />
          </div>
          <div className="flex-1 overflow-y-auto border rounded-lg p-2 max-h-60 mb-6">
            {filteredPanels.map((panel) => (
              <label
                key={panel._id}
                className={`flex items-center space-x-3 p-3 hover:bg-gray-100 rounded cursor-pointer border-b last:border-0 ${selectedPanels.includes(panel._id) ? "bg-green-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedPanels.includes(panel._id)}
                  onChange={() => togglePanel(panel._id)}
                  className="w-4 h-4 text-green-600"
                />
                <span className="font-medium text-gray-800">
                  {panel.name}{" "}
                  <span className="text-sm text-gray-500">
                    ({panel.userId})
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-auto">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Assignment Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border rounded-lg mb-4"
            />

            <button
              onClick={handleBulkAssign}
              disabled={
                saving ||
                selectedStudentIds.length === 0 ||
                selectedPanels.length !== 2
              }
              className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-400 flex justify-center items-center"
            >
              {saving
                ? "Assigning..."
                : `Confirm Assignment (${selectedStudentIds.length} Students)`}
            </button>
          </div>
        </div>
      </div>

      {/* UX Feature: Grouped Overview Table showing BOTH panels */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" /> Grouped Assignments (
            {groupedAssignments.length} Students)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white text-xs uppercase text-gray-600 border-b">
              <tr>
                <th className="px-6 py-4 font-bold">Student</th>
                <th className="px-6 py-4 font-bold">Assigned Panels</th>
                <th className="px-6 py-4 font-bold">Date Assigned</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupedAssignments.map((student) => (
                <tr key={student._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{student.name}</p>
                    <p className="text-sm text-gray-500">
                      {student.matricNumber}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {student.assignedPanels.map((ap, index) => {
                      const pId = ap.panelId?._id || ap.panelId;
                      const panelObj = panels.find((p) => p._id === pId);
                      return (
                        <div
                          key={index}
                          className="text-sm font-medium text-indigo-700 bg-indigo-50 inline-block px-2 py-1 rounded mr-2 mb-1 border border-indigo-100"
                        >
                          {panelObj ? panelObj.name : "Unknown Panel"}
                        </div>
                      );
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {new Date(
                        student.assignedPanels[0]?.startDate,
                      ).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() =>
                        handleDeleteRelation(
                          student._id,
                          student.assignedPanels,
                        )
                      }
                      className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold border border-transparent hover:border-red-200 flex items-center gap-2 ml-auto transition-all"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Relation
                    </button>
                  </td>
                </tr>
              ))}
              {groupedAssignments.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500">
                    No panels have been assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
