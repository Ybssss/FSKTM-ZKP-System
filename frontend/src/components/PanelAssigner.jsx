// src/components/PanelAssigner.jsx
import React, { useState, useEffect } from "react";

const PanelAssigner = ({ studentTitle, panelCandidates, onAssign }) => {
  const [selectedPanel, setSelectedPanel] = useState("");
  const [expertise, setExpertise] = useState([]);
  const [matchScore, setMatchScore] = useState(0);
  const [loading, setLoading] = useState(false);

  // Simple algorithm to check how many expertise tags match the Research Title
  const calculateMatch = (tags, title) => {
    if (!tags || tags.length === 0) return 0;

    const titleWords = title.toLowerCase().split(" ");
    let matches = 0;

    tags.forEach((tag) => {
      const tagLower = tag.toLowerCase();
      // Check if the expertise tag exists anywhere in the student's title
      if (
        titleWords.some(
          (word) => tagLower.includes(word) || word.includes(tagLower),
        )
      ) {
        matches++;
      }
    });

    // Calculate percentage (max 100%)
    const percentage = Math.min(Math.round((matches / tags.length) * 100), 100);
    setMatchScore(percentage);
  };

  const loadStoredExpertise = (panelName) => {
    if (!panelName) {
      setExpertise([]);
      setMatchScore(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const selectedCandidate = panelCandidates.find(
      (panel) => panel.name === panelName,
    );
    const storedTags = Array.isArray(selectedCandidate?.expertiseTags)
      ? selectedCandidate.expertiseTags
      : [];

    setExpertise(storedTags);
    calculateMatch(storedTags, studentTitle);
    setLoading(false);
  };

  // Load stored database expertise whenever a new panel is selected.
  useEffect(() => {
    loadStoredExpertise(selectedPanel);
  }, [selectedPanel, panelCandidates, studentTitle]);

  const handleConfirm = () => {
    if (onAssign && selectedPanel) {
      // Find the full panel object to pass back to the parent component
      const fullPanelObject = panelCandidates.find(
        (p) => p.name === selectedPanel,
      );
      onAssign(fullPanelObject);
    }
  };

  return (
    <div className="p-6 border-2 border-gray-200 rounded-lg shadow-md bg-white w-full">
      <h3 className="text-xl font-bold mb-4 text-gray-800">
        Assign Panel Expert
      </h3>

      <div className="mb-5 bg-blue-50 p-4 rounded-md border border-blue-100">
        <p className="text-sm text-gray-600 mb-1">Student Research Title:</p>
        <p className="font-semibold text-blue-800 text-lg">{studentTitle}</p>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium mb-2 text-gray-700">
          Select Panel Evaluator:
        </label>
        <select
          className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 text-base"
          value={selectedPanel}
          onChange={(e) => setSelectedPanel(e.target.value)}
        >
          <option value="">-- Choose a Panel --</option>
          {panelCandidates.map((panel, idx) => (
            <option key={idx} value={panel.name}>
              {panel.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="mt-4 p-4 text-center text-blue-600 animate-pulse bg-blue-50 rounded-md">
          Loading stored panel expertise...
        </div>
      )}

      {!loading && expertise.length > 0 && selectedPanel && (
        <div className="mt-6 p-5 bg-gray-50 border-2 border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-800 text-lg">
              Panel Expertise Match:
            </h4>
            <span
              className={`px-3 py-1.5 rounded-md text-white font-bold text-sm shadow-sm ${
                matchScore >= 50 ? "bg-green-600" : "bg-orange-500"
              }`}
            >
              Title Match: {matchScore}%
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {expertise.map((tag, idx) => (
              <span
                key={idx}
                className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1.5 rounded-md border border-blue-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* NEW: Confirmation Button */}
      <button
        onClick={handleConfirm}
        disabled={!selectedPanel}
        className={`mt-6 w-full py-3 px-4 rounded-md text-white font-bold text-lg transition-all ${
          selectedPanel
            ? "bg-blue-600 hover:bg-blue-700 shadow-md cursor-pointer"
            : "bg-gray-300 cursor-not-allowed"
        }`}
      >
        Confirm Panel Assignment
      </button>
    </div>
  );
};

export default PanelAssigner;
