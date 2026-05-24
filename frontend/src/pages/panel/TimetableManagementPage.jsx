import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Clock,
  Eye,
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
const assignedPanelValue = (assignment) => assignment?.panelId || assignment;

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
const sortSessionsBySchedule = (items = []) =>
  [...items].sort((a, b) => {
    const aKey = `${normalizeDateKey(a.date)} ${a.startTime || a.time || ""} ${a.title || ""}`;
    const bKey = `${normalizeDateKey(b.date)} ${b.startTime || b.time || ""} ${b.title || ""}`;
    return aKey.localeCompare(bKey);
  });

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
  const [batches, setBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionScope, setSessionScope] = useState("all");
  const [batchSearch, setBatchSearch] = useState("");
  const [bulkStudentSearch, setBulkStudentSearch] = useState("");

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

        return {
          sessions: fetchedSessions,
          batches: batchRes.batches || [],
          rubrics: fetchedRubrics,
          users,
        };
      }

      return {
        sessions: fetchedSessions,
        batches,
        rubrics,
        users: [],
      };
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
      sortSessionsBySchedule(
        sessions.filter((session) => String(session.batchId || "") === String(selectedBatchId || "")),
      ),
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

  const getAutoSlot = (index, config = bulkConfig, duration = slotDuration) => {
    const startTime = addMinutes(
      config.startTime || "09:00",
      index * (Number(duration || 30) + Number(config.breakBetweenSlotsMinutes || 0)),
    );
    return { startTime, endTime: addMinutes(startTime, Number(duration || 30)) };
  };

  const recalcRows = (rows, config = bulkConfig, duration = slotDuration) =>
    rows.map((row, index) => {
      const slot = getAutoSlot(index, config, duration);
      return {
        ...row,
        slotNo: index + 1,
        date: config.date,
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

  const resetRowsFromBatch = (batch, sessionSource = sessions) => {
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
    const nextSlotDuration = Number(batch?.slotDurationMinutes || 30);

    setBulkConfig(config);
    setSlotDuration(nextSlotDuration);
    setSelectedStudentIds([]);
    const currentBatchSessions = sortSessionsBySchedule(
      sessionSource.filter((s) => String(s.batchId) === String(batch?.batchId)),
    );
    setReviewRows(recalcRows(makeExistingRows(currentBatchSessions), config, nextSlotDuration));
  };

  const handleSelectBatch = (batchId) => {
    setSelectedBatchId(batchId);
    const batch = batches.find((b) => String(b.batchId) === String(batchId));
    if (batch) resetRowsFromBatch(batch);
  };

  useEffect(() => {
    if (isExistingBatchMode && selectedBatchId) {
      setReviewRows((rows) => {
        const existingRows = makeExistingRows();
        const draftRows = rows.filter((row) => row.type === "draft");
        return recalcRows([...existingRows, ...draftRows]);
      });
    }
  }, [
    isExistingBatchMode,
    selectedBatchId,
    selectedBatchSessions,
    bulkConfig.date,
    bulkConfig.startTime,
    bulkConfig.breakBetweenSlotsMinutes,
    slotDuration,
  ]);

  const updateBulkConfig = (patch) => {
    setBulkConfig((prev) => {
      const next = { ...prev, ...patch };
      if (patch.startTime || patch.date || patch.breakBetweenSlotsMinutes) {
        setReviewRows((rows) => recalcRows(rows, next, slotDuration));
      }
      return next;
    });
  };

  const resolvePanel = (value) => {
    const panelId = idOf(value);
    if (!panelId) return null;
    return panels.find((panel) => String(panel._id) === panelId) || value;
  };

  const assignedPanelNames = (student) =>
    (student.assignedPanels || [])
      .slice(0, 2)
      .map((assignment) => nameOf(resolvePanel(assignedPanelValue(assignment))))
      .filter((name) => name && name !== "-");

  const filteredBulkStudents = useMemo(() => {
    const term = bulkStudentSearch.toLowerCase().trim();

    return students
      .filter((student) => {
        if (!term) return true;

        const panelNames = assignedPanelNames(student);
        return [
          student.name,
          student.matricNumber,
          student.userId,
          student.email,
          student.researchTitle,
          ...panelNames,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        const aSelected = selectedStudentIds.includes(a._id);
        const bSelected = selectedStudentIds.includes(b._id);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [bulkStudentSearch, panels, selectedStudentIds, students]);

  const studentsWithDefaultPanels = students.filter(
    (student) => (student.assignedPanels || []).length >= 2,
  ).length;

  const toggleStudentForBulk = (student) => {
    if (isExistingBatchMode && !selectedBatchId) return alert("Please select an existing batch first.");
    const studentId = student._id;
    const assigned = student.assignedPanels || [];
    if (assigned.length < 2) {
      return alert("This student does not have exactly 2 default panels. Assign panels first.");
    }
    const p1 = assignedPanelValue(assigned[0]);
    const p2 = assignedPanelValue(assigned[1]);
    const panel1 = resolvePanel(p1);
    const panel2 = resolvePanel(p2);
    const selectedRubric = rubrics.find((r) => r._id === bulkConfig.rubricId);

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
      title: `${selectedRubric?.name || "Session"} - ${student.name}`,
      panel1Id: idOf(p1),
      panel2Id: idOf(p2),
      panel1Name: nameOf(panel1),
      panel2Name: nameOf(panel2),
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

  const timingConflictMap = useMemo(() => {
    const conflicts = new Map();
    const add = (key, message) => {
      const messages = conflicts.get(key) || [];
      if (!messages.includes(message)) conflicts.set(key, [...messages, message]);
    };

    const rows = reviewRows.map((row) => {
      const panelEntries = [
        [idOf(row.panel1Id), row.panel1Name],
        [idOf(row.panel2Id), row.panel2Name],
      ].filter(([panelId]) => panelId);

      return {
        ...row,
        source: "review",
        sessionId: idOf(row.sessionId),
        studentId: idOf(row.studentId),
        date: normalizeDateKey(row.date),
        start: timeToMinutes(row.startTime),
        end: timeToMinutes(row.endTime),
        panels: panelEntries.map(([panelId]) => panelId),
        panelNames: Object.fromEntries(panelEntries),
      };
    });
    const reviewedSessionIds = new Set(rows.map((row) => row.sessionId).filter(Boolean));
    const reviewDates = new Set(rows.map((row) => row.date).filter(Boolean));
    const existingItems = sessions
      .filter((session) => String(session.status || "").toLowerCase() !== "cancelled")
      .map((session) => {
        const sessionId = idOf(session._id || session.id);
        const student = getStudent(session);
        const panelValues = session.panels?.length ? session.panels : [getPanel(session, 0), getPanel(session, 1)];
        const panelEntries = panelValues
          .map((panel) => [idOf(panel), nameOf(panel)])
          .filter(([panelId]) => panelId);
        return {
          source: "existing",
          sessionId,
          title: session.title || session.sessionType?.replaceAll("_", " ") || "Existing session",
          studentId: idOf(student),
          studentName: student?.name || "Student",
          date: normalizeDateKey(session.date),
          startTime: session.startTime || session.time || "",
          endTime: session.endTime || "",
          start: timeToMinutes(session.startTime || session.time),
          end: timeToMinutes(session.endTime),
          panels: panelEntries.map(([panelId]) => panelId),
          panelNames: Object.fromEntries(panelEntries),
        };
      })
      .filter((item) => item.date && reviewDates.has(item.date))
      .filter((item) => !item.sessionId || !reviewedSessionIds.has(item.sessionId));

    rows.forEach((row) => {
      if (!row.studentId) add(row.key, "Missing student.");
      if (!row.date) add(row.key, "Missing date.");
      if (row.start === null || row.end === null) add(row.key, "Invalid time frame.");
      if (row.panels.length !== 2) add(row.key, "Exactly 2 panels required.");
      if (new Set(row.panels).size !== row.panels.length) add(row.key, "Panel 1 and Panel 2 are duplicated.");
    });

    const allItems = [...rows, ...existingItems];
    const addToReviewRow = (item, message) => {
      if (item.source === "review") add(item.key, message);
    };
    const itemLabel = (item) =>
      item.source === "review"
        ? `row #${item.slotNo} (${item.studentName || item.title || "session"})`
        : `existing session "${item.title}"`;
    const itemTime = (item) => `${item.startTime || "?"}-${item.endTime || "?"}`;
    const panelNameFor = (item, panelId) => {
      const directName = item.panelNames?.[panelId];
      if (directName && directName !== "-") return directName;
      const directoryName = nameOf(panels.find((panel) => idOf(panel) === panelId));
      return directoryName && directoryName !== "-" ? directoryName : "Selected panel";
    };

    for (let i = 0; i < allItems.length; i += 1) {
      for (let j = i + 1; j < allItems.length; j += 1) {
        const a = allItems[i];
        const b = allItems[j];
        if (a.source !== "review" && b.source !== "review") continue;
        if (a.sessionId && b.sessionId && a.sessionId === b.sessionId) continue;
        if (a.date !== b.date) continue;
        if (a.studentId && a.studentId === b.studentId) {
          addToReviewRow(
            a,
            `Student conflict: ${a.studentName || "This student"} already has ${itemLabel(b)} on ${a.date} at ${itemTime(b)}. One student can only have one session per day.`,
          );
          addToReviewRow(
            b,
            `Student conflict: ${b.studentName || "This student"} already has ${itemLabel(a)} on ${b.date} at ${itemTime(a)}. One student can only have one session per day.`,
          );
        }
        if (a.start === null || a.end === null || b.start === null || b.end === null) continue;
        if (!rangesOverlap(a.start, a.end, b.start, b.end)) continue;
        const sharedPanel = a.panels.find((panelId) => b.panels.includes(panelId));
        if (sharedPanel) {
          addToReviewRow(
            a,
            `Panel conflict: ${panelNameFor(a, sharedPanel)} is also assigned to ${itemLabel(b)} at ${itemTime(b)}, which overlaps this row at ${itemTime(a)}.`,
          );
          addToReviewRow(
            b,
            `Panel conflict: ${panelNameFor(b, sharedPanel)} is also assigned to ${itemLabel(a)} at ${itemTime(a)}, which overlaps this row at ${itemTime(b)}.`,
          );
        }
      }
    }

    return conflicts;
  }, [panels, reviewRows, sessions]);

  const publishConflictMap = useMemo(() => {
    const conflicts = new Map(
      [...timingConflictMap.entries()].map(([key, messages]) => [
        key,
        [...messages],
      ]),
    );
    const add = (key, message) =>
      conflicts.set(key, [...(conflicts.get(key) || []), message]);

    reviewRows
      .filter((row) => row.type === "draft")
      .forEach((row) => {
        if (isExistingBatchMode && !selectedBatchId) {
          add(row.key, "Select an existing batch before publishing.");
        }
        if (!String(bulkConfig.batchName || "").trim()) {
          add(row.key, "Batch name is required before publishing.");
        }
        if (!String(bulkConfig.academicSession || "").trim()) {
          add(row.key, "Academic session is required before publishing.");
        }
        if (!bulkConfig.rubricId) {
          add(row.key, "Rubric is required before publishing.");
        }
        if (!String(bulkConfig.venue || "").trim()) {
          add(row.key, "Online meeting link is required before publishing.");
        }
      });

    return conflicts;
  }, [
    bulkConfig.academicSession,
    bulkConfig.batchName,
    bulkConfig.rubricId,
    bulkConfig.venue,
    isExistingBatchMode,
    reviewRows,
    selectedBatchId,
    timingConflictMap,
  ]);

  const hasTimingConflicts = timingConflictMap.size > 0;
  const hasPublishConflicts = publishConflictMap.size > 0;

  const handleSaveTimeFrames = async () => {
    if (!selectedBatchId) return alert("Please select a batch first.");
    if (!reviewRows.length) return alert("There are no review timing rows to save.");
    if (hasTimingConflicts) return alert("Please fix highlighted timing conflicts before saving time frames.");
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
    const drafts = reviewRows.filter((row) => row.type === "draft");
    if (!drafts.length) return alert("Select at least one new student to publish.");
    if (hasPublishConflicts) return alert("Please fix highlighted row issues before publishing.");

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
      const updateRes = await sessionBatchAPI.update(selectedBatchId, batchForm);

      // Reload both master batches and actual timetable rows immediately.
      // The backend syncs batch date/link/name into Timetable rows, and this refresh
      // makes Session Management + Dashboard reflect the new batch date without waiting
      // for a full page reload.
      const sessionRes = await api.get("/timetables");
      const freshSessions =
        sessionRes.data.timetables || sessionRes.data.sessions || sessionRes.data.data || [];
      const sortedFreshSessions = [...freshSessions].sort((a, b) => {
        const da = `${normalizeDateKey(a.date)} ${a.startTime || a.time || ""}`;
        const db = `${normalizeDateKey(b.date)} ${b.startTime || b.time || ""}`;
        return db.localeCompare(da);
      });
      setSessions(sortedFreshSessions);

      const batchRes = await sessionBatchAPI.list();
      const freshBatches = batchRes.batches || [];
      setBatches(freshBatches);

      const updatedBatch =
        freshBatches.find((batch) => String(batch.batchId) === String(selectedBatchId)) ||
        updateRes.batch;

      if (updatedBatch) {
        resetRowsFromBatch(updatedBatch, sortedFreshSessions);
      }

      setEditingBatch(false);
      alert(
        updateRes.message ||
          `Batch updated successfully. ${updateRes.syncedSessionsCount || 0} session(s) synced.`,
      );
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update batch.");
    }
  };

  const currentUserId = idOf(user?.id || user?._id);
  const isMyAssignedSession = (session) =>
    (session.panels || []).some((panel) => idOf(panel) === currentUserId);

  const visibleSessions = useMemo(
    () =>
      isAdmin && sessionScope === "mine"
        ? sessions.filter(isMyAssignedSession)
        : sessions,
    [currentUserId, isAdmin, sessionScope, sessions],
  );

  const myAssignedSessionCount = useMemo(
    () => sessions.filter(isMyAssignedSession).length,
    [currentUserId, sessions],
  );

  const filteredSessions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return visibleSessions.filter((session) => {
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
  }, [visibleSessions, searchTerm]);

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
          <div className="p-4 bg-gray-50 border-b flex flex-col lg:flex-row lg:items-center gap-3">
            {isAdmin && (
              <div className="flex bg-white border border-gray-200 rounded-lg p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setSessionScope("all")}
                  className={`px-3 py-2 rounded-md text-xs font-bold ${sessionScope === "all" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  All Sessions ({sessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionScope("mine")}
                  className={`px-3 py-2 rounded-md text-xs font-bold ${sessionScope === "mine" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  My Assigned ({myAssignedSessionCount})
                </button>
              </div>
            )}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" placeholder="Search student, batch, session, date, panel..." />
            </div>
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
                  return (
                    <tr key={sessionId} className="hover:bg-gray-50">
                      <td className="p-4"><p className="font-bold text-gray-900">{session.title || session.sessionType}</p><p className="text-xs text-gray-500">{session.batchName || session.batchId || "No batch"}</p></td>
                      <td className="p-4 text-sm text-gray-700"><div>{normalizeDateKey(session.date)}</div><div className="font-semibold">{session.startTime || session.time} - {session.endTime}</div><a href={formatLink(session.venue || session.googleMeetLink)} target="_blank" rel="noreferrer" className="text-blue-700 font-semibold flex items-center gap-1"><Video className="w-4 h-4" /> Link</a></td>
                      <td className="p-4"><p className="font-bold">{student?.name || "-"}</p><p className="text-xs text-gray-500">{student?.matricNumber || student?.userId || "-"}</p></td>
                      <td className="p-4 text-sm"><p>{nameOf(getPanel(session, 0))}</p><p>{nameOf(getPanel(session, 1))}</p></td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/panel/sessions/${sessionId}`)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm font-bold"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => openEditSession(session)}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold"
                            >
                              <Pencil className="w-4 h-4" />
                              Edit
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => removeReviewRow({ type: "existing", sessionId })}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold border border-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          )}
                        </div>
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
                <input type="number" min="5" value={slotDuration} disabled={isExistingBatchMode} onChange={(e) => { const nextDuration = Number(e.target.value); setSlotDuration(nextDuration); localStorage.setItem("admin_slot_duration", e.target.value); setReviewRows((rows) => recalcRows(rows, bulkConfig, nextDuration)); }} className="w-full p-2 border rounded-lg disabled:bg-gray-100" placeholder="Duration" />
                <input type="number" min="0" value={bulkConfig.breakBetweenSlotsMinutes} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ breakBetweenSlotsMinutes: Number(e.target.value) })} className="w-full p-2 border rounded-lg disabled:bg-gray-100" placeholder="Break" />
              </div>
              <select value={bulkConfig.rubricId} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ rubricId: e.target.value })} className="w-full p-2 border rounded-lg disabled:bg-gray-100">
                {rubrics.map((rubric) => <option key={rubric._id} value={rubric._id}>{rubric.name}</option>)}
              </select>
              <input value={bulkConfig.venue} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ venue: e.target.value })} placeholder="Online Meeting Link" className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold flex items-center gap-2"><UserPlus className="w-5 h-5" /> Add Students</h2>
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {filteredBulkStudents.length}/{students.length}
                </span>
              </div>
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  value={bulkStudentSearch}
                  onChange={(e) => setBulkStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search name, matric, title, panel..."
                />
              </div>
              <div className="flex flex-wrap gap-2 mb-3 text-[11px] font-bold">
                <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Selected {selectedStudentIds.length}
                </span>
                <span className="px-2 py-1 rounded bg-green-50 text-green-700 border border-green-100">
                  Ready {studentsWithDefaultPanels}
                </span>
                <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-100">
                  Need Panels {students.length - studentsWithDefaultPanels}
                </span>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {filteredBulkStudents.length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                    No students match this search.
                  </div>
                )}
                {filteredBulkStudents.map((student) => {
                  const defaultPanels = assignedPanelNames(student);

                  return (
                    <button key={student._id} onClick={() => toggleStudentForBulk(student)} className={`w-full text-left p-3 rounded-lg border ${selectedStudentIds.includes(student._id) ? "bg-indigo-50 border-indigo-300" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
                      <p className="font-bold text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.matricNumber || student.userId}</p>
                      <p className={`text-[11px] mt-1 font-semibold ${defaultPanels.length === 2 ? "text-green-700" : "text-amber-700"}`}>
                        Panels: {defaultPanels.length ? defaultPanels.join(" / ") : "Not assigned"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-5 bg-gray-50 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Review Timings</h2>
                <p className="text-sm text-gray-500">Drag or use arrows to interchange time frames. Red rows show the exact timing or publish issue.</p>
              </div>
              <button onClick={handleSaveTimeFrames} disabled={saving || !reviewRows.some((row) => row.type === "existing") || hasTimingConflicts} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50 flex items-center gap-2 justify-center"><Save className="w-4 h-4" /> Save Time Frames</button>
            </div>

            <div className="max-h-[620px] overflow-y-auto divide-y divide-gray-100">
              {reviewRows.length === 0 && <div className="p-10 text-center text-gray-500">Select an existing batch or add students to review timings.</div>}
              {reviewRows.map((row, index) => {
                const errors = publishConflictMap.get(row.key) || [];
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
              <div>
                <p className="text-sm text-gray-600">{reviewRows.filter((r) => r.type === "existing").length} existing, {reviewRows.filter((r) => r.type === "draft").length} new draft(s).</p>
                {hasPublishConflicts && <p className="text-xs text-red-700 font-semibold mt-1">Fix the red row reason(s) before publishing.</p>}
              </div>
              <button onClick={handleBulkSubmit} disabled={saving || hasPublishConflicts || !reviewRows.some((row) => row.type === "draft")} className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50">Publish New Sessions</button>
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
