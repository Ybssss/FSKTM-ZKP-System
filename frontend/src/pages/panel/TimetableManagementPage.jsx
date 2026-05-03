import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Trash2,
  Search,
  Layers,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function TimetableManagementPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [bulkConfig, setBulkConfig] = useState({
    sessionType: "PROPOSAL_DEFENSE", // 👈 FIXED to match DB ENUM
    date: new Date().toISOString().split("T")[0],
    venue: "",
  });
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [sessionDrafts, setSessionDrafts] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/timetables/my");
      setSessions(res.data.data || res.data.sessions || []);

      if (isAdmin) {
        const usersRes = await api.get("/users/assignments");
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

  const toggleStudentForBulk = (studentId) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        const newDrafts = { ...sessionDrafts };
        delete newDrafts[studentId];
        setSessionDrafts(newDrafts);
        return prev.filter((id) => id !== studentId);
      } else {
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
    if (!bulkConfig.venue) return alert("Please set a Venue.");
    if (selectedStudentIds.length === 0)
      return alert("Select at least one student.");

    try {
      setIsSaving(true);
      // We loop through selected students and call the standard create API
      for (const studentId of selectedStudentIds) {
        const studentObj = students.find((s) => s._id === studentId);
        // Find 2 random panels just for the draft if they don't have assigned panels yet
        const panel1Id = panels[0]?._id;
        const panel2Id = panels[1]?._id;

        await api.post("/timetables/create", {
          studentId,
          sessionType: bulkConfig.sessionType,
          semester: "Semester 1, 2025/2026", // Or make dynamic
          date: bulkConfig.date,
          time: sessionDrafts[studentId].startTime,
          venue: bulkConfig.venue,
          panel1Id,
          panel2Id,
        });
      }
      alert("✅ Bulk Sessions Created Successfully!");
      setSelectedStudentIds([]);
      setSessionDrafts({});
      setActiveTab("list");
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to create bulk sessions");
    } finally {
      setIsSaving(false);
    }
  };

  const lowerSearch = searchTerm.toLowerCase();
  const filteredSessions = sessions.filter((s) => {
    const matchType = s.sessionType?.toLowerCase().includes(lowerSearch);
    const matchStudent =
      s.student?.name?.toLowerCase().includes(lowerSearch) ||
      s.student?.matricNumber?.toLowerCase().includes(lowerSearch);
    return matchType || matchStudent;
  });

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
              <Layers className="w-4 h-4" /> Smart Schedule
            </button>
          </div>
        )}
      </div>

      {activeTab === "list" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Session Info</th>
                  <th className="p-4">Schedule</th>
                  <th className="p-4">Student & SV</th>
                  <th className="p-4">Panels</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={(e) => {
                      if (!e.target.closest("button"))
                        navigate(`/panel/sessions/${session.id}`);
                    }}
                  >
                    <td className="p-4">
                      <p className="font-bold text-gray-900">
                        {session.rubric || session.sessionType}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                        SCHEDULED
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarIcon className="w-4 h-4 text-indigo-500" />{" "}
                        {new Date(session.schedule?.date).toLocaleDateString(
                          "en-MY",
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-blue-500" />{" "}
                        {session.schedule?.time}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-red-500" />{" "}
                        {session.schedule?.venue}
                      </div>
                    </td>
                    <td className="p-4">
                      {/* 👈 FIXED: Uses session.student object perfectly */}
                      <p className="font-semibold text-gray-800 text-sm">
                        {session.student?.name}
                      </p>
                      <p className="text-xs font-mono text-gray-500 mb-1">
                        {session.student?.matricNumber}
                      </p>
                      <p className="text-xs text-indigo-600 font-semibold">
                        SV: {session.student?.svName}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {session.panels?.map((p, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-100"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(session.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SMART BULK SCHEDULING UI */}
      {activeTab === "bulk" && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  {/* 👈 FIXED: Enum Dropdown matches database */}
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
                    <option value="PROPOSAL_DEFENSE">Proposal Defense</option>
                    <option value="PRE_VIVA">Pre-Viva Voce</option>
                    <option value="PROGRESS_ASSESSMENT">
                      Progress Assessment
                    </option>
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
              <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                {students.map((student) => (
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

          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="font-bold text-lg text-gray-900">
                  3. Adjust Timings & Save
                </h2>
              </div>
              <button
                onClick={handleBulkSubmit}
                disabled={isSaving || selectedStudentIds.length === 0}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {isSaving
                  ? "Saving..."
                  : `Publish ${selectedStudentIds.length} Sessions`}
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {selectedStudentIds.length === 0 ? (
                <div className="text-center text-gray-400 mt-12">
                  <Users className="w-12 h-12 mx-auto mb-3" />
                  <p>Select students to generate schedule drafts.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedStudentIds.map((id) => {
                    const student = students.find((s) => s._id === id);
                    return (
                      <div
                        key={id}
                        className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-xl bg-white shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">
                            {student.name}
                          </p>
                          <p className="text-xs font-mono text-gray-500">
                            {student.matricNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={sessionDrafts[id]?.startTime || ""}
                            onChange={(e) =>
                              updateDraftTime(id, "startTime", e.target.value)
                            }
                            className="p-2 border rounded-lg text-sm font-medium bg-gray-50"
                            required
                          />
                          <span className="text-gray-400">-</span>
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
