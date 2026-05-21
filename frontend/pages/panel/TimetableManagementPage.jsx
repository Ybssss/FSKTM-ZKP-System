import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Trash2,
  Search,
  Layers,
  Video,
  FileText,
  BookOpen,
  Pencil,
  X,
  Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";
import api, { sessionBatchAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function TimetableManagementPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [panels, setPanels] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [allEvaluations, setAllEvaluations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [slotDuration, setSlotDuration] = useState(() => {
    const saved = localStorage.getItem("admin_slot_duration");
    return saved ? parseInt(saved, 10) : 60;
  });
  const [batches, setBatches] = useState([]);
  const [batchMode, setBatchMode] = useState("existing"); // existing | new
  const [selectedBatchId, setSelectedBatchId] = useState("");

  const isExistingBatchMode = batchMode === "existing";

  const batchFieldClass = `w-full p-2 border rounded-lg font-semibold ${
    isExistingBatchMode
      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
      : "bg-gray-50"
  }`;

  const [bulkConfig, setBulkConfig] = useState({
    rubricId: "",
    academicSession: "2025/2026, Semester 1",
    batchName: "",
    batchId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    venue: "",
    breakBetweenSlotsMinutes: 5,
  });

  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [sessionDrafts, setSessionDrafts] = useState({});

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editForm, setEditForm] = useState({
    rubricId: "",
    date: "",
    time: "",
    endTime: "",
    venue: "",
    panel1Id: "",
    panel2Id: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const handleDurationChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setSlotDuration(val);
    if (!isNaN(val) && val > 0) {
      localStorage.setItem("admin_slot_duration", val);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/timetables/my");
      let fetchedSessions =
        res.data.data || res.data.sessions || res.data.timetables || [];
      fetchedSessions = fetchedSessions.sort(
        (a, b) =>
          new Date(b.schedule?.date || b.date) -
          new Date(a.schedule?.date || a.date),
      );
      setSessions(fetchedSessions);

      const evRes = await api.get("/evaluations");
      setAllEvaluations(evRes.data.data || evRes.data.evaluations || []);
    } catch (error) {
      console.error("Error loading timetables", error);
    }

    if (isAdmin) {
      try {
        const usersRes = await api.get("/users");
        const allUsers = usersRes.data.users || [];
        setStudents(allUsers.filter((u) => u.role === "student"));
        setPanels(allUsers.filter((u) => ["panel", "admin"].includes(u.role)));
        const rubRes = await api.get("/rubrics");
        const fetchedRubrics = rubRes.data.data || rubRes.data.rubrics || [];
        setRubrics(fetchedRubrics);

        if (fetchedRubrics.length > 0)
          setBulkConfig((prev) => ({
            ...prev,
            rubricId: fetchedRubrics[0]._id,
          }));

        const batchRes = await sessionBatchAPI.list();
        setBatches(batchRes.batches || []);
      } catch (error) {
        console.error("Error loading assignment data", error);
      }
    }
    setLoading(false);
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

  const addMinutes = (timeStr, mins) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m + parseInt(mins), 0, 0);
    return date.toTimeString().slice(0, 5);
  };

  const addMinutesToTime = (timeStr, mins) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m + Number(mins || 0), 0, 0);
    return date.toTimeString().slice(0, 5);
  };

  const getExistingBatchSessionCount = () => {
    if (batchMode !== "existing" || !selectedBatchId) return 0;

    return sessions.filter((session) => session.batchId === selectedBatchId)
      .length;
  };

  const getAutoSlot = (index) => {
    const duration = Number(slotDuration || 60);
    const breakMinutes = Number(bulkConfig.breakBetweenSlotsMinutes || 0);
    const start = addMinutesToTime(
      bulkConfig.startTime || "09:00",
      index * (duration + breakMinutes),
    );

    return {
      startTime: start,
      endTime: addMinutesToTime(start, duration),
    };
  };

  const selectedExistingBatchSessions = useMemo(() => {
    if (batchMode !== "existing" || !selectedBatchId) return [];

    return sessions
      .filter((session) => session.batchId === selectedBatchId)
      .sort((a, b) => {
        const dateDiff =
          new Date(a.schedule?.date || a.date) -
          new Date(b.schedule?.date || b.date);

        if (dateDiff !== 0) return dateDiff;

        return String(a.startTime || a.time || "").localeCompare(
          String(b.startTime || b.time || ""),
        );
      });
  }, [batchMode, selectedBatchId, sessions]);

  const buildRecalculatedDrafts = (ids, sourceDrafts = sessionDrafts) => {
    const result = { ...sourceDrafts };
    const offset = getExistingBatchSessionCount();

    ids.forEach((studentId, index) => {
      const autoSlot = getAutoSlot(offset + index);
      result[studentId] = {
        ...(result[studentId] || {}),
        startTime: autoSlot.startTime,
        endTime: autoSlot.endTime,
      };
    });

    return result;
  };

  const moveDraftStudent = (studentId, direction) => {
    setSelectedStudentIds((prev) => {
      const currentIndex = prev.indexOf(studentId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      setSessionDrafts((drafts) => buildRecalculatedDrafts(next, drafts));
      return next;
    });
  };

  const removeDraftStudent = (studentId) => {
    setSelectedStudentIds((prev) => {
      const next = prev.filter((id) => id !== studentId);
      setSessionDrafts((drafts) => {
        const copiedDrafts = { ...drafts };
        delete copiedDrafts[studentId];
        return buildRecalculatedDrafts(next, copiedDrafts);
      });
      return next;
    });
  };

  const handleEditClick = (session) => {
    setEditingSession(session);

    // 🔴 FRONTEND SELF-HEALING: Safely grab arrays or singular objects
    const p1 =
      session.panel1Id?._id ||
      session.panel1Id ||
      session.panels?.[0]?._id ||
      session.panels?.[0] ||
      "";
    const p2 =
      session.panel2Id?._id ||
      session.panel2Id ||
      session.panels?.[1]?._id ||
      session.panels?.[1] ||
      "";

    // 🔴 FIX: Try to get the Exact Rubric ID.
    let rubric = session.rubricId?._id || session.rubricId;

    // If rubricId is missing but we know the sessionType, auto-select the correct rubric!
    if (!rubric && session.sessionType) {
      const fallbackRubric = rubrics.find(
        (r) => r.sessionType === session.sessionType,
      );
      if (fallbackRubric) rubric = fallbackRubric._id;
    }

    setEditForm({
      rubricId: rubric || "",
      date: session.schedule?.date
        ? new Date(session.schedule.date).toISOString().split("T")[0]
        : session.date
          ? new Date(session.date).toISOString().split("T")[0]
          : "",
      time: session.schedule?.time || session.time || session.startTime || "",
      endTime: session.endTime || "",
      venue: session.schedule?.venue || session.venue || "",
      panel1Id: p1,
      panel2Id: p2,
    });
    setIsEditModalOpen(true);
  };

  const submitEditSession = async (e) => {
    e.preventDefault();
    try {
      const sessionId = editingSession._id || editingSession.id;
      const selectedRubric = rubrics.find((r) => r._id === editForm.rubricId);
      const sessionType = selectedRubric
        ? selectedRubric.sessionType
        : editingSession.sessionType;

      await api.put(`/timetables/${sessionId}`, { ...editForm, sessionType });
      alert("Session updated successfully!");
      setIsEditModalOpen(false);
      loadData();
    } catch (err) {
      alert("Failed to update session");
    }
  };

  const toggleStudentForBulk = (student) => {
    if (batchMode === "existing" && !selectedBatchId) {
      return alert("Please select an existing batch first.");
    }
    const studentId = student._id;
    if (!student.assignedPanels || student.assignedPanels.length < 2) {
      return alert(
        "This student does not have 2 panels assigned yet. Please assign them in the Panel Assignment tab first.",
      );
    }

    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        const next = prev.filter((id) => id !== studentId);
        setSessionDrafts((drafts) => {
          const copiedDrafts = { ...drafts };
          delete copiedDrafts[studentId];
          return buildRecalculatedDrafts(next, copiedDrafts);
        });
        return next;
      } else {
        const p1 =
          student.assignedPanels[0]?.panelId?._id ||
          student.assignedPanels[0]?.panelId ||
          student.assignedPanels[0];
        const p2 =
          student.assignedPanels[1]?.panelId?._id ||
          student.assignedPanels[1]?.panelId ||
          student.assignedPanels[1];
        const nextIndex = getExistingBatchSessionCount() + prev.length;
        const autoSlot = getAutoSlot(nextIndex);

        setSessionDrafts({
          ...sessionDrafts,
          [studentId]: {
            startTime: autoSlot.startTime,
            endTime: autoSlot.endTime,
            panel1Id: p1,
            panel2Id: p2,
          },
        });
        return [...prev, studentId];
      }
    });
  };

  const handleBulkSubmit = async () => {
    if (batchMode === "existing" && !selectedBatchId) {
      return alert("Please select an existing batch first.");
    }

    if (!bulkConfig.batchName.trim()) {
      return alert("Please enter a Batch / Session Name, e.g., PIXEL.");
    }

    if (!bulkConfig.venue) {
      return alert("Please set an Online Meeting Link.");
    }

    if (!bulkConfig.rubricId) {
      return alert("Please select an Evaluation Rubric.");
    }

    if (selectedStudentIds.length === 0) {
      return alert("Select at least one student.");
    }

    try {
      setIsSaving(true);
      const selectedRubric = rubrics.find((r) => r._id === bulkConfig.rubricId);
      const sessionType = selectedRubric
        ? selectedRubric.sessionType
        : "PROPOSAL_DEFENSE";

      const payload = selectedStudentIds.map((studentId, index) => {
        const draft = sessionDrafts[studentId] || {};
        const autoSlot = getAutoSlot(getExistingBatchSessionCount() + index);
        if (!draft.panel1Id || !draft.panel2Id)
          throw new Error(`Missing panels for a student.`);

        return {
          studentId: studentId,
          sessionType,
          rubricId: bulkConfig.rubricId,
          date: bulkConfig.date,
          time: draft.startTime || autoSlot.startTime,
          endTime: draft.endTime || autoSlot.endTime,
          venue: bulkConfig.venue,
          panel1Id: draft.panel1Id,
          panel2Id: draft.panel2Id,
        };
      });

      const finalBatchId =
        batchMode === "existing"
          ? selectedBatchId
          : bulkConfig.batchId.trim() ||
            `${bulkConfig.batchName.trim()}-${bulkConfig.date}`;

      if (batchMode === "new") {
        await sessionBatchAPI.create({
          batchName: bulkConfig.batchName.trim(),
          batchId: finalBatchId,
          academicSession: bulkConfig.academicSession,
          scheduleTitle: "Postgraduate Progress Presentation Schedule",
          sessionType,
          rubricId: bulkConfig.rubricId,
          date: bulkConfig.date,
          startTime: bulkConfig.startTime,
          slotDurationMinutes: slotDuration,
          breakBetweenSlotsMinutes: bulkConfig.breakBetweenSlotsMinutes,
          googleMeetLink: bulkConfig.venue,
          status: "active",
        });

        const batchRes = await sessionBatchAPI.list();
        setBatches(batchRes.batches || []);
      }

      await api.post("/timetables/bulk", {
        useExistingBatch: batchMode === "existing",
        academicSession: bulkConfig.academicSession,
        scheduleTitle: "Postgraduate Progress Presentation Schedule",
        batchName: bulkConfig.batchName.trim(),
        batchId: finalBatchId,
        googleMeetLink: bulkConfig.venue,
        venue: bulkConfig.venue,
        date: bulkConfig.date,
        startTime: bulkConfig.startTime,
        slotDurationMinutes: slotDuration,
        breakBetweenSlotsMinutes: bulkConfig.breakBetweenSlotsMinutes,
        semester: bulkConfig.academicSession,
        sessions: payload,
      });

      alert("✅ Bulk Sessions Created Successfully!");
      navigate(
        `/panel/sessions/batch/${encodeURIComponent(finalBatchId)}/print`,
      );
      setSelectedStudentIds([]);
      setSessionDrafts({});
      setActiveTab("list");
      loadData();
    } catch (error) {
      alert("Failed to create bulk sessions");
    } finally {
      setIsSaving(false);
    }
  };

  const formatMeetingLink = (url) => {
    if (!url) return "#";
    if (!url.startsWith("http://") && !url.startsWith("https://"))
      return `https://${url}`;
    return url;
  };

  const filteredSessions = sessions.filter((session) => {
    if (!searchTerm) return true;

    const studentObj =
      session.student || (session.students && session.students[0]) || null;

    if (!studentObj) return false; // Ignore broken records when searching

    const term = searchTerm.toLowerCase();
    const matchName = studentObj.name?.toLowerCase().includes(term);
    const matchMatric = studentObj.matricNumber?.toLowerCase().includes(term);
    const matchTitle = studentObj.researchTitle?.toLowerCase().includes(term);

    return matchName || matchMatric || matchTitle;
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
            Manage and schedule online symposium presentation slots.
          </p>
        </div>
        {isAdmin && (
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-4 py-2 rounded-md font-bold text-sm ${activeTab === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}
            >
              All Sessions
            </button>
            <button
              onClick={() => setActiveTab("bulk")}
              className={`px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 ${activeTab === "bulk" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600"}`}
            >
              <Layers className="w-4 h-4" /> Smart Schedule
            </button>
            <button
              onClick={() => navigate("/panel/sessions/batches/print")}
              className="px-4 py-2 rounded-md font-bold text-sm bg-green-600 text-white hover:bg-green-700"
            >
              Export Batches
            </button>
          </div>
        )}
      </div>

      {activeTab === "list" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex items-center relative">
            <Search className="w-5 h-5 text-gray-400 absolute ml-3" />
            <input
              type="text"
              placeholder="Search by Student Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b text-xs text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Session & Rubric</th>
                  <th className="p-4">Schedule & Link</th>
                  <th className="p-4">Student & Project</th>
                  <th className="p-4">Panels</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSessions.map((session) => {
                  const sessionId = session._id || session.id;

                  // 🔴 FRONTEND SELF-HEALING: Safely pull data from arrays or singular objects
                  const studentObj =
                    session.student ||
                    (session.students && session.students[0]) ||
                    null;
                  const p1 =
                    session.panel1Id ||
                    (session.panels && session.panels[0]) ||
                    null;
                  const p2 =
                    session.panel2Id ||
                    (session.panels && session.panels[1]) ||
                    null;
                  const panelsList = [p1, p2].filter(Boolean);

                  const linkedEvals = allEvaluations.filter(
                    (ev) =>
                      ev.sessionId?._id === sessionId ||
                      ev.sessionId === sessionId,
                  );
                  const myPendingEval = linkedEvals.find(
                    (e) =>
                      (e.evaluatorId?._id === user.id ||
                        e.evaluatorId === user.id) &&
                      e.status === "PENDING",
                  );

                  // If studentObj is null, this record is orphaned/broken!
                  const isBroken = !studentObj;

                  return (
                    <tr
                      key={sessionId}
                      className={`hover:bg-gray-50 cursor-pointer ${isBroken ? "bg-red-50" : ""}`}
                      onClick={(e) => {
                        if (
                          !e.target.closest("button") &&
                          !e.target.closest("a") &&
                          !isBroken
                        )
                          navigate(`/panel/sessions/${sessionId}`);
                      }}
                    >
                      <td className="p-4">
                        <p className="font-bold text-gray-900">
                          {session.rubricId?.name ||
                            session.sessionType?.replace("_", " ")}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-green-100 text-green-800 border border-green-200">
                          SCHEDULED
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2 mb-1 font-semibold">
                          <CalendarIcon className="w-4 h-4 text-indigo-500" />{" "}
                          {new Date(
                            session.schedule?.date || session.date,
                          ).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2 mb-2 font-semibold">
                          <Clock className="w-4 h-4 text-blue-500" />{" "}
                          {session.startTime || session.time}{" "}
                          {session.endTime ? ` - ${session.endTime}` : ""}
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={formatMeetingLink(session.venue)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-bold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
                          >
                            <Video className="w-4 h-4" /> Join
                          </a>
                        </div>
                      </td>
                      <td className="p-4">
                        {isBroken ? (
                          <div className="text-red-600 font-bold flex items-center gap-2 border border-red-200 bg-red-100 p-2 rounded">
                            <AlertTriangle className="w-5 h-5" />
                            <div>
                              <p>Deleted Student</p>
                              <p className="text-xs font-medium">
                                Please delete this session.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="font-bold text-gray-800 text-sm">
                              {studentObj?.name}
                            </p>
                            <p className="text-xs font-mono font-bold text-gray-500 mb-1">
                              {studentObj?.matricNumber}
                            </p>
                            <p className="text-xs text-indigo-600 font-semibold mb-2">
                              SV: {studentObj?.supervisorId?.name || "None"}
                            </p>
                            <div className="bg-gray-100 p-2 rounded border border-gray-200">
                              <p className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                <BookOpen className="w-3 h-3" /> Project Title
                              </p>
                              <p className="text-xs text-gray-700 italic font-medium line-clamp-2 mt-0.5">
                                "{studentObj?.researchTitle || "Not provided"}"
                              </p>
                            </div>
                          </>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {panelsList.length === 0 && (
                            <span className="text-xs text-gray-400 italic">
                              No Panels
                            </span>
                          )}
                          {panelsList.map((p, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded text-xs font-bold border shadow-sm ${p._id === user.id ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-indigo-700 border-indigo-200"}`}
                            >
                              {p.name || p} {p._id === user.id && "(You)"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {myPendingEval && !isBroken && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/panel/evaluation/${myPendingEval._id}`,
                              );
                            }}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 text-sm shadow-sm w-full mb-2"
                          >
                            Evaluate Now
                          </button>
                        )}

                        {isAdmin && (
                          <div className="flex justify-end gap-2">
                            {session.batchId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/panel/sessions/batch/${encodeURIComponent(session.batchId)}/print`,
                                  );
                                }}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold hover:bg-blue-100 text-sm shadow-sm"
                              >
                                Print Batch
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(session);
                              }}
                              className="px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg font-bold hover:bg-yellow-100 text-sm shadow-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(sessionId);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border hover:border-red-200 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Batch Mode
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBatchMode("existing");
                      setSelectedStudentIds([]);
                      setSessionDrafts({});
                    }}
                    className={`px-3 py-2 rounded-lg font-bold text-sm ${
                      batchMode === "existing"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    Use Existing Batch
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBatchMode("new");
                      setSelectedBatchId("");
                      setBulkConfig((prev) => ({
                        ...prev,
                        batchName: "",
                        batchId: "",
                        venue: "",
                        date: new Date().toISOString().split("T")[0],
                        startTime: "09:00",
                        breakBetweenSlotsMinutes: 5,
                      }));
                      setSelectedStudentIds([]);
                      setSessionDrafts({});
                    }}
                    className={`px-3 py-2 rounded-lg font-bold text-sm ${
                      batchMode === "new"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    Create New Batch
                  </button>
                </div>
              </div>

              {batchMode === "existing" && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Select Batch
                  </label>

                  <select
                    value={selectedBatchId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedBatchId(value);

                      const batch = batches.find((b) => b.batchId === value);
                      if (!batch) return;

                      setBulkConfig({
                        rubricId: batch.rubricId?._id || batch.rubricId || "",
                        academicSession: batch.academicSession || "",
                        batchName: batch.batchName || "",
                        batchId: batch.batchId || "",
                        date: batch.date
                          ? new Date(batch.date).toISOString().split("T")[0]
                          : "",
                        startTime: batch.startTime || "09:00",
                        venue: batch.googleMeetLink || "",
                        breakBetweenSlotsMinutes:
                          batch.breakBetweenSlotsMinutes ?? 5,
                      });

                      setSlotDuration(batch.slotDurationMinutes || 60);
                      setSelectedStudentIds([]);
                      setSessionDrafts({});
                    }}
                    className="w-full p-2 border rounded-lg bg-gray-50 font-semibold"
                  >
                    <option value="">Select existing batch...</option>
                    {batches.map((batch) => (
                      <option key={batch.batchId} value={batch.batchId}>
                        {batch.batchName} —{" "}
                        {batch.date
                          ? new Date(batch.date).toLocaleDateString("en-MY")
                          : "No date"}
                      </option>
                    ))}
                  </select>

                  <p className="text-[11px] text-gray-500 mt-1">
                    Latest created batch appears first. Selecting a batch
                    auto-fills the schedule settings.
                  </p>

                  {selectedBatchId && (
                    <div className="mt-3 border rounded-lg bg-gray-50">
                      <div className="px-3 py-2 border-b bg-white rounded-t-lg">
                        <p className="text-xs font-bold text-gray-700 uppercase">
                          Current scheduled sessions in this batch
                        </p>
                        <p className="text-[11px] text-gray-500">
                          New drafts will continue after these existing sessions.
                        </p>
                      </div>

                      <div className="max-h-56 overflow-y-auto divide-y divide-gray-200">
                        {selectedExistingBatchSessions.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 font-semibold">
                            No sessions have been planned in this batch yet.
                          </div>
                        ) : (
                          selectedExistingBatchSessions.map((session) => (
                            <div
                              key={session._id || session.id}
                              className="p-3 text-xs space-y-1"
                            >
                              <p className="font-bold text-gray-900">
                                {session.student?.name ||
                                  session.students?.[0]?.name ||
                                  session.title}
                              </p>
                              <p className="text-gray-600">
                                {new Date(
                                  session.schedule?.date || session.date,
                                ).toLocaleDateString("en-MY")}
                                {" · "}
                                {session.startTime || session.time || "-"} - {session.endTime || "-"}
                              </p>
                              <p className="text-gray-500 truncate">
                                Panels: {(session.panels || [])
                                  .map((panel) => panel?.name || panel?.userId || panel)
                                  .join(" / ") || "-"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Academic Session
                </label>
                <input
                  type="text"
                  value={bulkConfig.academicSession}
                  disabled={isExistingBatchMode}
                  className={batchFieldClass}
                  onChange={(e) =>
                    setBulkConfig({
                      ...bulkConfig,
                      academicSession: e.target.value,
                    })
                  }
                  placeholder="2025/2026, Semester 1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Batch / Session Name
                </label>
                <input
                  type="text"
                  value={bulkConfig.batchName}
                  disabled={isExistingBatchMode}
                  className={batchFieldClass}
                  onChange={(e) =>
                    setBulkConfig({ ...bulkConfig, batchName: e.target.value })
                  }
                  placeholder="e.g., PIXEL"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Batch ID
                </label>
                <input
                  type="text"
                  value={bulkConfig.batchId}
                  disabled={isExistingBatchMode}
                  className={batchFieldClass}
                  onChange={(e) =>
                    setBulkConfig({ ...bulkConfig, batchId: e.target.value })
                  }
                  placeholder="Auto if empty"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={bulkConfig.startTime}
                  disabled={isExistingBatchMode}
                  className={batchFieldClass}
                  onChange={(e) =>
                    setBulkConfig({ ...bulkConfig, startTime: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Break Between Slots
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="5"
                  value={bulkConfig.breakBetweenSlotsMinutes}
                  disabled={isExistingBatchMode}
                  className={batchFieldClass}
                  onChange={(e) =>
                    setBulkConfig({
                      ...bulkConfig,
                      breakBetweenSlotsMinutes: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Evaluation Rubric
                  </label>
                  <select
                    value={bulkConfig.rubricId}
                    disabled={isExistingBatchMode}
                    className={batchFieldClass}
                    onChange={(e) =>
                      setBulkConfig({ ...bulkConfig, rubricId: e.target.value })
                    }
                  >
                    {rubrics.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Slot Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="240"
                    step="5"
                    value={slotDuration}
                    disabled={isExistingBatchMode}
                    onChange={handleDurationChange}
                    className={batchFieldClass}
                    placeholder="e.g., 60"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 font-semibold uppercase">
                    Your preference is automatically saved.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={bulkConfig.date}
                    disabled={isExistingBatchMode}
                    className={batchFieldClass}
                    onChange={(e) =>
                      setBulkConfig({ ...bulkConfig, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" /> Online Meeting Link
                  </label>
                  <input
                    type="url"
                    value={bulkConfig.venue}
                    disabled={isExistingBatchMode}
                    onChange={(e) =>
                      setBulkConfig({ ...bulkConfig, venue: e.target.value })
                    }
                    className={batchFieldClass}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
              <h2 className="font-bold text-lg mb-4 text-gray-900 border-b pb-2">
                2. Select Students
              </h2>
              <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                {students.map((student) => {
                  const hasPanels =
                    student.assignedPanels &&
                    student.assignedPanels.length >= 2;
                  return (
                    <label
                      key={student._id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${selectedStudentIds.includes(student._id) ? "bg-indigo-50 border-indigo-200" : "hover:bg-gray-50 border-transparent"} ${!hasPanels ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        disabled={!hasPanels}
                        checked={selectedStudentIds.includes(student._id)}
                        onChange={() => toggleStudentForBulk(student)}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          {student.name}
                        </p>
                        <p className="text-xs font-mono font-bold text-gray-500">
                          {student.matricNumber}
                        </p>
                        {!hasPanels && (
                          <p className="text-[10px] text-red-500 font-bold uppercase mt-1">
                            Requires Panel Assignment First
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="font-bold text-lg text-gray-900">
                  3. Review Timings
                </h2>
                <p className="text-xs text-gray-500">
                  Panels are pulled automatically from assignments.
                </p>
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
                    const p1Id =
                      sessionDrafts[id]?.panel1Id?._id ||
                      sessionDrafts[id]?.panel1Id;
                    const p2Id =
                      sessionDrafts[id]?.panel2Id?._id ||
                      sessionDrafts[id]?.panel2Id;
                    const p1Name =
                      panels.find((p) => p._id === p1Id)?.name || "Panel 1";
                    const p2Name =
                      panels.find((p) => p._id === p2Id)?.name || "Panel 2";

                    return (
                      <div
                        key={id}
                        className="flex flex-col gap-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm"
                      >
                        <div className="flex justify-between items-center border-b pb-2">
                          <div>
                            <p className="font-bold text-gray-900">
                              {student.name}
                            </p>
                            <p className="text-xs font-mono font-bold text-gray-500 mb-1">
                              {student.matricNumber}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => moveDraftStudent(id, -1)}
                              className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveDraftStudent(id, 1)}
                              className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDraftStudent(id)}
                              className="px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold"
                            >
                              Remove
                            </button>
                            <input
                              type="time"
                              value={
                                sessionDrafts[id]?.startTime ||
                                getAutoSlot(
                                  getExistingBatchSessionCount() +
                                    selectedStudentIds.indexOf(id),
                                ).startTime
                              }
                              onChange={(e) =>
                                setSessionDrafts((prev) => ({
                                  ...prev,
                                  [id]: {
                                    ...prev[id],
                                    startTime: e.target.value,
                                  },
                                }))
                              }
                              className="p-2 border rounded-lg text-sm font-bold bg-indigo-50 border-indigo-200 focus:ring-2 focus:ring-indigo-500"
                              required
                            />
                            <span className="text-xs font-bold text-gray-400">
                              to
                            </span>
                            <input
                              type="time"
                              value={
                                sessionDrafts[id]?.endTime ||
                                getAutoSlot(
                                  getExistingBatchSessionCount() +
                                    selectedStudentIds.indexOf(id),
                                ).endTime
                              }
                              onChange={(e) =>
                                setSessionDrafts((prev) => ({
                                  ...prev,
                                  [id]: {
                                    ...prev[id],
                                    endTime: e.target.value,
                                  },
                                }))
                              }
                              className="p-2 border rounded-lg text-sm font-bold bg-indigo-50 border-indigo-200 focus:ring-2 focus:ring-indigo-500"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-2 rounded border border-gray-200">
                            <p className="text-[10px] font-bold text-gray-500 uppercase">
                              Panel 1
                            </p>
                            <p className="text-sm font-bold text-gray-900">
                              {p1Name}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded border border-gray-200">
                            <p className="text-[10px] font-bold text-gray-500 uppercase">
                              Panel 2
                            </p>
                            <p className="text-sm font-bold text-gray-900">
                              {p2Name}
                            </p>
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

      {/* FULL EDIT MODAL WITH PANEL SWAPPING */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-2">
              <Pencil className="w-5 h-5 text-indigo-600" /> Edit Session
              Details
            </h2>

            <form onSubmit={submitEditSession} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Evaluation Rubric
                </label>
                <select
                  required
                  value={editForm.rubricId}
                  onChange={(e) =>
                    setEditForm({ ...editForm, rubricId: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 bg-white font-semibold text-gray-800"
                >
                  <option value="">Select Rubric...</option>
                  {rubrics.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Panel 1 (Swap if absent)
                  </label>
                  <select
                    value={editForm.panel1Id}
                    onChange={(e) =>
                      setEditForm({ ...editForm, panel1Id: e.target.value })
                    }
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 bg-white font-semibold"
                  >
                    <option value="">Select Panel 1</option>
                    {panels.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Panel 2 (Swap if absent)
                  </label>
                  <select
                    value={editForm.panel2Id}
                    onChange={(e) =>
                      setEditForm({ ...editForm, panel2Id: e.target.value })
                    }
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 bg-white font-semibold"
                  >
                    <option value="">Select Panel 2</option>
                    {panels.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.date}
                    onChange={(e) =>
                      setEditForm({ ...editForm, date: e.target.value })
                    }
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={editForm.time}
                    onChange={(e) =>
                      setEditForm({ ...editForm, time: e.target.value })
                    }
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) =>
                      setEditForm({ ...editForm, endTime: e.target.value })
                    }
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-indigo-700 mb-1 flex items-center gap-1">
                  <LinkIcon className="w-4 h-4" /> Online Meeting Link
                </label>
                <input
                  type="url"
                  required
                  value={editForm.venue}
                  onChange={(e) =>
                    setEditForm({ ...editForm, venue: e.target.value })
                  }
                  placeholder="https://meet.google.com/xyz"
                  className="w-full border-2 border-indigo-200 rounded p-2 focus:ring-2 focus:ring-indigo-500 bg-indigo-50 font-semibold text-blue-700"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
