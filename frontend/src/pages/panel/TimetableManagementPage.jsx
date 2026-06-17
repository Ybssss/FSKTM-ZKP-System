import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ClipboardCheck,
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
import UserProfileLink from "../../components/UserProfileLink";
import SortableTh from "../../components/SortableTh";
import useSortableData from "../../hooks/useSortableData";
import {
  buildPublishConflictMap,
  buildTimingConflictMap,
  getPanel,
  getStudent,
  idOf,
  minutesToTime,
  nameOf,
  normalizeDateKey,
  timeToMinutes,
} from "../../utils/timetableConflicts";

const addMinutes = (time, minutes) => {
  const base = timeToMinutes(time);
  if (base === null) return "";
  return minutesToTime(base + Number(minutes || 0));
};

const buildBatchId = (batchName, date) => {
  const normalizedName = String(batchName || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 100);
  const normalizedDate = normalizeDateKey(date).replace(/-/g, "");
  return `${normalizedName || "BATCH"}${normalizedDate ? `-${normalizedDate}` : ""}`;
};

const assignedPanelValue = (assignment) => assignment?.panelId || assignment;
const sortSessionsBySchedule = (items = []) =>
  [...items].sort((a, b) => {
    const aKey = `${normalizeDateKey(a.date)} ${a.startTime || a.time || ""} ${a.title || ""}`;
    const bKey = `${normalizeDateKey(b.date)} ${b.startTime || b.time || ""} ${b.title || ""}`;
    return aKey.localeCompare(bKey);
  });

