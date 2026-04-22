import React, { useState } from "react";
import axios from "axios";

// The 5-tier scale from the UTHM forms
const SCALE = [
  { label: "Exemplary", value: 4 },
  { label: "Proficient", value: 3 },
  { label: "Satisfactory", value: 2 },
  { label: "Foundational", value: 1 },
  { label: "Novice", value: 0 },
];

// Sample criteria from the PDF (You can fetch this from the DB based on sessionType)
const CRITERIA = [
  { id: "crit_a", title: "CRITERIA A: PROPOSED RESEARCH TITLE" },
  { id: "crit_b", title: "CRITERIA B: ABSTRACT" },
  { id: "crit_c", title: "CRITERIA C: PROBLEM STATEMENT" },
  { id: "crit_d", title: "CRITERIA D: METHODOLOGY" },
];

const EvaluationRubric = ({ sessionId, studentName, sessionType }) => {
  const [scores, setScores] = useState({});
  const [overallComments, setOverallComments] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-calculate totals
  const totalMarks = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxMarks = CRITERIA.length * 4;
  const percentage =
    maxMarks > 0 ? ((totalMarks / maxMarks) * 100).toFixed(2) : 0;

  const handleScoreChange = (criteriaId, value) => {
    setScores((prev) => ({ ...prev, [criteriaId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.keys(scores).length < CRITERIA.length) {
      alert("Please score all criteria before submitting.");
      return;
    }

    setLoading(true);
    try {
      // Send to the Express backend
      await axios.post("http://localhost:5000/api/evaluation/submit", {
        sessionId,
        rubricScores: scores,
        totalMarks: percentage, // Sending as % for the UTHM Grade Calculator
        overallComments,
      });
      alert(
        "Evaluation submitted successfully! Total Marks: " + percentage + "%",
      );
    } catch (error) {
      alert("Error submitting evaluation: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow-lg rounded-lg mt-6">
      <div className="border-b-4 border-blue-800 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Postgraduate Evaluation Form
        </h2>
        <p className="text-gray-600">
          Student: <span className="font-semibold">{studentName}</span> |
          Session: <span className="font-semibold">{sessionType}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="p-3 border">Criteria</th>
                {SCALE.map((s) => (
                  <th key={s.value} className="p-3 border text-center">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((crit) => (
                <tr key={crit.id} className="hover:bg-gray-50 border-b">
                  <td className="p-3 font-semibold text-sm w-1/3">
                    {crit.title}
                  </td>
                  {SCALE.map((s) => (
                    <td
                      key={s.value}
                      className="p-3 text-center border-l border-r"
                    >
                      <input
                        type="radio"
                        name={crit.id}
                        value={s.value}
                        className="w-5 h-5 text-blue-600 cursor-pointer"
                        onChange={() => handleScoreChange(crit.id, s.value)}
                        required
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Live Score Tracker */}
        <div className="bg-blue-50 p-4 rounded-md flex justify-between items-center mb-6 border border-blue-200">
          <span className="font-bold text-blue-900">Calculated Score:</span>
          <span className="text-2xl font-black text-blue-700">
            {percentage}%
          </span>
        </div>

        {/* Full-Text Indexed Comments */}
        <div className="mb-6">
          <label className="block font-bold text-gray-700 mb-2">
            Overall Comments & Feedback (Indexed for Search)
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            rows="5"
            placeholder="Write constructive feedback here. This will be searchable in future semesters..."
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
            required
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700 transition"
        >
          {loading ? "Saving Evaluation..." : "Submit Evaluation"}
        </button>
      </form>
    </div>
  );
};

export default EvaluationRubric;
