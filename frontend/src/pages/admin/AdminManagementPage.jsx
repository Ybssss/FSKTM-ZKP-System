import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { UserMinus } from "lucide-react";

export default function AdminManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("create");
  const [studentView, setStudentView] = useState("unassigned");

  const [students, setStudents] = useState([]);
  const [panels, setPanels] = useState([]);

  // 🔴 FIXED: Separated search terms to prevent cross-contamination
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [panelSearchTerm, setPanelSearchTerm] = useState("");

  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedPanels, setSelectedPanels] = useState([]);

  const [isMatching, setIsMatching] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const [formData, setFormData] = useState({
    userId: "",
    name: "",
    email: "",
    role: "",
    matricNumber: "",
  });

  useEffect(() => {
    if (activeTab === "assign") fetchUsers();
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users");
      const allUsers = res.data.users || [];
      setStudents(allUsers.filter((u) => u.role === "student"));
      setPanels(allUsers.filter((u) => ["panel", "admin"].includes(u.role)));
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/users", formData);

      alert(
        `User created successfully.\nUser ID: ${
          res.data.user?.userId || formData.userId
        }\nRegistration Code: ${res.data.registrationCode}`,
      );
      setFormData({
        userId: "",
        name: "",
        email: "",
        role: "",
        matricNumber: "",
      });
      fetchUsers();
    } catch (err) {
      alert("Failed to create user");
    }
  };

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) => {
      if (!prev.includes(id)) setAiSuggestions([]);
      return prev.includes(id)
        ? prev.filter((sId) => sId !== id)
        : [...prev, id];
    });
  };

  const togglePanel = (id) => {
    if (selectedPanels.includes(id)) {
      setSelectedPanels((prev) => prev.filter((pId) => pId !== id));
    } else {
      if (selectedPanels.length >= 2) return alert("Maximum 2 panels allowed.");
      setSelectedPanels([...selectedPanels, id]);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedPanels.length !== 2)
      return alert("You must select exactly 2 panels.");
    try {
      for (const studentId of selectedStudentIds) {
        await api.post("/users/assign-panel", {
          studentId: studentId,
          panelIds: selectedPanels,
        });
      }
      alert(`Assigned successfully to ${selectedStudentIds.length} students!`);
      setSelectedStudentIds([]);
      setSelectedPanels([]);
      setAiSuggestions([]);
      fetchUsers();
    } catch (err) {
      alert("Assignment failed.");
    }
  };

  const handleUnassign = async (student) => {
    if (
      !window.confirm(
        `Are you sure you want to remove the panels from ${student.name}?`,
      )
    )
      return;
    try {
      for (const panelObj of student.assignedPanels) {
        let panelIdToUnassign =
          panelObj.panelId?._id || panelObj.panelId || panelObj._id || panelObj;
        if (panelIdToUnassign)
          await api.post("/users/unassign-panel", {
            studentId: student._id,
            panelId: panelIdToUnassign,
          });
      }
      alert(`${student.name} unassigned successfully.`);
      fetchUsers();
    } catch (err) {
      alert("Failed to unassign.");
    }
  };

  const handleAIMatch = async (student) => {
    if (!student.researchTitle)
      return alert(
        "This student has not set their Research Title yet. Cannot use AI.",
      );
    setIsMatching(true);
    setAiSuggestions([]);
    try {
      setSelectedStudentIds([student._id]);
      const res = await api.post("/timetables/match-expertise", {
        researchTitle: student.researchTitle,
        researchAbstract: student.researchAbstract || "",
        studentId: student._id,
      });
      if (res.data.recommendedPanels && res.data.recommendedPanels.length > 0) {
        setAiSuggestions(
          (res.data.recommendations || [])
            .filter((item) => item.score >= 30)
            .slice(0, 2)
            .map((item) => ({
              _id: item.panelId,
              name: item.name,
              email: item.email,
              expertiseTags: item.expertiseTags || [],
              matchScore: item.score,
              matches: item.matches || [],
            })),
        );
      } else {
        alert("AI could not find any relevant panels.");
      }
    } catch (err) {
      alert("AI Matching failed.");
    } finally {
      setIsMatching(false);
    }
  };

  const unassignedStudents = students.filter(
    (s) => !s.assignedPanels || s.assignedPanels.length === 0,
  );
  const assignedStudents = students.filter(
    (s) => s.assignedPanels && s.assignedPanels.length > 0,
  );

  const activeList =
    studentView === "unassigned" ? unassignedStudents : assignedStudents;

  // 🔴 Uses studentSearchTerm purely!
  const filteredActiveList = activeList.filter((s) => {
    const searchLow = studentSearchTerm.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(searchLow)) ||
      (s.matricNumber && s.matricNumber.toLowerCase().includes(searchLow))
    );
  });

  const activeSvId =
    selectedStudentIds.length === 1
      ? students.find((s) => s._id === selectedStudentIds[0])?.supervisorId
          ?._id ||
        students.find((s) => s._id === selectedStudentIds[0])?.supervisorId
      : null;

  // 🔴 Uses panelSearchTerm purely!
  let displayPanels = panels.filter((p) => {
    if (p._id === activeSvId) return false;
    const searchLow = panelSearchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(searchLow) ||
      (p.expertiseTags &&
        p.expertiseTags.some((t) => t.toLowerCase().includes(searchLow)))
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">System Management</h1>

      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab("create")}
          className={`pb-2 ${activeTab === "create" ? "border-b-2 border-indigo-600 font-bold" : "text-gray-500"}`}
        >
          Create Users
        </button>
        <button
          onClick={() => setActiveTab("assign")}
          className={`pb-2 ${activeTab === "assign" ? "border-b-2 border-indigo-600 font-bold" : "text-gray-500"}`}
        >
          Panel Assignment
        </button>
      </div>

      {activeTab === "create" && (
        <form
          onSubmit={handleCreateUser}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 max-w-xl"
        >
          {/* Form UI */}
          <h2 className="text-xl font-bold mb-4">Register New Account</h2>
          <input
            required
            type="text"
            placeholder="User ID (e.g. STU009)"
            value={formData.userId}
            onChange={(e) =>
              setFormData({ ...formData, userId: e.target.value })
            }
            className="w-full p-2 border rounded"
          />
          <input
            required
            type="text"
            placeholder="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="w-full p-2 border rounded"
          />
          <select
            required
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Role...</option>
            <option value="admin">Administrator</option>
            <option value="panel">Panel Member</option>
            <option value="student">Student</option>
          </select>
          {formData.role === "student" && (
            <input
              required
              type="text"
              placeholder="Matric Number"
              value={formData.matricNumber}
              onChange={(e) =>
                setFormData({ ...formData, matricNumber: e.target.value })
              }
              className="w-full p-2 border rounded"
            />
          )}
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 font-bold"
          >
            Create User
          </button>
        </form>
      )}

      {activeTab === "assign" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[700px]">
            <h2 className="text-xl font-bold mb-2">1. Select Student</h2>
            <div className="flex bg-gray-200 rounded-lg p-1 w-full mb-4">
              <button
                onClick={() => {
                  setStudentView("unassigned");
                  setSelectedStudentIds([]);
                  setAiSuggestions([]);
                }}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${studentView === "unassigned" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Needs Panels ({unassignedStudents.length})
              </button>
              <button
                onClick={() => {
                  setStudentView("assigned");
                  setSelectedStudentIds([]);
                  setAiSuggestions([]);
                }}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${studentView === "assigned" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Already Assigned ({assignedStudents.length})
              </button>
            </div>

            <input
              type="text"
              placeholder="Search Students..."
              value={studentSearchTerm}
              onChange={(e) => setStudentSearchTerm(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 bg-gray-50 focus:ring-2 focus:ring-indigo-500"
            />

            <div className="space-y-2 overflow-y-auto flex-1 pr-2 border-t pt-4">
              {filteredActiveList.map((student) => (
                <div
                  key={student._id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${selectedStudentIds.includes(student._id) ? "bg-indigo-50 border-indigo-300" : "hover:bg-gray-50 border-gray-200"}`}
                >
                  {studentView === "unassigned" ? (
                    <>
                      <label className="flex items-center space-x-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student._id)}
                          onChange={() => toggleStudent(student._id)}
                          className="w-5 h-5 text-indigo-600 rounded"
                        />
                        <div>
                          <span className="font-bold text-gray-900 block">
                            {student.name}
                          </span>
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {student.matricNumber}
                          </span>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAIMatch(student)}
                        disabled={isMatching || !student.researchTitle}
                        className="ml-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded shadow disabled:opacity-50 transition-all whitespace-nowrap"
                      >
                        {isMatching ? "..." : "✨ AI Match"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <span className="font-bold text-gray-900 block">
                          {student.name}
                        </span>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {student.matricNumber}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnassign(student)}
                        className="ml-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-sm font-bold rounded-lg flex items-center gap-2 transition-all shadow-sm"
                      >
                        <UserMinus className="w-4 h-4" /> Unassign
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[700px] ${studentView === "assigned" ? "opacity-50 pointer-events-none" : ""}`}
          >
            <h2 className="text-xl font-bold mb-2">2. Select Panels</h2>

            {aiSuggestions.length > 0 && (
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 mb-4 shadow-sm">
                <h3 className="text-sm font-black text-indigo-900 mb-3">
                  ✨ AI Recommended Panels
                </h3>
                <div className="space-y-2 mb-3">
                  {aiSuggestions.map((p) => (
                    <div
                      key={p._id}
                      className="text-sm text-indigo-900 bg-white px-3 py-2 rounded-lg font-bold shadow-sm"
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setSelectedPanels(
                      aiSuggestions.map((p) => p._id).slice(0, 2),
                    );
                    setAiSuggestions([]);
                  }}
                  className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700"
                >
                  Apply Quick Select
                </button>
              </div>
            )}

            <input
              type="text"
              placeholder="Search Panels..."
              value={panelSearchTerm}
              onChange={(e) => setPanelSearchTerm(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 bg-gray-50 focus:ring-2 focus:ring-indigo-500"
            />

            <div className="space-y-2 overflow-y-auto flex-1 pr-2 border-t pt-4 mb-4">
              {displayPanels.map((panel) => (
                <label
                  key={panel._id}
                  className={`flex items-start space-x-3 p-3 rounded-lg cursor-pointer border transition-colors ${selectedPanels.includes(panel._id) ? "bg-green-50 border-green-300" : "hover:bg-gray-50 border-gray-200"}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPanels.includes(panel._id)}
                    onChange={() => togglePanel(panel._id)}
                    className="w-5 h-5 text-green-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-gray-900 block">
                      {panel.name}
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold">
                      {panel.expertiseTags?.join(", ") || "General"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={handleBulkAssign}
              disabled={
                selectedStudentIds.length === 0 || selectedPanels.length !== 2
              }
              className={`w-full p-4 rounded-xl font-black text-lg transition-all ${selectedStudentIds.length === 0 || selectedPanels.length !== 2 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg"}`}
            >
              Assign Panels
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