const getSessionStartDateTime = (session) => {
  const date = normalizeDateKey(session?.date);
  const time = String(session?.startTime || session?.time || "00:00").trim();
  const dt = new Date(`${date}T${time}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const getSessionEndDateTime = (session) => {
  const date = normalizeDateKey(session?.date);
  const time = String(
    session?.endTime || session?.startTime || session?.time || "23:59",
  ).trim();
  const dt = new Date(`${date}T${time}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

export default function TimetableManagementPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const currentUserId = idOf(user?.id || user?._id);
  const canTrackViewerEvaluations = ["admin", "panel"].includes(user?.role);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("list");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [sessionEvaluations, setSessionEvaluations] = useState([]);
  const [viewerEvaluations, setViewerEvaluations] = useState([]);
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
  const derivedBatchId = useMemo(
    () => buildBatchId(bulkConfig.batchName, bulkConfig.date),
    [bulkConfig.batchName, bulkConfig.date],
  );
  const visibleBatchId = isExistingBatchMode
    ? bulkConfig.batchId || selectedBatchId || derivedBatchId
    : derivedBatchId;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionRes, evaluationRes] = await Promise.all([
        isAdmin ? api.get("/timetables") : api.get("/timetables/my"),
        canTrackViewerEvaluations
          ? api.get("/evaluations")
          : Promise.resolve({ data: { data: [] } }),
      ]);
      const fetchedSessions = sessionRes.data.timetables || sessionRes.data.sessions || sessionRes.data.data || [];
      const fetchedEvaluations =
        evaluationRes.data?.data || evaluationRes.data?.evaluations || [];
      setSessions(
        [...fetchedSessions].sort((a, b) => {
          const da = `${normalizeDateKey(a.date)} ${a.startTime || a.time || ""}`;
          const db = `${normalizeDateKey(b.date)} ${b.startTime || b.time || ""}`;
          return db.localeCompare(da);
        }),
      );
      setSessionEvaluations(fetchedEvaluations);
      setViewerEvaluations(
        fetchedEvaluations.filter(
          (evaluation) => idOf(evaluation?.evaluatorId) === currentUserId,
        ),
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
        batches: [],
        rubrics: [],
        users: [],
      };
    } catch (error) {
      console.error("Failed to load session data", error);
      alert(error.response?.data?.message || "Failed to load session data.");
    } finally {
      setLoading(false);
    }
  }, [canTrackViewerEvaluations, currentUserId, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    const visibleBatches = !term
      ? batches
      : batches.filter((batch) =>
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

    return [...visibleBatches].sort((a, b) => {
      const aKey = `${normalizeDateKey(a.date || a.earliestDate)} ${a.batchName || a.batchId || ""}`;
      const bKey = `${normalizeDateKey(b.date || b.earliestDate)} ${b.batchName || b.batchId || ""}`;
      return aKey.localeCompare(bKey);
    });
  }, [batches, batchSearch]);

  const getAutoSlot = useCallback((index, config = bulkConfig, duration = slotDuration) => {
    const startTime = addMinutes(
      config.startTime || "09:00",
      index * (Number(duration || 30) + Number(config.breakBetweenSlotsMinutes || 0)),
    );
    return { startTime, endTime: addMinutes(startTime, Number(duration || 30)) };
  }, [bulkConfig, slotDuration]);

  const recalcRows = useCallback((rows, config = bulkConfig, duration = slotDuration) =>
    rows.map((row, index) => {
      const slot = getAutoSlot(index, config, duration);
      return {
        ...row,
        slotNo: index + 1,
        date: config.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };
    }), [bulkConfig, getAutoSlot, slotDuration]);

  const makeExistingRows = useCallback((batchSessions) =>
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
    }), []);

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
        const existingRows = makeExistingRows(selectedBatchSessions);
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
    makeExistingRows,
    recalcRows,
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

  const resolvePanel = useCallback((value) => {
    const panelId = idOf(value);
    if (!panelId) return null;
    return panels.find((panel) => String(panel._id) === panelId) || value;
  }, [panels]);

  const resolveStudent = useCallback((value) => {
    const studentId = idOf(value);
    if (!studentId) return null;
    return students.find((student) => String(student._id) === studentId) || value;
  }, [students]);

  const resolveSupervisor = useCallback((studentValue) => {
    const student = resolveStudent(studentValue);
    const supervisor = student?.supervisorId;
    const supervisorId = idOf(supervisor);
    if (!supervisorId) return null;
    return panels.find((panel) => String(panel._id) === supervisorId) || supervisor;
  }, [panels, resolveStudent]);

  const assignedPanelNames = useCallback((student) =>
    (student.assignedPanels || [])
      .slice(0, 2)
      .map((assignment) => nameOf(resolvePanel(assignedPanelValue(assignment))))
      .filter((name) => name && name !== "-"), [resolvePanel]);

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
  }, [assignedPanelNames, bulkStudentSearch, selectedStudentIds, students]);

  const studentsWithDefaultPanels = students.filter(
    (student) => (student.assignedPanels || []).length >= 2,
  ).length;

  const reviewStudentIds = useMemo(
    () =>
      new Set(
        reviewRows
          .map((row) => String(row.studentId || ""))
          .filter(Boolean),
      ),
    [reviewRows],
  );

  const toggleStudentForBulk = (student) => {
    if (isExistingBatchMode && !selectedBatchId) return alert("Please select an existing batch first.");
    const studentId = student._id;
    const existingReviewRow = reviewRows.find(
      (row) => String(row.studentId || "") === String(studentId),
    );
    const assigned = student.assignedPanels || [];
    if (assigned.length < 2) {
      return alert("This student does not have exactly 2 default panels. Assign panels first.");
    }
    const p1 = assignedPanelValue(assigned[0]);
    const p2 = assignedPanelValue(assigned[1]);
    const panel1 = resolvePanel(p1);
    const panel2 = resolvePanel(p2);
    const selectedRubric = rubrics.find((r) => r._id === bulkConfig.rubricId);

    if (existingReviewRow?.type === "existing") {
      return;
    }

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
    return buildTimingConflictMap({ reviewRows, sessions, panels });
  }, [panels, reviewRows, sessions]);

  const publishConflictMap = useMemo(() => {
    return buildPublishConflictMap({
      timingConflictMap,
      reviewRows,
      isExistingBatchMode,
      selectedBatchId,
      bulkConfig: {
        academicSession: bulkConfig.academicSession,
        batchName: bulkConfig.batchName,
        rubricId: bulkConfig.rubricId,
        venue: bulkConfig.venue,
      },
    });
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
      if (batchMode === "new" && !bulkConfig.batchName.trim()) {
        alert("Batch name is required.");
        setSaving(false);
        return;
      }
      const finalBatchId = isExistingBatchMode
        ? selectedBatchId
        : derivedBatchId;

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

  const isPanelReplacementLocked = useMemo(() => {
    if (!editingSession) return false;
    const sessionStart = getSessionStartDateTime(editingSession);
    if (!sessionStart) return true;
    return sessionStart.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
  }, [editingSession]);

  const submitEditSession = async (e) => {
    e.preventDefault();
    const selectedRubric = rubrics.find((r) => r._id === editForm.rubricId);
    const originalPanel1Id = idOf(getPanel(editingSession, 0));
    const originalPanel2Id = idOf(getPanel(editingSession, 1));
    const panelsChanged =
      originalPanel1Id !== String(editForm.panel1Id || "") ||
      originalPanel2Id !== String(editForm.panel2Id || "");

    if (isPanelReplacementLocked && panelsChanged) {
      alert("Panel replacement is only allowed at least 1 week before the session date.");
      return;
    }

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

  const isMyAssignedSession = useCallback((session) => {
    const isPanelAssignment = (session.panels || []).some(
      (panel) => idOf(panel) === currentUserId,
    );
    if (isPanelAssignment) return true;

    const student = getStudent(session);
    return idOf(student?.supervisorId) === currentUserId;
  }, [currentUserId]);

  const visibleSessions = useMemo(
    () =>
      isAdmin && sessionScope === "mine"
        ? sessions.filter(isMyAssignedSession)
        : sessions,
    [isAdmin, isMyAssignedSession, sessionScope, sessions],
  );

  const myAssignedSessionCount = useMemo(
    () => sessions.filter(isMyAssignedSession).length,
    [isMyAssignedSession, sessions],
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
        student?.supervisorId?.name,
        student?.supervisorId?.userId,
        student?.supervisorId?.email,
        session.startTime,
        normalizeDateKey(session.date),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [visibleSessions, searchTerm]);
  const viewerEvaluationBySession = useMemo(() => {
    const nextMap = new Map();

    viewerEvaluations.forEach((evaluation) => {
      const sessionId = idOf(evaluation?.sessionId);
      if (!sessionId || nextMap.has(sessionId)) return;
      nextMap.set(sessionId, evaluation);
    });

    return nextMap;
  }, [viewerEvaluations]);
  const sessionEvaluationsBySession = useMemo(() => {
    const nextMap = new Map();

    sessionEvaluations.forEach((evaluation) => {
      const sessionId = idOf(evaluation?.sessionId);
      if (!sessionId) return;

      const existing = nextMap.get(sessionId) || [];
      existing.push(evaluation);
      nextMap.set(sessionId, existing);
    });

    return nextMap;
  }, [sessionEvaluations]);
  const sessionSortAccessors = useMemo(
    () => ({
      session: (session) => `${session.title || session.sessionType || ""} ${session.batchName || session.batchId || ""}`,
      schedule: (session) => `${normalizeDateKey(session.date)} ${session.startTime || session.time || ""}`,
      student: (session) => {
        const student = getStudent(session);
        const supervisor = student?.supervisorId;
        return `${student?.name || ""} ${student?.matricNumber || student?.userId || ""} ${supervisor?.name || ""} ${supervisor?.userId || ""}`;
      },
      panels: (session) => {
        const supervisor = getStudent(session)?.supervisorId;
        return `${nameOf(getPanel(session, 0))} ${nameOf(getPanel(session, 1))} ${supervisor?.name || ""} ${supervisor?.userId || ""}`;
      },
    }),
    [],
  );
  const {
    sortedItems: sortedSessions,
    sortConfig: sessionSortConfig,
    requestSort: requestSessionSort,
  } = useSortableData(filteredSessions, sessionSortAccessors, { key: "schedule" });

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
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" placeholder="Search student, supervisor, batch, session, date, panel..." />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-gray-50 border-b text-xs text-gray-600 uppercase">
                <tr>
                  <SortableTh className="p-4" sortKey="session" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Session</SortableTh>
                  <SortableTh className="p-4" sortKey="schedule" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Schedule</SortableTh>
                  <SortableTh className="p-4" sortKey="student" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Student</SortableTh>
                  <SortableTh className="p-4" sortKey="panels" sortConfig={sessionSortConfig} onSort={requestSessionSort}>Panels</SortableTh>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedSessions.map((session) => {
                  const sessionId = session._id || session.id;
                  const student = getStudent(session);
                  const supervisor = resolveSupervisor(student);
                  const isSupervisorViewer = idOf(supervisor) === currentUserId;
                  const sessionEnd = getSessionEndDateTime(session);
                  const isSessionLate =
                    sessionEnd && sessionEnd.getTime() < Date.now();
                  const sessionEvaluationItems =
                    sessionEvaluationsBySession.get(String(sessionId)) || [];
                  const latePendingEvaluations = isSessionLate
                    ? sessionEvaluationItems.filter(
                        (evaluation) =>
                          String(evaluation?.status || "").toUpperCase() ===
                          "PENDING",
                      )
                    : [];
                  const latePendingSummary = latePendingEvaluations
                    .map((evaluation) => {
                      const evaluatorName =
                        evaluation?.evaluatorId?.name || "Unknown Evaluator";
                      return evaluation?.formFiller === "Supervisor"
                        ? `SV: ${evaluatorName}`
                        : evaluatorName;
                    })
                    .filter(Boolean);
                  const viewerEvaluation = viewerEvaluationBySession.get(
                    String(sessionId),
                  );
                  const viewerEvaluationStatus = String(
                    viewerEvaluation?.status || "",
                  ).toUpperCase();
                  const isViewerLate =
                    isSessionLate && viewerEvaluationStatus === "PENDING";
                  const viewAction =
                    viewerEvaluationStatus === "COMPLETED"
                      ? {
                          label: "Submitted",
                          icon: Eye,
                          className:
                            "bg-emerald-600 text-white hover:bg-emerald-700",
                          title:
                            "You already submitted your evaluation for this session.",
                        }
                      : isViewerLate
                        ? {
                            label: "Late",
                            icon: AlertTriangle,
                            className:
                              "bg-red-600 text-white hover:bg-red-700",
                            title:
                              "Your evaluation is still pending after the scheduled session end time.",
                          }
                        : viewerEvaluationStatus === "PENDING"
                        ? {
                            label: "Evaluate",
                            icon: ClipboardCheck,
                            className:
                              "bg-amber-500 text-white hover:bg-amber-600",
                            title:
                              "This session still has a pending evaluation assigned to you.",
                          }
                        : {
                            label: "View",
                            icon: Eye,
                            className:
                              "bg-gray-700 text-white hover:bg-gray-800",
                            title: "Open session details.",
                          };
                  return (
                    <tr
                      key={sessionId}
                      className={`${
                        latePendingEvaluations.length
                          ? "bg-red-50/40 hover:bg-red-50/70"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-gray-900">
                            {session.title || session.sessionType}
                          </p>
                          {latePendingEvaluations.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase text-red-700">
                              <AlertTriangle className="w-3 h-3" />
                              Late Pending {latePendingEvaluations.length}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {session.batchName || session.batchId || "No batch"}
                        </p>
                        {latePendingSummary.length > 0 && (
                          <p className="mt-1 text-xs font-semibold text-red-700">
                            Waiting for: {latePendingSummary.join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-700"><div>{normalizeDateKey(session.date)}</div><div className="font-semibold">{session.startTime || session.time} - {session.endTime}</div><a href={formatLink(session.venue || session.googleMeetLink)} target="_blank" rel="noreferrer" className="text-blue-700 font-semibold flex items-center gap-1"><Video className="w-4 h-4" /> Link</a></td>
                      <td className="p-4"><p className="font-bold"><UserProfileLink user={student} fallback="-" className="font-bold" /></p><p className="text-xs text-gray-500">{student?.matricNumber || student?.userId || "-"}</p></td>
                      <td className="p-4 text-sm">
                        <p><UserProfileLink user={getPanel(session, 0)} fallback={nameOf(getPanel(session, 0))} /></p>
                        <p><UserProfileLink user={getPanel(session, 1)} fallback={nameOf(getPanel(session, 1))} /></p>
                        {supervisor && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold uppercase text-emerald-700">
                              SV
                            </span>
                            <UserProfileLink
                              user={supervisor}
                              fallback={nameOf(supervisor)}
                              className="font-semibold text-emerald-800"
                            />
                            {isSupervisorViewer && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                                You
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/panel/sessions/${sessionId}`)}
                            title={viewAction.title}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${viewAction.className}`}
                          >
                            <viewAction.icon className="w-4 h-4" />
                            {viewAction.label}
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
        <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] 2xl:grid-cols-[480px_minmax(0,1fr)] gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="text-lg font-bold mb-4">Batch Mode</h2>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => { setBatchMode("existing"); setSelectedStudentIds([]); setReviewRows([]); }} className={`px-3 py-2 rounded-lg font-bold text-sm ${batchMode === "existing" ? "bg-indigo-600 text-white" : "bg-gray-100"}`}>Use Existing</button>
                <button onClick={() => { setBatchMode("new"); setSelectedBatchId(""); setSelectedStudentIds([]); setReviewRows([]); setBulkConfig((prev) => ({ ...prev, batchName: "", batchId: "", venue: "", date: normalizeDateKey(new Date()), startTime: "09:00" })); }} className={`px-3 py-2 rounded-lg font-bold text-sm ${batchMode === "new" ? "bg-indigo-600 text-white" : "bg-gray-100"}`}>Create New</button>
              </div>

              {isExistingBatchMode && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={batchSearch}
                      onChange={(e) => setBatchSearch(e.target.value)}
                      placeholder="Search batch name, ID, session, or date"
                      className="w-full pl-9 pr-3 py-2 border border-indigo-100 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-white overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-indigo-100 bg-indigo-50/60 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                      <span>Existing Batches</span>
                      <span>{filteredBatches.length} match(es)</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-indigo-50">
                      {filteredBatches.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-500">
                          No batch matches this search.
                        </div>
                      ) : (
                        filteredBatches.map((batch) => {
                          const isSelected =
                            String(selectedBatchId) === String(batch.batchId);
                          const batchDate = normalizeDateKey(
                            batch.date || batch.earliestDate,
                          );
                          const batchType =
                            batch.sessionType?.replaceAll("_", " ") || "Session";

                          return (
                            <button
                              key={batch.batchId}
                              type="button"
                              onClick={() => handleSelectBatch(batch.batchId)}
                              className={`w-full px-3 py-3 text-left transition-colors ${
                                isSelected
                                  ? "bg-indigo-600 text-white"
                                  : "bg-white hover:bg-indigo-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-black truncate">
                                    {batch.batchName || batch.batchId}
                                  </p>
                                  <p
                                    className={`text-xs truncate ${
                                      isSelected ? "text-indigo-100" : "text-gray-500"
                                    }`}
                                  >
                                    {batch.batchId}
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    isSelected
                                      ? "border-indigo-200 text-white"
                                      : "border-indigo-100 bg-indigo-50 text-indigo-700"
                                  }`}
                                >
                                  {batchType}
                                </span>
                              </div>
                              <p
                                className={`mt-2 text-xs ${
                                  isSelected ? "text-indigo-100" : "text-gray-600"
                                }`}
                              >
                                {batchDate} · {batch.academicSession || "No academic session"}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                  {selectedBatch ? (
                    <div className="rounded-lg bg-white border border-indigo-100 p-3 text-xs text-gray-700">
                      <p className="font-black text-gray-900">{selectedBatch.batchName || selectedBatch.batchId}</p>
                      <p>{selectedBatch.batchId}</p>
                      <p>{normalizeDateKey(selectedBatch.date || selectedBatch.earliestDate)} | {selectedBatch.sessionType?.replaceAll("_", " ") || "Session"}</p>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-indigo-700">
                      {filteredBatches.length} matching batch(es) available.
                    </p>
                  )}
                  <button
                    onClick={openEditBatch}
                    disabled={!selectedBatchId}
                    className="w-full px-3 py-2 rounded-lg font-bold text-sm bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Edit Selected Batch
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
              <h2 className="text-lg font-bold">Batch Details</h2>
              <input value={bulkConfig.batchName} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ batchName: e.target.value })} placeholder="Batch Name, e.g. PIXEL" className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <div className="w-full p-2 border rounded-lg bg-gray-50 text-sm disabled:bg-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                  {isExistingBatchMode ? "Batch ID" : "Batch ID (Auto-generated)"}
                </p>
                <p className="font-mono font-semibold text-gray-800 break-all">
                  {visibleBatchId}
                </p>
              </div>
              <input type="date" value={bulkConfig.date} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ date: e.target.value })} className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <input type="time" value={bulkConfig.startTime} disabled={isExistingBatchMode} onChange={(e) => updateBulkConfig({ startTime: e.target.value })} className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                    Slot Duration
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      value={slotDuration}
                      disabled={isExistingBatchMode}
                      onChange={(e) => {
                        const nextDuration = Number(e.target.value);
                        setSlotDuration(nextDuration);
                        localStorage.setItem("admin_slot_duration", e.target.value);
                        setReviewRows((rows) => recalcRows(rows, bulkConfig, nextDuration));
                      }}
                      className="w-full p-2 pr-12 border rounded-lg disabled:bg-gray-100"
                      placeholder="Duration"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                      min
                    </span>
                  </div>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                    Break Between Slots
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={bulkConfig.breakBetweenSlotsMinutes}
                      disabled={isExistingBatchMode}
                      onChange={(e) => updateBulkConfig({ breakBetweenSlotsMinutes: Number(e.target.value) })}
                      className="w-full p-2 pr-12 border rounded-lg disabled:bg-gray-100"
                      placeholder="Break"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                      min
                    </span>
                  </div>
                </label>
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
              <p className="mb-3 text-xs text-gray-500">
                Select from this list only. Profile links remain available after the student is placed in the review panel.
              </p>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-[88px_minmax(0,1.25fr)_minmax(0,1fr)_74px] gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
                  <span>ID</span>
                  <span>Student</span>
                  <span>Default Panels</span>
                  <span className="text-right">State</span>
                </div>
              <div className="max-h-[40rem] overflow-y-auto divide-y divide-gray-100">
                {filteredBulkStudents.length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                    No students match this search.
                  </div>
                )}
                {filteredBulkStudents.map((student) => {
                  const defaultPanels = assignedPanelNames(student);
                  const isSelected = reviewStudentIds.has(String(student._id));
                  const hasExistingRow = reviewRows.some(
                    (row) =>
                      String(row.studentId || "") === String(student._id) &&
                      row.type === "existing",
                  );

                  return (
                    <button
                      key={student._id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleStudentForBulk(student)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleStudentForBulk(student);
                        }
                      }}
                      title={student.researchTitle || student.name || "Student"}
                      className={`w-full grid grid-cols-[88px_minmax(0,1.25fr)_minmax(0,1fr)_74px] gap-3 px-3 py-3 text-left cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-50"
                          : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 break-all">
                          {student.matricNumber || student.userId || "-"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate">
                          {student.name || student.userId || "Student"}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {student.researchTitle || "No research title"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[11px] font-semibold truncate ${defaultPanels.length === 2 ? "text-green-700" : "text-amber-700"}`}>
                          {defaultPanels.length ? defaultPanels.join(" / ") : "Not assigned"}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {student.email || "-"}
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <span
                          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                            isSelected
                              ? "border-indigo-200 bg-indigo-100 text-indigo-700"
                              : "border-gray-200 bg-gray-50 text-gray-500"
                          }`}
                        >
                          {hasExistingRow ? "Selected" : isSelected ? "Selected" : "Add"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
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
                const student = resolveStudent(row.studentId);
                const supervisor = resolveSupervisor(student);
                return (
                  <div key={row.key} draggable onDragStart={() => setDragIndex(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragIndex !== null) moveRow(dragIndex, index); setDragIndex(null); }} className={`p-4 grid grid-cols-1 lg:grid-cols-[44px_90px_1fr_140px_180px_120px] gap-3 items-center ${errors.length ? "bg-red-50 border-l-4 border-red-500" : row.type === "existing" ? "bg-blue-50/30" : "bg-white"}`}>
                    <div className="flex items-center gap-2 text-gray-500"><GripVertical className="w-5 h-5" /><span className="font-bold">#{row.slotNo}</span></div>
                    <div><p className="font-bold text-gray-900">{row.startTime}</p><p className="text-xs text-gray-500">to {row.endTime}</p></div>
                    <div>
                      <p className="font-bold text-gray-900">
                        <UserProfileLink
                          user={resolveStudent(row.studentId)}
                          fallback={row.studentName}
                          className="font-bold"
                        />
                      </p>
                      <p className="text-xs text-gray-500">{row.matricNumber} · {row.type === "existing" ? "Scheduled" : "New Draft"}</p>
                      {supervisor && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold uppercase text-emerald-700">
                            SV
                          </span>
                          <UserProfileLink
                            user={supervisor}
                            fallback={nameOf(supervisor)}
                            className="font-semibold text-emerald-800"
                          />
                        </div>
                      )}
                      {errors.map((err) => <p key={err} className="text-xs text-red-700 font-semibold mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {err}</p>)}
                    </div>
                    <div><p className="text-xs text-gray-500 uppercase font-bold">Date</p><p className="font-semibold">{row.date}</p></div>
                    <div className="text-sm">
                      <p>
                        <UserProfileLink
                          user={resolvePanel(row.panel1Id)}
                          fallback={row.panel1Name}
                        />
                      </p>
                      <p>
                        <UserProfileLink
                          user={resolvePanel(row.panel2Id)}
                          fallback={row.panel2Name}
                        />
                      </p>
                    </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><select value={editForm.panel1Id} disabled={isPanelReplacementLocked} onChange={(e) => setEditForm({ ...editForm, panel1Id: e.target.value })} className="p-2 border rounded-lg disabled:bg-gray-100 disabled:text-gray-500"><option value="">Panel 1</option>{panels.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select><select value={editForm.panel2Id} disabled={isPanelReplacementLocked} onChange={(e) => setEditForm({ ...editForm, panel2Id: e.target.value })} className="p-2 border rounded-lg disabled:bg-gray-100 disabled:text-gray-500"><option value="">Panel 2</option>{panels.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
            <p className={`text-xs border p-3 rounded-lg ${isPanelReplacementLocked ? "text-red-700 bg-red-50 border-red-200" : "text-amber-700 bg-amber-50 border-amber-200"}`}>{isPanelReplacementLocked ? "Panel replacement is locked because this session is less than 1 week away. If a panel is replaced earlier, evaluations authored by removed panels are discarded and the new panel receives a pending evaluation." : "Panel replacement is only allowed at least 1 week before the session date. If a panel is replaced, evaluations authored by removed panels are discarded and the new panel receives a pending evaluation."}</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Slot Duration
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    value={batchForm.slotDurationMinutes || ""}
                    onChange={(e) => setBatchForm({ ...batchForm, slotDurationMinutes: Number(e.target.value) })}
                    className="w-full p-2 pr-12 border rounded-lg"
                    placeholder="Duration"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                    min
                  </span>
                </div>
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Break Between Slots
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={batchForm.breakBetweenSlotsMinutes ?? ""}
                    onChange={(e) => setBatchForm({ ...batchForm, breakBetweenSlotsMinutes: Number(e.target.value) })}
                    className="w-full p-2 pr-12 border rounded-lg"
                    placeholder="Break"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                    min
                  </span>
                </div>
              </label>
            </div>
            <input value={batchForm.googleMeetLink || ""} onChange={(e) => setBatchForm({ ...batchForm, googleMeetLink: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Meeting link" />
            <button className="w-full py-3 bg-amber-600 text-white rounded-lg font-bold">Save Batch</button>
          </form>
        </div>
      )}
    </div>
  );
}
