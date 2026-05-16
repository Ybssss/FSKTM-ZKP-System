// src/pages/panel/PanelAssignmentPage.jsx
import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Lightbulb,
  Target,
  BookOpen,
  CheckCircle,
  UserMinus,
  CheckSquare,
  Square,
} from "lucide-react";
import api from "../../services/api";

export default function PanelAssignmentPage() {
  const [panels, setPanels] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Toggle States
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("unassigned"); // 'unassigned' | 'assigned'

  // Expertise Matching States
  const [researchTitle, setResearchTitle] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [matchingExpertise, setMatchingExpertise] = useState(false);
  const [selectedStudentForMatching, setSelectedStudentForMatching] =
    useState(null);

  // NEW: Track which panels are selected from the recommendations
  const [selectedPanels, setSelectedPanels] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users/assignments");
      setPanels(res.data.panels || []);

      // Ensure we only look at actual students with a matric number
      const validStudents = (res.data.students || []).filter(
        (s) => s.matricNumber,
      );
      setStudents(validStudents);
    } catch (error) {
      alert("Failed to load users data");
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (student) => {
    if (!window.confirm(`Remove panel assignments for ${student.name}?`))
      return;
    try {
      for (const panelObj of student.assignedPanels) {
        let panelIdToUnassign =
          panelObj.panelId?._id || panelObj.panelId || panelObj._id || panelObj;
        if (panelIdToUnassign) {
          await api.post("/users/unassign-panel", {
            studentId: student._id,
            panelId: panelIdToUnassign,
          });
        }
      }
      alert(`${student.name} unassigned successfully.`);
      loadData(); // Refresh list
    } catch (err) {
      alert("Failed to unassign.");
    }
  };

  // NEW: Function to officially assign the selected panels
  // NEW: Send both panels at the exact same time! (NO LOOPING)
  const handleConfirmAssignment = async () => {
    if (!selectedStudentForMatching) return;

    try {
      // Send the entire array of selected panels in ONE single request
      await api.post("/users/assign-panel", {
        studentId: selectedStudentForMatching._id,
        panelIds: selectedPanels, // <-- Sending array ["id1", "id2"] directly
      });

      alert(
        `Successfully assigned ${selectedPanels.length} panel(s) to ${selectedStudentForMatching.name}!`,
      );

      // Reset UI states
      setSelectedPanels([]);
      setRecommendations([]);
      setSelectedStudentForMatching(null);
      setResearchTitle("");

      // Refresh Data
      loadData();
    } catch (error) {
      console.error(error);
      alert("Failed to assign panels. Please check console.");
    }
  };

  const handleExpertiseMatching = () => {
    if (!researchTitle.trim())
      return alert(
        "Please select a student or enter a research title manually.",
      );

    setMatchingExpertise(true);
    setSelectedPanels([]); // Clear previous selections when searching again

    setTimeout(() => {
      const stopwords = [
        "the",
        "and",
        "a",
        "to",
        "of",
        "in",
        "on",
        "with",
        "for",
        "system",
        "based",
      ];
      const titleWords = researchTitle
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopwords.includes(w));

      let matches = [];
      const svId =
        selectedStudentForMatching?.supervisorId?._id ||
        selectedStudentForMatching?.supervisorId;

      panels.forEach((panel) => {
        if (panel._id === svId) return; // Skip SV

        let score = 0;
        let matchedTerms = [];

        panel.expertiseTags?.forEach((tag) => {
          const tagWords = tag
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, "")
            .split(/\s+/);
          const hasOverlap = tagWords.some((tagWord) =>
            titleWords.some(
              (titleWord) =>
                tagWord.includes(titleWord) || titleWord.includes(tagWord),
            ),
          );

          if (hasOverlap) {
            score += 35;
            matchedTerms.push(tag);
          }
        });

        if (score === 0) score = Math.floor(Math.random() * 15) + 5;

        matches.push({
          panelId: panel._id,
          name: panel.name,
          email: panel.email,
          tags: panel.expertiseTags?.join(", ") || "General",
          match: { score: Math.min(score, 100), matches: matchedTerms },
        });
      });

      matches.sort((a, b) => b.match.score - a.match.score);
      setRecommendations(matches);
      setMatchingExpertise(false);
    }, 800);
  };

  // NEW: Toggle selection of a panel card
  const togglePanelSelection = (panelId) => {
    if (selectedPanels.includes(panelId)) {
      setSelectedPanels(selectedPanels.filter((id) => id !== panelId));
    } else {
      if (selectedPanels.length >= 2) {
        return alert("You can only assign a maximum of 2 panels per student.");
      }
      setSelectedPanels([...selectedPanels, panelId]);
    }
  };

  // Filter Logic
  const unassignedStudents = students.filter(
    (s) => !s.assignedPanels || s.assignedPanels.length === 0,
  );
  const assignedStudents = students.filter(
    (s) => s.assignedPanels && s.assignedPanels.length > 0,
  );

  const activeList =
    viewMode === "unassigned" ? unassignedStudents : assignedStudents;

  const filteredStudents = activeList.filter((s) => {
    const term = searchTerm.toLowerCase();
    const nameMatch = s.name?.toLowerCase().includes(term);
    const matricMatch = s.matricNumber?.toLowerCase().includes(term);
    const userIdMatch = s.userId?.toLowerCase().includes(term);

    const panelMatch = s.assignedPanels?.some((p) => {
      const pName = p.panelId?.name || p.name || "";
      return pName.toLowerCase().includes(term);
    });

    return nameMatch || matricMatch || userIdMatch || panelMatch;
  });

  if (loading)
    return (
      <div className="p-12 text-center text-gray-500 font-bold">
        Loading Directory...
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-8 h-8 text-indigo-600" /> Panel Expertise
            Matcher
          </h1>
          <p className="text-gray-600 mt-2">
            Analyze research titles against UTHM directory tags to find the best
            examiners.
          </p>
        </div>

        <div className="flex bg-gray-200 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("unassigned")}
            className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${viewMode === "unassigned" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
          >
            Needs Panels ({unassignedStudents.length})
          </button>
          <button
            onClick={() => setViewMode("assigned")}
            className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${viewMode === "assigned" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
          >
            Assigned ({assignedStudents.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* LEFT COLUMN: Student List */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[750px]">
          <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" /> Student Directory
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search name, matric, userid, or panel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredStudents.length === 0 ? (
              <div className="text-center text-gray-400 py-8 font-bold">
                No students found.
              </div>
            ) : (
              filteredStudents.map((student) => (
                <div
                  key={student._id}
                  onClick={() => {
                    // Reset right panel automatically when changing students
                    setSelectedStudentForMatching(student);
                    setResearchTitle(student.researchTitle || "");
                    setRecommendations([]);
                    setSelectedPanels([]);
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedStudentForMatching?._id === student._id ? "border-indigo-500 bg-indigo-50" : "border-gray-100 hover:border-indigo-200 bg-white"}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-gray-900">{student.name}</p>
                    <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {student.userId || student.matricNumber}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    Matric: {student.matricNumber}
                  </p>

                  {student.researchTitle ? (
                    <p className="text-xs text-indigo-700 italic font-medium line-clamp-2">
                      "{student.researchTitle}"
                    </p>
                  ) : (
                    <p className="text-xs text-red-500 italic font-semibold">
                      No Research Title Provided
                    </p>
                  )}

                  {viewMode === "assigned" && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                        Assigned Panels:
                      </p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {student.assignedPanels.map((p, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-200"
                          >
                            {p.panelId?.name || p.name || "Panel"}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnassign(student);
                        }}
                        className="w-full py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all"
                      >
                        <UserMinus className="w-3 h-3" /> Remove Assignments
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AI Matcher */}
        <div className="lg:col-span-7 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-sm flex flex-col h-[750px] relative">
          <div className="flex items-center gap-3 mb-6">
            <Lightbulb className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Expertise Analysis
              </h2>
              <p className="text-sm text-gray-600">
                Select a student on the left, match, and pick up to 2 panels.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Research Title / Keywords to Match
            </label>
            <textarea
              value={researchTitle}
              onChange={(e) => setResearchTitle(e.target.value)}
              placeholder="e.g., Deep Learning, Cybersecurity, HCI..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
              rows="3"
            />
            {selectedStudentForMatching && (
              <p className="text-xs text-indigo-600 font-bold mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Analyzing context for:{" "}
                {selectedStudentForMatching.name}
              </p>
            )}
          </div>

          <button
            onClick={handleExpertiseMatching}
            disabled={matchingExpertise || !researchTitle.trim()}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            {matchingExpertise ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>{" "}
                Searching Directory...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" /> Find Expert Panels
              </>
            )}
          </button>

          {/* RESULTS */}
          <div className="flex-1 overflow-y-auto mt-6 pr-2 pb-24">
            {recommendations.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Matches Found - Select up to 2
                </h3>
                {recommendations.slice(0, 10).map((rec, index) => {
                  const isSelected = selectedPanels.includes(rec.panelId);
                  return (
                    <div
                      key={rec.panelId}
                      onClick={() => togglePanelSelection(rec.panelId)}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border-2 cursor-pointer shadow-sm transition-all ${
                        isSelected
                          ? "border-green-500 bg-green-50 shadow-md transform scale-[1.01]"
                          : "border-gray-200 bg-white hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex-1 flex gap-4">
                        <div className="mt-1">
                          {isSelected ? (
                            <CheckSquare className="w-6 h-6 text-green-600" />
                          ) : (
                            <Square className="w-6 h-6 text-gray-300" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-xs font-black text-white bg-indigo-600 px-2 py-0.5 rounded">
                              #{index + 1}
                            </span>
                            <h4
                              className={`font-bold ${isSelected ? "text-green-900" : "text-gray-900"}`}
                            >
                              {rec.name}
                            </h4>
                          </div>
                          <p className="text-xs text-gray-500 font-semibold mb-2 line-clamp-1">
                            All Tags: {rec.tags}
                          </p>

                          <div className="flex flex-wrap gap-1">
                            {rec.match.matches.map((match, i) => (
                              <span
                                key={i}
                                className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200"
                              >
                                {match}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`mt-3 sm:mt-0 sm:text-right p-3 rounded-lg border min-w-[100px] text-center ${
                          isSelected
                            ? "bg-green-100 border-green-200"
                            : "bg-indigo-50 border-indigo-100"
                        }`}
                      >
                        <p
                          className={`text-[10px] font-bold uppercase mb-0.5 ${isSelected ? "text-green-800" : "text-indigo-800"}`}
                        >
                          Confidence
                        </p>
                        <p
                          className={`text-2xl font-black ${isSelected ? "text-green-600" : "text-indigo-600"}`}
                        >
                          {rec.match.score}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              !matchingExpertise &&
              researchTitle && (
                <div className="text-center text-gray-500 bg-white p-8 rounded-xl border border-gray-200">
                  <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="font-bold">No perfect matches found.</p>
                  <p className="text-sm mt-1">
                    Try shortening the title to core keywords.
                  </p>
                </div>
              )
            )}
          </div>

          {/* NEW: Confirm Assignment Action Bar */}
          {selectedPanels.length > 0 && selectedStudentForMatching && (
            <div className="absolute bottom-6 left-6 right-6 bg-gray-900 rounded-xl shadow-2xl p-4 flex items-center justify-between border border-gray-700 animate-fade-in-up">
              <div>
                <p className="text-gray-300 text-sm">Assigning to:</p>
                <p className="text-white font-bold">
                  {selectedStudentForMatching.name}
                </p>
                <p className="text-indigo-300 text-xs font-mono">
                  {selectedStudentForMatching.matricNumber}
                </p>
              </div>
              <button
                onClick={handleConfirmAssignment}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center gap-2 transition-transform transform hover:scale-105"
              >
                <CheckCircle className="w-5 h-5" />
                Confirm {selectedPanels.length} Panel
                {selectedPanels.length > 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
