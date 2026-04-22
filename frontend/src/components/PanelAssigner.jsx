// src/components/PanelAssigner.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

const PanelAssigner = ({ studentTitle, panelCandidates }) => {
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

  const fetchExpertise = async (panelName) => {
    if (!panelName) return;
    setLoading(true);
    try {
      // Call the Express backend we just created
      const res = await axios.get(
        `http://localhost:5000/api/expertise?panelName=${panelName}`,
      );
      const fetchedTags = res.data.expertiseTags;

      setExpertise(fetchedTags);
      calculateMatch(fetchedTags, studentTitle);
    } catch (error) {
      console.error("Failed to fetch expertise", error);
    } finally {
      setLoading(false);
    }
  };

  // Run fetch whenever a new panel is selected from the dropdown
  useEffect(() => {
    fetchExpertise(selectedPanel);
  }, [selectedPanel]);

  return (
    <div className="p-4 border rounded shadow-sm bg-white">
      <h3 className="text-lg font-bold mb-2">Assign Panel</h3>

      <div className="mb-4">
        <p className="text-sm text-gray-600">Student Research Title:</p>
        <p className="font-semibold text-blue-700">{studentTitle}</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm mb-1">Select Panel Evaluator:</label>
        <select
          className="w-full p-2 border rounded"
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
        <p className="text-sm text-gray-500">
          Fetching expertise from UTHM Community...
        </p>
      )}

      {!loading && expertise.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 border rounded">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold">Panel Expertise:</h4>
            <span
              className={`px-2 py-1 rounded text-white text-sm ${matchScore > 50 ? "bg-green-500" : "bg-orange-500"}`}
            >
              Title Match: {matchScore}%
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {expertise.map((tag, idx) => (
              <span
                key={idx}
                className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelAssigner;
