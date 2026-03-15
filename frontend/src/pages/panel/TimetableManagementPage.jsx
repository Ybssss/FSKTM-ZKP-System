import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Plus,
  Trash2,
  Search,
  Layers,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function TimetableManagementPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [activeTab, setActiveTab] = useState("list"); // 'list' | 'bulk'
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Scheduling States
  const [bulkConfig, setBulkConfig] = useState({
    sessionType: "Progress Review #1",
    date: new Date().toISOString().split("T")[0],
    venue: "",
  });
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [sessionDrafts, setSessionDrafts] = useState({}); // { studentId: { startTime, endTime } }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/timetables");
      setSessions(res.data.timetables || []);

      if (isAdmin) {
        const usersRes = await api.get("/users/assignments"); // Using the assignments endpoint to get panel mappings
        setStudents(usersRes.data.students || []);
        setPanels(usersRes.data.panels || []);
      }
    } catch (error) {
      console.error("Error loading timetable data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this session permanently?")) return;
    try {
      await api.delete(`/timetables/${id}`);
      loadData();
    } catch (error) {
      alert("Failed to delete session");
    }
  };

  // --- SMART BULK LOGIC ---
  const toggleStudentForBulk = (studentId) => {
    setSelectedStudentIds((prev) => {
      const isSelected = prev.includes(studentId);
      if (isSelected) {
        const newDrafts = { ...sessionDrafts };
        delete newDrafts[studentId];
        setSessionDrafts(newDrafts);
        return prev.filter((id) => id !== studentId);
      } else {
        // Initialize default times when checked
        setSessionDrafts({
          ...sessionDrafts,
          [studentId]: { startTime: "09:00", endTime: "10:00" },
        });
        return [...prev, studentId];
      }
    });
  };

  const updateDraftTime = (studentId, field, value) => {
    setSessionDrafts((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleBulkSubmit = async () => {
    if (!bulkConfig.venue)
      return alert("Please set a Venue for these sessions.");
    if (selectedStudentIds.length === 0)
      return alert("Select at least one student.");

    try {
      setIsSaving(true);
      // Construct the payload array
      const payload = selectedStudentIds.map((studentId) => {
        const studentObj = students.find((s) => s._id === studentId);
        // Auto-extract their assigned panels!
        const assignedPanelIds =
          studentObj?.assignedPanels?.map(
            (ap) => ap.panelId?._id || ap.panelId,
          ) || [];

        return {
          sessionType: bulkConfig.sessionType,
          title: `${bulkConfig.sessionType} - ${studentObj?.name}`,
          date: bulkConfig.date,
          venue: bulkConfig.venue,
          startTime: sessionDrafts[studentId].startTime,
          endTime: sessionDrafts[studentId].endTime,
          students: [studentId],
          panels: assignedPanelIds,
        };
      });

      await api.post("/timetables/bulk", { sessions: payload });
      alert("✅ Bulk Sessions Created Successfully!");
      setSelectedStudentIds([]);
      setSessionDrafts({});
      setActiveTab("list");
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create bulk sessions");
    } finally {
      setIsSaving(false);
    }
  };

  // --- UPGRADED FILTERING LOGIC ---
  const lowerSearch = searchTerm.toLowerCase();
  const filteredSessions = sessions.filter((s) => {
    // Search by Title or Session Type
    const matchTitle = s.title?.toLowerCase().includes(lowerSearch);
    const matchType = s.sessionType?.toLowerCase().includes(lowerSearch);

    // NEW: Search by Student Name or Matric Number (Checking inside the array)
    const matchStudent = s.students?.some(
      (student) =>
        student.name?.toLowerCase().includes(lowerSearch) ||
        student.matricNumber?.toLowerCase().includes(lowerSearch),
    );

    return matchTitle || matchType || matchStudent;
  });

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(lowerSearch) ||
      s.matricNumber?.toLowerCase().includes(lowerSearch),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-indigo-600" /> Session
            Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage and schedule symposium presentation slots.
          </p>
        </div>
        {isAdmin && (
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${activeTab === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}
            >
              All Sessions
            </button>
            <button
              onClick={() => setActiveTab("bulk")}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 ${activeTab === "bulk" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600"}`}
            >
              <Layers className="w-4 h-4" /> Smart Bulk Schedule
            </button>
          </div>
        )}
      </div>

      {activeTab === "list" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Session Info</th>
                  <th className="p-4">Schedule</th>
                  <th className="p-4">Students</th>
                  <th className="p-4">Panels</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSessions.map((session) => (
                  <tr
                    key={session._id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={(e) => {
                      if (!e.target.closest("button"))
                        navigate(`/panel/sessions/${session._id}`);
                    }}
                  >
                    <td className="p-4">
                      <p className="font-bold text-gray-900">
                        {session.title || session.sessionType}
                      </p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${session.status === "completed" ? "bg-gray-200 text-gray-700" : "bg-green-100 text-green-800"}`}
                      >
                        {session.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarIcon className="w-4 h-4 text-indigo-500" />{" "}
                        {new Date(session.date).toLocaleDateString("en-MY")}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-blue-500" />{" "}
                        {session.startTime} - {session.endTime}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-red-500" />{" "}
                        {session.venue}
                      </div>
                    </td>
                    <td className="p-4">
                      {/* ✅ FIX: Now clearly shows Matric Number in the preview! */}
                      {session.students?.map((s) => (
                        <div key={s._id} className="mb-1">
                          <p className="font-semibold text-gray-800 text-sm">
                            {s.name}
                          </p>
                          <p className="text-xs font-mono text-gray-500">
                            {s.matricNumber || "No Matric"}
                          </p>
                        </div>
                      ))}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {session.panels?.map((p) => (
                          <span
                            key={p._id}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-100"
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(session._id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSessions.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                No sessions found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SMART BULK SCHEDULING UI */}
      {activeTab === "bulk" && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Configuration & Student List */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <h2 className="font-bold text-lg mb-4 text-gray-900 border-b pb-2">
                1. Base Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Session Type
                  </label>
                  <select
                    value={bulkConfig.sessionType}
                    onChange={(e) =>
                      setBulkConfig({
                        ...bulkConfig,
                        sessionType: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded-lg bg-gray-50"
                  >
                    <option>Proposal Defense</option>
                    <option>Progress Review #1</option>
                    <option>Progress Review #2</option>
                    <option>Final Defense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={bulkConfig.date}
                    onChange={(e) =>
                      setBulkConfig({ ...bulkConfig, date: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Common Venue
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Meeting Room A"
                    value={bulkConfig.venue}
                    onChange={(e) =>
                      setBulkConfig({ ...bulkConfig, venue: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg bg-gray-50"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
              <h2 className="font-bold text-lg mb-4 text-gray-900 border-b pb-2">
                2. Select Students
              </h2>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 mb-3 border rounded-lg text-sm bg-gray-50"
              />
              <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                {filteredStudents.map((student) => (
                  <label
                    key={student._id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedStudentIds.includes(student._id) ? "bg-indigo-50 border-indigo-200" : "hover:bg-gray-50 border-transparent"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(student._id)}
                      onChange={() => toggleStudentForBulk(student._id)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">
                        {student.name}
                      </p>
                      <p className="text-xs font-mono text-gray-500">
                        {student.matricNumber}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Time Table */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="font-bold text-lg text-gray-900">
                  3. Adjust Timings & Save
                </h2>
                <p className="text-xs text-gray-500">
                  Assigned panels are automatically pulled from the database!
                </p>
              </div>
              <button
                onClick={handleBulkSubmit}
                disabled={isSaving || selectedStudentIds.length === 0}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {isSaving
                  ? "Saving..."
                  : `Publish ${selectedStudentIds.length} Sessions`}
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {selectedStudentIds.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                  <Users className="w-12 h-12" />
                  <p>
                    Select students from the left to generate schedule drafts.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedStudentIds.map((id) => {
                    const student = students.find((s) => s._id === id);
                    return (
                      <div
                        key={id}
                        className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-xl bg-white shadow-sm hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">
                            {student.name}
                          </p>
                          <p className="text-xs font-mono text-gray-500">
                            {student.matricNumber}
                          </p>
                          <div className="mt-2 flex gap-1 flex-wrap">
                            {student.assignedPanels?.length > 0 ? (
                              student.assignedPanels.map((ap, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100"
                                >
                                  {ap.panelId?.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                                ⚠️ No Panels Assigned
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">
                              Start
                            </label>
                            <input
                              type="time"
                              value={sessionDrafts[id]?.startTime || ""}
                              onChange={(e) =>
                                updateDraftTime(id, "startTime", e.target.value)
                              }
                              className="p-2 border rounded-lg text-sm font-medium bg-gray-50"
                              required
                            />
                          </div>
                          <span className="mt-4 text-gray-400">-</span>
                          <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">
                              End
                            </label>
                            <input
                              type="time"
                              value={sessionDrafts[id]?.endTime || ""}
                              onChange={(e) =>
                                updateDraftTime(id, "endTime", e.target.value)
                              }
                              className="p-2 border rounded-lg text-sm font-medium bg-gray-50"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
