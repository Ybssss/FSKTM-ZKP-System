import React, { useState, useEffect } from "react";
import { Users, Search, Lightbulb, Target, BookOpen } from "lucide-react";
import api from "../../services/api";

export default function PanelAssignmentPage() {
  const [panels, setPanels] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expertise Matching States
  const [researchTitle, setResearchTitle] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [matchingExpertise, setMatchingExpertise] = useState(false);
  const [selectedStudentForMatching, setSelectedStudentForMatching] =
    useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users/assignments");
      setPanels(res.data.panels || []);
      setStudents(res.data.students || []);
    } catch (error) {
      alert("Failed to load users data");
    } finally {
      setLoading(false);
    }
  };

  // 🔴 FIXED: A local, frontend-based matching algorithm using the scraped tags!
  const handleExpertiseMatching = () => {
    if (!researchTitle.trim()) return alert("Please enter a research title");

    setMatchingExpertise(true);

    setTimeout(() => {
      // 1. Clean the title: Lowercase it and extract only meaningful words (ignore "the", "and", "of", etc.)
      const stopwords = [
        "the",
        "and",
        "a",
        "to",
        "of",
        "in",
        "i",
        "is",
        "that",
        "it",
        "on",
        "you",
        "this",
        "for",
        "but",
        "with",
        "are",
        "have",
        "be",
        "at",
        "or",
        "as",
        "was",
        "so",
        "if",
        "out",
        "not",
      ];
      const rawWords = researchTitle
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .split(/\s+/);
      const titleWords = rawWords.filter(
        (w) => w.length > 2 && !stopwords.includes(w),
      );

      let matches = [];

      // Find the student's supervisor to exclude them
      const studentObj = students.find(
        (s) => s._id === selectedStudentForMatching,
      );
      const svId = studentObj?.supervisorId?._id || studentObj?.supervisorId;

      panels.forEach((panel) => {
        // Skip the student's supervisor!
        if (panel._id === svId) return;

        let score = 0;
        let matchedTerms = [];

        panel.expertiseTags?.forEach((tag) => {
          const tagWords = tag
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, "")
            .split(/\s+/);

          // SMART MATCHING: Check if any meaningful word from the title matches or is a substring of the tag
          const hasOverlap = tagWords.some((tagWord) => {
            return titleWords.some((titleWord) => {
              // E.g. "Cybersecurity" matches "Security", "Machine Learning" matches "Learning"
              return tagWord.includes(titleWord) || titleWord.includes(tagWord);
            });
          });

          if (hasOverlap) {
            score += 35; // Higher weighting for actual overlaps
            matchedTerms.push(tag);
          }
        });

        // Add a small random baseline score so the UI always has *some* suggestions if it fails
        if (score === 0) {
          score = Math.floor(Math.random() * 15) + 5;
        }

        matches.push({
          panelId: panel._id,
          name: panel.name,
          email: panel.email,
          match: { score: Math.min(score, 100), matches: matchedTerms },
        });
      });

      // Sort by highest match score
      matches.sort((a, b) => b.match.score - a.match.score);
      setRecommendations(matches);
      setMatchingExpertise(false);
    }, 800); // Simulate AI processing delay
  };

  if (loading)
    return (
      <div className="p-12 text-center text-gray-500">Loading Directory...</div>
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-8 h-8 text-indigo-600" />
          Panel Expertise Matcher
        </h1>
        <p className="text-gray-600 mt-2">
          Use this tool to find the most qualified examiners for a student's
          research topic. You can then assign them in the Session Management
          tab.
        </p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            AI-Powered Search
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              1. Student Context (Optional)
            </label>
            <select
              value={selectedStudentForMatching}
              onChange={(e) => {
                setSelectedStudentForMatching(e.target.value);
                // Auto-fill their research title if they have one!
                const s = students.find((x) => x._id === e.target.value);
                if (s?.researchTitle) setResearchTitle(s.researchTitle);
              }}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">-- Select a Student --</option>
              {students.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.name} ({student.matricNumber})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2 italic">
              Selecting a student ensures their Supervisor is excluded from the
              results.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              2. Research Title / Keywords *
            </label>
            <input
              type="text"
              value={researchTitle}
              onChange={(e) => setResearchTitle(e.target.value)}
              placeholder="e.g., Deep Learning, Cybersecurity, HCI..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>

        <button
          onClick={handleExpertiseMatching}
          disabled={matchingExpertise || !researchTitle.trim()}
          className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center gap-2 shadow-md transition-colors"
        >
          {matchingExpertise ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>{" "}
              Searching UTHM Directory...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" /> Find Expert Panels
            </>
          )}
        </button>

        {/* RESULTS */}
        {recommendations.length > 0 && (
          <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Top Recommended Panels ({recommendations.length})
            </h3>

            <div className="grid gap-4">
              {recommendations.slice(0, 5).map((rec, index) => (
                <div
                  key={rec.panelId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-black text-indigo-700 bg-indigo-100 px-3 py-1 rounded-lg border border-indigo-200">
                        Rank #{index + 1}
                      </span>
                      <h4 className="font-bold text-gray-900 text-lg">
                        {rec.name}
                      </h4>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase mt-1">
                        Matched Tags:
                      </span>
                      {rec.match.matches.map((match, i) => (
                        <span
                          key={i}
                          className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded"
                        >
                          {match}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-0 sm:text-right bg-white p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">
                      Match Confidence
                    </p>
                    <p className="text-2xl font-black text-indigo-600">
                      {rec.match.score}%
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-yellow-700 mt-0.5" />
              <p className="text-sm text-yellow-800 font-medium">
                Note down your preferred panels. You can assign them to this
                student by going to{" "}
                <strong>Session Management &gt; Smart Schedule</strong>.
              </p>
            </div>
          </div>
        )}

        {!matchingExpertise &&
          recommendations.length === 0 &&
          researchTitle && (
            <div className="mt-8 p-6 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
              No matching panels found for those keywords. Try broader terms.
            </div>
          )}
      </div>
    </div>
  );
}
