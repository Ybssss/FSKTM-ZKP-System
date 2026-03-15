import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api"; // Ensure you have standard API exports

export default function AdminManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("create");

  // States
  const [students, setStudents] = useState([]);
  const [panels, setPanels] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedPanels, setSelectedPanels] = useState([]);

  // Create User Form State
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
      // Assuming your API has a GET /api/users endpoint
      const res = await api.get("/users");
      const allUsers = res.data.users || [];
      setStudents(allUsers.filter((u) => u.role === "student"));
      setPanels(allUsers.filter((u) => u.role === "panel"));
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", formData); // Adjust to your actual creation endpoint
      alert("User created! Code is: TEST-123 (Update via email module later)");
      setFormData({
        userId: "",
        name: "",
        email: "",
        role: "",
        matricNumber: "",
      });
    } catch (err) {
      alert("Failed to create user");
    }
  };

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id],
    );
  };

  const togglePanel = (id) => {
    if (selectedPanels.includes(id)) {
      setSelectedPanels((prev) => prev.filter((pId) => pId !== id));
    } else {
      if (selectedPanels.length >= 2)
        return alert("Maximum 2 panels allowed per assignment.");
      setSelectedPanels([...selectedPanels, id]);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedPanels.length !== 2)
      return alert("You must select exactly 2 panels.");
    try {
      await api.post("/timetables/assign-panel", {
        panelIds: selectedPanels,
        studentIds: selectedStudentIds,
      });
      alert(`Assigned successfully to ${selectedStudentIds.length} students!`);
      setSelectedStudentIds([]);
      setSelectedPanels([]);
    } catch (err) {
      alert("Assignment failed");
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.matricNumber &&
        s.matricNumber.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">System Management</h1>

      {/* Tabs */}
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
          Bulk Panel Assignment
        </button>
      </div>

      {/* CREATE USERS TAB */}
      {activeTab === "create" && (
        <form
          onSubmit={handleCreateUser}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 max-w-xl"
        >
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
            {/* Hierarchy Enforcement */}
            {user?.role === "superadmin" && (
              <option value="admin">Administrator</option>
            )}
            {(user?.role === "admin" || user?.role === "superadmin") && (
              <>
                <option value="panel">Panel Member</option>
                <option value="student">Student</option>
              </>
            )}
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

      {/* BULK ASSIGNMENT TAB */}
      {activeTab === "assign" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Students with Search */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">1. Select Students</h2>
            <input
              type="text"
              placeholder="Search by Name or Matric No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border rounded mb-4 bg-gray-50"
            />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredStudents.map((student) => (
                <label
                  key={student._id}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(student._id)}
                    onChange={() => toggleStudent(student._id)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="font-medium">
                    {student.name}{" "}
                    <span className="text-sm text-gray-500">
                      ({student.matricNumber})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Right: Panels & Submit */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">2. Select 2 Panels</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
              {panels.map((panel) => (
                <label
                  key={panel._id}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border"
                >
                  <input
                    type="checkbox"
                    checked={selectedPanels.includes(panel._id)}
                    onChange={() => togglePanel(panel._id)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="font-medium">{panel.name}</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleBulkAssign}
              disabled={
                selectedStudentIds.length === 0 || selectedPanels.length !== 2
              }
              className="w-full bg-green-600 text-white p-3 rounded-lg font-bold disabled:bg-gray-400"
            >
              Assign Panels to {selectedStudentIds.length} Students
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
