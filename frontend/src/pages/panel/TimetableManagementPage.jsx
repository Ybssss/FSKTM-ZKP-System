import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Clock,
  GripVertical,
  Layers,
  Pencil,
  Save,
  Search,
  Trash2,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api, { sessionBatchAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const normalizeDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const timeToMinutes = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const minutesToTime = (minutes) => {
  const normalized = ((Number(minutes) || 0) % 1440 + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
};

const addMinutes = (time, minutes) => {
  const base = timeToMinutes(time);
  if (base === null) return "";
  return minutesToTime(base + Number(minutes || 0));
};

const getStudent = (session) => session.student || session.students?.[0] || null;
const getPanel = (session, index) => session.panels?.[index] || session[`panel${index + 1}Id`] || null;
const idOf = (value) => String(value?._id || value || "");
const nameOf = (value) => value?.name || value?.userId || "-";

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export default function TimetableManagementPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("list");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [panels, setPanels] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [batches, setBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [batchSearch, setBatchSearch] = useState("");

  const [batchMode, setBatchMode] = useState("existing");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [reviewRows, setReviewRows] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [saving, setSaving] = useState(false);

  const [slotDuration, setSlotDuration] = useState(() => Number(localStorage.getItem("admin_slot_duration") || 30));
  const [bulkConfig, setBulkConfig] = useState({
    rubricId: "",
    academicSession: "2025/2026, Semester 1",
    batchName: "",
    batchId: "",
    date: normalizeDateKey(new Date()),
    startTime: "09:00",
    venue: "",
    breakBetweenSlotsMinutes: 5,
  });

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

  const [editingBatch, setEditingBatch] = useState(false);
  const [batchForm, setBatchForm] = useState({});

  const isExistingBatchMode = batchMode === "existing";

  const loadData = async () => {
    setLoading(true);
    try {
      const sessionRes = isAdmin ? await api.get("/timetables") : await api.get("/timetables/my");
      const fetchedSessions = sessionRes.data.timetables || sessionRes.data.sessions || sessionRes.data.data || [];
      setSessions(
        [...fetchedSessions].sort((a, b) => {
          const da = `${normalizeDateKey(a.date)} ${a.startTime || a.time || ""}`;
          const db = `${normalizeDateKey(b.date)} ${b.startTime || b.time || ""}`;
          return db.localeCompare(da);
        }),
      );

      const evRes = await api.get("/evaluations");
      setEvaluations(evRes.data.data || evRes.data.evaluations || []);

      if (isAdmin) {
        const [usersRes, rubRes, batchRes] = await Promise.all([
          api.get("/users"),
          api.get("/rubrics"),
          sessionBatchAPI.list(),
        ]);
        const users = usersRes.data.users || [];
        const fetchedRubrics = rubRes.data.data || rubRes.data.rubrics || [];
        setStudents(users.filter((u) => u.role === "student"));
        setPanels(users.filter((u) => ["panel", "admin"].includes(u.role)));
        setRubrics(fetchedRubrics);
        setBatches(batchRes.batches || []);
        setBulkConfig((prev) => ({ ...prev, rubricId: prev.rubricId || fetchedRubrics[0]?._id || "" }));
      }
    } catch (error) {
      console.error("Failed to load session data", error);
      alert(error.response?.data?.message || "Failed to load session data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedBatch = useMemo(
    () => batches.find((batch) => String(batch.batchId) === String(selectedBatchId)),
    [batches, selectedBatchId],
  );

  const selectedBatchSessions = useMemo(
    () =>
      sessions
        .filter((session) => String(session.batchId || "") === String(selectedBatchId || ""))
        .sort((a, b) => String(a.startTime || a.time || "").localeCompare(String(b.startTime || b.time || ""))),
    [sessions, selectedBatchId],
  );

  const filteredBatches = useMemo(() => {
    const term = batchSearch.toLowerCase().trim();
    if (!term) return batches;
    return batches.filter((batch) =>
      [
        batch.batchName,
        batch.batchId,
        batch.sessionType,
        batch.academicSession,
        normalizeDateKey(batch.date || batch.earliestDate),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [batches, batchSearch]);

  const getAutoSlot = (index) => {
    const startTime = addMinutes(
      bulkConfig.startTime || "09:00",
      index * (Number(slotDuration || 30) + Number(bulkConfig.breakBetweenSlotsMinutes || 0)),
    );
    return { startTime, endTime: addMinutes(startTime, Number(slotDuration || 30)) };
  };

  const recalcRows = (rows) =>
    rows.map((row, index) => {
      const slot = getAutoSlot(index);
      return {
        ...row,
        slotNo: index + 1,
        date: bulkConfig.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };
    });

  const makeExistingRows = (batchSessions = selectedBatchSessions) =>
    batchSessions.map((session, index) => {
      const student = getStudent(session);
      const p1 = getPanel(session, 0);
      const p2 = getPanel(session, 1);
      return {
        key: `existing-${session._id || session.id}`,
        type: "existing",
        sessionId: session._id || session.id,
        slotNo: index + 1,
        studentId: idOf(student),
        studentName: student?.name || "Unknown Student",
        matricNumber: student?.matricNumber || student?.userId || "-",
        title: session.title || session.sessionType?.replaceAll("_", " ") || "Session",
        date: normalizeDateKey(session.date),
        startTime: session.startTime || session.time || "",
        endTime: session.endTime || "",
        panel1Id: idOf(p1),
        panel2Id: idOf(p2),
        panel1Name: nameOf(p1),
        panel2Name: nameOf(p2),
        status: session.status || "scheduled",
      };
    });

  const resetRowsFromBatch = (batch) => {
    const batchDate = normalizeDateKey(batch?.date || batch?.earliestDate || new Date());
    const config = {
      rubricId: batch?.rubricId?._id || batch?.rubricId || bulkConfig.rubricId,
      academicSession: batch?.academicSession || "2025/2026, Semester 1",
      batchName: batch?.batchName || "",
      batchId: batch?.batchId || "",
      date: batchDate,
      startTime: batch?.startTime || "09:00",
      venue: batch?.googleMeetLink || "",
      breakBetweenSlotsMinutes: batch?.breakBetweenSlotsMinutes ?? 5,
    };
    setBulkConfig(config);
    setSlotDuration(Number(batch?.slotDurationMinutes || 30));
    setSelectedStudentIds([]);
    setReviewRows(makeExistingRows(sessions.filter((s) => String(s.batchId) === String(batch?.batchId))));
  };

  const handleSelectBatch = (batchId) => {
    setSelectedBatchId(batchId);
    const batch = batches.find((b) => String(b.batchId) === String(batchId));
    if (batch) resetRowsFromBatch(batch);
  };

  useEffect(() => {
    if (isExistingBatchMode && selectedBatchId) {
      setReviewRows((rows) => {
        const existingKeys = new Set(rows.filter((row) => row.type !== "existing").map((row) => row.key));
        const existingRows = makeExistingRows();
        const draftRows = rows.filter((row) => existingKeys.has(row.key));
        return recalcRows([...existingRows, ...draftRows]);
      });
    }
  }, [selectedBatchSessions.length]);

  const updateBulkConfig = (patch) => {
    setBulkConfig((prev) => {
      const next = { ...prev, ...patch };
      if (patch.startTime || patch.date || patch.breakBetweenSlotsMinutes) {
        setTimeout(() => setReviewRows((rows) => recalcRows(rows)), 0);
      }
      return next;
    });
  };

  const toggleStudentForBulk = (student) => {
    if (isExistingBatchMode && !selectedBatchId) return alert("Please select an existing batch first.");
    const studentId = student._id;
    const assigned = student.assignedPanels || [];
    if (assigned.length < 2) {
      return alert("This student does not have exactly 2 default panels. Assign panels first.");
    }
    const p1 = assigned[0]?.panelId?._id || assigned[0]?.panelId || assigned[0];
    const p2 = assigned[1]?.panelId?._id || assigned[1]?.panelId || assigned[1];

    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds((prev) => prev.filter((id) => id !== studentId));
      setReviewRows((prev) => recalcRows(prev.filter((row) => row.key !== `draft-${studentId}`)));
      return;
    }

    const draft = {
      key: `draft-${studentId}`,
      type: "draft",
      studentId,
      studentName: student.name,
      matricNumber: student.matricNumber || student.userId || "-",
      title: `Proposal Defense - ${student.name}`,
      panel1Id: idOf(p1),
      panel2Id: idOf(p2),
      panel1Name: nameOf(assigned[0]?.panelId || assigned[0]),
      panel2Name: nameOf(assigned[1]?.panelId || assigned[1]),
      status: "draft",
    };
    setSelectedStudentIds((prev) => [...prev, studentId]);
    setReviewRows((prev) => recalcRows([...prev, draft]));
  };

  const moveRow = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= reviewRows.length) return;
    const next = [...reviewRows];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    setReviewRows(recalcRows(next));
  };

  const removeReviewRow = async (row) => {
    if (row.type === "draft") {
      setSelectedStudentIds((prev) => prev.filter((id) => id !== row.studentId));
      setReviewRows((prev) => recalcRows(prev.filter((r) => r.key !== row.key)));
      return;
    }
    if (!window.confirm("Drop this scheduled session? Pending evaluations will also be removed.")) return;
    await api.delete(`/timetables/${row.sessionId}`);
    await loadData();
    setReviewRows((prev) => recalcRows(prev.filter((r) => r.key !== row.key)));
  };

  const conflictMap = useMemo(() => {
    const conflicts = new Map();
    const add = (key, message) => conflicts.set(key, [...(conflicts.get(key) || []), message]);

    const rows = reviewRows.map((row) => ({
      ...row,
      start: timeToMinutes(row.startTime),
      end: timeToMinutes(row.endTime),
      panels: [row.panel1Id, row.panel2Id].filter(Boolean),
    }));

    rows.forEach((row) => {
      if (!row.studentId) add(row.key, "Missing student.");
      if (!row.date) add(row.key, "Missing date.");
      if (row.start === null || row.end === null) add(row.key, "Invalid time frame.");
      if (row.panels.length !== 2) add(row.key, "Exactly 2 panels required.");
      if (new Set(row.panels).size !== row.panels.length) add(row.key, "Panel 1 and Panel 2 are duplicated.");
    });

    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i];
        const b = rows[j];
        if (a.date !== b.date) continue;
        if (a.studentId && a.studentId === b.studentId) {
          add(a.key, "Student already has another session on this date.");
          add(b.key, "Student already has another session on this date.");
        }
        if (a.start === null || a.end === null || b.start === null || b.end === null) continue;
        if (!rangesOverlap(a.start, a.end, b.start, b.end)) continue;
        const sharedPanel = a.panels.find((panelId) => b.panels.includes(panelId));
        if (sharedPanel) {
          add(a.key, "Panel time conflict with another row.");
          add(b.key, "Panel time conflict with another row.");
        }
      }
    }

    return conflicts;
  }, [reviewRows]);

  const hasConflicts = conflictMap.size > 0;

  const handleSaveTimeFrames = async () => {
    if (!selectedBatchId) return alert("Please select a batch first.");
    if (!reviewRows.length) return alert("There are no review timing rows to save.");
    if (hasConflicts) return alert("Please fix highlighted conflicts before saving time frames.");
    setSaving(true);
    try {
      const existingItems = reviewRows
        .filter((row) => row.type === "existing")
        .map((row) => ({
          sessionId: row.sessionId,
          date: bulkConfig.date,
          startTime: row.startTime,
          endTime: row.endTime,
        }));
      if (existingItems.length) {
        await api.post(`/timetables/batches/${encodeURIComponent(selectedBatchId)}/time-frames`, {
          date: bulkConfig.date,
          items: existingItems,
        });
      }
      alert("Time frames saved successfully.");
      await loadData();
      const batchRes = await sessionBatchAPI.list();
      setBatches(batchRes.batches || []);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save time frames.");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (hasConflicts) return alert("Please fix highlighted conflicts before publishing.");
    const drafts = reviewRows.filter((row) => row.type === "draft");
    if (!drafts.length) return alert("Select at least one new student to publish.");
    if (!bulkConfig.batchName.trim()) return alert("Please enter/select a batch name.");
    if (!bulkConfig.venue) return alert("Please set an online meeting link.");
    if (!bulkConfig.rubricId) return alert("Please select a rubric.");

    setSaving(true);
    try {
      const selectedRubric = rubrics.find((r) => r._id === bulkConfig.rubricId);
      const sessionType = selectedRubric?.sessionType || "PROPOSAL_DEFENSE";
      const finalBatchId = isExistingBatchMode
        ? selectedBatchId
        : bulkConfig.batchId.trim() || `${bulkConfig.batchName.trim()}-${bulkConfig.date}`;

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
        sessions: drafts.map((row) => ({
          title: row.title,
          studentName: row.studentName,
          studentId: row.studentId,
          sessionType,
          rubricId: bulkConfig.rubricId,
          date: row.date,
          time: row.startTime,
          startTime: row.startTime,
          endTime: row.endTime,
          venue: bulkConfig.venue,
          panel1Id: row.panel1Id,
          panel2Id: row.panel2Id,
        })),
      });

      alert("Sessions published successfully.");
      setSelectedStudentIds([]);
      await loadData();
      const batchRes = await sessionBatchAPI.list();
      setBatches(batchRes.batches || []);
      navigate(`/panel/sessions/batch/${encodeURIComponent(finalBatchId)}/print`);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to publish sessions.");
    } finally {
      setSaving(false);
    }
  };

  const openEditSession = (session) => {
    const p1 = getPanel(session, 0);
    const p2 = getPanel(session, 1);
    setEditingSession(session);
    setEditForm({
      rubricId: session.rubricId?._id || session.rubricId || "",
      date: normalizeDateKey(session.date),
      time: session.startTime || session.time || "",
      endTime: session.endTime || "",
      venue: session.venue || session.googleMeetLink || "",
      panel1Id: idOf(p1),
      panel2Id: idOf(p2),
    });
  };

  const submitEditSession = async (e) => {
    e.preventDefault();
    const selectedRubric = rubrics.find((r) => r._id === editForm.rubricId);
    try {
      await api.put(`/timetables/${editingSession._id || editingSession.id}`, {
        ...editForm,
        date: editForm.date,
        startTime: editForm.time,
        sessionType: selectedRubric?.sessionType || editingSession.sessionType,
      });
      setEditingSession(null);
      alert("Session updated successfully.");
      await loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update session.");
    }
  };

  const openEditBatch = () => {
    if (!selectedBatch) return alert("Please select a batch first.");
    setBatchForm({
      batchName: selectedBatch.batchName || "",
      academicSession: selectedBatch.academicSession || "",
      scheduleTitle: selectedBatch.scheduleTitle || "Postgraduate Progress Presentation Schedule",
      sessionType: selectedBatch.sessionType || "PROPOSAL_DEFENSE",
      date: normalizeDateKey(selectedBatch.date || selectedBatch.earliestDate),
      startTime: selectedBatch.startTime || "09:00",
      slotDurationMinutes: selectedBatch.slotDurationMinutes || slotDuration,
      breakBetweenSlotsMinutes: selectedBatch.breakBetweenSlotsMinutes ?? 5,
      googleMeetLink: selectedBatch.googleMeetLink || "",
      status: selectedBatch.status || "active",
    });
    setEditingBatch(true);
  };

  const submitEditBatch = async (e) => {
    e.preventDefault();
    try {
      await sessionBatchAPI.update(selectedBatchId, batchForm);
      const batchRes = await sessionBatchAPI.list();
      setBatches(batchRes.batches || []);
      setEditingBatch(false);
      handleSelectBatch(selectedBatchId);
      alert("Batch updated successfully.");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update batch.");
    }
  };

  const filteredSessions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return sessions.filter((session) => {
      if (!term) return true;
      const student = getStudent(session);
      return [
        session.title,
        session.batchName,
        session.sessionType,
        student?.name,
        student?.matricNumber,
        student?.researchTitle,
        session.startTime,
        normalizeDateKey(session.date),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [sessions, searchTerm]);

  const formatLink = (url) => {
    if (!url) return "#";
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500 font-semibold">Loading Session Management...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-indigo-600" /> Session Management
          </h1>
          <p className="text-gray-600 mt-2">Schedule sessions with student/day and panel/time conflict protection.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap bg-gray-200 p-1 rounded-lg gap-1">
            <button onClick={() => setActiveTab("list")} className={`px-4 py-2 rounded-md font-bold text-sm ${activeTab === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}>All Sessions</button>
            <button onClick={() => setActiveTab("bulk")} className={`px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 ${activeTab === "bulk" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600"}`}><Layers className="w-4 h-4" /> Smart Schedule</button>
            <button onClick={() => navigate("/panel/sessions/batches/print")} className="px-4 py-2 rounded-md font-bold text-sm bg-green-600 text-white hover:bg-green-700">Export Batches</button>
          </div>
        )}
      </div>

      {activeTab === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex items-center relative">
            <Search className="w-5 h-5 text-gray-400 absolute ml-3" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" placeholder="Search student, batch, session, date, panel..." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-gray-50 border-b text-xs text-gray-600 uppercase">
                <tr><th className="p-4">Session</th><th className="p-4">Schedule</th><th className="p-4">Student</th><th className="p-4">Panels</th><th className="p-4 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSessions.map((session) => {
                  const sessionId = session._id || session.id;
                  const student = getStudent(session);
                  const pendingEval = evaluations.find((ev) => {
                    const evSessionId = ev.sessionId?._id || ev.sessionId;
                    const evEvaluator = ev.evaluatorId?._id || ev.evaluatorId;
                    return String(evSessionId) === String(sessionId) && String(evEvaluator) === String(user.id) && ev.status === "PENDING";
                  });
                  return (
                    <tr key={sessionId} className="hover:bg-gray-50">
                      <td className="p-4"><p className="font-bold text-gray-900">{session.title || session.sessionType}</p><p className="text-xs text-gray-500">{session.batchName || session.batchId || "No batch"}</p></td>
                      <td className="p-4 text-sm text-gray-700"><div>{normalizeDateKey(session.date)}</div><div className="font-semibold">{session.startTime || session.time} - {session.endTime}</div><a href={formatLink(session.venue || session.googleMeetLink)} target="_blank" rel="noreferrer" className="text-blue-700 font-semibold flex items-center gap-1"><Video className="w-4 h-4" /> Link</a></td>
                      <td className="p-4"><p className="font-bold">{student?.name || "-"}</p><p className="text-xs text-gray-500">{student?.matricNumber || student?.userId || "-"}</p></td>
                      <td className="p-4 text-sm"><p>{nameOf(getPanel(session, 0))}</p><p>{nameOf(getPanel(session, 1))}</p></td>
                      <td className="p-4 text-right space-x-2">
                        {isAdmin ? <button onClick={() => openEditSession(session)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Edit</button> : pendingEval ? <button onClick={() => navigate(`/panel/evaluation/${pendingEval._id}`)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Evaluate</button> : <button onClick={() => navigate(`/panel/sessions/${sessionId}`)} className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm font-bold">View</button>}
                        {isAdmin && <button onClick={() => removeReviewRow({ type: "existing", sessionId })} className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold border border-red-200">Delete</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "bulk" && isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="text-lg font-bold mb-4">Batch Mode</h2>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => { setBatchMode("existing"); setSelectedStudentIds([]); setReviewRows([]); }} className={`px-3 py-2 rounded-lg font-bold text-sm ${batchMode === "existing" ? "bg-indigo-600 text-white" : "bg-gray-100"}`}>Use Existing</button>
                <button onClick={() => { setBatchMode("new"); setSelectedBatchId(""); setSelectedStudentIds([]); setReviewRows([]); setBulkConfig((prev) => ({ ...prev, batchName: "", batchId: "", venue: "", date: normalizeDateKey(new Date()), startTime: "09:00" })); }} className={`px-3 py-2 rounded-lg font-bold text-sm ${batchMode === "new" ? "bg-indigo-600 text-white" : "bg-gray-100"}`}>Create New</button>
              </div>

              {isExistingBatchMode && (
                <>
                  <input value={batchSearch} onChange={(e) => setBatchSearch(e.target.value)} placeholder="Search available batches..." className="w-full p-2 border rounded-lg mb-2" />
                  <select value={selectedBatchId} onChange={(e) => handleSelectBatch(e.target.value)} className="w-full p-2 border rounded-lg font-semibold bg-gray-50">
                    <option value="">Select existing batch...</option>
                    {filteredBatches.map((batch) => <option key={batch.batchId} value={batch.batchId}>{batch.batchName || batch.batchId} — {normalizeDateKey(batch.date || batch.earliestDate)}</option>)}
                  </select>
                  <button onClick={openEditBatch} disabled={!selectedBatchId} className="mt-2 w-full px-3 py-2 rounded-lg font-bold text-sm bg-amber-50 text-amber-700 border border-amber-200 disabled:opacity-50">Edit Selected Batch</button>
                </>
              )}
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
              <h2 className="text-lg font-bold">Batch Details</h2>
              <input value={bulkConfig.batchName} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ batchName: e.target.value })} placeholder="Batch Name, e.g. PIXEL" className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <input value={bulkConfig.batchId} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ batchId: e.target.value })} placeholder="Batch ID" className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <input type="date" value={bulkConfig.date} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ date: e.target.value })} className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <input type="time" value={bulkConfig.startTime} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ startTime: e.target.value })} className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="5" value={slotDuration} disabled={isExistingBatchMode} onChange={(e) => { setSlotDuration(Number(e.target.value)); localStorage.setItem("admin_slot_duration", e.target.value); setTimeout(() => setReviewRows((rows) => recalcRows(rows)), 0); }} className="w-full p-2 border rounded-lg disabled:bg-gray-100" placeholder="Duration" />
                <input type="number" min="0" value={bulkConfig.breakBetweenSlotsMinutes} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ breakBetweenSlotsMinutes: Number(e.target.value) })} className="w-full p-2 border rounded-lg disabled:bg-gray-100" placeholder="Break" />
              </div>
              <select value={bulkConfig.rubricId} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ rubricId: e.target.value })} className="w-full p-2 border rounded-lg disabled:bg-gray-100">
                {rubrics.map((rubric) => <option key={rubric._id} value={rubric._id}>{rubric.name}</option>)}
              </select>
              <input value={bulkConfig.venue} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ venue: e.target.value })} placeholder="Online Meeting Link" className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><UserPlus className="w-5 h-5" /> Add Students</h2>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {students.map((student) => (
                  <button key={student._id} onClick={() => toggleStudentForBulk(student)} className={`w-full text-left p-3 rounded-lg border ${selectedStudentIds.includes(student._id) ? "bg-indigo-50 border-indigo-300" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
                    <p className="font-bold text-gray-900">{student.name}</p>
                    <p className="text-xs text-gray-500">{student.matricNumber || student.userId}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-5 bg-gray-50 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Review Timings</h2>
                <p className="text-sm text-gray-500">Drag or use arrows to interchange time frames. Red rows mean student/day or panel/time crash.</p>
              </div>
              <button onClick={handleSaveTimeFrames} disabled={saving || !reviewRows.some((row) => row.type === "existing") || hasConflicts} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50 flex items-center gap-2 justify-center"><Save className="w-4 h-4" /> Save Time Frames</button>
            </div>

            <div className="max-h-[620px] overflow-y-auto divide-y divide-gray-100">
              {reviewRows.length === 0 && <div className="p-10 text-center text-gray-500">Select an existing batch or add students to review timings.</div>}
              {reviewRows.map((row, index) => {
                const errors = conflictMap.get(row.key) || [];
                return (
                  <div key={row.key} draggable onDragStart={() => setDragIndex(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragIndex !== null) moveRow(dragIndex, index); setDragIndex(null); }} className={`p-4 grid grid-cols-1 lg:grid-cols-[44px_90px_1fr_140px_180px_120px] gap-3 items-center ${errors.length ? "bg-red-50 border-l-4 border-red-500" : row.type === "existing" ? "bg-blue-50/30" : "bg-white"}`}>
                    <div className="flex items-center gap-2 text-gray-500"><GripVertical className="w-5 h-5" /><span className="font-bold">#{row.slotNo}</span></div>
                    <div><p className="font-bold text-gray-900">{row.startTime}</p><p className="text-xs text-gray-500">to {row.endTime}</p></div>
                    <div><p className="font-bold text-gray-900">{row.studentName}</p><p className="text-xs text-gray-500">{row.matricNumber} · {row.type === "existing" ? "Scheduled" : "New Draft"}</p>{errors.map((err) => <p key={err} className="text-xs text-red-700 font-semibold mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {err}</p>)}</div>
                    <div><p className="text-xs text-gray-500 uppercase font-bold">Date</p><p className="font-semibold">{row.date}</p></div>
                    <div className="text-sm"><p>{row.panel1Name}</p><p>{row.panel2Name}</p></div>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => moveRow(index, index - 1)} className="px-2 py-1 border rounded">↑</button>
                      <button onClick={() => moveRow(index, index + 1)} className="px-2 py-1 border rounded">↓</button>
                      {row.type === "existing" && <button onClick={() => openEditSession(sessions.find((s) => String(s._id || s.id) === String(row.sessionId)))} className="px-2 py-1 bg-indigo-600 text-white rounded"><Pencil className="w-4 h-4" /></button>}
                      <button onClick={() => removeReviewRow(row)} className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-5 border-t bg-gray-50 flex flex-col md:flex-row justify-between gap-3">
              <p className="text-sm text-gray-600">{reviewRows.filter((r) => r.type === "existing").length} existing, {reviewRows.filter((r) => r.type === "draft").length} new draft(s).</p>
              <button onClick={handleBulkSubmit} disabled={saving || hasConflicts || !reviewRows.some((row) => row.type === "draft")} className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50">Publish New Sessions</button>
            </div>
          </div>
        </div>
      )}

      {editingSession && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={submitEditSession} className="bg-white rounded-xl max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Edit Session</h2><button type="button" onClick={() => setEditingSession(null)}><X className="w-5 h-5" /></button></div>
            <select value={editForm.rubricId} onChange={(e) => setEditForm({ ...editForm, rubricId: e.target.value })} className="w-full p-2 border rounded-lg">{rubrics.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}</select>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="p-2 border rounded-lg" /><input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} className="p-2 border rounded-lg" /><input type="time" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} className="p-2 border rounded-lg" /></div>
            <input value={editForm.venue} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Meeting link" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><select value={editForm.panel1Id} onChange={(e) => setEditForm({ ...editForm, panel1Id: e.target.value })} className="p-2 border rounded-lg"><option value="">Panel 1</option>{panels.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select><select value={editForm.panel2Id} onChange={(e) => setEditForm({ ...editForm, panel2Id: e.target.value })} className="p-2 border rounded-lg"><option value="">Panel 2</option>{panels.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">Panel replacement is only allowed at least 1 week before the session date. Completed evaluations are not changed.</p>
            <button className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold">Save Session</button>
          </form>
        </div>
      )}

      {editingBatch && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={submitEditBatch} className="bg-white rounded-xl max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Edit Batch</h2><button type="button" onClick={() => setEditingBatch(false)}><X className="w-5 h-5" /></button></div>
            <input value={batchForm.batchName || ""} onChange={(e) => setBatchForm({ ...batchForm, batchName: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Batch name" />
            <input value={batchForm.academicSession || ""} onChange={(e) => setBatchForm({ ...batchForm, academicSession: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Academic session" />
            <input value={batchForm.scheduleTitle || ""} onChange={(e) => setBatchForm({ ...batchForm, scheduleTitle: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Schedule title" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="date" value={batchForm.date || ""} onChange={(e) => setBatchForm({ ...batchForm, date: e.target.value })} className="p-2 border rounded-lg" /><input type="time" value={batchForm.startTime || ""} onChange={(e) => setBatchForm({ ...batchForm, startTime: e.target.value })} className="p-2 border rounded-lg" /></div>
            <input value={batchForm.googleMeetLink || ""} onChange={(e) => setBatchForm({ ...batchForm, googleMeetLink: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Meeting link" />
            <button className="w-full py-3 bg-amber-600 text-white rounded-lg font-bold">Save Batch</button>
          </form>
        </div>
      )}
    </div>
  );
}
